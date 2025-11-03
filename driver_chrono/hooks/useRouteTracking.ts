import { useState, useEffect, useRef, useCallback } from 'react';
import { config } from '../config';
import { logger } from '../utils/logger';

interface Coordinates {
  latitude: number;
  longitude: number;
}

interface RouteResult {
  coordinates: Coordinates[];
  duration: number; // en secondes
  distance: number; // en mètres
}

/**
 * Hook pour récupérer et tracker une route en temps réel
 * Inspiré de Yango pour une expérience fluide
 */
export const useRouteTracking = (
  currentLocation: Coordinates | null,
  destination: Coordinates | null,
  enabled: boolean = true
) => {
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const GOOGLE_API_KEY = config.googleApiKey;

  // Décoder polyline Google
  const decodePolyline = useCallback((encoded: string): Coordinates[] => {
    const points: Coordinates[] = [];
    let index = 0;
    const len = encoded.length;
    let lat = 0;
    let lng = 0;

    while (index < len) {
      let b: number;
      let shift = 0;
      let result = 0;

      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);

      const dlat = ((result & 1) !== 0 ? ~(result >> 1) : (result >> 1));
      lat += dlat;

      shift = 0;
      result = 0;

      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);

      const dlng = ((result & 1) !== 0 ? ~(result >> 1) : (result >> 1));
      lng += dlng;

      points.push({
        latitude: lat * 1e-5,
        longitude: lng * 1e-5,
      });
    }

    return points;
  }, []);

  // Récupérer la route depuis Google Directions API
  const fetchRoute = useCallback(async (origin: Coordinates, dest: Coordinates): Promise<RouteResult | null> => {
    if (!GOOGLE_API_KEY || GOOGLE_API_KEY.startsWith('<')) {
      logger.warn('Google API key not configured', 'useRouteTracking');
      return null;
    }

    try {
      const url = `https://maps.googleapis.com/maps/api/directions/json?` +
        `origin=${origin.latitude},${origin.longitude}` +
        `&destination=${dest.latitude},${dest.longitude}` +
        `&mode=driving` +
        `&departure_time=now` +
        `&traffic_model=best_guess` +
        `&alternatives=false` +
        `&key=${GOOGLE_API_KEY}`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.status === 'OK' && data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const leg = route.legs[0];

        // Décoder la polyline
        const coordinates = decodePolyline(route.overview_polyline.points);

        // S'assurer que les points de départ et d'arrivée sont inclus
        const startPoint = { latitude: origin.latitude, longitude: origin.longitude };
        const endPoint = { latitude: dest.latitude, longitude: dest.longitude };

        // Vérifier si le premier point est proche de l'origine
        const isClose = (a: Coordinates, b: Coordinates, threshold = 0.001) => {
          return Math.abs(a.latitude - b.latitude) < threshold &&
                 Math.abs(a.longitude - b.longitude) < threshold;
        };

        if (coordinates.length > 0 && !isClose(coordinates[0], startPoint)) {
          coordinates.unshift(startPoint);
        }

        if (coordinates.length > 0 && !isClose(coordinates[coordinates.length - 1], endPoint)) {
          coordinates.push(endPoint);
        }

        return {
          coordinates,
          duration: leg.duration.value,
          distance: leg.distance.value,
        };
      } else {
        logger.warn(`Google Directions API error: ${data.status}`, 'useRouteTracking');
        return null;
      }
    } catch (err) {
      logger.error('Error fetching route', 'useRouteTracking', err);
      return null;
    }
  }, [GOOGLE_API_KEY, decodePolyline]);

  // Recalculer la route quand la position ou la destination change
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

    // Debounce pour éviter trop de requêtes
    const timeoutId = setTimeout(calculateRoute, 500);
    return () => clearTimeout(timeoutId);
  }, [currentLocation?.latitude, currentLocation?.longitude, destination?.latitude, destination?.longitude, enabled, fetchRoute]);

  // Recalculer la route périodiquement (toutes les 30 secondes) pour prendre en compte le trafic
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
    }, 30000); // 30 secondes

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

