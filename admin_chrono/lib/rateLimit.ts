/**
 * Rate limiting simple pour les API routes
 * En production, utiliser @upstash/ratelimit avec Redis
 */

interface RateLimitStore {
  [key: string]: {
    count: number
    resetTime: number
  }
}

// Store en mémoire (pour développement uniquement)
// En production, utiliser Redis avec @upstash/ratelimit
const store: RateLimitStore = {}

/**
 * Rate limiter simple
 * @param identifier Identifiant unique (IP, user ID, etc.)
 * @param limit Nombre maximum de requêtes
 * @param window Fenêtre de temps en secondes
 */
export function rateLimit(
  identifier: string,
  limit: number = 10,
  window: number = 60
): { success: boolean; remaining: number; reset: number } {
  const now = Date.now()
  const windowMs = window * 1000

  // Nettoyer les entrées expirées (garbage collection simple)
  if (Object.keys(store).length > 1000) {
    Object.keys(store).forEach((key) => {
      if (store[key].resetTime < now) {
        delete store[key]
      }
    })
  }

  const record = store[identifier]

  if (!record || record.resetTime < now) {
    // Nouvelle fenêtre
    store[identifier] = {
      count: 1,
      resetTime: now + windowMs,
    }
    return {
      success: true,
      remaining: limit - 1,
      reset: now + windowMs,
    }
  }

  if (record.count >= limit) {
    // Limite atteinte
    return {
      success: false,
      remaining: 0,
      reset: record.resetTime,
    }
  }

  // Incrémenter le compteur
  record.count++
  return {
    success: true,
    remaining: limit - record.count,
    reset: record.resetTime,
  }
}

/**
 * Obtenir l'identifiant depuis la requête (IP ou user ID)
 */
export function getRateLimitIdentifier(request: Request): string {
  // En production, utiliser l'IP réelle
  // Pour l'instant, utiliser un identifiant basique
  const forwarded = request.headers.get('x-forwarded-for')
  const ip = forwarded ? forwarded.split(',')[0] : 'unknown'
  return ip
}

