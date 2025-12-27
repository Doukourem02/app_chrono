/**
 * Utilitaires pour gérer les données de trafic Google Maps
 */

export interface TrafficData {
  durationInTraffic?: number // Durée en secondes avec trafic
  durationBase?: number // Durée en secondes sans trafic
  hasTrafficData: boolean // Indique si les données de trafic sont disponibles
}

/**
 * Extrait les données de trafic depuis une réponse Google Directions API
 */
export function extractTrafficData(leg: any): TrafficData {
  const durationInTraffic = leg.duration_in_traffic?.value
  const durationBase = leg.duration?.value

  return {
    durationInTraffic,
    durationBase,
    hasTrafficData: !!durationInTraffic,
  }
}

/**
 * Calcule l'ETA en tenant compte du trafic
 * Utilise duration_in_traffic si disponible, sinon duration
 */
export function calculateETAWithTraffic(
  trafficData: TrafficData,
  vehicleMultiplier: number = 1.0
): number | null {
  const { durationInTraffic, durationBase } = trafficData

  // Utiliser duration_in_traffic si disponible, sinon duration
  const baseDuration = durationInTraffic || durationBase

  if (!baseDuration) {
    return null
  }

  // Appliquer le multiplicateur selon le type de véhicule
  return Math.round(baseDuration * vehicleMultiplier)
}

/**
 * Formate l'ETA avec trafic en texte lisible
 */
export function formatETAWithTraffic(etaSeconds: number | null): string {
  if (!etaSeconds) return 'Calcul en cours...'
  if (etaSeconds < 60) return `${Math.round(etaSeconds)} sec`

  const minutes = Math.round(etaSeconds / 60)
  if (minutes < 60) return `${minutes} min`

  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  if (remainingMinutes === 0) {
    return `${hours}h`
  }
  return `${hours}h ${remainingMinutes} min`
}

