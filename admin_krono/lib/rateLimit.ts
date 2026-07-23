/**
 * Rate limiting pour les API routes.
 *
 * Utilise Redis (compteur atomique INCR/EXPIRE) quand REDIS_URL est configuré,
 * pour rester correct en environnement serverless multi-instances. Sans Redis
 * (dev local, ou si la connexion échoue), retombe sur un store en mémoire
 * process — suffisant en dev, mais non partagé entre instances en production.
 */
import { getRedisClient } from './redisClient'
import { logger } from '@/utils/logger'

interface RateLimitResult {
  success: boolean
  remaining: number
  reset: number
}

interface MemoryStore {
  [key: string]: {
    count: number
    resetTime: number
  }
}

const memoryStore: MemoryStore = {}

function rateLimitMemory(identifier: string, limit: number, window: number): RateLimitResult {
  const now = Date.now()
  const windowMs = window * 1000

  // Nettoyer les entrées expirées (garbage collection simple)
  if (Object.keys(memoryStore).length > 1000) {
    Object.keys(memoryStore).forEach((key) => {
      if (memoryStore[key].resetTime < now) {
        delete memoryStore[key]
      }
    })
  }

  const record = memoryStore[identifier]

  if (!record || record.resetTime < now) {
    memoryStore[identifier] = { count: 1, resetTime: now + windowMs }
    return { success: true, remaining: limit - 1, reset: now + windowMs }
  }

  if (record.count >= limit) {
    return { success: false, remaining: 0, reset: record.resetTime }
  }

  record.count++
  return { success: true, remaining: limit - record.count, reset: record.resetTime }
}

async function rateLimitRedis(
  identifier: string,
  limit: number,
  window: number
): Promise<RateLimitResult | null> {
  const redis = await getRedisClient()
  if (!redis) return null

  try {
    const key = `ratelimit:${identifier}`
    const count = await redis.incr(key)
    if (count === 1) {
      await redis.expire(key, window)
    }
    const ttl = await redis.ttl(key)
    const reset = Date.now() + Math.max(ttl, 0) * 1000

    if (count > limit) {
      return { success: false, remaining: 0, reset }
    }
    return { success: true, remaining: Math.max(limit - count, 0), reset }
  } catch (err) {
    logger.error('Erreur rate limit Redis, repli sur le store en mémoire:', err)
    return null
  }
}

/**
 * Rate limiter : Redis si disponible, sinon store en mémoire.
 * @param identifier Identifiant unique (IP, user ID, etc.)
 * @param limit Nombre maximum de requêtes
 * @param window Fenêtre de temps en secondes
 */
export async function rateLimit(
  identifier: string,
  limit: number = 10,
  window: number = 60
): Promise<RateLimitResult> {
  const redisResult = await rateLimitRedis(identifier, limit, window)
  if (redisResult) return redisResult

  return rateLimitMemory(identifier, limit, window)
}

/**
 * Obtenir l'identifiant depuis la requête (IP ou user ID)
 */
export function getRateLimitIdentifier(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  const ip = forwarded ? forwarded.split(',')[0] : 'unknown'
  return ip
}
