/**
 * Utilitaires pour calculer l'ETA (Estimated Time of Arrival) en temps réel
 */

import type { TrafficData } from './trafficUtils'
import { calculateETAWithTraffic } from './trafficUtils'
import type { WeatherAdjustment } from './weatherUtils'
import {
  realisticEtaMinutesFromAirDistance,
  realisticEtaMinutesFromRoute,
} from './ivoryCoastEta'

interface Position {
  latitude: number
  longitude: number
}

/**
 * Calcule la distance en mètres entre deux points GPS (formule de Haversine)
 */
export function calculateDistance(point1: Position, point2: Position): number {
  const R = 6371000 // Rayon de la Terre en mètres
  const dLat = toRad(point2.latitude - point1.latitude)
  const dLon = toRad(point2.longitude - point1.longitude)

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(point1.latitude)) *
      Math.cos(toRad(point2.latitude)) *
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
  return realisticEtaMinutesFromAirDistance({
    airDistanceMeters: distance,
    vehicleType,
  })
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
 * Utilise les données de trafic si disponibles, sinon calcule basé sur la distance
 * @param driverPosition Position actuelle du driver
 * @param destination Position de destination
 * @param vehicleType Type de véhicule (optionnel)
 * @param trafficData Données de trafic (optionnel)
 * @param weatherAdjustment Ajustement météo (optionnel)
 * @returns Objet avec distance (mètres) et ETA (minutes)
 */
export function calculateFullETA(
  driverPosition: Position | null,
  destination: Position | null,
  vehicleType: 'moto' | 'vehicule' | 'cargo' | null = null,
  trafficData: TrafficData | null = null,
  weatherAdjustment: WeatherAdjustment | null = null
): { distance: number; etaMinutes: number; formattedETA: string } | null {
  if (!driverPosition || !destination) {
    return null
  }

  const distance = calculateDistance(driverPosition, destination)
  
  // Utiliser les données de trafic si disponibles
  if (trafficData?.hasTrafficData) {
    const etaSeconds = calculateETAWithTraffic(trafficData, 1)
    
    if (etaSeconds !== null) {
      const etaMinutes = realisticEtaMinutesFromRoute({
        distanceMeters: trafficData.distanceMeters ?? distance * 1.55,
        durationSeconds: etaSeconds,
        vehicleType,
        weatherAdjustment,
      })
      const formattedETA = formatETA(etaMinutes)
      
      return {
        distance,
        etaMinutes,
        formattedETA,
      }
    }
  }
  
  // Fallback: calcul basé sur la distance
  const etaMinutes = realisticEtaMinutesFromAirDistance({
    airDistanceMeters: distance,
    vehicleType,
    weatherAdjustment,
  })
  
  const formattedETA = formatETA(etaMinutes)

  return {
    distance,
    etaMinutes,
    formattedETA,
  }
}
