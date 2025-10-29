import { useEffect, useRef, useState } from 'react';
import { Alert, Animated } from 'react-native';
import * as Location from 'expo-location';
import MapView, { Region } from 'react-native-maps';
import { useShipmentStore } from '../store/useShipmentStore';
import { logger } from '../utils/logger';
import { useErrorHandler } from '../utils/errorHandler';
import { config } from '../config';

type Coordinates = {
  latitude: number;
  longitude: number;
};

interface UseMapLogicParams {
  mapRef: React.RefObject<MapView>;
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
  
  const [region, setRegion] = useState<Region | null>(null);
  const [pickupCoords, setPickupCoords] = useState<Coordinates | null>(null);
  const [dropoffCoords, setDropoffCoords] = useState<Coordinates | null>(null);
  const [displayedRouteCoords, setDisplayedRouteCoords] = useState<Coordinates[]>([]);
  const [durationText, setDurationText] = useState<string | null>(null);
  const [driverCoords, setDriverCoords] = useState<Coordinates | null>(null);
  const [showMethodSelection, setShowMethodSelection] = useState(false);

  const polylineAnimRef = useRef<any>(null);
  const destinationPulseAnim = useRef(new Animated.Value(0)).current;
  const userPulseAnim = useRef(new Animated.Value(0)).current;
  const GOOGLE_API_KEY = config.googleApiKey;

