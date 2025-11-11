import { useEffect, useRef, useCallback } from 'react';
import MapView from 'react-native-maps';
import { logger } from '../utils/logger';

interface Coordinates {
  latitude: number;
  longitude: number;
}

interface RouteCoordinates {
  coordinates: Coordinates[];
}

/**
 * Hook pour gérer la caméra de la map de manière fluide
 * - Suit automatiquement le driver
 * - Auto-fit pour inclure driver + destination
 * - Animations smooth comme Yango
 */
export const useMapCamera = (
  mapRef: React.RefObject<MapView>,
  driverLocation: Coordinates | null,
  route: RouteCoordinates | null,
  currentOrder: any | null,
  isTracking: boolean = true
) => {
  const lastCameraUpdate = useRef<number>(0);
  const CAMERA_UPDATE_INTERVAL = 3000; // Mise à jour caméra toutes les 3 secondes max

  // Suivre automatiquement le driver avec la route visible
  useEffect(() => {
    if (!isTracking || !driverLocation || !mapRef.current) return;
    if (!currentOrder) {
      // Si pas de commande, centrer sur le driver
      const now = Date.now();
      if (now - lastCameraUpdate.current > CAMERA_UPDATE_INTERVAL) {
        try {
          mapRef.current.animateToRegion({
            latitude: driverLocation.latitude,
            longitude: driverLocation.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }, 1000);
          lastCameraUpdate.current = now;
        } catch (err) {
          logger.warn('Camera animation error', 'useMapCamera', err);
        }
      }
      return;
    }

    // Si on a une route, fit la map pour inclure driver + route
    if (route && route.coordinates.length > 0) {
      const now = Date.now();
      if (now - lastCameraUpdate.current > CAMERA_UPDATE_INTERVAL) {
        try {
          // Créer une liste de points à inclure : driver + quelques points de la route
          const pointsToFit = [
            driverLocation,
            ...route.coordinates.slice(0, Math.floor(route.coordinates.length / 3)), // Premier tiers de la route
            route.coordinates[route.coordinates.length - 1], // Destination
          ].filter((point): point is Coordinates => point !== null);

          mapRef.current.fitToCoordinates(pointsToFit, {
            edgePadding: {
              top: 100,
              right: 50,
              bottom: 200,
              left: 50,
            },
            animated: true,
          });

          lastCameraUpdate.current = now;
        } catch (err) {
          logger.warn('Camera fit error', 'useMapCamera', err);
        }
      }
    } else {
      // Pas de route, juste suivre le driver
      const now = Date.now();
      if (now - lastCameraUpdate.current > CAMERA_UPDATE_INTERVAL) {
        try {
          mapRef.current.animateToRegion({
            latitude: driverLocation.latitude,
            longitude: driverLocation.longitude,
            latitudeDelta: 0.015,
            longitudeDelta: 0.015,
          }, 1000);
          lastCameraUpdate.current = now;
        } catch (err) {
          logger.warn('Camera follow error', 'useMapCamera', err);
        }
      }
    }
  }, [driverLocation, route, currentOrder, isTracking, mapRef]);

  // Fonction pour fit sur la route complète (appelée manuellement si besoin)
  const fitToRoute = () => {
    if (!route || !mapRef.current) return;

    try {
      mapRef.current.fitToCoordinates(route.coordinates, {
        edgePadding: {
          top: 100,
          right: 50,
          bottom: 200,
          left: 50,
        },
        animated: true,
      });
    } catch (err) {
      logger.warn('Fit to route error', 'useMapCamera', err);
    }
  };

  // Fonction pour centrer sur le driver
  const centerOnDriver = useCallback(() => {
    if (!driverLocation || !mapRef.current) return;

    try {
      mapRef.current.animateToRegion({
        latitude: driverLocation.latitude,
        longitude: driverLocation.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }, 500);
    } catch (err) {
      logger.warn('Center on driver error', 'useMapCamera', err);
    }
  }, [driverLocation, mapRef]);

  return {
    fitToRoute,
    centerOnDriver,
  };
};

