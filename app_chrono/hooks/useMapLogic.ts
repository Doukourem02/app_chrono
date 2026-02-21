import { useEffect, useRef, useState } from 'react';
import { Alert, Animated, Dimensions } from 'react-native';
import * as Location from 'expo-location';
import { useShipmentStore } from '../store/useShipmentStore';
import { logger } from '../utils/logger';
import { useErrorHandler } from '../utils/errorHandler';
import { config } from '../config';
import { locationService } from '../services/locationService';
import { fetchMapboxDirections } from '../utils/mapboxDirections';

type Coordinates = {
  latitude: number;
  longitude: number;
};

export interface MapRefHandle {
  fitToCoordinates: (coords: Coordinates[], opts: { edgePadding: { top: number; right: number; bottom: number; left: number }; animated: boolean }) => void;
  animateToRegion: (region: { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number }, duration: number) => void;
}

interface UseMapLogicParams {
  mapRef: React.RefObject<MapRefHandle | null>;
}

export const useMapLogic = ({ mapRef }: UseMapLogicParams) => {
  const {
    pickupLocation,
    deliveryLocation,
    selectedMethod,
    setPickupLocation,
    setDeliveryLocation,
  } = useShipmentStore();
  
  const { handleError } = useErrorHandler();
  
  const [region, setRegion] = useState<{ latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number } | null>(null);
  const [pickupCoords, setPickupCoords] = useState<Coordinates | null>(null);
  const [dropoffCoords, setDropoffCoords] = useState<Coordinates | null>(null);
  const [displayedRouteCoords, setDisplayedRouteCoords] = useState<Coordinates[]>([]);
  const [durationText, setDurationText] = useState<string | null>(null);
  const [arrivalTimeText, setArrivalTimeText] = useState<string | null>(null);
  const [driverCoords, setDriverCoords] = useState<Coordinates | null>(null);
  const [showMethodSelection, setShowMethodSelection] = useState(false);
  const [cameraAnimationDuration, setCameraAnimationDuration] = useState(0);

  const polylineAnimRef = useRef<number | null>(null);
  const destinationPulseAnim = useRef(new Animated.Value(0)).current;
  const userPulseAnim = useRef(new Animated.Value(0)).current;
  const MAPBOX_TOKEN = config.mapboxAccessToken;

  const simplifyRoute = (points: Coordinates[], tolerance = 0.00002): Coordinates[] => {
    if (!points || points.length <= 2) return points;

    const sqTolerance = tolerance * tolerance;

    const sqDist = (a: Coordinates, b: Coordinates) => {
      const dx = a.latitude - b.latitude;
      const dy = a.longitude - b.longitude;
      return dx * dx + dy * dy;
    };

    const simplifyRadialDistance = (pts: Coordinates[], sqTol: number) => {
      const newPoints: Coordinates[] = [pts[0]];
      let prevPoint = pts[0];

      for (let i = 1; i < pts.length; i++) {
        const point = pts[i];
        if (sqDist(point, prevPoint) > sqTol) {
          newPoints.push(point);
          prevPoint = point;
        }
      }

      if (prevPoint !== pts[pts.length - 1]) {
        newPoints.push(pts[pts.length - 1]);
      }

      return newPoints;
    };

    const sqSegDist = (p: Coordinates, a: Coordinates, b: Coordinates) => {
      let x = a.latitude;
      let y = a.longitude;
      let dx = b.latitude - x;
      let dy = b.longitude - y;

      if (dx !== 0 || dy !== 0) {
        const t = ((p.latitude - x) * dx + (p.longitude - y) * dy) / (dx * dx + dy * dy);
        if (t > 1) {
          x = b.latitude;
          y = b.longitude;
        } else if (t > 0) {
          x += dx * t;
          y += dy * t;
        }
      }

      dx = p.latitude - x;
      dy = p.longitude - y;

      return dx * dx + dy * dy;
    };

    const simplifyDouglasPeucker = (pts: Coordinates[], sqTol: number) => {
      const last = pts.length - 1;
      const stack: [number, number][] = [[0, last]];
      const keep: boolean[] = new Array(pts.length).fill(false);
      keep[0] = keep[last] = true;

      while (stack.length) {
        const [start, end] = stack.pop()!;
        let maxDist = 0;
        let index = 0;

        for (let i = start + 1; i < end; i++) {
          const dist = sqSegDist(pts[i], pts[start], pts[end]);
          if (dist > maxDist) {
            index = i;
            maxDist = dist;
          }
        }

        if (maxDist > sqTol) {
          keep[index] = true;
          stack.push([start, index], [index, end]);
        }
      }

      return pts.filter((_, i) => keep[i]);
    };

    const radialSimplified = simplifyRadialDistance(points, sqTolerance);
    return simplifyDouglasPeucker(radialSimplified, sqTolerance);
  };

  // Animation de la polyline
  const animatePolyline = (points: Coordinates[]) => {
    try {
      if (polylineAnimRef.current) {
        cancelAnimationFrame(polylineAnimRef.current as any);
        polylineAnimRef.current = null;
      }
    } catch {}

    if (!points || points.length <= 1) {
      setDisplayedRouteCoords(points || []);
      return;
    }

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
    for (let i = 1; i < points.length; i++) totalKm += haversineKm(points[i - 1], points[i]);

    // Durée visible : ~1s min, ~2.5s max - juste milieu entre trop rapide et trop lent
    const totalDuration = Math.min(Math.max(1000 + totalKm * 500, 1000), 2500);
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

      setDisplayedRouteCoords(displayed);

      if (t < 1) {
        polylineAnimRef.current = requestAnimationFrame(step) as any;
      } else {
        polylineAnimRef.current = null;
        setDisplayedRouteCoords(points);
      }
    };

    polylineAnimRef.current = requestAnimationFrame(step) as any;
  };

  // Animation pulse pour la destination
  const startDestinationPulse = () => {
    const animation = Animated.loop(
      Animated.timing(destinationPulseAnim, {
        toValue: 1,
        duration: 1500,
        useNativeDriver: true,
      })
    );
    animation.start();
  };

  // Arrêter l'animation pulse pour la destination
  const stopDestinationPulse = () => {
    destinationPulseAnim.stopAnimation();
    destinationPulseAnim.setValue(0);
  };

  // Arrêter l'animation pulse pour le marqueur utilisateur
  const stopUserPulse = () => {
    userPulseAnim.stopAnimation();
    userPulseAnim.setValue(0);
  };

  // Clear route and related animations/state
  const clearRoute = () => {
    try {
      if (polylineAnimRef.current) {
        cancelAnimationFrame(polylineAnimRef.current as any);
        polylineAnimRef.current = null;
      }
    } catch {}

    setDisplayedRouteCoords([]);
    setDurationText(null);
    setArrivalTimeText(null);
    stopDestinationPulse();
  };

  // Réinitialiser l'état après recherche chauffeur
  const resetAfterDriverSearch = () => {
    setShowMethodSelection(false);
    stopUserPulse();
    // Redémarrer l'animation destination si on a un itinéraire
    if (displayedRouteCoords.length > 0) {
      startDestinationPulse();
    }
  };

  // Démarrer le mode sélection de méthode
  const startMethodSelection = () => {
    setShowMethodSelection(true);
    stopDestinationPulse();
  };

  // Récupérer l'itinéraire via Mapbox Directions API
  const fetchRoute = async (pickup: Coordinates, dropoff: Coordinates) => {
    if (!MAPBOX_TOKEN || MAPBOX_TOKEN.startsWith('<')) {
      logger.warn('Mapbox token not set - cannot fetch directions', 'useMapLogic');
      return;
    }

    try {
      const result = await fetchMapboxDirections(
        { lat: pickup.latitude, lng: pickup.longitude },
        { lat: dropoff.latitude, lng: dropoff.longitude },
        MAPBOX_TOKEN
      );

      if (result && result.coordinates.length > 0) {
        let points = result.coordinates.map((c) => ({ latitude: c.lat, longitude: c.lng }));
        points = simplifyRoute(points);

        // Forcer le premier et dernier point exactement sur pickup/dropoff pour que la polyline soit collée aux marqueurs
        const exactPickup = { latitude: pickup.latitude, longitude: pickup.longitude };
        const exactDropoff = { latitude: dropoff.latitude, longitude: dropoff.longitude };
        if (points.length > 0) {
          points[0] = exactPickup;
          points[points.length - 1] = exactDropoff;
        }

        animatePolyline(points);
        startDestinationPulse();

        const vehicleMultiplier = selectedMethod === 'moto' ? 0.85 : selectedMethod === 'cargo' ? 1.25 : 1.0;
        const chosenSeconds = result.durationTypical ?? result.duration;
        if (chosenSeconds) {
          const adjustedSeconds = Math.round(chosenSeconds * vehicleMultiplier);
          setDurationText(adjustedSeconds < 60 ? `${adjustedSeconds} sec` : `${Math.round(adjustedSeconds / 60)} min`);
          const arrivalDate = new Date(Date.now() + adjustedSeconds * 1000);
          const hours = arrivalDate.getHours();
          const minutes = arrivalDate.getMinutes();
          setArrivalTimeText(`arrive à ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`);
        } else {
          setDurationText(null);
          setArrivalTimeText(null);
        }

        fitRoute(points);
      }
    } catch (err) {
      handleError(err, 'useMapLogic', 'Erreur lors de la récupération de l\'itinéraire');
    }
  };

  // Gestion de la caméra : zoom arrière animé pour voir toute la polyline
  const fitRoute = (coords: Coordinates[]) => {
    if (coords.length === 0) return;
    const lngs = coords.map((c) => c.longitude);
    const lats = coords.map((c) => c.latitude);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    // Padding en degrés : plus généreux pour que la polyline soit visible au-dessus du bottom sheet
    const { height: screenHeight } = Dimensions.get('window');
    const bottomSheetHeight = screenHeight * 0.55;
    const padLat = Math.max(0.004, (maxLat - minLat) * 0.4);
    const padLng = Math.max(0.005, (maxLng - minLng) * 0.4);
    const centerLat = (minLat + maxLat) / 2;
    const centerLng = (minLng + maxLng) / 2;
    const latDelta = (maxLat - minLat) + padLat * 2;
    const lngDelta = (maxLng - minLng) + padLng * 2;
    setRegion({
      latitude: centerLat,
      longitude: centerLng,
      latitudeDelta: latDelta,
      longitudeDelta: lngDelta,
    });
    setCameraAnimationDuration(1200);
    // Appel impératif pour l'animation fluide (si disponible)
    try {
      mapRef.current?.fitToCoordinates?.(coords, {
        edgePadding: { top: 80, right: 40, bottom: bottomSheetHeight, left: 40 },
        animated: true,
      });
    } catch {
      // Fallback : region déjà mise à jour ci-dessus
    }
  };

  const animateToCoordinate = (coordinate: Coordinates, delta = 0.01) => {
    const newRegion = {
      latitude: coordinate.latitude,
      longitude: coordinate.longitude,
      latitudeDelta: delta,
      longitudeDelta: delta,
    };
    setRegion(newRegion);
    setCameraAnimationDuration(1000);
    try {
      mapRef.current?.animateToRegion?.(newRegion, 1000);
    } catch {
      // Fallback : region déjà mise à jour
    }
  };

  /** Dézoomer / revenir à la vue complète : route si disponible, sinon zone élargie autour de la position */
  const zoomOutToFit = () => {
    const coordsToFit: Coordinates[] = [];
    if (displayedRouteCoords.length > 0) {
      coordsToFit.push(...displayedRouteCoords);
    } else if (pickupCoords && dropoffCoords) {
      coordsToFit.push(pickupCoords, dropoffCoords);
    }
    if (coordsToFit.length > 0) {
      fitRoute(coordsToFit);
    } else if (pickupCoords) {
      animateToCoordinate(pickupCoords, 0.025);
    } else if (region) {
      animateToCoordinate({ latitude: region.latitude, longitude: region.longitude }, 0.03);
    }
  };

  // Initialiser la position
  useEffect(() => {
    let isMounted = true;

    (async () => {
      try {
        const coords = await locationService.getCurrentPosition(true);

        if (!coords || !isMounted) {
          if (!isMounted) return;
          Alert.alert('Permission refusée', 'Activez la localisation pour utiliser la carte.');
          return;
        }

        const { latitude, longitude } = coords;

        const newRegion = {
          latitude,
          longitude,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        };

        setRegion(newRegion);
        setPickupCoords({ latitude, longitude });

        // Reverse geocoding : Mapbox (priorité) > Nominatim > Google > Expo (via locationService)
        const address = await locationService.reverseGeocode({
          latitude,
          longitude,
          timestamp: Date.now(),
        });

        if (address && isMounted) {
          useShipmentStore.getState().setPickupLocation(address);
        } else if (isMounted) {
          // Fallback Expo si le service n'a rien retourné
          try {
            const geocoded = await Location.reverseGeocodeAsync({ latitude, longitude });
            if (geocoded?.length > 0 && isMounted) {
              const place = geocoded[0];
              const parts = [place.name, place.street, place.district || place.city, place.region];
              const addr = parts.filter(Boolean).join(', ');
              if (addr) useShipmentStore.getState().setPickupLocation(addr);
            } else {
              useShipmentStore.getState().setPickupLocation(`Position: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
            }
          } catch {
            if (isMounted) {
              useShipmentStore.getState().setPickupLocation(`Position: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
            }
          }
        }

        await locationService.startWatching();
      } catch (error) {
        if (isMounted) {
          logger.error('Location permission or access failed', 'useMapLogic', error);
          Alert.alert('Erreur', 'Impossible d\'accéder à votre position');
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  // Générer des véhicules disponibles
  const getAvailableVehicles = () => {
    if (!pickupCoords) return [];
    
    return [
      {
        id: 1,
        coordinate: {
          latitude: pickupCoords.latitude + 0.01,
          longitude: pickupCoords.longitude + 0.01,
        },
        type: selectedMethod,
      },
      {
        id: 2,
        coordinate: {
          latitude: pickupCoords.latitude - 0.01,
          longitude: pickupCoords.longitude - 0.01,
        },
        type: selectedMethod,
      },
      {
        id: 3,
        coordinate: {
          latitude: pickupCoords.latitude + 0.015,
          longitude: pickupCoords.longitude - 0.008,
        },
        type: selectedMethod,
      },
      {
        id: 4,
        coordinate: {
          latitude: pickupCoords.latitude - 0.012,
          longitude: pickupCoords.longitude + 0.015,
        },
        type: selectedMethod,
      },
    ];
  };

  useEffect(() => {
    if (cameraAnimationDuration > 0) {
      const t = setTimeout(() => setCameraAnimationDuration(0), 1500);
      return () => clearTimeout(t);
    }
  }, [cameraAnimationDuration]);

  return {
    // États
    region,
    cameraAnimationDuration,
    pickupCoords,
    dropoffCoords,
    displayedRouteCoords,
    durationText,
    arrivalTimeText,
    driverCoords,
    pickupLocation,
    deliveryLocation,
    selectedMethod,
    showMethodSelection,
    destinationPulseAnim,
    userPulseAnim,
    
    // Actions
    setPickupCoords,
    setDropoffCoords,
    setDriverCoords,
    setPickupLocation,
    setDeliveryLocation,
    fetchRoute,
    getAvailableVehicles,
    fitRoute,
    animateToCoordinate,
    zoomOutToFit,
    startMethodSelection,
    stopDestinationPulse,
    stopUserPulse,
    resetAfterDriverSearch,
    clearRoute,
  };
};