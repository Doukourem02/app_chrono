import { useEffect, useState, useCallback } from 'react';
import { logger } from '../utils/logger';
import { Alert } from 'react-native';
import { locationService } from '../services/locationService';
import { useLocationStore } from '../store/useLocationStore';

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

  const reverseGeocodeWithCache = useCallback(async (coords: { latitude: number; longitude: number }) => {
    // Utiliser le service centralisé de localisation pour le reverse geocoding
    // Le service utilise Mapbox pour le géocodage
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

  const requestLocation = useCallback(async (opts?: { forceRefresh?: boolean }) => {
    const forceRefresh = opts?.forceRefresh === true;
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const coords = await locationService.getCurrentPosition(forceRefresh);

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

        setState(prev => ({
          ...prev,
          coords: { latitude: retryCoords.latitude, longitude: retryCoords.longitude },
          hasPermission: true,
          loading: false,
        }));

        await reverseGeocodeWithCache(retryCoords);
        return { latitude: retryCoords.latitude, longitude: retryCoords.longitude };
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

  /** Affichage immédiat depuis AsyncStorage + alignement hook quand le store change */
  useEffect(() => {
    const syncFromStore = () => {
      const cl = useLocationStore.getState().currentLocation;
      const perm = useLocationStore.getState().locationPermission;
      if (cl?.latitude != null && cl.longitude != null) {
        locationService.applyPersistedSnapshot(cl);
        setState((prev) => ({
          ...prev,
          coords: { latitude: cl.latitude, longitude: cl.longitude },
          address: cl.address?.trim() ? cl.address.trim() : prev.address,
          hasPermission: perm === 'granted' ? true : prev.hasPermission,
          loading: prev.loading,
        }));
      }
    };

    syncFromStore();
    return useLocationStore.subscribe(syncFromStore);
  }, []);

  useEffect(() => {
    void requestLocation({ forceRefresh: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 

  return {
    ...state,
    requestLocation,
    reverseGeocode: reverseGeocodeWithCache,
  };
};