import { OnlineDriver } from '../useRealTimeTracking'

/**
 * Vérifie si un driver est valide (en ligne, avec coordonnées, et actif)
 * Un driver est considéré comme actif s'il a été mis à jour dans les 5 dernières minutes
 */
export function isDriverValid(driver: OnlineDriver): boolean {
  // Vérifier si le driver est en ligne
  if (!driver.is_online) {
    return false
  }

  // Vérifier si le driver a des coordonnées
  if (!driver.current_latitude || !driver.current_longitude) {
    return false
  }

  // Vérifier si le driver est actif (mis à jour dans les 5 dernières minutes)
  if (!driver.updated_at) {
    return false
  }

  const updatedAt = new Date(driver.updated_at)
  const diffInMinutes = (Date.now() - updatedAt.getTime()) / 60000
  return diffInMinutes <= 5
}

