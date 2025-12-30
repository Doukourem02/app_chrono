/**
 * Hook pour récupérer et utiliser les données météo
 */

import { useState, useEffect } from 'react';
import { fetchWeatherData, type WeatherData, type WeatherAdjustment } from '../utils/weatherUtils';
import { logger } from '../utils/logger';

interface UseWeatherOptions {
  latitude: number | null;
  longitude: number | null;
  vehicleType?: 'moto' | 'vehicule' | 'cargo' | null;
  enabled?: boolean;
}

export function useWeather({ latitude, longitude, vehicleType, enabled = true }: UseWeatherOptions) {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [adjustment, setAdjustment] = useState<WeatherAdjustment | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !latitude || !longitude) {
      return;
    }

    const loadWeather = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const data = await fetchWeatherData(latitude, longitude, vehicleType || null);
        
        if (data) {
          setWeather(data.weather);
          setAdjustment(data.adjustment);
        } else {
          setError('Données météo non disponibles');
        }
      } catch (err) {
        logger.error('Error loading weather:', err instanceof Error ? err.message : String(err));
        setError('Erreur lors du chargement des données météo');
      } finally {
        setIsLoading(false);
      }
    };

    loadWeather();

    // Recharger toutes les 10 minutes
    const interval = setInterval(loadWeather, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, [enabled, latitude, longitude, vehicleType]);

  return {
    weather,
    adjustment,
    isLoading,
    error,
    isDifficult: adjustment?.bonusEligible || false,
    alert: adjustment?.alert,
  };
}

