import { useState, useEffect } from 'react';
import * as Location from 'expo-location';
import { logger } from '../utils/logger';

export interface DriverLocation {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

/**
 * Suivi GPS livreur. Priorité : ne pas laisser d’erreur « collante » si le flux temps réel reprend
 * (évite « Localisation indisponible » alors que le livreur est en ligne et reçoit des courses).
 */
export const useDriverLocation = (isOnline: boolean) => {
  const [location, setLocation] = useState<DriverLocation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  /** Refus explicite — seul cas où l’utilisateur doit ouvrir Réglages. */
  const [permissionDenied, setPermissionDenied] = useState(false);

  useEffect(() => {
    let subscription: Location.LocationSubscription | null = null;
    let cancelled = false;

    const startLocationTracking = async () => {
      if (!isOnline) {
        if (subscription) {
          subscription.remove();
          subscription = null;
        }
        setLocation(null);
        setPermissionDenied(false);
        setError(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      setPermissionDenied(false);

      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          if (!cancelled) {
            setPermissionDenied(status === 'denied');
            setError('Permission de localisation refusée');
            setLoading(false);
          }
          return;
        }

        const apply = (lat: number, lng: number, accuracy?: number) => {
          if (cancelled) return;
          setLocation({
            latitude: lat,
            longitude: lng,
            accuracy: accuracy ?? undefined,
          });
          setError(null);
        };

        // Position cache (instantané, évite trou noir au passage « en ligne »)
        try {
          const last = await Location.getLastKnownPositionAsync({});
          if (last?.coords) {
            apply(
              last.coords.latitude,
              last.coords.longitude,
              last.coords.accuracy ?? undefined
            );
          }
        } catch {
          /* optionnel */
        }

        // Fix initial : Balanced (High time out souvent en intérieur / test)
        try {
          const current = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          apply(
            current.coords.latitude,
            current.coords.longitude,
            current.coords.accuracy ?? undefined
          );
        } catch {
          try {
            const low = await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.Low,
            });
            apply(
              low.coords.latitude,
              low.coords.longitude,
              low.coords.accuracy ?? undefined
            );
          } catch {
            /* le watch peut fournir la 1re position */
          }
        }

        subscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: 5000,
            distanceInterval: 30,
          },
          (newLocation) => {
            apply(
              newLocation.coords.latitude,
              newLocation.coords.longitude,
              newLocation.coords.accuracy ?? undefined
            );
          }
        );

        if (!cancelled) {
          setLoading(false);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          logger.error('Location error:', undefined, err);
          setError('Erreur lors de la récupération de la localisation');
          setLoading(false);
        }
      }
    };

    void startLocationTracking();

    return () => {
      cancelled = true;
      if (subscription) {
        subscription.remove();
      }
    };
  }, [isOnline]);

  return { location, error, loading, permissionDenied };
};
