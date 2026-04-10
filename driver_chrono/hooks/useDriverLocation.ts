import { useState, useEffect } from 'react';
import * as Location from 'expo-location';
import { logger } from '../utils/logger';

export interface DriverLocation {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

export const useDriverLocation = (isOnline: boolean) => {
  const [location, setLocation] = useState<DriverLocation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  /** iOS/Android : refus explicite — le système ne redemandera pas ; il faut ouvrir Réglages. */
  const [permissionDenied, setPermissionDenied] = useState(false);

  useEffect(() => {
    let subscription: Location.LocationSubscription | null = null;

    const startLocationTracking = async () => {
      if (!isOnline) {
        // Si offline, arrêter le tracking
        if (subscription) {
          subscription.remove();
          subscription = null;
        }
        setLocation(null);
        setPermissionDenied(false);
        return;
      }

      setLoading(true);
      setError(null);
      setPermissionDenied(false);

      try {
        // Demander les permissions (dialog système la 1ère fois ; si déjà refusé, status === denied sans nouvelle popup)
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setPermissionDenied(status === 'denied');
          setError('Permission de localisation refusée');
          setLoading(false);
          return;
        }

        // Obtenir la position actuelle
        const currentLocation = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });

        setLocation({
          latitude: currentLocation.coords.latitude,
          longitude: currentLocation.coords.longitude,
          accuracy: currentLocation.coords.accuracy || undefined,
        });

        subscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: 5000,
            distanceInterval: 30,
          },
          (newLocation) => {
            setLocation({
              latitude: newLocation.coords.latitude,
              longitude: newLocation.coords.longitude,
              accuracy: newLocation.coords.accuracy || undefined,
            });
          }
        );

        setLoading(false);
      } catch (err) {
        setError('Erreur lors de la récupération de la localisation');
        setLoading(false);
        logger.error('Location error:', undefined, err);
      }
    };

    startLocationTracking();

    // Cleanup
    return () => {
      if (subscription) {
        subscription.remove();
      }
    };
  }, [isOnline]);

  return { location, error, loading, permissionDenied };
};