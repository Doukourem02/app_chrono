import React, { useState, useEffect, useRef } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Text,
} from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";
import { Ionicons } from "@expo/vector-icons";
import { StatusToggle } from "../../components/StatusToggle";
import { StatsCards } from "../../components/StatsCards";
import { OrderRequestPopup } from "../../components/OrderRequestPopup";
import { useDriverLocation } from "../../hooks/useDriverLocation";
import { useDriverStore } from "../../store/useDriverStore";
import { useOrderStore } from "../../store/useOrderStore";
import { apiService } from "../../services/apiService";
import { orderSocketService } from "../../services/orderSocketService";
import { logger } from '../../utils/logger';
import { useRouteTracking } from '../../hooks/useRouteTracking';
import { useMapCamera } from '../../hooks/useMapCamera';

export default function Index() {
  // Store du chauffeur
  const { 
    isOnline: storeIsOnline, 
    setOnlineStatus, 
    setLocation,
    todayStats,
    updateTodayStats,
    user,
    profile 
  } = useDriverStore();
  
  // Store des commandes
  const { 
    pendingOrder, 
    setPendingOrder,
    currentOrder,
    } = useOrderStore();
  
  // Utiliser directement le store pour la synchronisation avec profile.tsx
  const isOnline = storeIsOnline;
  
  // Hook de géolocalisation
  const { location, error } = useDriverLocation(isOnline);
  const mapRef = useRef<MapView | null>(null);

  // Normaliser plusieurs formats de coordonnées possibles (latitude/longitude ou lat/lng)
  const resolveCoords = (candidate?: any) => {
    if (!candidate) return null;

    // candidate may be: { coordinates: { latitude, longitude } } OR { coords: { lat, lng } } OR direct { latitude, longitude }
    const c = candidate.coordinates || candidate.coords || candidate.location || candidate;
    const lat = c?.latitude ?? c?.lat ?? c?.latitude ?? c?.Lat ?? c?.y;
    const lng = c?.longitude ?? c?.lng ?? c?.lon ?? c?.long ?? c?.Longitude ?? c?.x;

    if (lat == null || lng == null) return null;
    const latN = Number(lat);
    const lngN = Number(lng);
    if (Number.isNaN(latN) || Number.isNaN(lngN)) return null;
    return { latitude: latN, longitude: lngN };
  };

  // Déterminer la destination actuelle selon le statut de la commande
  const getCurrentDestination = () => {
    if (!currentOrder || !location) return null;
    const status = String(currentOrder.status || '');
    const pickupCoord = resolveCoords(currentOrder.pickup);
    const dropoffCoord = resolveCoords(currentOrder.dropoff);

    // Si commande acceptée/en route -> destination = pickup
    if ((status === 'accepted' || status === 'enroute' || status === 'in_progress') && pickupCoord) {
      return pickupCoord;
    }
    
    // Si colis récupéré -> destination = dropoff
    if ((status === 'picked_up' || status === 'delivering') && dropoffCoord) {
      return dropoffCoord;
    }

    return null;
  };

  // Hook pour récupérer la route réelle depuis Google Directions
  const destination = getCurrentDestination();
  const { route: routeToDestination, isLoading: isRouteLoading, refetch: refetchRoute } = useRouteTracking(
    location,
    destination,
    isOnline && !!currentOrder && !!destination
  );

  // Hook pour la caméra qui suit automatiquement
  const { fitToRoute, centerOnDriver } = useMapCamera(
    mapRef,
    location,
    routeToDestination ? { coordinates: routeToDestination.coordinates } : null,
    currentOrder,
    isOnline && !!currentOrder
  );

  // Animated driver position for simple delivery animation
  const [animatedDriverPos, setAnimatedDriverPos] = useState<{ latitude: number; longitude: number } | null>(null);
  const polyPulseRef = useRef<boolean>(false);
  const polyPulseIntervalRef = useRef<number | null>(null);
  const animationTimeoutsRef = useRef<number[]>([]);

  // Cleanup timeouts/intervals on unmount
  useEffect(() => {
    return () => {
      if (polyPulseIntervalRef.current) clearInterval(polyPulseIntervalRef.current);
      animationTimeoutsRef.current.forEach(id => clearTimeout(id));
    };
  }, []);

  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

  const startDeliveryAnimation = (from: { latitude: number; longitude: number }, to: { latitude: number; longitude: number }) => {
    // clear previous timeouts
    animationTimeoutsRef.current.forEach(id => clearTimeout(id));
    animationTimeoutsRef.current = [];

    const steps = 16;
    const duration = 1600;
    const stepMs = Math.round(duration / steps);

    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const lat = lerp(from.latitude, to.latitude, t);
      const lng = lerp(from.longitude, to.longitude, t);
      const timeoutId = window.setTimeout(() => setAnimatedDriverPos({ latitude: lat, longitude: lng }), i * stepMs) as unknown as number;
      animationTimeoutsRef.current.push(timeoutId);
    }

    // animate camera to fit
    const center = { latitude: (from.latitude + to.latitude) / 2, longitude: (from.longitude + to.longitude) / 2 };
    try {
      mapRef.current?.animateToRegion({ latitude: center.latitude, longitude: center.longitude, latitudeDelta: Math.abs(from.latitude - to.latitude) * 2.5 + 0.01, longitudeDelta: Math.abs(from.longitude - to.longitude) * 2.5 + 0.01 }, 600);
    } catch {}

    // polyline pulse
    let pulses = 0;
    polyPulseRef.current = true;
    polyPulseIntervalRef.current = window.setInterval(() => {
      polyPulseRef.current = !polyPulseRef.current;
      pulses++;
      if (pulses >= 6 && polyPulseIntervalRef.current) {
        clearInterval(polyPulseIntervalRef.current);
        polyPulseIntervalRef.current = null;
        polyPulseRef.current = false;
      }
    }, 200) as unknown as number;
  };

  // 🔌 Connexion Socket pour les commandes
  useEffect(() => {
    if (isOnline && user?.id) {
      orderSocketService.connect(user.id);
    } else {
      orderSocketService.disconnect();
    }

    return () => {
      orderSocketService.disconnect();
    };
  }, [isOnline, user?.id]);

  // Gestion des commandes
  const handleAcceptOrder = (orderId: string) => {
    orderSocketService.acceptOrder(orderId);
    setPendingOrder(null); // Fermer le popup
  };

  const handleDeclineOrder = (orderId: string) => {
    orderSocketService.declineOrder(orderId);
    setPendingOrder(null); // Fermer le popup
  };

  // Gestion du changement de statut
  const handleToggleOnline = async (value: boolean) => {
    if (value && error) {
      Alert.alert(
        "Erreur de localisation", 
        "Impossible de vous mettre en ligne sans accès à votre localisation.",
        [{ text: "OK" }]
      );
      return;
    }
    // Ne pas marquer le driver en ligne localement avant que le backend confirme la mise à jour du statut.
    // Cela évite une condition de course où le socket se connecte avant que le serveur ait le statut/coords du driver.
    if (user?.id) {
      const statusData: any = {
        is_online: value,
        is_available: value // Si online, disponible aussi
      };

      // Ajouter la position si disponible et en ligne
      if (value && location) {
        statusData.current_latitude = location.latitude;
        statusData.current_longitude = location.longitude;
        setLocation(location);
      }

      console.log('🔄 Synchronisation statut avec backend...');
      const result = await apiService.updateDriverStatus(user.id, statusData);

      if (!result.success) {
        console.error('❌ Échec synchronisation:', result.message);
        Alert.alert(
          "Erreur de synchronisation",
          "Impossible de synchroniser votre statut avec le serveur.",
          [{ text: "OK" }]
        );
        // Ne pas changer le statut local si l'API échoue
        return;
      }

      // Backend confirmé — mettre à jour le store (cela déclenchera la connexion socket)
      // Le store sera automatiquement synchronisé avec profile.tsx
      setOnlineStatus(value);
    } else {
      // Si pas d'user id (ne devrait pas arriver), fallback
      setOnlineStatus(value);
    }
  };

  // 📍 Effet pour synchroniser automatiquement la position quand elle change
  useEffect(() => {
    const syncLocation = async () => {
      if (isOnline && location && user?.id) {
        try {
          await apiService.updateDriverStatus(user.id, {
            current_latitude: location.latitude,
            current_longitude: location.longitude
          });
        } catch (error) {
          console.log('⚠️ Erreur sync position:', error);
        }
      }
    };

    // Débounce - attendre 2 secondes avant de sync
    const timeoutId = setTimeout(syncLocation, 2000);
    return () => clearTimeout(timeoutId);
  }, [location, isOnline, user?.id]);

  // distanceMeters removed — no longer used (polyline always points to pickup after accept)

  // Debug: vérifier que currentOrder est bien reçu (seulement quand il change)
  // Note: Ne pas logger location car il change trop souvent (géolocalisation en temps réel)
  useEffect(() => {
    if (currentOrder) {
      logger.debug('DEBUG currentOrder', 'driverIndex', {
        id: currentOrder.id,
        status: currentOrder.status,
        pickup_resolved: resolveCoords(currentOrder.pickup),
        dropoff_resolved: resolveCoords(currentOrder.dropoff),
      });
    }
    // Ne pas logger quand currentOrder est null pour éviter le spam
  }, [currentOrder]); // Seulement dépendre de currentOrder, pas de location

  // NOTE: removed automatic fitToCoordinates to avoid abrupt map zooming; map remains centered on driver's region.

  // When the order completes (or is cleared), reset any temporary map animations/lines
  useEffect(() => {
    const status = String(currentOrder?.status || '');

    if (!currentOrder || status === 'completed') {
      // clear animated driver position and any running timeouts/intervals
      setAnimatedDriverPos(null);

      if (polyPulseIntervalRef.current) {
        clearInterval(polyPulseIntervalRef.current);
        polyPulseIntervalRef.current = null;
      }

      animationTimeoutsRef.current.forEach(id => clearTimeout(id));
      animationTimeoutsRef.current = [];

      // animate back to driver's real location if available
      if (location) {
        try {
          mapRef.current?.animateToRegion({ latitude: location.latitude, longitude: location.longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 }, 500);
        } catch {}
      }
    }
  }, [currentOrder?.status, currentOrder, location]);

  useEffect(() => {
    // Charger les stats depuis le serveur si utilisateur connecté
    const loadTodayStats = async () => {
      if (user && isOnline) {
        try {
          const result = await apiService.getTodayStats(user.id);
          if (result.success && result.data) {
            updateTodayStats(result.data);
          }
        } catch (err) {
          console.error('Erreur chargement stats:', err);
        }
      }
    };

    loadTodayStats();
  }, [isOnline, user, updateTodayStats]);

  return (
    <View style={styles.container}>
      {/* MAP */}
      <MapView
        style={StyleSheet.absoluteFillObject}
        ref={mapRef}
        initialRegion={location ? {
          latitude: location.latitude,
          longitude: location.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        } : {
          latitude: 5.345317,
          longitude: -4.024429,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
        customMapStyle={grayMapStyle}
        showsUserLocation={false}
        showsMyLocationButton={false}
        followsUserLocation={false}
      >
        {/* Marqueur du chauffeur quand en ligne (use animated pos if animating) */}
        {isOnline && (animatedDriverPos || location) && (
          <Marker
            coordinate={{
              latitude: (animatedDriverPos || location)!.latitude,
              longitude: (animatedDriverPos || location)!.longitude,
            }}
            title="Ma position"
            description="Chauffeur en ligne"
          >
            <View style={styles.driverMarker}>
              <Ionicons name="car" size={20} color="#fff" />
            </View>
          </Marker>
        )}

        {/* Polyline pour la commande active avec route réelle depuis Google Directions */}
        {isOnline && location && currentOrder && routeToDestination && routeToDestination.coordinates.length > 0 && (
          <Polyline
            coordinates={routeToDestination.coordinates}
            strokeColor={
              String(currentOrder.status) === 'picked_up' || String(currentOrder.status) === 'delivering'
                ? '#10B981'
                : '#8B5CF6'
            }
            strokeWidth={5}
            lineCap="round"
            lineJoin="round"
          />
        )}

        {/* Fallback: ligne droite si pas de route Google disponible */}
        {isOnline && location && currentOrder && (!routeToDestination || routeToDestination.coordinates.length === 0) && !isRouteLoading && (() => {
          const pickupCoord = resolveCoords(currentOrder.pickup);
          const dropoffCoord = resolveCoords(currentOrder.dropoff);
          const status = String(currentOrder.status || '');

          if ((status === 'accepted' || status === 'enroute' || status === 'in_progress') && pickupCoord) {
            return (
              <Polyline
                coordinates={[
                  { latitude: location.latitude, longitude: location.longitude },
                  { latitude: pickupCoord.latitude, longitude: pickupCoord.longitude }
                ]}
                strokeColor="#8B5CF6"
                strokeWidth={4}
                lineCap="round"
                lineDashPattern={[5, 5]} // Ligne pointillée pour indiquer que c'est un fallback
              />
            );
          }

          if ((status === 'picked_up' || status === 'delivering') && dropoffCoord) {
            return (
              <Polyline
                coordinates={[
                  { latitude: location.latitude, longitude: location.longitude },
                  { latitude: dropoffCoord.latitude, longitude: dropoffCoord.longitude }
                ]}
                strokeColor="#10B981"
                strokeWidth={4}
                lineCap="round"
                lineDashPattern={[5, 5]}
              />
            );
          }

          return null;
        })()}

        {/* Markers pour pickup / dropoff (si commande active) - labels clarifiés */}
        {currentOrder && (() => {
          const pickupCoord = resolveCoords(currentOrder.pickup);
          const dropoffCoord = resolveCoords(currentOrder.dropoff);

          return (
            <>
              {pickupCoord && (
                <Marker
                  coordinate={pickupCoord}
                  title={currentOrder.user?.name ? `Récupérer : ${currentOrder.user.name}` : 'Récupérer (client)'}
                  description={currentOrder.pickup?.address}
                >
                  <View style={{
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    backgroundColor: '#fff',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 3,
                    borderColor: '#8B5CF6'
                  }} />
                </Marker>
              )}

              {dropoffCoord && (
                <Marker
                  coordinate={dropoffCoord}
                  title={'Livrer : Destinataire'}
                  description={currentOrder.dropoff?.address}
                >
                  <View style={{
                    width: 24,
                    height: 24,
                    borderRadius: 12,
                    backgroundColor: '#fff',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 2,
                    borderColor: '#94A3B8'
                  }} />
                </Marker>
              )}
            </>
          );
        })()}
      </MapView>

      {/* SWITCH ONLINE/OFFLINE */}
      <StatusToggle 
        isOnline={isOnline} 
        onToggle={handleToggleOnline}
        hasLocationError={!!error}
      />

      {/* STATS CARDS */}
      <StatsCards 
        todayDeliveries={todayStats.deliveries}
        totalRevenue={profile?.total_earnings || 0}
        isOnline={isOnline}
      />

      {/* FLOATING MENU */}
      <View style={styles.floatingMenu}>
        <TouchableOpacity style={[styles.menuButton, styles.activeButton]}>
          <Ionicons name="map" size={22} color="#fff" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuButton}>
          <Ionicons name="list" size={22} color="#8B5CF6" />
        </TouchableOpacity>
      </View>

      {/* ACTIONS RAPIDES POUR LA COMMANDE (driver) */}
      {currentOrder && (
        <View style={styles.orderActionsContainer} pointerEvents="box-none">
          {String(currentOrder.status) === 'accepted' && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => orderSocketService.updateDeliveryStatus(currentOrder.id, 'enroute', location)}
            >
              <Text style={styles.actionText}>Je pars</Text>
            </TouchableOpacity>
          )}

          {(String(currentOrder.status) === 'enroute' || String(currentOrder.status) === 'accepted' || String(currentOrder.status) === 'in_progress') && (
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: '#F59E0B' }]}
              onPress={async () => {
                // send status to server then recalculate route to dropoff
                const dropoffCoord = resolveCoords(currentOrder.dropoff);
                await orderSocketService.updateDeliveryStatus(currentOrder.id, 'picked_up', location);
                if (location && dropoffCoord) {
                  // Reset animated position to real location
                  setAnimatedDriverPos(null);
                  // Recalculate route to dropoff (will be triggered automatically by useEffect)
                  setTimeout(() => {
                    refetchRoute();
                    fitToRoute();
                  }, 500);
                }
              }}
            >
              <Text style={styles.actionText}>Colis récupéré</Text>
            </TouchableOpacity>
          )}

          {(String(currentOrder.status) === 'picked_up' || String(currentOrder.status) === 'in_progress') && (
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: '#10B981' }]}
              onPress={() => orderSocketService.updateDeliveryStatus(currentOrder.id, 'completed', location)}
            >
              <Text style={styles.actionText}>Terminé</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* 📦 POPUP COMMANDE */}
      <OrderRequestPopup
        order={pendingOrder}
        visible={!!pendingOrder}
        onAccept={handleAcceptOrder}
        onDecline={handleDeclineOrder}
        autoDeclineTimer={30}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  driverMarker: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#8B5CF6',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  floatingMenu: {
    position: "absolute",
    bottom: 30,
    alignSelf: "center",
    backgroundColor: "#fff",
    flexDirection: "row",
    justifyContent: "space-around",
    width: 120,
    paddingVertical: 10,
    borderRadius: 30,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  menuButton: {
    backgroundColor: "#fff",
    width: 45,
    height: 45,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
  },
  activeButton: {
    backgroundColor: "#8B5CF6",
  },
  orderActionsContainer: {
    position: 'absolute',
    bottom: 100,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 10,
    zIndex: 1300,
  },
  actionButton: {
    backgroundColor: '#8B5CF6',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: {
    color: '#fff',
    fontWeight: '600',
  },
});

/* 🗺️ STYLE GRIS PERSONNALISÉ POUR LA MAP */
const grayMapStyle = [
  {
    elementType: "geometry",
    stylers: [{ color: "#ebe3cd" }],
  },
  {
    elementType: "labels.text.fill",
    stylers: [{ color: "#523735" }],
  },
  {
    elementType: "labels.text.stroke",
    stylers: [{ color: "#f5f1e6" }],
  },
  {
    featureType: "administrative",
    elementType: "geometry.stroke",
    stylers: [{ color: "#c9b2a6" }],
  },
  {
    featureType: "poi",
    elementType: "geometry",
    stylers: [{ color: "#dfd2ae" }],
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#f5f1e6" }],
  },
  {
    featureType: "road.arterial",
    elementType: "geometry",
    stylers: [{ color: "#fdfcf8" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: "#f8c967" }],
  },
  {
    featureType: "water",
    elementType: "geometry.fill",
    stylers: [{ color: "#b9d3c2" }],
  },
];
