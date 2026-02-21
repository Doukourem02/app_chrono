import { useState, useEffect, useRef, useCallback } from 'react';
import { config } from '../config';
import { type TrafficData } from '../utils/trafficUtils';
import { logger } from '../utils/logger';
import { fetchMapboxDirections } from '../utils/mapboxDirections';

type Coordinates = {
  latitude: number;
  longitude: number;
};

interface UseAnimatedRouteOptions {
  origin: Coordinates | null;
  destination: Coordinates | null;
  enabled?: boolean;
  onRouteCalculated?: (route: Coordinates[]) => void;
}

/**
 * Hook pour obtenir une route animée entre deux points via Mapbox Directions API
 */
export const useAnimatedRoute = ({
  origin,
  destination,
  enabled = true,
  onRouteCalculated,
}: UseAnimatedRouteOptions) => {
  const [routeCoordinates, setRouteCoordinates] = useState<Coordinates[]>([]);
  const [animatedCoordinates, setAnimatedCoordinates] = useState<Coordinates[]>([]);
  const [trafficData, setTrafficData] = useState<TrafficData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const animationRef = useRef<number | null>(null);
  const lastRecalcRef = useRef<number>(0);
  const MAPBOX_TOKEN = config.mapboxAccessToken;
  const TRAFFIC_RECALC_INTERVAL = 2 * 60 * 1000;

  // Obtenir la route depuis Mapbox Directions API
  const fetchRoute = useCallback(async (orig: Coordinates, dest: Coordinates): Promise<Coordinates[] | null> => {
    if (!MAPBOX_TOKEN || MAPBOX_TOKEN.startsWith('<')) return null;

    try {
      const result = await fetchMapboxDirections(
        { lat: orig.latitude, lng: orig.longitude },
        { lat: dest.latitude, lng: dest.longitude },
        MAPBOX_TOKEN
      );

      if (result && result.coordinates.length > 0) {
        setTrafficData({
          durationInTraffic: result.durationTypical ?? result.duration,
          durationBase: result.duration,
          hasTrafficData: !!result.durationTypical,
        });

        let points = result.coordinates.map((c) => ({ latitude: c.lat, longitude: c.lng }));
        const almostEqual = (a: Coordinates, b: Coordinates, eps = 0.0001) =>
          Math.abs(a.latitude - b.latitude) < eps && Math.abs(a.longitude - b.longitude) < eps;

        if (points.length > 0 && !almostEqual(points[0], orig)) {
          points = [{ latitude: orig.latitude, longitude: orig.longitude }, ...points];
        }
        if (points.length > 0 && !almostEqual(points[points.length - 1], dest)) {
          points = [...points, { latitude: dest.latitude, longitude: dest.longitude }];
        }

        return points;
      }
      return null;
    } catch (err) {
      logger.error('Error fetching route:', undefined, err);
      return null;
    }
  }, [MAPBOX_TOKEN]);

  // Animer le dessin progressif de la route
  const animateRoute = useCallback((points: Coordinates[]) => {
    // Arrêter l'animation précédente
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }

    if (!points || points.length <= 1) {
      setAnimatedCoordinates(points || []);
      return;
    }

    // Calculer la distance totale pour déterminer la durée de l'animation
    const haversineKm = (a: Coordinates, b: Coordinates) => {
      const toRad = (v: number) => (v * Math.PI) / 180;
      const R = 6371;
      const dLat = toRad(b.latitude - a.latitude);
      const dLon = toRad(b.longitude - a.longitude);
      const lat1 = toRad(a.latitude);
      const lat2 = toRad(b.latitude);
      const aa = Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
      const c = 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
      return R * c;
    };

    let totalKm = 0;
    for (let i = 1; i < points.length; i++) {
      totalKm += haversineKm(points[i - 1], points[i]);
    }

    // Durée de l'animation basée sur la distance (min 300ms, max 2000ms)
    const totalDuration = Math.min(Math.max(300 + totalKm * 400, 300), 2000);
    const start = Date.now();

    const step = () => {
      const now = Date.now();
      const t = Math.min(1, (now - start) / totalDuration);
      const exactIndex = t * (points.length - 1);
      const idx = Math.floor(exactIndex);
      const frac = exactIndex - idx;

      const displayed = points.slice(0, idx + 1);
      if (idx < points.length - 1) {
        const a = points[idx];
        const b = points[idx + 1];
        const interp = {
          latitude: a.latitude + (b.latitude - a.latitude) * frac,
          longitude: a.longitude + (b.longitude - a.longitude) * frac,
        };
        displayed.push(interp);
      }

      setAnimatedCoordinates(displayed);

      if (t < 1) {
        animationRef.current = requestAnimationFrame(step) as any;
      } else {
        animationRef.current = null;
        setAnimatedCoordinates(points);
      }
    };

    animationRef.current = requestAnimationFrame(step) as any;
  }, []);

  // Charger la route quand origin/destination changent
  useEffect(() => {
    if (!enabled || !origin || !destination) {
      setRouteCoordinates([]);
      setAnimatedCoordinates([]);
      setTrafficData(null);
      return;
    }

    const loadRoute = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const route = await fetchRoute(origin, destination);
        if (route && route.length > 0) {
          setRouteCoordinates(route);
          onRouteCalculated?.(route);
          // Démarrer l'animation
          animateRoute(route);
          lastRecalcRef.current = Date.now();
        } else {
          // Fallback: ligne droite si pas de route disponible
          const fallbackRoute = [origin, destination];
          setRouteCoordinates(fallbackRoute);
          setAnimatedCoordinates(fallbackRoute);
          setError('Route non disponible, affichage ligne droite');
        }
      } catch {
        setError('Erreur lors du calcul de la route');
        // Ne pas fallback sur une ligne droite : garder les coordonnées existantes pour éviter une ligne aberrante
      } finally {
        setIsLoading(false);
      }
    };

    const timeoutId = setTimeout(loadRoute, 300); // Debounce
    return () => clearTimeout(timeoutId);
  }, [origin, destination, enabled, fetchRoute, animateRoute, onRouteCalculated]);

  // Recalcul périodique pour tenir compte du trafic en temps réel
  useEffect(() => {
    if (!enabled || !origin || !destination || routeCoordinates.length === 0) {
      return;
    }

    const recalculateRoute = async () => {
      const now = Date.now();
      const timeSinceLastRecalc = now - lastRecalcRef.current;

      // Recalculer toutes les 2 minutes pour tenir compte du trafic
      if (timeSinceLastRecalc >= TRAFFIC_RECALC_INTERVAL) {
        try {
          const route = await fetchRoute(origin, destination);
          if (route && route.length > 0) {
            // Mettre à jour les coordonnées si la route a changé significativement
            setRouteCoordinates(route);
            lastRecalcRef.current = Date.now();
          }
        } catch (err) {
          // Ignorer les erreurs silencieusement pour ne pas perturber l'utilisateur
          logger.debug('Erreur recalcul route trafic:', undefined, err);
        }
      }
    };

    // Vérifier toutes les 30 secondes si un recalcul est nécessaire
    const intervalId = setInterval(recalculateRoute, 30 * 1000);
    return () => clearInterval(intervalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, origin, destination, routeCoordinates.length, fetchRoute]);

  // Nettoyer l'animation au démontage
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  return {
    routeCoordinates,
    animatedCoordinates,
    trafficData,
    isLoading,
    error,
    refetch: () => {
      if (origin && destination) {
        fetchRoute(origin, destination).then((route) => {
          if (route) {
            setRouteCoordinates(route);
            animateRoute(route);
            lastRecalcRef.current = Date.now();
          }
        });
      }
    },
  };
};

