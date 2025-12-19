import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useRef, useEffect, useMemo, useCallback } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, Alert, Animated } from 'react-native';
import MapView from 'react-native-maps';
import { useRequireAuth } from '../../hooks/useRequireAuth';
import { useAuthStore } from '../../store/useAuthStore';
import { DeliveryMapView } from '../../components/DeliveryMapView';
import TrackingBottomSheet from '../../components/TrackingBottomSheet';
import RatingBottomSheet from '../../components/RatingBottomSheet';
import MessageBottomSheet from '../../components/MessageBottomSheet';
import { userOrderSocketService } from '../../services/userOrderSocketService';
import { userMessageSocketService } from '../../services/userMessageSocketService';
import { userApiService } from '../../services/userApiService';
import { useOrderStore } from '../../store/useOrderStore';
import { useRatingStore } from '../../store/useRatingStore';
import { useBottomSheet } from '../../hooks/useBottomSheet';
import { useMessageBottomSheet } from '../../hooks/useMessageBottomSheet';
import { logger } from '../../utils/logger';
import { locationService } from '../../services/locationService';
import { formatUserName } from '../../utils/formatName';

export default function OrderTrackingPage() {
  const { requireAuth } = useRequireAuth();
  const params = useLocalSearchParams<{ orderId: string }>();
  const { user } = useAuthStore();
  const orderId = params.orderId;
  
  const storeOrder = useOrderStore((state) => 
    orderId ? state.activeOrders.find(o => o.id === orderId) : null
  );
  const { driverCoords: orderDriverCoordsMap, setSelectedOrder } = useOrderStore();
  const { showRatingBottomSheet, orderId: ratingOrderId, driverName: ratingDriverName, resetRatingBottomSheet } = useRatingStore();
  
  const mapRef = useRef<MapView | null>(null);

  const [loadedOrder, setLoadedOrder] = React.useState<any>(null);
  const [isLoadingOrder, setIsLoadingOrder] = React.useState(false);
  const [showError, setShowError] = React.useState(false);
  const [region, setRegion] = React.useState<any>(null);
  const isLoadingOrderRef = useRef(false);

  // Fusionner storeOrder (temps réel) et loadedOrder (API) - le store a priorité pour le statut
  const currentOrder = useMemo(() => {
    if (!orderId) return null;
    if (storeOrder) {
      if (loadedOrder) {
        const merged = {
          ...loadedOrder,
          ...storeOrder,
          status: storeOrder.status,
        };
        return merged;
      }
      return storeOrder;
    }
    return loadedOrder || null;
  }, [orderId, storeOrder, loadedOrder]);
  const orderDriverCoords = orderId ? orderDriverCoordsMap.get(orderId) || null : null;

  useEffect(() => {
    requireAuth(() => {});
  }, [requireAuth]);

  useEffect(() => {
    if (user?.id) {
      userOrderSocketService.connect(user.id);
    }
    return () => {
      userOrderSocketService.disconnect();
    };
  }, [user?.id]);

  useEffect(() => {
    if (user?.id) {
      userMessageSocketService.connect(user.id);
    }
    return () => {
      userMessageSocketService.disconnect();
    };
  }, [user?.id]);

  useEffect(() => {
    if (orderId) {
      setSelectedOrder(orderId);
    }
  }, [orderId, setSelectedOrder]);

  useEffect(() => {
    locationService.startWatching();
  }, []);
  const {
    animatedHeight,
    isExpanded,
    expand: expandBottomSheet,
    toggle: toggleBottomSheet,
    panResponder,
  } = useBottomSheet();

  const {
    animatedHeight: ratingAnimatedHeight,
    isExpanded: ratingIsExpanded,
    panResponder: ratingPanResponder,
    toggle: toggleRatingBottomSheet,
    expand: expandRatingBottomSheet,
    collapse: collapseRatingBottomSheet,
  } = useBottomSheet();

  const {
    animatedHeight: messageAnimatedHeight,
    isExpanded: messageIsExpanded,
    panResponder: messagePanResponder,
    toggle: toggleMessageBottomSheet,
    expand: expandMessageBottomSheet,
    collapse: collapseMessageBottomSheet,
  } = useMessageBottomSheet();

  const [showMessageBottomSheet, setShowMessageBottomSheet] = React.useState(false);
  const hasAutoExpandedRef = useRef(false);
  
  // Ouvrir automatiquement le bottom sheet de tracking au montage
  useEffect(() => {
    if (currentOrder && !isExpanded && !hasAutoExpandedRef.current) {
      hasAutoExpandedRef.current = true;
      setTimeout(() => {
        expandBottomSheet();
      }, 300);
    }
  }, [currentOrder, isExpanded, expandBottomSheet]);

  useEffect(() => {
    if (showRatingBottomSheet && ratingOrderId === orderId && !ratingIsExpanded) {
      setTimeout(() => {
        expandRatingBottomSheet();
      }, 300);
    }
  }, [showRatingBottomSheet, ratingOrderId, orderId, ratingIsExpanded, expandRatingBottomSheet]);

  // Afficher automatiquement le RatingBottomSheet si la commande est complétée et non évaluée
  useEffect(() => {
    if (currentOrder && currentOrder.status === 'completed' && currentOrder.id === orderId) {
      if (!showRatingBottomSheet || ratingOrderId !== orderId) {
        const checkAndShowRating = async () => {
          try {
            const ratingResult = await userApiService.getOrderRating(currentOrder.id);
            if (!ratingResult.success || !ratingResult.data) {
              const driverId = currentOrder.driverId || currentOrder.driver?.id;
              const driverName = formatUserName(currentOrder.driver, 'Votre livreur');
              
              if (driverId) {
                useRatingStore.getState().setRatingBottomSheet(
                  true,
                  currentOrder.id,
                  driverId,
                  driverName
                );
                setTimeout(() => {
                  expandRatingBottomSheet();
                }, 500);
              }
            }
          } catch (error) {
            console.error('Erreur vérification rating:', error);
            const driverId = currentOrder.driverId || currentOrder.driver?.id;
            const driverName = currentOrder.driver?.name || 'Votre livreur';
            
            if (driverId) {
              useRatingStore.getState().setRatingBottomSheet(
                true,
                currentOrder.id,
                driverId,
                driverName
              );
              setTimeout(() => {
                expandRatingBottomSheet();
              }, 500);
            }
          }
        };
        
        checkAndShowRating();
      }
    }
  }, [currentOrder, orderId, showRatingBottomSheet, ratingOrderId, expandRatingBottomSheet]);

  // Charger la commande depuis l'API si elle n'est pas dans le store
  const loadOrderFromAPI = React.useCallback(async () => {
    if (!orderId || !user?.id || isLoadingOrderRef.current) return;
    
    isLoadingOrderRef.current = true;
    setIsLoadingOrder(true);
    try {
      const result = await userApiService.getUserDeliveries(user.id, { limit: 100 });
      if (result.success && result.data) {
        const order = result.data.find((o: any) => o.id === orderId);
        if (order) {
          const orderStatus = order.status;
          const isFinalStatus = orderStatus === 'completed' || orderStatus === 'cancelled' || orderStatus === 'declined';
          
          const formattedOrder = {
            id: order.id,
            user: { id: order.user_id, name: formatUserName(order.user) },
            driver: order.driver_id
              ? {
                  id: order.driver_id,
                  first_name: order.driver?.first_name,
                  last_name: order.driver?.last_name,
                  name: order.driver?.first_name && order.driver?.last_name
                    ? `${order.driver.first_name} ${order.driver.last_name}`.trim()
                    : order.driver?.first_name || order.driver?.last_name || formatUserName(order.driver, 'Livreur'),
                  phone: order.driver?.phone,
                  email: order.driver?.email,
                  avatar_url: order.driver?.avatar_url,
                  rating: order.driver?.rating,
                }
              : undefined,
            pickup: (() => {
              let parsedPickup;
              try {
                if (typeof order.pickup_address === 'string') {
                  parsedPickup = JSON.parse(order.pickup_address);
                } else if (order.pickup_address && typeof order.pickup_address === 'object') {
                  parsedPickup = order.pickup_address;
                } else {
                  parsedPickup = null;
                }
              } catch (e) {
                console.warn('Erreur parsing pickup_address:', e);
                parsedPickup = null;
              }
              
              return {
                address: order.pickup_address_text || parsedPickup?.address || '',
                coordinates: parsedPickup?.coordinates || { latitude: 0, longitude: 0 },
              };
            })(),
            dropoff: (() => {
              let parsedDropoff;
              try {
                if (typeof order.dropoff_address === 'string') {
                  parsedDropoff = JSON.parse(order.dropoff_address);
                } else if (order.dropoff_address && typeof order.dropoff_address === 'object') {
                  parsedDropoff = order.dropoff_address;
                } else {
                  parsedDropoff = null;
                }
              } catch (e) {
                console.warn('Erreur parsing dropoff_address:', e);
                parsedDropoff = null;
              }
              
              return {
                address: order.dropoff_address_text || parsedDropoff?.address || '',
                coordinates: parsedDropoff?.coordinates || { latitude: 0, longitude: 0 },
              };
            })(),
            price: order.price || order.price_cfa,
            deliveryMethod: order.delivery_method as 'moto' | 'vehicule' | 'cargo',
            distance: order.distance || order.distance_km,
            estimatedDuration: order.estimated_duration || order.eta_minutes,
            status: orderStatus,
            driverId: order.driver_id,
            createdAt: order.created_at,
          };
          
          const store = useOrderStore.getState();
          const existingOrder = store.activeOrders.find(o => o.id === orderId);
          
          if (existingOrder) {
            if (existingOrder.status !== orderStatus) {
              store.updateFromSocket({ order: formattedOrder as any });
            } else {
              store.updateOrder(orderId, formattedOrder as any);
            }
          } else {
            if (!isFinalStatus) {
              store.addOrder(formattedOrder as any);
            }
          }
          
          setLoadedOrder(formattedOrder);
          logger.info('Commande chargée depuis l\'API', 'order-tracking', { orderId, status: orderStatus });
        } else {
          logger.warn('Commande non trouvée dans l\'API', 'order-tracking', { orderId });
          setLoadedOrder(null);
        }
      }
    } catch (error) {
      logger.error('Erreur chargement commande', 'order-tracking', error);
    } finally {
      isLoadingOrderRef.current = false;
      setIsLoadingOrder(false);
    }
  }, [orderId, user?.id]);

  // Charger la commande au montage et recharger périodiquement si elle est active
  useEffect(() => {
    if (!currentOrder && orderId && user?.id) {
      loadOrderFromAPI();
    }
    
    // Recharger toutes les 5 secondes pour garantir que le statut est à jour
    const interval = setInterval(() => {
      if (orderId && user?.id) {
        if (currentOrder && currentOrder.status !== 'completed' && currentOrder.status !== 'cancelled' && currentOrder.status !== 'declined') {
          loadOrderFromAPI();
        }
      }
    }, 5000);
    
    return () => clearInterval(interval);
  }, [orderId, user?.id, currentOrder, storeOrder, loadOrderFromAPI]);

  // Calculer la région de la map pour afficher pickup et dropoff
  useEffect(() => {
    if (currentOrder) {
      const pickup = currentOrder.pickup?.coordinates;
      const dropoff = currentOrder.dropoff?.coordinates;
      
      if (pickup && dropoff) {
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

  const handleCancelOrder = useCallback(async (orderIdToCancel: string) => {
    if (currentOrder && currentOrder.status !== 'pending' && currentOrder.status !== 'accepted') {
      const statusMessages: Record<string, string> = {
        'picked_up': 'Impossible d\'annuler une commande dont le colis a déjà été récupéré',
        'enroute': 'Impossible d\'annuler une commande en cours de livraison',
        'completed': 'Impossible d\'annuler une commande déjà terminée',
        'cancelled': 'Cette commande a déjà été annulée',
        'declined': 'Cette commande a été refusée',
      };
      Alert.alert('Annulation impossible', statusMessages[currentOrder.status] || 'Cette commande ne peut pas être annulée');
      return;
    }

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
              const result = await userApiService.cancelOrder(orderIdToCancel, currentOrder?.status);
              if (result.success) {
                logger.info('Commande annulée', 'order-tracking', { orderId: orderIdToCancel });
                if (router.canGoBack()) {
                  router.back();
                } else {
                  router.replace('/(tabs)/box');
                }
              } else {
                logger.error('Erreur lors de l\'annulation', 'order-tracking', { message: result.message });
                Alert.alert('Erreur', result.message || 'Impossible d\'annuler la commande');
              }
            } catch (error) {
              logger.error('Erreur lors de l\'annulation', 'order-tracking', error);
              Alert.alert('Erreur', 'Impossible d\'annuler la commande');
            }
          },
        },
      ]
    );
  }, [currentOrder]);

  const handleRatingSubmitted = useCallback(() => {
    resetRatingBottomSheet();
    collapseRatingBottomSheet();
    setTimeout(() => {
      if (!isExpanded) {
        expandBottomSheet();
      }
    }, 300);
  }, [resetRatingBottomSheet, collapseRatingBottomSheet, expandBottomSheet, isExpanded]);

  const handleRatingClose = useCallback(() => {
    resetRatingBottomSheet();
    collapseRatingBottomSheet();
    setTimeout(() => {
      if (!isExpanded) {
        expandBottomSheet();
      }
    }, 300);
  }, [resetRatingBottomSheet, collapseRatingBottomSheet, expandBottomSheet, isExpanded]);

  const handleOpenMessage = useCallback(() => {
    if (!currentOrder?.driverId) {
      Alert.alert('Information', 'Aucun livreur assigné à cette commande.');
      return;
    }
    setShowMessageBottomSheet(true);
    setTimeout(() => {
      expandMessageBottomSheet();
    }, 300);
  }, [currentOrder?.driverId, expandMessageBottomSheet]);

  const handleCloseMessage = useCallback(() => {
    collapseMessageBottomSheet();
    setTimeout(() => {
      setShowMessageBottomSheet(false);
    }, 300);
  }, [collapseMessageBottomSheet]);

  React.useEffect(() => {
    if (!currentOrder && !isLoadingOrder) {
      const timer = setTimeout(() => {
        setShowError(true);
      }, 3000);
      return () => clearTimeout(timer);
    } else {
      setShowError(false);
    }
  }, [currentOrder, isLoadingOrder]);

  // Région par défaut (Abidjan) si aucune région calculée
  const mapRegion = useMemo(() => {
    if (region) return region;
    
    return {
      latitude: 5.3600,
      longitude: -4.0083,
      latitudeDelta: 0.1,
      longitudeDelta: 0.1,
    };
  }, [region]);

  if (!currentOrder && isLoadingOrder) {
    return (
      <View style={styles.container}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/(tabs)/box');
            }
          }}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <View style={styles.errorContainer}>
          <Ionicons name="hourglass-outline" size={48} color="#7C3AED" />
          <Text style={styles.errorText}>Chargement de la commande...</Text>
        </View>
      </View>
    );
  }

  if (!currentOrder && !isLoadingOrder) {
    if (showError) {
      return (
        <View style={styles.container}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace('/(tabs)/box');
              }
            }}
          >
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
            <Text style={styles.errorText}>Commande introuvable</Text>
            <TouchableOpacity 
              style={styles.backButtonText}
              onPress={() => {
                loadOrderFromAPI();
                setShowError(false);
              }}
            >
              <Text style={styles.backButtonTextLabel}>Réessayer</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.backButtonText, { marginTop: 12, backgroundColor: '#F3F4F6' }]}
              onPress={() => {
                if (router.canGoBack()) {
                  router.back();
                } else {
                  router.replace('/(tabs)/box');
                }
              }}
            >
              <Text style={[styles.backButtonTextLabel, { color: '#666' }]}>Retour</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }
    
    return (
      <View style={styles.container}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/(tabs)/box');
            }
          }}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <View style={styles.errorContainer}>
          <Ionicons name="hourglass-outline" size={48} color="#7C3AED" />
          <Text style={styles.errorText}>Chargement de la commande...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity 
        style={styles.backButton}
        onPress={() => {
          if (router.canGoBack()) {
            router.back();
          } else {
            router.replace('/(tabs)/box');
          }
        }}
      >
        <Ionicons name="arrow-back" size={24} color="#333" />
      </TouchableOpacity>

      <DeliveryMapView
        mapRef={mapRef}
        region={mapRegion}
        pickupCoords={currentOrder?.pickup?.coordinates || null}
        dropoffCoords={currentOrder?.dropoff?.coordinates || null}
        displayedRouteCoords={[]}
        driverCoords={null}
        orderDriverCoords={orderDriverCoords}
        orderStatus={currentOrder?.status}
        onlineDrivers={[]}
        isSearchingDriver={currentOrder?.status === 'pending'}
        destinationPulseAnim={new Animated.Value(1)}
        userPulseAnim={new Animated.Value(1)}
        durationText=""
        searchSeconds={0}
        selectedMethod={currentOrder?.deliveryMethod || 'moto'}
        availableVehicles={[]}
        showMethodSelection={false}
        onMapPress={() => {
          toggleBottomSheet();
        }}
      />

      {currentOrder && (
        <TrackingBottomSheet
          key={`tracking-${currentOrder.id}-${currentOrder.status}`}
          currentOrder={currentOrder}
          panResponder={panResponder}
          animatedHeight={animatedHeight}
          isExpanded={isExpanded}
          onToggle={toggleBottomSheet}
          onCancel={() => handleCancelOrder(currentOrder.id)}
          onMessage={handleOpenMessage}
          onNewOrder={() => {
            // Nettoyer la sélection de commande pour permettre la création d'une nouvelle commande
            useOrderStore.getState().setSelectedOrder(null);
            router.push('/(tabs)/map');
          }}
          activeOrdersCount={useOrderStore.getState().activeOrders.length}
        />
      )}

      {showMessageBottomSheet && currentOrder?.driverId && (
        <MessageBottomSheet
          orderId={currentOrder.id}
          driverId={currentOrder.driverId}
          driverName={formatUserName(currentOrder.driver, 'Livreur')}
          driverAvatar={currentOrder.driver?.avatar}
          panResponder={messagePanResponder}
          animatedHeight={messageAnimatedHeight}
          isExpanded={messageIsExpanded}
          onToggle={toggleMessageBottomSheet}
          onClose={handleCloseMessage}
        />
      )}

      {/* RatingBottomSheet a la priorité la plus haute - s'affiche au-dessus de tout */}
      {((showRatingBottomSheet && ratingOrderId === orderId) || 
        (currentOrder?.status === 'completed' && currentOrder?.id === orderId && currentOrder?.driverId)) && (
        <RatingBottomSheet
          orderId={ratingOrderId || orderId}
          driverName={ratingDriverName || formatUserName(currentOrder?.driver, 'Votre livreur')}
          panResponder={ratingPanResponder}
          animatedHeight={ratingAnimatedHeight}
          isExpanded={ratingIsExpanded}
          onToggle={toggleRatingBottomSheet}
          onRatingSubmitted={handleRatingSubmitted}
          onClose={handleRatingClose}
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

