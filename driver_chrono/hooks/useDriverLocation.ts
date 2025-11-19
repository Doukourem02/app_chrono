import { useState, useEffect } from 'react';
import * as Location from 'expo-location';

export interface DriverLocation {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

export const useDriverLocation = (isOnline: boolean) => {
  const [location, setLocation] = useState<DriverLocation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // Demander les permissions
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
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
            timeInterval: 10000, 
            distanceInterval: 50, 
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
        console.error('Location error:', err);
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

  return { location, error, loading };
};