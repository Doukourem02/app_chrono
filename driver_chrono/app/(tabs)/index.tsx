import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Alert,
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
  
  const [isOnline, setIsOnline] = useState(storeIsOnline);
  
  // Hook de géolocalisation
  const { location, error } = useDriverLocation(isOnline);

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
    
    setIsOnline(value);
    setOnlineStatus(value); // Mettre à jour le store
    
    // 📡 Synchroniser avec le backend
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
        // Optionnel: Afficher une alerte à l'utilisateur
        Alert.alert(
          "Erreur de synchronisation",
          "Impossible de synchroniser votre statut avec le serveur.",
          [{ text: "OK" }]
        );
      } else {
        // Statut synchronisé avec succès (log supprimé)
      }
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

  // Région de la carte basée sur la localisation du chauffeur
  const mapRegion = location ? {
    latitude: location.latitude,
    longitude: location.longitude,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  } : {
    latitude: 5.345317,
    longitude: -4.024429,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  };
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

  // distanceMeters removed — no longer used (polyline always points to pickup after accept)

  // Debug: vérifier que currentOrder et location sont bien reçus
  useEffect(() => {
    if (currentOrder) {
      console.log('🧭 DEBUG currentOrder:', {
        id: currentOrder.id,
        status: currentOrder.status,
        pickup_raw: currentOrder.pickup,
        pickup_resolved: resolveCoords(currentOrder.pickup),
        dropoff_resolved: resolveCoords(currentOrder.dropoff),
      });
    } else {
      console.log('🧭 DEBUG currentOrder: null');
    }

    if (location) {
      console.log('🧭 DEBUG driver location:', location);
    }
  }, [currentOrder, location]);

  // NOTE: removed automatic fitToCoordinates to avoid abrupt map zooming; map remains centered on driver's region.

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
        region={mapRegion}
        customMapStyle={grayMapStyle}
        showsUserLocation={false}
        showsMyLocationButton={false}
      >
        {/* Marqueur du chauffeur quand en ligne */}
        {isOnline && location && (
          <Marker
            coordinate={{
              latitude: location.latitude,
              longitude: location.longitude,
            }}
            title="Ma position"
            description="Chauffeur en ligne"
          >
            <View style={styles.driverMarker}>
              <Ionicons name="car" size={20} color="#fff" />
            </View>
          </Marker>
        )}

        {/* Polyline pour la commande active
            - Affichée seulement après acceptation (status === 'accepted' ou 'in_progress')
            - Trace toujours chauffeur -> pickup (le chauffeur doit aller récupérer le colis chez l'expéditeur)
        */}
        {isOnline && location && currentOrder && (currentOrder.status === 'accepted' || currentOrder.status === 'in_progress') && (() => {
          const pickupCoord = resolveCoords(currentOrder.pickup);
          if (!pickupCoord) {
            console.warn('⚠️ currentOrder has no resolvable pickup coord', currentOrder);
            return null;
          }

          return (
            <Polyline
              coordinates={[
                { latitude: location.latitude, longitude: location.longitude },
                { latitude: pickupCoord.latitude, longitude: pickupCoord.longitude }
              ]}
              strokeColor="#8B5CF6"
              strokeWidth={4}
              lineCap="round"
            />
          );
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
