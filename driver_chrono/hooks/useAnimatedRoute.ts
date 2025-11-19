import { useState, useEffect, useRef, useCallback } from 'react';
import { config } from '../config';

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
 * Hook pour obtenir une route animée entre deux points en utilisant Google Directions API
 * Retourne les coordonnées progressives pour animer le dessin de la polyline
 */
export const useAnimatedRoute = ({
  origin,
  destination,
  enabled = true,
  onRouteCalculated,
}: UseAnimatedRouteOptions) => {
  const [routeCoordinates, setRouteCoordinates] = useState<Coordinates[]>([]);
  const [animatedCoordinates, setAnimatedCoordinates] = useState<Coordinates[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const animationRef = useRef<number | null>(null);
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

  // Obtenir la route depuis Google Directions API
  const fetchRoute = useCallback(async (origin: Coordinates, dest: Coordinates): Promise<Coordinates[] | null> => {
    if (!GOOGLE_API_KEY || GOOGLE_API_KEY.startsWith('<')) {
      return null;
    }

    try {
      const departureTs = Math.floor(Date.now() / 1000);
      const url = `https://maps.googleapis.com/maps/api/directions/json?` +
        `origin=${origin.latitude},${origin.longitude}` +
        `&destination=${dest.latitude},${dest.longitude}` +
        `&mode=driving` +
        `&departure_time=${departureTs}` +
        `&traffic_model=best_guess` +
        `&alternatives=false` +
        `&key=${GOOGLE_API_KEY}`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.status === 'OK' && data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        let points = decodePolyline(route.overview_polyline.points);

        // S'assurer que les points de départ et d'arrivée sont inclus
        const almostEqual = (a: Coordinates, b: Coordinates, eps = 0.0001) =>
          Math.abs(a.latitude - b.latitude) < eps && Math.abs(a.longitude - b.longitude) < eps;

        if (points.length > 0 && !almostEqual(points[0], origin)) {
          points = [{ latitude: origin.latitude, longitude: origin.longitude }, ...points];
        }

        if (points.length > 0 && !almostEqual(points[points.length - 1], dest)) {
          points = [...points, { latitude: dest.latitude, longitude: dest.longitude }];
        }

        return points;
      } else {
        return null;
      }
    } catch (err) {
      console.error('Error fetching route:', err);
      return null;
    }
  }, [GOOGLE_API_KEY, decodePolyline]);

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
    isLoading,
    error,
    refetch: () => {
      if (origin && destination) {
        fetchRoute(origin, destination).then((route) => {
          if (route) {
            setRouteCoordinates(route);
            animateRoute(route);
          }
        });
      }
    },
  };
};

