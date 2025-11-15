/**
 * Health Check Avancé pour le Backend
 * 
 * Vérifie:
 * - Connexion à la base de données
 * - Connexion à Supabase
 * - Espace disque (si disponible)
 * - Mémoire disponible
 * - Pool de connexions
 */

import { Request, Response } from 'express';
import pool from '../config/db.js';
import { supabase } from '../config/supabase.js';
import os from 'os';
import logger from '../utils/logger.js';

interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  checks: {
    database?: CheckResult;
    supabase?: CheckResult;
    disk?: CheckResult;
    memory?: CheckResult;
    pool?: CheckResult;
  };
}

interface CheckResult {
  status: 'ok' | 'warning' | 'error';
  message?: string;
  latency?: number;
  details?: Record<string, any>;
}

export async function advancedHealthCheck(req: Request, res: Response): Promise<void> {
  const checks: HealthCheckResult['checks'] = {};
  let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

  // 1. Vérifier la base de données
  try {
    const startTime = Date.now();
    const result = await pool.query('SELECT NOW() as current_time, version() as pg_version');
    const latency = Date.now() - startTime;

    checks.database = {
      status: latency < 100 ? 'ok' : latency < 500 ? 'warning' : 'error',
      latency,
      details: {
        version: result.rows[0]?.pg_version?.split(' ')[0] || 'unknown',
      },
    };

    if (checks.database.status !== 'ok') {
      overallStatus = checks.database.status === 'warning' ? 'degraded' : 'unhealthy';
    }
  } catch (error: any) {
    checks.database = {
      status: 'error',
      message: error.message,
    };
    overallStatus = 'unhealthy';
  }

  // 2. Vérifier Supabase
  try {
    const startTime = Date.now();
    const { error } = await supabase.from('users').select('id').limit(1);
    const latency = Date.now() - startTime;

    // Ignorer l'erreur PGRST116 (table vide)
    const isError = error && error.code !== 'PGRST116';

    checks.supabase = {
      status: isError ? 'error' : latency < 200 ? 'ok' : latency < 1000 ? 'warning' : 'error',
      latency,
      message: isError ? error.message : undefined,
    };

    if (checks.supabase.status !== 'ok') {
      overallStatus = checks.supabase.status === 'warning' ? 'degraded' : 'unhealthy';
    }
  } catch (error: any) {
    checks.supabase = {
      status: 'error',
      message: error.message,
    };
    overallStatus = 'unhealthy';
  }

  // 3. Vérifier l'espace disque (approximation basée sur la mémoire système)
  // Note: Node.js natif ne peut pas facilement vérifier l'espace disque de manière cross-platform
  // Cette vérification est simplifiée et peut ne pas être précise sur tous les systèmes
  try {
    // Utiliser os.freemem() comme approximation (ce n'est pas l'espace disque mais la mémoire)
    // Pour une vraie vérification du disque, il faudrait utiliser une bibliothèque externe
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const memoryUsagePercent = ((totalMemory - freeMemory) / totalMemory) * 100;

    // Note: Ceci vérifie la mémoire, pas le disque
    // Pour une vraie vérification du disque, installer: npm install check-disk-space
    checks.disk = {
      status: 'warning',
      message: 'Disk space check not implemented (requires external library)',
      details: {
        note: 'This check is a placeholder. Install "check-disk-space" package for real disk space monitoring.',
      },
    };
  } catch (error: any) {
    checks.disk = {
      status: 'warning',
      message: 'Could not check disk space',
    };
  }

  // 4. Vérifier la mémoire
  try {
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const usagePercent = (usedMemory / totalMemory) * 100;

    checks.memory = {
      status: usagePercent < 80 ? 'ok' : usagePercent < 90 ? 'warning' : 'error',
      details: {
        total: formatBytes(totalMemory),
        free: formatBytes(freeMemory),
        used: formatBytes(usedMemory),
        usagePercent: usagePercent.toFixed(2),
      },
    };

    if (checks.memory.status !== 'ok') {
      overallStatus = checks.memory.status === 'warning' ? 'degraded' : 'unhealthy';
    }
  } catch (error: any) {
    checks.memory = {
      status: 'warning',
      message: 'Could not check memory',
    };
  }

  // 5. Vérifier le pool de connexions
  try {
    const poolInfo = pool as any;
    const totalConnections = poolInfo.totalCount || poolInfo._totalCount || 0;
    const idleConnections = poolInfo.idleCount || poolInfo._idleCount || 0;
    const waitingCount = poolInfo.waitingCount || poolInfo._waitingCount || 0;

    checks.pool = {
      status: waitingCount === 0 ? 'ok' : waitingCount < 5 ? 'warning' : 'error',
      details: {
        total: totalConnections,
        idle: idleConnections,
        active: totalConnections - idleConnections,
        waiting: waitingCount,
      },
    };

    if (checks.pool.status !== 'ok') {
      overallStatus = checks.pool.status === 'warning' ? 'degraded' : 'unhealthy';
    }
  } catch (error: any) {
    checks.pool = {
      status: 'warning',
      message: 'Could not check connection pool',
    };
  }

  const result: HealthCheckResult = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    checks,
  };

  const statusCode = overallStatus === 'healthy' ? 200 : overallStatus === 'degraded' ? 200 : 503;
  
  if (overallStatus !== 'healthy') {
    logger.warn('Advanced health check: System degraded or unhealthy', {
      status: overallStatus,
      checks,
    });
  }

  res.status(statusCode).json(result);
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

