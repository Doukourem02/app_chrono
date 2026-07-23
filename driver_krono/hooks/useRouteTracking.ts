import { useState, useEffect, useCallback } from 'react';
import { config } from '../config';
import { logger } from '../utils/logger';
import { fetchMapboxDirections } from '../utils/mapboxDirections';

interface Coordinates {
  latitude: number;
  longitude: number;
}

interface RouteResult {
  coordinates: Coordinates[];
  duration: number; // en secondes
  distance: number; // en mètres
  durationTypical?: number; // trafic Mapbox
}

export const useRouteTracking = (
  currentLocation: Coordinates | null,
  destination: Coordinates | null,
  enabled: boolean = true
) => {
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const MAPBOX_TOKEN = config.mapboxAccessToken;

  const fetchRoute = useCallback(async (origin: Coordinates, dest: Coordinates): Promise<RouteResult | null> => {
    if (!MAPBOX_TOKEN || MAPBOX_TOKEN.startsWith('<')) {
      logger.warn('Mapbox token not configured', 'useRouteTracking');
      return null;
    }

    try {
      const result = await fetchMapboxDirections(
        { lat: origin.latitude, lng: origin.longitude },
        { lat: dest.latitude, lng: dest.longitude },
        MAPBOX_TOKEN
      );

      if (!result) return null;

      const coordinates: Coordinates[] = result.coordinates.map((c) => ({
        latitude: c.lat,
        longitude: c.lng,
      }));

      return {
        coordinates,
        duration: result.duration,
        distance: result.distance,
        durationTypical: result.durationTypical,
      };
    } catch (err) {
      logger.error('Error fetching route', 'useRouteTracking', err);
      return null;
    }
  }, [MAPBOX_TOKEN]);

  useEffect(() => {
    if (!enabled || !currentLocation || !destination) {
      setRoute(null);
      return;
    }

    const calculateRoute = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const routeResult = await fetchRoute(currentLocation, destination);
        if (routeResult) {
          setRoute(routeResult);
        } else {
          setError('Impossible de calculer l\'itinéraire');
        }
      } catch (err) {
        setError('Erreur lors du calcul de l\'itinéraire');
        logger.error('Route calculation error', 'useRouteTracking', err);
      } finally {
        setIsLoading(false);
      }
    };

    const timeoutId = setTimeout(calculateRoute, 500);
    return () => clearTimeout(timeoutId);
  }, [currentLocation, destination, enabled, fetchRoute]);

  useEffect(() => {
    if (!enabled || !currentLocation || !destination || !route) return;

    const interval = setInterval(async () => {
      try {
        const updatedRoute = await fetchRoute(currentLocation, destination);
        if (updatedRoute) {
          setRoute(updatedRoute);
        }
      } catch (err) {
        logger.warn('Periodic route update failed', 'useRouteTracking', err);
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [currentLocation, destination, enabled, route, fetchRoute]);

  return {
    route,
    isLoading,
    error,
    refetch: () => {
      if (currentLocation && destination) {
        fetchRoute(currentLocation, destination).then(setRoute);
      }
    },
  };
};
