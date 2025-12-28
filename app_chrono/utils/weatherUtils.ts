/**
 * Utilitaires météo pour app_chrono
 */

import { config } from '../config';

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
    const url = `${config.apiUrl}/api/weather/${latitude}/${longitude}${vehicleType ? `?vehicleType=${vehicleType}` : ''}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data;
  } catch (error) {
    // Ne pas logger les erreurs réseau en production (normal si le backend n'est pas disponible)
    if (__DEV__) {
      console.warn('Weather API unavailable:', error instanceof Error ? error.message : 'Network error');
    }
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

