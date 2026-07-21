import { Request, Response, NextFunction } from 'express';
import { createClient, RedisClientType } from 'redis';
import logger from '../utils/logger.js';

interface FailedAttemptData {
  attempts: number;
  firstAttempt: number;
  lastAttempt: number;
  lockedUntil?: number;
}

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;
const LOCKOUT_MS = 30 * 60 * 1000;
const REDIS_PREFIX = 'bf:';

// Fallback in-memory (mono-instance uniquement)
const memoryStore = new Map<string, FailedAttemptData>();

let redisClient: RedisClientType | null = null;

async function getRedis(): Promise<RedisClientType | null> {
  if (redisClient?.isOpen) return redisClient;
  const url = process.env.REDIS_URL?.trim();
  if (!url || /^https?:\/\//i.test(url)) return null;
  try {
    redisClient = createClient({ url }) as RedisClientType;
    redisClient.on('error', () => { redisClient = null; });
    await redisClient.connect();
    return redisClient;
  } catch {
    redisClient = null;
    return null;
  }
}

export async function isBlocked(identifier: string): Promise<boolean> {
  const redis = await getRedis();

  if (redis) {
    try {
      const raw = await redis.get(`${REDIS_PREFIX}${identifier}`);
      if (!raw) return false;
      const data: FailedAttemptData = JSON.parse(raw);
      if (data.lockedUntil && Date.now() < data.lockedUntil) return true;
      if (data.lockedUntil && Date.now() >= data.lockedUntil) {
        await redis.del(`${REDIS_PREFIX}${identifier}`);
        return false;
      }
      return data.attempts >= MAX_ATTEMPTS;
    } catch {
      // Redis error → fallback memory
    }
  }

  // Fallback mémoire
  const now = Date.now();
  const data = memoryStore.get(identifier);
  if (!data) return false;
  if (now - data.lastAttempt > WINDOW_MS) { memoryStore.delete(identifier); return false; }
  if (data.lockedUntil && now < data.lockedUntil) return true;
  if (data.lockedUntil && now >= data.lockedUntil) { memoryStore.delete(identifier); return false; }
  return data.attempts >= MAX_ATTEMPTS;
}

export async function recordFailedAttempt(identifier: string): Promise<void> {
  const now = Date.now();
  const redis = await getRedis();

  if (redis) {
    try {
      const key = `${REDIS_PREFIX}${identifier}`;
      const raw = await redis.get(key);
      let data: FailedAttemptData = raw
        ? JSON.parse(raw)
        : { attempts: 0, firstAttempt: now, lastAttempt: now };

      if (now - data.firstAttempt > WINDOW_MS) {
        data = { attempts: 1, firstAttempt: now, lastAttempt: now };
      } else {
        data.attempts++;
        data.lastAttempt = now;
        if (data.attempts >= MAX_ATTEMPTS && !data.lockedUntil) {
          data.lockedUntil = now + LOCKOUT_MS;
          logger.warn(`Brute force — verrouillage Redis: ${identifier}`);
        }
      }

      await redis.set(key, JSON.stringify(data), { PX: LOCKOUT_MS + WINDOW_MS });
      return;
    } catch {
      // Redis error → fallback memory
    }
  }

  // Fallback mémoire
  const existing = memoryStore.get(identifier);
  if (!existing || now - existing.firstAttempt > WINDOW_MS) {
    memoryStore.set(identifier, { attempts: 1, firstAttempt: now, lastAttempt: now });
  } else {
    existing.attempts++;
    existing.lastAttempt = now;
    if (existing.attempts >= MAX_ATTEMPTS && !existing.lockedUntil) {
      existing.lockedUntil = now + LOCKOUT_MS;
      logger.warn(`Brute force — verrouillage mémoire: ${identifier}`);
    }
  }
}

export async function resetAttempts(identifier: string): Promise<void> {
  const redis = await getRedis();
  if (redis) {
    try { await redis.del(`${REDIS_PREFIX}${identifier}`); return; } catch { /* fallback */ }
  }
  memoryStore.delete(identifier);
}

export const bruteForceProtection = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const identifier =
    (req.body?.email as string) ||
    req.ip ||
    (req.headers['x-forwarded-for'] as string) ||
    'unknown';

  if (await isBlocked(identifier)) {
    logger.warn(`Tentative bloquée (brute force): ${identifier}`);
    res.status(429).json({
      success: false,
      message: 'Trop de tentatives échouées. Réessayez dans 30 minutes.',
      code: 'TOO_MANY_ATTEMPTS',
    });
    return;
  }

  (req as any).recordFailedAttempt = () => recordFailedAttempt(identifier);
  (req as any).resetAttempts = () => resetAttempts(identifier);
  next();
};
