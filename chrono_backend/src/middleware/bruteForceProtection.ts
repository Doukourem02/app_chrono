import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger.js';

interface FailedAttemptData {
  attempts: number;
  firstAttempt: number;
  lastAttempt: number;
  lockedUntil?: number;
}

const failedAttempts = new Map<string, FailedAttemptData>();

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;
const LOCKOUT_MS = 30 * 60 * 1000;

function cleanupExpiredAttempts(): void {
  const now = Date.now();
  for (const [key, data] of failedAttempts.entries()) {
    if (now - data.lastAttempt > WINDOW_MS) {
      failedAttempts.delete(key);
    }
  }
}

export function isBlocked(identifier: string): boolean {
  cleanupExpiredAttempts();
  
  const data = failedAttempts.get(identifier);
  if (!data) {
    return false;
  }
  
  if (data.lockedUntil && Date.now() < data.lockedUntil) {
    return true;
  }
  
  if (data.lockedUntil && Date.now() >= data.lockedUntil) {
    failedAttempts.delete(identifier);
    return false;
  }
  
  if (data.attempts >= MAX_ATTEMPTS) {
    if (!data.lockedUntil) {
      data.lockedUntil = Date.now() + LOCKOUT_MS;
      logger.warn(`Verrouillage de ${identifier} pour ${LOCKOUT_MS / 1000 / 60} minutes`);
    }
    return true;
  }
  
  return false;
}

export function recordFailedAttempt(identifier: string): void {
  cleanupExpiredAttempts();
  
  const now = Date.now();
  const data = failedAttempts.get(identifier);
  
  if (!data) {
    failedAttempts.set(identifier, {
      attempts: 1,
      firstAttempt: now,
      lastAttempt: now
    });
  } else {
    if (now - data.firstAttempt > WINDOW_MS) {
      failedAttempts.set(identifier, {
        attempts: 1,
        firstAttempt: now,
        lastAttempt: now
      });
    } else {
      data.attempts++;
      data.lastAttempt = now;
    }
  }
  
  const attempts = failedAttempts.get(identifier)?.attempts || 0;
  if (attempts >= MAX_ATTEMPTS - 1) {
    logger.warn(`Tentative de force brute suspecte: ${identifier} (${attempts} tentatives)`);
  }
}

export function resetAttempts(identifier: string): void {
  failedAttempts.delete(identifier);
}

export const bruteForceProtection = (req: Request, res: Response, next: NextFunction): void => {
  const identifier = (req.body?.email as string) || req.ip || 
                     (req.headers['x-forwarded-for'] as string) || 'unknown';

  if (isBlocked(identifier)) {
    const data = failedAttempts.get(identifier);
    const remainingTime = data?.lockedUntil ? Math.ceil((data.lockedUntil - Date.now()) / 1000 / 60) : 0;
    
    logger.warn(`Tentative bloquée: ${identifier} (verrouillé pour ${remainingTime} minutes)`);
    res.status(429).json({
      success: false,
      message: `Trop de tentatives échouées. Réessayez dans ${remainingTime} minutes.`,
      code: 'TOO_MANY_ATTEMPTS'
    });
    return;
  }
  
  (req as any).recordFailedAttempt = () => recordFailedAttempt(identifier);
  (req as any).resetAttempts = () => resetAttempts(identifier);
  
  next();
};
