import { createClient, RedisClientType } from 'redis'
import { logger } from '@/utils/logger'

/**
 * Client Redis partagé (lazy singleton), réutilisé entre invocations d'API routes
 * quand l'instance reste chaude. Si REDIS_URL n'est pas configuré ou que la connexion
 * échoue, retourne null — les appelants doivent alors retomber sur un fallback
 * en mémoire (voir lib/rateLimit.ts).
 */
let client: RedisClientType | null = null
let connecting: Promise<RedisClientType | null> | null = null

function normalizeRedisUrl(raw: string | undefined): string | undefined {
  if (!raw) return undefined
  const trimmed = raw.trim().replace(/^['"]|['"]$/g, '')
  return trimmed || undefined
}

export async function getRedisClient(): Promise<RedisClientType | null> {
  const redisUrl = normalizeRedisUrl(process.env.REDIS_URL)
  if (!redisUrl || /^https?:\/\//i.test(redisUrl)) {
    return null
  }

  if (client?.isOpen) {
    return client
  }

  if (connecting) {
    return connecting
  }

  connecting = (async () => {
    try {
      const c = createClient({
        url: redisUrl,
        socket: { connectTimeout: 3000 },
      }) as RedisClientType

      c.on('error', (err) => {
        logger.error('Redis rate-limit client error:', err)
      })

      await c.connect()
      client = c
      return c
    } catch (err) {
      logger.error('Impossible de se connecter à Redis pour le rate limiting:', err)
      client = null
      return null
    } finally {
      connecting = null
    }
  })()

  return connecting
}