  // Décoder polyline Google
  const decodePolyline = (t: string) => {
    let points: Coordinates[] = [];
    let index = 0, len = t.length;
    let lat = 0, lng = 0;

    while (index < len) {
      let b, shift = 0, result = 0;
      do {
        b = t.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      let dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
      lat += dlat;

      shift = 0;
      result = 0;
      do {
        b = t.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      let dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
      lng += dlng;

      points.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
    }
    return points;
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

    const totalDuration = Math.min(Math.max(200 + totalKm * 350, 200), 1200);
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

  // Animation pulse pour le marqueur utilisateur
  const startUserPulse = () => {
    const animation = Animated.loop(
      Animated.timing(userPulseAnim, {
        toValue: 1,
        duration: 1200,
        useNativeDriver: true,
      })
    );
    animation.start();
  };

  // Arrêter l'animation pulse pour le marqueur utilisateur
  const stopUserPulse = () => {
    userPulseAnim.stopAnimation();
    userPulseAnim.setValue(0);
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
     console.log('🚀 startMethodSelection called - setting showMethodSelection to TRUE');
    setShowMethodSelection(true);
    stopDestinationPulse();
    startUserPulse();
  };

  // Récupérer l'itinéraire
  const fetchRoute = async (pickup: Coordinates, dropoff: Coordinates) => {
    if (!GOOGLE_API_KEY || GOOGLE_API_KEY.startsWith('<')) {
      logger.warn('Google API key not set - cannot fetch directions', 'useMapLogic');
      return;
    }

    try {
      const departureTs = Math.floor(Date.now() / 1000);
      const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${pickup.latitude},${pickup.longitude}&destination=${dropoff.latitude},${dropoff.longitude}&mode=driving&departure_time=${departureTs}&traffic_model=best_guess&key=${GOOGLE_API_KEY}`;
      
      const res = await fetch(url);
      const json = await res.json();
      
      if (json.routes && json.routes.length > 0) {
        const route = json.routes[0];
        let points = decodePolyline(route.overview_polyline.points);

        const almostEqual = (a: Coordinates, b: Coordinates, eps = 0.0001) =>
          Math.abs(a.latitude - b.latitude) < eps && Math.abs(a.longitude - b.longitude) < eps;
        
        if (pickup && points.length > 0 && !almostEqual(points[0], pickup)) {
          points = [{ latitude: pickup.latitude, longitude: pickup.longitude }, ...points];
        }

        if (dropoff && points.length > 0 && !almostEqual(points[points.length - 1], dropoff)) {
          points = [...points, { latitude: dropoff.latitude, longitude: dropoff.longitude }];
        }

        animatePolyline(points);
        
        // Démarrer l'animation pulse pour la destination
        startDestinationPulse();
        
        const leg = route.legs && route.legs[0];
        if (leg) {
          const durationTraffic = leg.duration_in_traffic && leg.duration_in_traffic.value;
          const durationBase = leg.duration && leg.duration.value;
          const vehicleMultiplier = selectedMethod === 'moto' ? 0.85 : selectedMethod === 'cargo' ? 1.25 : 1.0;
          const chosenSeconds = durationTraffic || durationBase;
          
          if (chosenSeconds) {
            const adjustedSeconds = Math.round(chosenSeconds * vehicleMultiplier);
            const text = (leg.duration_in_traffic && leg.duration_in_traffic.text) || 
                        (leg.duration && leg.duration.text) || 
                        `${Math.round(adjustedSeconds / 60)} min`;
            setDurationText(text);
          } else {
            setDurationText(leg.duration?.text || null);
          }
        }

        // Animation automatique de la caméra pour montrer l'itinéraire complet
        fitRoute(points);
      }
    } catch (err) {
      handleError(err, 'useMapLogic', 'Erreur lors de la récupération de l\'itinéraire');
    }
  };

  // Gestion de la caméra
  const fitRoute = (coords: Coordinates[]) => {
    if (!mapRef.current || coords.length === 0) return;
    try {
      mapRef.current.fitToCoordinates(coords, {
        edgePadding: { top: 80, right: 40, bottom: 200, left: 40 },
        animated: true,
      });
    } catch {
      // Ignorer les erreurs de fitToCoordinates
    }
  };

  // Centrer la caméra sur une position spécifique
  const animateToCoordinate = (coordinate: Coordinates, zoomLevel = 0.01) => {
    if (!mapRef.current) return;
    try {
      mapRef.current.animateToRegion({
        latitude: coordinate.latitude,
        longitude: coordinate.longitude,
        latitudeDelta: zoomLevel,
        longitudeDelta: zoomLevel,
      }, 1000); // Animation de 1 seconde
    } catch {
      // Ignorer les erreurs d'animation
    }
  };

  // Initialiser la position
  useEffect(() => {
    let isMounted = true;
    
    // Fonction de géolocalisation inverse plus précise avec Google
    const getReverseGeocode = async (latitude: number, longitude: number) => {
      if (!GOOGLE_API_KEY || GOOGLE_API_KEY.startsWith('<')) {
        // Fallback sur l'API Expo si pas de clé Google
        try {
          const geocoded = await Location.reverseGeocodeAsync({ latitude, longitude });
          if (!isMounted) return;
          
          if (geocoded && geocoded.length > 0) {
            const place = geocoded[0];
            const addressParts = [place.name, place.street, place.district || place.city, place.region];
            const address = addressParts.filter(Boolean).join(', ');
            if (address && isMounted) {
              useShipmentStore.getState().setPickupLocation(address);
            }
          }
        } catch (err: any) {
          logger.warn('Expo reverse geocode failed', 'useMapLogic', { 
            message: err?.message || 'Unknown error' 
          });
        }
        return;
      }

      // Utilisation de Google Geocoding API pour plus de précision
      try {
        const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${GOOGLE_API_KEY}&language=fr&region=ci`;
        const response = await fetch(url);
        const data = await response.json();

        if (!isMounted) return;

        if (data.status === 'OK' && data.results && data.results.length > 0) {
          // Chercher l'adresse la plus précise
          let bestAddress = '';
          
          // Priorité 1: Rechercher une adresse avec numéro de rue
          const streetAddress = data.results.find((result: any) => 
            result.types.includes('street_address') || 
            result.types.includes('premise')
          );
          
          if (streetAddress) {
            bestAddress = streetAddress.formatted_address;
          } else {
            // Priorité 2: Rechercher un point d'intérêt proche
            const poi = data.results.find((result: any) => 
              result.types.includes('point_of_interest') ||
              result.types.includes('establishment')
            );
            
            if (poi) {
              bestAddress = poi.formatted_address;
            } else {
              // Priorité 3: Prendre le premier résultat détaillé
              bestAddress = data.results[0].formatted_address;
            }
          }

          // Nettoyer l'adresse pour la Côte d'Ivoire
          if (bestAddress) {
            // Supprimer les informations redondantes et garder les plus pertinentes
            bestAddress = bestAddress
              .replace(/, Côte d'Ivoire$/, '') // Supprimer le pays à la fin
              .replace(/,\s*Abidjan,\s*Abidjan/g, ', Abidjan') // Supprimer doublons
              .replace(/^Unnamed Road,?\s*/, '') // Supprimer "Unnamed Road"
              .trim();
            
            if (isMounted) {
              useShipmentStore.getState().setPickupLocation(bestAddress + ', Abidjan');
              logger.info('Precise location found', 'useMapLogic', { address: bestAddress });
            }
          }
        } else {
          logger.warn('Google Geocoding API failed', 'useMapLogic', { 
            status: data.status,
            errorMessage: data.error_message 
          });
          
          // Fallback sur l'API Expo
          const geocoded = await Location.reverseGeocodeAsync({ latitude, longitude });
          if (!isMounted) return;
          
          if (geocoded && geocoded.length > 0) {
            const place = geocoded[0];
            const addressParts = [place.name, place.street, place.district || place.city];
            const address = addressParts.filter(Boolean).join(', ');
            if (address && isMounted) {
              useShipmentStore.getState().setPickupLocation(address + ', Abidjan');
            }
          }
        }
      } catch (err: any) {
        logger.error('Google Geocoding request failed', 'useMapLogic', { 
          message: err?.message || 'Unknown error' 
        });
        
        // Fallback final sur Expo
        try {
          const geocoded = await Location.reverseGeocodeAsync({ latitude, longitude });
          if (!isMounted) return;
          
          if (geocoded && geocoded.length > 0) {
            const place = geocoded[0];
            const addressParts = [place.name, place.street, place.district || place.city];
            const address = addressParts.filter(Boolean).join(', ');
            if (address && isMounted) {
              useShipmentStore.getState().setPickupLocation(address + ', Abidjan');
            }
          }
        } catch {
          // Échec total - utiliser coordonnées
          if (isMounted) {
            useShipmentStore.getState().setPickupLocation(`Position: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
          }
        }
      }
    };
    
    (async () => {
      try {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission refusée', 'Activez la localisation pour utiliser la carte.');
          return;
        }

        // Configuration plus précise pour la géolocalisation
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.BestForNavigation, // Précision maximale
        });
        
        if (!isMounted) return;
        
        const { latitude, longitude } = location.coords;

        const newRegion: Region = {
          latitude,
          longitude,
          latitudeDelta: 0.005, // Zoom plus précis
          longitudeDelta: 0.005,
        };

        setRegion(newRegion);
        setPickupCoords({ latitude, longitude });

        // Utiliser Google Geocoding API pour plus de précision
        await getReverseGeocode(latitude, longitude);
        
      } catch {
        if (isMounted) {
          logger.error('Location permission or access failed', 'useMapLogic');
          Alert.alert('Erreur', 'Impossible d\'accéder à votre position');
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [GOOGLE_API_KEY]);

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

  return {
    // États
    region,
    pickupCoords,
    dropoffCoords,
    displayedRouteCoords,
    durationText,
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
    startMethodSelection,
    stopDestinationPulse,
    stopUserPulse,
    resetAfterDriverSearch,
  };
};