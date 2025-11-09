import { useEffect, useState, useCallback } from 'react';
import { logger } from '../utils/logger';
import { Alert } from 'react-native';
import { locationService } from '../services/locationService';

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
    // Utiliser le service centralisé de localisation pour le reverse geocoding
    // Le service utilisera automatiquement Google Geocoding API si disponible
    try {
      const address = await locationService.reverseGeocode({
        latitude: coords.latitude,
        longitude: coords.longitude,
        timestamp: Date.now(),
      });
      
      if (address) {
        setState(prev => ({ ...prev, address }));
      }
    } catch (error: any) {
      // Ne pas faire échouer toute l'opération pour un échec de géocodage inverse
      logger.warn('Reverse geocoding failed', 'useLocation', {
        message: error.message,
        coords: `${coords.latitude.toFixed(6)},${coords.longitude.toFixed(6)}`,
      });
      // Pas d'erreur utilisateur pour éviter le spam
    }
  }, []);

  const requestLocation = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      // Utiliser le service centralisé de localisation
      const coords = await locationService.getCurrentPosition();
      
      if (!coords) {
        const hasPermission = await locationService.checkPermissions();
        if (!hasPermission) {
          setState(prev => ({
            ...prev,
            loading: false,
            error: 'Permission de localisation refusée',
            hasPermission: false,
          }));
          Alert.alert('Permission refusée', 'Activez la localisation pour utiliser cette fonctionnalité.');
          return null;
        }
        
        // Réessayer après avoir demandé les permissions
        const retryCoords = await locationService.getCurrentPosition(true);
        if (!retryCoords) {
          setState(prev => ({
            ...prev,
            loading: false,
            error: 'Erreur lors de la géolocalisation',
            hasPermission: false,
          }));
          return null;
        }
        
        const coordsToUse = retryCoords;
        setState(prev => ({
          ...prev,
          coords: { latitude: coordsToUse.latitude, longitude: coordsToUse.longitude },
          hasPermission: true,
          loading: false,
        }));
        
        await reverseGeocodeWithCache(coordsToUse);
        return { latitude: coordsToUse.latitude, longitude: coordsToUse.longitude };
      }

      setState(prev => ({
        ...prev,
        coords: { latitude: coords.latitude, longitude: coords.longitude },
        hasPermission: true,
        loading: false,
      }));

      await reverseGeocodeWithCache(coords);
      
      return { latitude: coords.latitude, longitude: coords.longitude };

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