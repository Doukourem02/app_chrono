/**
 * Utilitaires pour calculer l'ETA (Estimated Time of Arrival) en temps réel
 */

interface Position {
  lat: number
  lng: number
}

/**
 * Calcule la distance en mètres entre deux points GPS (formule de Haversine)
 */
export function calculateDistance(point1: Position, point2: Position): number {
  const R = 6371000 // Rayon de la Terre en mètres
  const dLat = toRad(point2.lat - point1.lat)
  const dLon = toRad(point2.lng - point1.lng)

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(point1.lat)) *
      Math.cos(toRad(point2.lat)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

function toRad(degrees: number): number {
  return (degrees * Math.PI) / 180
}

/**
 * Calcule l'ETA en minutes basé sur la distance et la vitesse moyenne
 * @param distance Distance en mètres
 * @param averageSpeed Vitesse moyenne en km/h (par défaut 30 km/h en ville)
 * @returns ETA en minutes
 */
export function calculateETA(distance: number, averageSpeed: number = 30): number {
  if (distance <= 0) return 0
  const distanceKm = distance / 1000
  const timeHours = distanceKm / averageSpeed
  return Math.ceil(timeHours * 60) // Arrondir à la minute supérieure
}

/**
 * Calcule l'ETA en tenant compte du type de véhicule
 * @param distance Distance en mètres
 * @param vehicleType Type de véhicule
 * @returns ETA en minutes
 */
export function calculateETAForVehicle(
  distance: number,
  vehicleType: 'moto' | 'vehicule' | 'cargo' | null = null
): number {
  // Vitesses moyennes par type de véhicule (en km/h)
  const speeds: Record<string, number> = {
    moto: 35, // Moto plus rapide en ville
    vehicule: 30, // Voiture vitesse standard
    cargo: 25, // Cargo plus lent
  }

  const averageSpeed = vehicleType ? speeds[vehicleType] || 30 : 30
  return calculateETA(distance, averageSpeed)
}

/**
 * Formate l'ETA en texte lisible
 * @param etaMinutes ETA en minutes
 * @returns Texte formaté (ex: "5 min", "1h 15 min")
 */
export function formatETA(etaMinutes: number): string {
  if (etaMinutes < 1) return 'Arrivé'
  if (etaMinutes < 60) return `${Math.round(etaMinutes)} min`

  const hours = Math.floor(etaMinutes / 60)
  const minutes = Math.round(etaMinutes % 60)
  if (minutes === 0) {
    return `${hours}h`
  }
  return `${hours}h ${minutes} min`
}

/**
 * Calcule l'ETA complet entre la position actuelle du driver et la destination
 * @param driverPosition Position actuelle du driver
 * @param destination Position de destination
 * @param vehicleType Type de véhicule (optionnel)
 * @returns Objet avec distance (mètres) et ETA (minutes)
 */
export function calculateFullETA(
  driverPosition: Position | null,
  destination: Position | null,
  vehicleType: 'moto' | 'vehicule' | 'cargo' | null = null
): { distance: number; etaMinutes: number; formattedETA: string } | null {
  if (!driverPosition || !destination) {
    return null
  }

  const distance = calculateDistance(driverPosition, destination)
  const etaMinutes = calculateETAForVehicle(distance, vehicleType)
  const formattedETA = formatETA(etaMinutes)

  return {
    distance,
    etaMinutes,
    formattedETA,
  }
}

