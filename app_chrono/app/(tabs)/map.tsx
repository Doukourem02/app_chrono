import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Animated, Dimensions, Image, PanResponder, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Marker, Region, Polyline } from 'react-native-maps';
import { io } from 'socket.io-client';
import { useShipmentStore } from '../../store/useShipmentStore';
import PlacesAutocomplete from '../../components/PlacesAutocomplete';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
// Reduce the max height so the bottom sheet doesn't cover too much of the map
const BOTTOM_SHEET_MAX_HEIGHT = SCREEN_HEIGHT * 0.5; // was 0.65
const BOTTOM_SHEET_MIN_HEIGHT = 100;

// Définition du type pour les coordonnées
type Coordinates = {
  latitude: number;
  longitude: number;
};

export default function MapPage() {
  // 🔹 Obtenir la position actuelle au démarrage
  const {
    pickupLocation,
    deliveryLocation,
    selectedMethod,
    setPickupLocation,
    setDeliveryLocation,
    setSelectedMethod,
    createShipment,
  } = useShipmentStore();
  
  const [region, setRegion] = useState<Region | null>(null);
  const [pickupCoords, setPickupCoords] = useState<Coordinates | null>(null);
  const [isBottomSheetExpanded, setIsBottomSheetExpanded] = useState(false);
    const [dropoffCoords, setDropoffCoords] = useState<Coordinates | null>(null);
  // displayedRouteCoords is the progressively drawn polyline; we keep full route only inside fetch and animation
  const [displayedRouteCoords, setDisplayedRouteCoords] = useState<Coordinates[]>([]);
  const [durationText, setDurationText] = useState<string | null>(null);
    const [driverCoords, setDriverCoords] = useState<Coordinates | null>(null);

    const mapRef = useRef<MapView | null>(null);
    const polylineAnimRef = useRef<any>(null);
  // no head marker; the polyline itself will be drawn progressively
  const [isSearchingDriver, setIsSearchingDriver] = useState(false);
  const [searchSeconds, setSearchSeconds] = useState(0);
  const searchIntervalRef = useRef<number | null>(null);
  const searchTimeoutRef = useRef<number | null>(null);
  const pulseAnim = useRef(new Animated.Value(0)).current;

    // Animate polyline smoothly using requestAnimationFrame and interpolation
    const animatePolyline = (points: Coordinates[]) => {
      // cancel any running animation
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

      // Compute total distance (km)
      const haversineKm = (a: Coordinates, b: Coordinates) => {
        const toRad = (v: number) => (v * Math.PI) / 180;
        const R = 6371; // km
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

      // duration: faster for short distances, bounded for smoothness
      const totalDuration = Math.min(Math.max(200 + totalKm * 350, 200), 1200);

      const start = Date.now();

      const step = () => {
        const now = Date.now();
        const t = Math.min(1, (now - start) / totalDuration);
        const exactIndex = t * (points.length - 1);
        const idx = Math.floor(exactIndex);
        const frac = exactIndex - idx;

        // take points up to idx
        const displayed = points.slice(0, idx + 1);
        // interpolate next point for smooth drawing
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

  // Replace with your Google API key (Directions API + Places)
  // TEMPORARY: using the same key present in PlacesAutocomplete for quick testing.
  // IMPORTANT: move this to a secure place (backend proxy or env) for production.
  const GOOGLE_API_KEY = "AIzaSyCAN9p_0DsBFRl6Yaw3SCRel90kh1vJ3Tk";
    const SOCKET_URL = 'http://localhost:4000';

    // decode polyline from Google Directions overview_polyline
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

    

    const fitRoute = (coords: Coordinates[]) => {
      if (!mapRef.current || coords.length === 0) return;
      try {
        mapRef.current.fitToCoordinates(coords, {
          edgePadding: { top: 80, right: 40, bottom: 200, left: 40 },
          animated: true,
        });
      } catch (err) {
        console.warn('fitToCoordinates failed', err);
      }
    };

  const fetchRoute = async (pickup: Coordinates, dropoff: Coordinates) => {
      if (!GOOGLE_API_KEY || GOOGLE_API_KEY.startsWith('<')) {
        console.warn('Google API key not set - cannot fetch directions');
        return;
      }

      try {
        // Request directions with departure_time=now so Google can return traffic-aware durations
        const departureTs = Math.floor(Date.now() / 1000);
        const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${pickup.latitude},${pickup.longitude}&destination=${dropoff.latitude},${dropoff.longitude}&mode=driving&departure_time=${departureTs}&traffic_model=best_guess&key=${GOOGLE_API_KEY}`;
        console.log('Fetching directions from', url);
        const res = await fetch(url);
        const json = await res.json();
        console.log('Directions response status', res.status, 'routes', json.routes && json.routes.length);
        if (json.routes && json.routes.length > 0) {
          const route = json.routes[0];
          let points = decodePolyline(route.overview_polyline.points);
          // Ensure the polyline starts exactly at the user's pickup position.
          const almostEqual = (a: Coordinates, b: Coordinates, eps = 0.0001) =>
            Math.abs(a.latitude - b.latitude) < eps && Math.abs(a.longitude - b.longitude) < eps;
          if (pickup && points.length > 0 && !almostEqual(points[0], pickup)) {
            points = [{ latitude: pickup.latitude, longitude: pickup.longitude }, ...points];
          }
          // Ensure the polyline ends exactly at the dropoff/destination position.
          if (dropoff && points.length > 0 && !almostEqual(points[points.length - 1], dropoff)) {
            points = [...points, { latitude: dropoff.latitude, longitude: dropoff.longitude }];
          }
          // animate the polyline drawing progressively
          animatePolyline(points);
          const leg = route.legs && route.legs[0];
          if (leg) {
            // Prefer duration_in_traffic when available (more accurate with current traffic)
            const durationTraffic = leg.duration_in_traffic && leg.duration_in_traffic.value; // seconds
            const durationBase = leg.duration && leg.duration.value; // seconds

            // Apply a small vehicle-type multiplier to better reflect real-world times in Abidjan
            const vehicleMultiplier = selectedMethod === 'moto' ? 0.85 : selectedMethod === 'cargo' ? 1.25 : 1.0;

            const chosenSeconds = durationTraffic || durationBase;
            if (!chosenSeconds) console.warn('No duration returned by Directions API for leg', leg);

            const adjustedSeconds = chosenSeconds ? Math.round(chosenSeconds * vehicleMultiplier) : undefined;

            if (adjustedSeconds) {
              // Update duration text using the API text when available, otherwise format from seconds
              const text = (leg.duration_in_traffic && leg.duration_in_traffic.text) || (leg.duration && leg.duration.text) || `${Math.round(adjustedSeconds / 60)} min`;
              setDurationText(text);
              // arrival time computed from adjusted seconds (not shown in UI currently)
            } else {
              setDurationText(leg.duration?.text || null);
              // arrival time not used here
            }
          }
          fitRoute(points);
        } else {
          console.warn('No routes returned from Directions API', json);
        }
      } catch (err) {
        console.warn('Directions fetch error', err);
      }
    };

    // connect to socket.io server to receive driver positions (optional)
    useEffect(() => {
      let socket: any;
      try {
        socket = io(SOCKET_URL);
        socket.on('connect', () => console.log('socket connected', socket.id));
        socket.on('driver_position', (payload: any) => {
          const coords = payload.coords || payload;
          if (coords && coords.latitude && coords.longitude) {
            setDriverCoords({ latitude: coords.latitude, longitude: coords.longitude });
          }
        });
      } catch (err) {
        console.warn('Socket connection failed', err);
      }

      return () => {
        try { socket && socket.disconnect(); } catch {}
      };
    }, []);

    // Pulse animation control for searching UI
    useEffect(() => {
      let loop: any;
      if (isSearchingDriver) {
        pulseAnim.setValue(0);
        loop = Animated.loop(
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1400,
            useNativeDriver: true,
          })
        );
        loop.start();
      } else {
        // stop loop by resetting value
        pulseAnim.stopAnimation(() => pulseAnim.setValue(0));
        if (loop && loop.stop) loop.stop();
      }

      return () => {
        if (loop && loop.stop) loop.stop();
      };
    }, [isSearchingDriver, pulseAnim]);
  
  const animatedHeight = useRef(new Animated.Value(isBottomSheetExpanded ? BOTTOM_SHEET_MAX_HEIGHT : BOTTOM_SHEET_MIN_HEIGHT)).current;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (event, gestureState) => {
        const newHeight = BOTTOM_SHEET_MAX_HEIGHT - gestureState.dy;
        if (newHeight >= BOTTOM_SHEET_MIN_HEIGHT && newHeight <= BOTTOM_SHEET_MAX_HEIGHT) {
          animatedHeight.setValue(newHeight);
        }
      },
      onPanResponderRelease: (event, gestureState) => {
        if (gestureState.dy > 100) {
          // Glisser vers le bas - minimiser
          setIsBottomSheetExpanded(false);
          Animated.spring(animatedHeight, {
            toValue: BOTTOM_SHEET_MIN_HEIGHT,
            useNativeDriver: false,
          }).start();
        } else if (gestureState.dy < -100) {
          // Glisser vers le haut - maximiser
          setIsBottomSheetExpanded(true);
          Animated.spring(animatedHeight, {
            toValue: BOTTOM_SHEET_MAX_HEIGHT,
            useNativeDriver: false,
          }).start();
        } else {
          // Retourner à la position précédente
          Animated.spring(animatedHeight, {
            toValue: isBottomSheetExpanded ? BOTTOM_SHEET_MAX_HEIGHT : BOTTOM_SHEET_MIN_HEIGHT,
            useNativeDriver: false,
          }).start();
        }
      },
    })
  ).current;

  const toggleBottomSheet = () => {
    const toValue = isBottomSheetExpanded ? BOTTOM_SHEET_MIN_HEIGHT : BOTTOM_SHEET_MAX_HEIGHT;
    setIsBottomSheetExpanded((v) => !v);

    Animated.spring(animatedHeight, {
      toValue,
      useNativeDriver: false,
    }).start();
  };

  const startDriverSearch = () => {
    setIsSearchingDriver(true);
    setSearchSeconds(0);

    // start seconds counter
    if (searchIntervalRef.current) {
      clearInterval(searchIntervalRef.current as any);
      searchIntervalRef.current = null;
    }
    searchIntervalRef.current = (setInterval(() => {
      setSearchSeconds((s) => s + 1);
    }, 1000) as unknown) as number;

    // demo: simulate a search that lasts at least 20s — do not display drivers during this demo search
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current as any);
      searchTimeoutRef.current = null;
    }
    searchTimeoutRef.current = (setTimeout(() => {
      // End the searching state after 20s. No driver marker is placed in this demo.
      stopDriverSearch();
    }, 20000) as unknown) as number;
  };

  const stopDriverSearch = () => {
    setIsSearchingDriver(false);
    if (searchIntervalRef.current) {
      clearInterval(searchIntervalRef.current as any);
      searchIntervalRef.current = null;
    }
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current as any);
      searchTimeoutRef.current = null;
    }
    setSearchSeconds(0);
  };

  const deliveryMethods = [
    { id: 'moto', name: 'Livraison par moto', icon: require('../../assets/images/motoo.png') },
    { id: 'vehicule', name: 'Livraison par véhicule', icon: require('../../assets/images/carrss.png') },
    { id: 'cargo', name: 'Livraison par cargo', icon: require('../../assets/images/ccargo.png') },
  ];

  // 🔹 Images des véhicules pour la carte
  const vehicleImages = {
    moto: require('../../assets/images/moto.png'),
    vehicule: require('../../assets/images/cars.png'),
    cargo: require('../../assets/images/cargo.png'),
  };

  // 🔹 Générer des véhicules disponibles autour de la position
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

  // 🔹 Obtenir la position actuelle au démarrage
  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission refusée', 'Activez la localisation pour utiliser la carte.');
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = location.coords;

      const newRegion: Region = {
        latitude,
        longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      };

      setRegion(newRegion);
      setPickupCoords({ latitude, longitude });

      // Reverse geocode to get a readable address and fill pickupLocation automatically
      try {
        const geocoded = await Location.reverseGeocodeAsync({ latitude, longitude });
        if (geocoded && geocoded.length > 0) {
          const place = geocoded[0];
          const addressParts = [place.name, place.street, place.city || place.region];
          const address = addressParts.filter(Boolean).join(', ');
          if (address) setPickupLocation(address);
        }
      } catch (err) {
        console.warn('Reverse geocode failed', err);
      }
    })();
  }, [setPickupLocation]);

  const handleConfirm = async () => {
    if (!pickupLocation || !deliveryLocation) {
      Alert.alert('Champs requis', 'Veuillez renseigner les deux adresses.');
      return;
    }

    // Ensure we have the most recent route/duration so the badge on the map can show it immediately
    try {
      if (pickupCoords && dropoffCoords) {
        await fetchRoute(pickupCoords, dropoffCoords);
      }
    } catch (err) {
      console.warn('fetchRoute before search failed', err);
    }

    // Créer la livraison dans le store
    createShipment();
    // Démarrer la recherche d'un livreur et afficher l'UI de recherche
    startDriverSearch();
  };

  if (!region) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Chargement de la carte...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Bouton Retour */}
      <TouchableOpacity 
        style={styles.backButton}
        onPress={() => router.push('/(tabs)')}
      >
        <Ionicons name="arrow-back" size={24} color="#333" />
      </TouchableOpacity>

      {/* --- MAP --- */}
  <MapView ref={(r) => { mapRef.current = r; }} style={styles.map} region={region}>
        {pickupCoords && (
          <Marker coordinate={pickupCoords} title="Ma position" anchor={{ x: 0.5, y: 0.5 }}>
            <Image source={require('../../assets/images/me.png')} style={styles.meMarker} />
          </Marker>
        )}
        {/* Pulsing search rings + ETA badge while searching for a driver */}
        {isSearchingDriver && pickupCoords && (
          <Marker coordinate={pickupCoords} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
            <View style={{ alignItems: 'center', justifyContent: 'center' }}>
              <Animated.View
                style={[
                  styles.pulseOuter,
                  {
                    transform: [
                      {
                        scale: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 2.2] }),
                      },
                    ],
                    opacity: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.8, 0] }),
                  },
                ]}
              />
              <Animated.View
                style={[
                  styles.pulseInner,
                  {
                    transform: [
                      {
                        scale: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.4] }),
                      },
                    ],
                    opacity: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 0.2] }),
                  },
                ]}
              />
              {/* ETA badge */}
              <View style={styles.etaBadge}>
                <Text style={styles.etaBadgeText}>{durationText ? durationText : 'Recherche...'}</Text>
                <Text style={styles.etaSmallBadge}>{searchSeconds}s</Text>
              </View>
            </View>
          </Marker>
        )}
        
        {/* Véhicules disponibles selon la méthode sélectionnée (masqués pendant la recherche) */}
        {!isSearchingDriver && getAvailableVehicles().map((vehicle) => (
          <Marker
            key={vehicle.id}
            coordinate={vehicle.coordinate}
            title={`${selectedMethod.charAt(0).toUpperCase() + selectedMethod.slice(1)} disponible`}
          >
            <Image 
              source={vehicleImages[selectedMethod as keyof typeof vehicleImages]} 
              style={styles.vehicleMarker}
            />
          </Marker>
        ))}
        {dropoffCoords && (
          <Marker coordinate={dropoffCoords} title="Destination" anchor={{ x: 0.5, y: 0.5 }}>
            <Image source={require('../../assets/images/place.png')} style={styles.dropoffMarker} />
          </Marker>
        )}

        {displayedRouteCoords && displayedRouteCoords.length > 0 && (
          <Polyline
            coordinates={displayedRouteCoords}
            strokeColor="#8A76FF"
            strokeWidth={4}
            lineJoin="round"
          />
        )}

        {/* Static ETA badge when a route is available (visible immediately with the polyline) */}
        {durationText && pickupCoords && !isSearchingDriver && (
          <Marker coordinate={pickupCoords} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
            <View style={styles.etaBadgeStatic}>
              <Text style={styles.etaBadgeText}>{durationText}</Text>
            </View>
          </Marker>
        )}

        {/* polyline is drawn progressively via displayedRouteCoords - no head marker */}

        {/* Driver marker not shown during demo search flow */}
        {!isSearchingDriver && driverCoords && (
          <Marker coordinate={driverCoords} title="Livreur" anchor={{ x: 0.5, y: 0.5 }}>
            <Image source={require('../../assets/images/delivery.png')} style={styles.vehicleMarker} />
          </Marker>
        )}
      </MapView>

      {/* --- BOTTOM SHEET ANIMÉ --- */}
      <Animated.View 
        style={[styles.bottomSheet, { height: animatedHeight }]}
        {...panResponder.panHandlers}
      >
        {/* Indicateur de glissement + chevron animé */}
        <TouchableOpacity style={styles.dragIndicator} onPress={toggleBottomSheet} activeOpacity={0.8}>
          <View style={styles.dragHandle} />
        </TouchableOpacity>

        {isBottomSheetExpanded ? (
          <ScrollView 
            showsVerticalScrollIndicator={false}
            style={styles.scrollContent}
            scrollEnabled={isBottomSheetExpanded}
          >
            <Text style={styles.title}>ENVOYER UN COLIS</Text>

            {/* Champs de saisie avec autocomplete */}
            <View style={styles.inputContainer}>
              <PlacesAutocomplete
                placeholder="Où récupérer"
                country="ci"
                initialValue={pickupLocation}
                onPlaceSelected={({ description, coords }) => {
                  setPickupLocation(description);
                  if (coords) {
                    setPickupCoords(coords);
                    setRegion({ ...coords, latitudeDelta: 0.05, longitudeDelta: 0.05 });
                    if (dropoffCoords) fetchRoute(coords, dropoffCoords);
                  }
                }}
              />

              <View style={styles.inputSeparator} />

              <PlacesAutocomplete
                placeholder="Où livrer"
                country="ci"
                initialValue={deliveryLocation}
                onPlaceSelected={({ description, coords }) => {
                  setDeliveryLocation(description);
                  if (coords) {
                    setDropoffCoords(coords);
                    if (pickupCoords) fetchRoute(pickupCoords, coords);
                  }
                }}
              />
            </View>

            {/* Options de livraison */}
            <View style={styles.deliveryOptions}>
              {deliveryMethods.map((method) => (
                <TouchableOpacity
                  key={method.id}
                  style={[
                    styles.deliveryOption,
                    selectedMethod === method.id && styles.selectedOption,
                  ]}
                  onPress={() => setSelectedMethod(method.id as 'moto' | 'vehicule' | 'cargo')}
                >
                  <Image source={method.icon} style={styles.methodIcon} />
                  <Text style={styles.methodName}>{method.name}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Duration/ETA is shown on the map when searching; removed from bottom sheet per UX */}

            {/* Bouton de validation */}
            <TouchableOpacity
              style={[
                styles.chooseButton,
                (!pickupLocation || !deliveryLocation) && { opacity: 0.5 },
              ]}
              disabled={!pickupLocation || !deliveryLocation}
              onPress={handleConfirm}
            >
              <Text style={styles.chooseButtonText}>Choix de la méthode</Text>
              <Text style={styles.chooseButtonText}>de Livraison</Text>
            </TouchableOpacity>
          </ScrollView>
        ) : (
          <TouchableOpacity style={styles.peekContainer} onPress={toggleBottomSheet} activeOpacity={0.8}>
            <Text style={styles.peekText} numberOfLines={1}>{pickupLocation ? `De: ${pickupLocation}` : 'De: Ma position'} → {deliveryLocation ? `À: ${deliveryLocation}` : 'Choisissez une destination'}</Text>
          </TouchableOpacity>
        )}
      </Animated.View>
    </View>
  );
}

// --- STYLES ---
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  backButton: {
    position: 'absolute',
    top: 60,
    left: 20,
    width: 50,
    height: 50,
    backgroundColor: '#fff',
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  map: {
    flex: 1,
  },
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    paddingHorizontal: 20,
    paddingTop: 5,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  dragIndicator: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#ccc',
    borderRadius: 2,
  },
  scrollContent: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 25,
    textAlign: 'left',
  },
  inputContainer: {
    backgroundColor: '#f8f8f8',
    borderRadius: 15,
    marginBottom: 25,
    paddingVertical: 5,
  },
  input: {
    fontSize: 16,
    paddingHorizontal: 20,
    paddingVertical: 15,
    color: '#333',
  },
  inputSeparator: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginHorizontal: 20,
  },
  deliveryOptions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 25,
  },
  deliveryOption: {
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
    borderRadius: 15,
    paddingVertical: 15,
    paddingHorizontal: 10,
    width: '30%',
  },
  selectedOption: {
    backgroundColor: '#e8e0ff',
    borderWidth: 2,
    borderColor: '#8B5CF6',
  },
  methodIcon: {
    width: 30,
    height: 30,
    marginBottom: 8,
    resizeMode: 'contain',
  },
  methodName: {
    fontSize: 12,
    textAlign: 'center',
    color: '#666',
    fontWeight: '500',
  },
  chooseButton: {
    backgroundColor: '#8B5CF6',
    borderRadius: 15,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 0,
  },
  chooseButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  vehicleMarker: {
    width: 40,
    height: 40,
    resizeMode: 'contain',
  },
  meMarker: {
    width: 48,
    height: 48,
    resizeMode: 'contain',
  },
  dropoffMarker: {
    width: 36,
    height: 36,
    resizeMode: 'contain',
  },
  etaBox: {
    backgroundColor: '#eef2ff',
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
    marginTop: -10,
  },
  etaText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2B6CB0',
    
  },
  etaSmall: {
    fontSize: 14,
    color: '#555',
    marginTop: 4,
  },
  peekContainer: {
    backgroundColor: '#fff',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  peekText: {
    fontSize: 14,
    color: '#333',
  },
  polylineHead: {
    width: 14,
    height: 14,
    borderRadius: 8,
    backgroundColor: '#8A76FF',
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  pulseOuter: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#8A76FF',
  },
  pulseInner: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#8A76FF',
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  etaBadge: {
    marginTop: -70,
    backgroundColor: '#fff',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#eee',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
  etaBadgeStatic: {
    marginTop: -70,
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#eee',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
  },
  etaBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#8B5CF6',
  },
  etaSmallBadge: {
    fontSize: 10,
    color: '#666',
    marginTop: 2,
  },
  
});
