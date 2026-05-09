/**
 * Hook pour récupérer et utiliser les données météo
 */

import { useState, useEffect, useRef } from 'react';
import { fetchWeatherData, type WeatherData, type WeatherAdjustment } from '../utils/weatherUtils';
import { logger } from '../utils/logger';

const toRadians = (value: number) => (value * Math.PI) / 180;

const distanceInMeters = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const earthRadiusM = 6_371_000;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusM * c;
};

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
  const lastFetchRef = useRef<{ latitude: number; longitude: number; timestamp: number } | null>(null);

  const WEATHER_MIN_REFRESH_MS = 10 * 60 * 1000;
  const WEATHER_FORCE_REFRESH_MS = 2 * 60 * 1000;
  const WEATHER_MIN_DISTANCE_METERS = 300;

  useEffect(() => {
    if (!enabled || !latitude || !longitude) {
      return;
    }

    const loadWeather = async (force = false) => {
      const now = Date.now();
      const lastFetch = lastFetchRef.current;
      if (!force && lastFetch) {
        const elapsed = now - lastFetch.timestamp;
        const movedMeters = distanceInMeters(
          lastFetch.latitude,
          lastFetch.longitude,
          latitude,
          longitude
        );
        // Evite un fetch à chaque update GPS de navigation.
        if (elapsed < WEATHER_FORCE_REFRESH_MS && movedMeters < WEATHER_MIN_DISTANCE_METERS) {
          return;
        }
      }

      setIsLoading(true);
      setError(null);

      try {
        const data = await fetchWeatherData(latitude, longitude, vehicleType || null);
        
        if (data) {
          setWeather(data.weather);
          setAdjustment(data.adjustment);
          lastFetchRef.current = { latitude, longitude, timestamp: now };
        } else {
          setError('Données météo non disponibles');
        }
      } catch (err) {
        logger.error('Error loading weather:', undefined, err);
        setError('Erreur lors du chargement des données météo');
      } finally {
        setIsLoading(false);
      }
    };

    loadWeather();

    // Recharger toutes les 10 minutes même sans mouvement significatif.
    const interval = setInterval(() => {
      void loadWeather(true);
    }, WEATHER_MIN_REFRESH_MS);
    return () => clearInterval(interval);
  }, [enabled, latitude, longitude, vehicleType, WEATHER_FORCE_REFRESH_MS, WEATHER_MIN_DISTANCE_METERS, WEATHER_MIN_REFRESH_MS]);

  return {
    weather,
    adjustment,
    isLoading,
    error,
    isDifficult: adjustment?.bonusEligible || false,
    alert: adjustment?.alert,
  };
}

