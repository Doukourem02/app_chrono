import { useEffect, useState, useCallback } from 'react';
import * as Location from 'expo-location';
import { logger } from '../utils/logger';
import { Alert } from 'react-native';

interface LocationState {
  coords: { latitude: number; longitude: number } | null;
  address: string | null;
  loading: boolean;
  error: string | null;
  hasPermission: boolean;
}

export const useLocation = () => {
  const [state, setState] = useState<LocationState>({
    coords: null,
    address: null,
    loading: false,
    error: null,
    hasPermission: false,
  });

  // Cache pour éviter les appels répétitifs
  const [lastReverseGeocode, setLastReverseGeocode] = useState<{
    coords: string;
    address: string;
    timestamp: number;
  } | null>(null);

  const reverseGeocodeWithCache = useCallback(async (coords: { latitude: number; longitude: number }) => {
    const coordsKey = `${coords.latitude.toFixed(4)},${coords.longitude.toFixed(4)}`;
    const now = Date.now();
    const cacheExpiry = 5 * 60 * 1000; // 5 minutes

    // Vérifier le cache
    if (lastReverseGeocode && 
        lastReverseGeocode.coords === coordsKey && 
        now - lastReverseGeocode.timestamp < cacheExpiry) {
      setState(prev => ({ ...prev, address: lastReverseGeocode.address }));
      return;
    }

    try {
      const geocoded = await Location.reverseGeocodeAsync(coords);
      
      if (geocoded && geocoded.length > 0) {
        const place = geocoded[0];
        const addressParts = [place.name, place.street, place.city || place.region];
        const address = addressParts.filter(Boolean).join(', ');
        
        if (address) {
          setState(prev => ({ ...prev, address }));
          setLastReverseGeocode({
            coords: coordsKey,
            address,
            timestamp: now,
          });
        }
      }
    } catch (error: any) {
      // Ne pas faire échouer toute l'opération pour un échec de géocodage inverse
      logger.warn('Reverse geocoding failed', 'useLocation', {
        message: error.message,
        coords: coordsKey,
      });
      // Pas d'erreur utilisateur pour éviter le spam
    }
  }, [lastReverseGeocode]);

  const requestLocation = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      // Vérifier les permissions
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        setState(prev => ({
          ...prev,
          loading: false,
          error: 'Permission de localisation refusée',
          hasPermission: false,
        }));
        Alert.alert('Permission refusée', 'Activez la localisation pour utiliser cette fonctionnalité.');
        return null;
      }

      setState(prev => ({ ...prev, hasPermission: true }));

      // Obtenir la position actuelle
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced, // Balance entre précision et vitesse
      });

      const coords = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };

      setState(prev => ({ ...prev, coords, loading: false }));


      await reverseGeocodeWithCache(coords);
      
      return coords;

    } catch (error: any) {
      logger.error('Location request failed', 'useLocation', error);
      setState(prev => ({
        ...prev,
        loading: false,
        error: error.message || 'Erreur lors de la géolocalisation',
      }));
      return null;
    }
  }, [reverseGeocodeWithCache]);


  useEffect(() => {
    requestLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 

  return {
    ...state,
    requestLocation,
    reverseGeocode: reverseGeocodeWithCache,
  };
};