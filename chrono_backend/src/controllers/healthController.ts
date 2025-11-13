import { Request, Response } from 'express';
import pool from '../config/db.js';
import { supabase } from '../config/supabase.js';
import logger from '../utils/logger.js';

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  checks: {
    database: {
      status: 'ok' | 'error';
      responseTime?: number;
      error?: string;
    };
    supabase: {
      status: 'ok' | 'error';
      responseTime?: number;
      error?: string;
    };
    memory: {
      status: 'ok' | 'warning';
      used: number;
      total: number;
      percentage: number;
    };
  };
}

export const healthCheck = async (req: Request, res: Response): Promise<void> => {
  const startTime = Date.now();
  const healthStatus: HealthStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0',
    checks: {
      database: { status: 'error' },
      supabase: { status: 'error' },
      memory: {
        status: 'ok',
        used: 0,
        total: 0,
        percentage: 0,
      },
    },
  };

  const memUsage = process.memoryUsage();
  const totalMemory = memUsage.heapTotal;
  const usedMemory = memUsage.heapUsed;
  const memoryPercentage = (usedMemory / totalMemory) * 100;

  healthStatus.checks.memory = {
    status: memoryPercentage > 90 ? 'warning' : 'ok',
    used: Math.round(usedMemory / 1024 / 1024),
    total: Math.round(totalMemory / 1024 / 1024),
    percentage: Math.round(memoryPercentage * 100) / 100,
  };

  if (process.env.DATABASE_URL && pool && typeof pool.query === 'function') {
    try {
      const dbStartTime = Date.now();
      await pool.query('SELECT 1');
      const dbResponseTime = Date.now() - dbStartTime;
      healthStatus.checks.database = {
        status: 'ok',
        responseTime: dbResponseTime,
      };
    } catch (error: any) {
      healthStatus.checks.database = {
        status: 'error',
        error: error?.message || 'Database connection failed',
      };
      healthStatus.status = 'degraded';
      logger.error('Health check: Database error', { error: error?.message });
    }
  } else {
    healthStatus.checks.database = {
      status: 'error',
      error: 'DATABASE_URL not configured or pool not initialized',
    };
    healthStatus.status = 'degraded';
  }

  try {
    const supabaseStartTime = Date.now();
    const { error } = await supabase.from('users').select('id').limit(1);
    const supabaseResponseTime = Date.now() - supabaseStartTime;
    
    if (error && error.code !== 'PGRST116') {
      throw error;
    }
    
    healthStatus.checks.supabase = {
      status: 'ok',
      responseTime: supabaseResponseTime,
    };
  } catch (error: any) {
    healthStatus.checks.supabase = {
      status: 'error',
      error: error?.message || 'Supabase connection failed',
    };
    healthStatus.status = 'degraded';
    logger.error('Health check: Supabase error', { error: error?.message });
  }

  const hasErrors = healthStatus.checks.database.status === 'error' && healthStatus.checks.supabase.status === 'error';
  
  if (hasErrors) {
    healthStatus.status = 'unhealthy';
  } else if (
    healthStatus.checks.database.status === 'error' ||
    healthStatus.checks.supabase.status === 'error' ||
    healthStatus.checks.memory.status === 'warning'
  ) {
    healthStatus.status = 'degraded';
  }

  const statusCode = healthStatus.status === 'healthy' ? 200 : healthStatus.status === 'degraded' ? 200 : 503;
  const responseTime = Date.now() - startTime;

  if (healthStatus.status !== 'healthy') {
    logger.warn('Health check: System degraded or unhealthy', {
      status: healthStatus.status,
      checks: healthStatus.checks,
      responseTime,
    });
  }

  res.status(statusCode).json({
    ...healthStatus,
    responseTime,
  });
};

export const livenessCheck = (_req: Request, res: Response): void => {
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
};

export const readinessCheck = async (req: Request, res: Response): Promise<void> => {
  const checks: { [key: string]: boolean } = {};

  if (process.env.DATABASE_URL && pool && typeof pool.query === 'function') {
    try {
      await pool.query('SELECT 1');
      checks.database = true;
    } catch {
      checks.database = false;
    }
  } else {
    checks.database = false;
  }

  try {
    const { error } = await supabase.from('users').select('id').limit(1);
    checks.supabase = !error || error.code === 'PGRST116';
  } catch {
    checks.supabase = false;
  }

  const isReady = Object.values(checks).every(check => check === true);

  if (isReady) {
    res.status(200).json({
      status: 'ready',
      timestamp: new Date().toISOString(),
      checks,
    });
  } else {
    res.status(503).json({
      status: 'not ready',
      timestamp: new Date().toISOString(),
      checks,
    });
  }
};
