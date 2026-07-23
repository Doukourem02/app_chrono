/**
 * Types et helpers pour les réponses API
 * Évite les répétitions de typage lors de l'extraction de données
 */

/**
 * Helper pour typer les tableaux retournés par les APIs
 * Utilisation: const items = asArray<MyType>(apiResponse.data)
 */
export function asArray<T>(data: unknown, fallback: T[] = []): T[] {
  if (Array.isArray(data)) {
    return data as T[]
  }
  return fallback
}

/**
 * Helper pour typer un objet retourné par une API
 * Utilisation: const item = asType<MyType>(apiResponse.data)
 */
export function asType<T>(data: unknown, fallback?: T): T {
  if (data && typeof data === 'object') {
    return data as T
  }
  if (fallback !== undefined) {
    return fallback
  }
  throw new Error('Invalid data type')
}

/**
 * Helper pour typer une réponse API avec vérification
 * Utilisation: const items = asApiArray<MyType>(apiResponse)
 */
export function asApiArray<T>(
  response: { success?: boolean; data?: unknown },
  fallback: T[] = []
): T[] {
  if (response.success && response.data) {
    return asArray<T>(response.data, fallback)
  }
  return fallback
}

