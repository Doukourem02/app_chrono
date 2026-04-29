/**
 * Utilitaires pour gérer les données de trafic (Mapbox)
 */

export interface TrafficData {
  durationInTraffic?: number // Durée en secondes avec trafic (Mapbox driving-traffic: duration)
  durationBase?: number // Durée typique sans trafic fort (Mapbox: duration_typical)
  distanceMeters?: number
  hasTrafficData: boolean
}

/**
 * Extrait les données de trafic depuis une réponse Mapbox Directions
 * Mapbox: duration_typical | duration
 */
export function extractTrafficData(leg: {
  duration_typical?: number;
  duration?: number | { value?: number };
  duration_in_traffic?: { value?: number };
}): TrafficData {
  const dur = leg.duration;
  const duration = typeof dur === 'number' ? dur : (dur as { value?: number })?.value;
  const durationInTraffic = duration ?? leg.duration_in_traffic?.value;
  const durationBase = leg.duration_typical ?? durationInTraffic;

  return {
    durationInTraffic,
    durationBase,
    hasTrafficData: !!durationInTraffic,
  };
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
