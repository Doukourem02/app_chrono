/**
 * Utilitaires météo pour admin_chrono
 */
import { logger } from './logger'

export interface WeatherData {
  temperature: number;
  condition: string;
  windSpeed: number;
  humidity: number;
  description: string;
  icon: string;
}

export interface WeatherAdjustment {
  multiplier: number;
  delayMinutes: number;
  alert?: string;
  bonusEligible: boolean;
}

/**
 * Récupère les données météo depuis l'API backend
 */
export async function fetchWeatherData(
  latitude: number,
  longitude: number,
  vehicleType?: 'moto' | 'vehicule' | 'cargo' | null
): Promise<{ weather: WeatherData; adjustment: WeatherAdjustment; isDifficult: boolean } | null> {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
    const url = `${apiUrl}/api/weather/${latitude}/${longitude}${vehicleType ? `?vehicleType=${vehicleType}` : ''}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data;
  } catch (error) {
    logger.error('Error fetching weather:', error);
    return null;
  }
}

/**
 * Applique l'ajustement météo à un ETA
 */
export function applyWeatherAdjustment(
  baseETAMinutes: number,
  adjustment: WeatherAdjustment
): number {
  const adjusted = baseETAMinutes * adjustment.multiplier + adjustment.delayMinutes;
  return Math.ceil(adjusted);
}

