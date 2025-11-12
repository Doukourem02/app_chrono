import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useRef, useEffect, useMemo, useCallback } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, Alert, Animated, Dimensions } from 'react-native';
import MapView from 'react-native-maps';
import { useRequireAuth } from '../../hooks/useRequireAuth';
import { useAuthStore } from '../../store/useAuthStore';
import { DeliveryMapView } from '../../components/DeliveryMapView';
import TrackingBottomSheet from '../../components/TrackingBottomSheet';
import RatingBottomSheet from '../../components/RatingBottomSheet';
import { userOrderSocketService } from '../../services/userOrderSocketService';
import { userApiService } from '../../services/userApiService';
import { useOrderStore } from '../../store/useOrderStore';
import { useRatingStore } from '../../store/useRatingStore';
import { useBottomSheet } from '../../hooks/useBottomSheet';
import { logger } from '../../utils/logger';
import { locationService } from '../../services/locationService';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function OrderTrackingPage() {
  const { requireAuth } = useRequireAuth();
  const params = useLocalSearchParams<{ orderId: string }>();
  const { user } = useAuthStore();
  const { activeOrders, driverCoords: orderDriverCoordsMap, setSelectedOrder } = useOrderStore();
  const { showRatingBottomSheet, ratingOrderId, resetRatingBottomSheet } = useRatingStore();
  
  const mapRef = useRef<MapView | null>(null);
  const orderId = params.orderId;

  // Trouver la commande correspondante
  const currentOrder = useMemo(() => {
    if (!orderId) return null;
    return activeOrders.find(o => o.id === orderId) || null;
  }, [orderId, activeOrders]);

  // Récupérer les coordonnées du driver pour cette commande
  const orderDriverCoords = orderId ? orderDriverCoordsMap.get(orderId) || null : null;

  // Vérifier l'authentification
  useEffect(() => {
    requireAuth(() => {});
  }, [requireAuth]);

  // Connexion Socket
  useEffect(() => {
    if (user?.id) {
      userOrderSocketService.connect(user.id);
    }
    return () => {
      userOrderSocketService.disconnect();
    };
  }, [user?.id]);

  // Sélectionner automatiquement la commande au montage
  useEffect(() => {
    if (orderId) {
      setSelectedOrder(orderId);
    }
  }, [orderId, setSelectedOrder]);

  // Démarrer le watch de localisation
  useEffect(() => {
    locationService.startWatching();
    return () => {
      // Le service gère son cycle de vie
    };
  }, []);

  // Bottom sheet pour le tracking
  const {
    animatedHeight,
    isExpanded,
    expand: expandBottomSheet,
    collapse: collapseBottomSheet,
    toggle: toggleBottomSheet,
    panResponder,
  } = useBottomSheet();

  // Ouvrir automatiquement le bottom sheet au montage
  useEffect(() => {
    if (currentOrder && !isExpanded) {
      setTimeout(() => {
        expandBottomSheet();
      }, 300);
    }
  }, [currentOrder, isExpanded, expandBottomSheet]);

  // États pour la map
  const [pickupCoords, setPickupCoords] = React.useState<{ latitude: number; longitude: number } | null>(null);
  const [dropoffCoords, setDropoffCoords] = React.useState<{ latitude: number; longitude: number } | null>(null);
  const [displayedRouteCoords, setDisplayedRouteCoords] = React.useState<{ latitude: number; longitude: number }[]>([]);
  const [region, setRegion] = React.useState<any>(null);

  // Charger la commande depuis l'API si elle n'est pas dans le store
  useEffect(() => {
    const loadOrder = async () => {
      if (!orderId || currentOrder) return; // Déjà dans le store
      
      try {
        if (user?.id) {
          const result = await userApiService.getUserDeliveries(user.id, { limit: 100 });
          if (result.success && result.data) {
            const order = result.data.find((o: any) => o.id === orderId);
            if (order) {
              // Formater et ajouter au store
              const formattedOrder = {
                id: order.id,
                user: { id: order.user_id, name: order.user?.name || 'Client' },
                driver: order.driver_id ? { id: order.driver_id, name: order.driver?.name || 'Livreur' } : undefined,
                pickup: {
                  address: order.pickup_address_text || (typeof order.pickup_address === 'string' ? JSON.parse(order.pickup_address) : order.pickup_address)?.address || '',
                  coordinates: typeof order.pickup_address === 'string' 
                    ? JSON.parse(order.pickup_address).coordinates 
                    : order.pickup_address?.coordinates || { latitude: 0, longitude: 0 },
                },
                dropoff: {
                  address: order.dropoff_address_text || (typeof order.dropoff_address === 'string' ? JSON.parse(order.dropoff_address) : order.dropoff_address)?.address || '',
                  coordinates: typeof order.dropoff_address === 'string'
                    ? JSON.parse(order.dropoff_address).coordinates
                    : order.dropoff_address?.coordinates || { latitude: 0, longitude: 0 },
                },
                price: order.price || order.price_cfa,
                deliveryMethod: order.delivery_method as 'moto' | 'vehicule' | 'cargo',
                distance: order.distance || order.distance_km,
                estimatedDuration: order.estimated_duration || order.eta_minutes,
                status: order.status,
                driverId: order.driver_id,
                createdAt: order.created_at,
              };
              useOrderStore.getState().addOrder(formattedOrder as any);
            }
          }
        }
      } catch (error) {
        logger.error('❌ Erreur chargement commande', 'order-tracking', error);
      }
    };
    
    loadOrder();
  }, [orderId, currentOrder, user?.id]);

  // Mettre à jour les coordonnées pickup/dropoff depuis la commande
  useEffect(() => {
    if (currentOrder) {
      const pickup = currentOrder.pickup?.coordinates;
      const dropoff = currentOrder.dropoff?.coordinates;
      
      if (pickup && dropoff) {
        setPickupCoords(pickup);
        setDropoffCoords(dropoff);
        
        // Calculer la région de la map
        const minLat = Math.min(pickup.latitude, dropoff.latitude);
        const maxLat = Math.max(pickup.latitude, dropoff.latitude);
        const minLng = Math.min(pickup.longitude, dropoff.longitude);
        const maxLng = Math.max(pickup.longitude, dropoff.longitude);
        
        const centerLat = (minLat + maxLat) / 2;
        const centerLng = (minLng + maxLng) / 2;
        const latDelta = Math.max((maxLat - minLat) * 1.5, 0.01);
        const lngDelta = Math.max((maxLng - minLng) * 1.5, 0.01);
        
        setRegion({
          latitude: centerLat,
          longitude: centerLng,
          latitudeDelta: latDelta,
          longitudeDelta: lngDelta,
        });
      }
    }
  }, [currentOrder]);

  // Gérer l'annulation de commande
  const handleCancelOrder = useCallback(async (orderIdToCancel: string) => {
    Alert.alert(
      'Annuler la commande',
      'Êtes-vous sûr de vouloir annuler cette commande ?',
      [
        { text: 'Non', style: 'cancel' },
        {
          text: 'Oui, annuler',
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await userApiService.cancelOrder(orderIdToCancel);
              if (result.success) {
                logger.info('✅ Commande annulée', 'order-tracking', { orderId: orderIdToCancel });
                // Retourner à la page précédente après annulation
                router.back();
              } else {
                logger.error('❌ Erreur lors de l\'annulation', 'order-tracking', { message: result.message });
                Alert.alert('Erreur', result.message || 'Impossible d\'annuler la commande');
              }
            } catch (error) {
              logger.error('❌ Erreur lors de l\'annulation', 'order-tracking', error);
              Alert.alert('Erreur', 'Impossible d\'annuler la commande');
            }
          },
        },
      ]
    );
  }, []);

  // Gérer la soumission du rating
  const handleRatingSubmitted = useCallback(() => {
    resetRatingBottomSheet();
    // Retourner à la page précédente après le rating
    setTimeout(() => {
      router.back();
    }, 500);
  }, [resetRatingBottomSheet]);

  // Gérer la fermeture du rating
  const handleRatingClose = useCallback(() => {
    resetRatingBottomSheet();
    router.back();
  }, [resetRatingBottomSheet]);

  // Calculer la région de la map basée sur pickup et dropoff
  // ⚠️ IMPORTANT: Ce hook doit être appelé AVANT tout return conditionnel
  const mapRegion = useMemo(() => {
    if (region) return region;
    
    // Région par défaut (Abidjan)
    return {
      latitude: 5.3600,
      longitude: -4.0083,
      latitudeDelta: 0.1,
      longitudeDelta: 0.1,
    };
  }, [region]);

  if (!currentOrder) {
    return (
      <View style={styles.container}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
          <Text style={styles.errorText}>Commande introuvable</Text>
          <TouchableOpacity 
            style={styles.backButtonText}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonTextLabel}>Retour</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Bouton Retour */}
      <TouchableOpacity 
        style={styles.backButton}
        onPress={() => router.back()}
      >
        <Ionicons name="arrow-back" size={24} color="#333" />
      </TouchableOpacity>

      {/* Carte dédiée au tracking */}
      <DeliveryMapView
        mapRef={mapRef}
        region={mapRegion}
        pickupCoords={currentOrder?.pickup?.coordinates || null}
        dropoffCoords={currentOrder?.dropoff?.coordinates || null}
        displayedRouteCoords={displayedRouteCoords}
        driverCoords={null} // Pas de recherche de driver ici
        orderDriverCoords={orderDriverCoords} // Coordonnées du driver assigné
        orderStatus={currentOrder?.status}
        onlineDrivers={[]} // Pas besoin d'afficher les autres drivers
        isSearchingDriver={false}
        pulseAnim={new Animated.Value(1)}
        destinationPulseAnim={new Animated.Value(1)}
        userPulseAnim={new Animated.Value(1)}
        durationText=""
        searchSeconds={0}
        selectedMethod={currentOrder?.deliveryMethod || 'moto'}
        availableVehicles={[]}
        showMethodSelection={false}
        onMapPress={() => {
          // Toggle le bottom sheet au clic sur la map
          toggleBottomSheet();
        }}
      />

      {/* Rating Bottom Sheet */}
      {showRatingBottomSheet && ratingOrderId === orderId && (
        <RatingBottomSheet
          orderId={ratingOrderId}
          onRatingSubmitted={handleRatingSubmitted}
          onClose={handleRatingClose}
        />
      )}

      {/* Tracking Bottom Sheet */}
      {currentOrder && (
        <TrackingBottomSheet
          currentOrder={currentOrder}
          panResponder={panResponder}
          animatedHeight={animatedHeight}
          isExpanded={isExpanded}
          onToggle={toggleBottomSheet}
          onCancel={() => handleCancelOrder(currentOrder.id)}
          onNewOrder={() => {
            // Rediriger vers la map principale pour créer une nouvelle commande
            router.push('/(tabs)/map');
          }}
          activeOrdersCount={activeOrders.length}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  backButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    zIndex: 1000,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    color: '#EF4444',
    marginTop: 16,
    marginBottom: 24,
    textAlign: 'center',
  },
  backButtonText: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#8B5CF6',
    borderRadius: 12,
  },
  backButtonTextLabel: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});

