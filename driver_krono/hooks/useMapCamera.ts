import { useEffect, useRef, useCallback } from 'react';
import { logger } from '../utils/logger';

interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface MapRefHandle {
  fitToCoordinates: (coords: Coordinates[], opts: { edgePadding: { top: number; right: number; bottom: number; left: number }; animated: boolean }) => void;
  animateToRegion: (region: { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number }, duration: number) => void;
}

interface RouteCoordinates {
  coordinates: Coordinates[];
}

export const useMapCamera = (
  mapRef: React.RefObject<MapRefHandle | null>,
  driverLocation: Coordinates | null,
  route: RouteCoordinates | null,
  currentOrder: any | null,
  isTracking: boolean = true
) => {
  const lastCameraUpdate = useRef<number>(0);
  const CAMERA_UPDATE_INTERVAL = 3000; 

  useEffect(() => {
    if (!isTracking || !driverLocation || !mapRef.current) return;
    
    if (!currentOrder) {
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

    if (route && route.coordinates.length > 0) {
      const now = Date.now();
      if (now - lastCameraUpdate.current > CAMERA_UPDATE_INTERVAL) {
        try {
          const pointsToFit = [
            driverLocation,
            ...route.coordinates.slice(0, Math.floor(route.coordinates.length / 3)),
            route.coordinates[route.coordinates.length - 1],
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

