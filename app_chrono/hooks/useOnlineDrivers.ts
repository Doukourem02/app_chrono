import { useState, useEffect, useCallback, useMemo } from 'react';
import { userApiService } from '../services/userApiService';

export interface OnlineDriver {
  user_id: string;
  first_name: string;
  last_name: string;
  vehicle_type: string;
  vehicle_plate: string;
  current_latitude: number;
  current_longitude: number;
  is_online: boolean;
  is_available: boolean;
  rating: number;
  total_deliveries: number;
  profile_image_url?: string;
}

interface UseOnlineDriversOptions {
  userLocation?: {
    latitude: number;
    longitude: number;
  };
  refreshInterval?: number; // En millisecondes
  autoRefresh?: boolean;
}

export const useOnlineDrivers = (options: UseOnlineDriversOptions = {}) => {
  const {
    userLocation,
    refreshInterval = 30000, // 30 secondes par défaut (au lieu de 10)
    autoRefresh = true
  } = options;

  // Stabiliser la position pour éviter les re-renders constants
  const stableUserLocation = useMemo(() => {
    if (!userLocation?.latitude || !userLocation?.longitude) return undefined;
    return {
      latitude: Math.round(userLocation.latitude * 10000) / 10000, // Arrondir à 4 décimales
      longitude: Math.round(userLocation.longitude * 10000) / 10000
    };
  }, [userLocation?.latitude, userLocation?.longitude]);

  const [drivers, setDrivers] = useState<OnlineDriver[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  // Fonction pour récupérer les chauffeurs
  const fetchDrivers = useCallback(async () => {
    setLoading(true);
    setError(null);

      try {
        const result = await userApiService.getOnlineDrivers(stableUserLocation);
        
        if (result.success && result.data) {
          // 🔍 Filtrer strictement pour ne garder QUE les chauffeurs en ligne
          const onlineOnly = result.data.filter(driver => driver.is_online === true);
          setDrivers(onlineOnly);
          setLastUpdate(new Date());
          if (onlineOnly.length > 0) {
            console.log(`🚗 ${onlineOnly.length} chauffeur(s) en ligne`);
          }
        } else {
          setError(result.message || 'Erreur de récupération');
          setDrivers([]);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur inconnue');
        setDrivers([]);
      } finally {
        setLoading(false);
      }
  }, [stableUserLocation]);

  // Effet pour le chargement initial et le rafraîchissement automatique
  useEffect(() => {
    const loadDrivers = async () => {
      setLoading(true);
      setError(null);

      try {
        const result = await userApiService.getOnlineDrivers(stableUserLocation);
        
        if (result.success && result.data) {
          // 🔍 Filtrer strictement pour ne garder QUE les chauffeurs en ligne
          const onlineOnly = result.data.filter(driver => driver.is_online === true);
          setDrivers(onlineOnly);
          setLastUpdate(new Date());
          // Log uniquement s'il y a des changements significatifs
        } else {
          setError(result.message || 'Erreur de récupération');
          setDrivers([]);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur inconnue');
        setDrivers([]);
      } finally {
        setLoading(false);
      }
    };

    loadDrivers();

    if (autoRefresh) {
      const interval = setInterval(loadDrivers, refreshInterval);
      return () => clearInterval(interval);
    }
    
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stableUserLocation?.latitude, stableUserLocation?.longitude, autoRefresh, refreshInterval]); // ⚠️ Dépendances contrôlées

  // Fonction pour rafraîchir manuellement
  const refresh = useCallback(() => {
    fetchDrivers();
  }, [fetchDrivers]);

  // Fonction pour obtenir les chauffeurs dans un rayon donné
  const getDriversInRadius = useCallback((
    center: { latitude: number; longitude: number },
    radiusKm: number
  ): OnlineDriver[] => {
    if (!center) return drivers;

    return drivers.filter(driver => {
      const distance = getDistanceInKm(
        center.latitude,
        center.longitude,
        driver.current_latitude,
        driver.current_longitude
      );
      return distance <= radiusKm;
    });
  }, [drivers]);

  return {
    drivers,
    loading,
    error,
    lastUpdate,
    refresh,
    getDriversInRadius
  };
};

// Fonction utilitaire pour calculer la distance entre deux points
function getDistanceInKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Rayon de la Terre en km
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}