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
import { logger } from '../../utils/logger';
import { locationService } from '../../services/locationService';

export default function OrderTrackingPage() {
  const { requireAuth } = useRequireAuth();
  const params = useLocalSearchParams<{ orderId: string }>();
  const { user } = useAuthStore();
  const orderId = params.orderId;
  
  // 🆕 Utiliser un sélecteur Zustand pour que le composant se mette à jour automatiquement
  // quand le statut de la commande change dans le store
  const storeOrder = useOrderStore((state) => 
    orderId ? state.activeOrders.find(o => o.id === orderId) : null
  );
  const { driverCoords: orderDriverCoordsMap, setSelectedOrder } = useOrderStore();
  const { showRatingBottomSheet, orderId: ratingOrderId, driverName: ratingDriverName, resetRatingBottomSheet } = useRatingStore();
  
  const mapRef = useRef<MapView | null>(null);

  // État local pour stocker la commande chargée depuis l'API si elle n'est pas dans le store
  const [loadedOrder, setLoadedOrder] = React.useState<any>(null);
  const [isLoadingOrder, setIsLoadingOrder] = React.useState(false);
  const [showError, setShowError] = React.useState(false);
  const [region, setRegion] = React.useState<any>(null);
  const isLoadingOrderRef = useRef(false);

  // Trouver la commande correspondante (dans le store ou chargée depuis l'API)
  // Utiliser le store directement pour avoir les mises à jour en temps réel
  const currentOrder = useMemo(() => {
    if (!orderId) return null;
    // D'abord chercher dans le store (priorité car c'est en temps réel)
    if (storeOrder) {
      // Si on a une commande chargée depuis l'API, la fusionner avec le store pour avoir toutes les infos
      if (loadedOrder) {
        const merged = {
          ...loadedOrder,
          ...storeOrder, // Le store a priorité pour le statut et les infos temps réel
          status: storeOrder.status, // S'assurer que le statut vient du store
        };
        if (__DEV__) {
          console.log(`🔄 currentOrder mis à jour (fusionné): ${merged.status} pour ${orderId.slice(0, 8)}...`);
        }
        return merged;
      }
      if (__DEV__) {
        console.log(`🔄 currentOrder mis à jour (store): ${storeOrder.status} pour ${orderId.slice(0, 8)}...`);
      }
      return storeOrder;
    }
    // Sinon utiliser la commande chargée depuis l'API
    if (loadedOrder && __DEV__) {
      console.log(`🔄 currentOrder (API): ${loadedOrder.status} pour ${orderId.slice(0, 8)}...`);
    }
    return loadedOrder || null;
  }, [orderId, storeOrder, loadedOrder]);
  
  // Log pour debug quand le statut change
  useEffect(() => {
    if (currentOrder && __DEV__) {
      console.log(`📊 OrderTrackingPage - Statut actuel: ${currentOrder.status} pour ${currentOrder.id.slice(0, 8)}...`);
    }
  }, [currentOrder?.status, currentOrder?.id]);

  // Récupérer les coordonnées du driver pour cette commande
  const orderDriverCoords = orderId ? orderDriverCoordsMap.get(orderId) || null : null;

  // Vérifier l'authentification
  useEffect(() => {
    requireAuth(() => {});
  }, [requireAuth]);

  // Connexion Socket pour les commandes
  useEffect(() => {
    if (user?.id) {
      userOrderSocketService.connect(user.id);
    }
    return () => {
      userOrderSocketService.disconnect();
    };
  }, [user?.id]);

  // Connexion Socket pour la messagerie
  useEffect(() => {
    if (user?.id) {
      userMessageSocketService.connect(user.id);
    }
    return () => {
      userMessageSocketService.disconnect();
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
    toggle: toggleBottomSheet,
    panResponder,
  } = useBottomSheet();

  // Bottom sheet séparé pour l'évaluation
  const {
    animatedHeight: ratingAnimatedHeight,
    isExpanded: ratingIsExpanded,
    panResponder: ratingPanResponder,
    toggle: toggleRatingBottomSheet,
    expand: expandRatingBottomSheet,
    collapse: collapseRatingBottomSheet,
  } = useBottomSheet();

  // Bottom sheet séparé pour la messagerie
  const {
    animatedHeight: messageAnimatedHeight,
    isExpanded: messageIsExpanded,
    panResponder: messagePanResponder,
    toggle: toggleMessageBottomSheet,
    expand: expandMessageBottomSheet,
    collapse: collapseMessageBottomSheet,
  } = useBottomSheet();

  // État pour gérer l'affichage du bottom sheet de messagerie
  const [showMessageBottomSheet, setShowMessageBottomSheet] = React.useState(false);

  // Ouvrir automatiquement le bottom sheet au montage (une seule fois)
  const hasAutoExpandedRef = useRef(false);
  useEffect(() => {
    if (currentOrder && !isExpanded && !hasAutoExpandedRef.current) {
      hasAutoExpandedRef.current = true;
      setTimeout(() => {
        expandBottomSheet();
      }, 300);
    }
  }, [currentOrder, expandBottomSheet]);

  // Ouvrir automatiquement le rating bottom sheet quand il doit être affiché
  useEffect(() => {
    if (showRatingBottomSheet && ratingOrderId === orderId && !ratingIsExpanded) {
      setTimeout(() => {
        expandRatingBottomSheet();
      }, 300);
    }
  }, [showRatingBottomSheet, ratingOrderId, orderId, ratingIsExpanded, expandRatingBottomSheet]);

  // 🆕 Afficher automatiquement le RatingBottomSheet si la commande est complétée et n'a pas encore été évaluée
  useEffect(() => {
    if (currentOrder && currentOrder.status === 'completed' && currentOrder.id === orderId) {
      // Vérifier si le RatingBottomSheet n'est pas déjà affiché
      if (!showRatingBottomSheet || ratingOrderId !== orderId) {
        // Vérifier si la commande a déjà été évaluée
        const checkAndShowRating = async () => {
          try {
            const ratingResult = await userApiService.getOrderRating(currentOrder.id);
            // Si aucune évaluation n'existe, afficher le RatingBottomSheet
            if (!ratingResult.success || !ratingResult.data) {
              const driverId = currentOrder.driverId || currentOrder.driver?.id;
              const driverName = currentOrder.driver?.name || 'Votre livreur';
              
              if (driverId) {
                useRatingStore.getState().setRatingBottomSheet(
                  true,
                  currentOrder.id,
                  driverId,
                  driverName
                );
                if (__DEV__) {
                  console.log(`⭐ Affichage automatique RatingBottomSheet pour commande complétée ${currentOrder.id.slice(0, 8)}...`);
                }
                // Ouvrir automatiquement le bottom sheet après un court délai
                setTimeout(() => {
                  expandRatingBottomSheet();
                }, 500);
              }
            } else {
              if (__DEV__) {
                console.log(`ℹ️ Commande ${currentOrder.id.slice(0, 8)}... déjà évaluée, pas d'affichage du RatingBottomSheet`);
              }
            }
          } catch (error) {
            console.error('Erreur vérification rating:', error);
            // En cas d'erreur, afficher quand même le RatingBottomSheet
            const driverId = currentOrder.driverId || currentOrder.driver?.id;
            const driverName = currentOrder.driver?.name || 'Votre livreur';
            
            if (driverId) {
              useRatingStore.getState().setRatingBottomSheet(
                true,
                currentOrder.id,
                driverId,
                driverName
              );
              // Ouvrir automatiquement le bottom sheet après un court délai
              setTimeout(() => {
                expandRatingBottomSheet();
              }, 500);
            }
          }
        };
        
        checkAndShowRating();
      }
    }
  }, [currentOrder?.status, currentOrder?.id, orderId, showRatingBottomSheet, ratingOrderId, expandRatingBottomSheet]);

  // Charger la commande depuis l'API si elle n'est pas dans le store
  // Cette fonction peut être appelée plusieurs fois pour recharger la commande
  const loadOrderFromAPI = React.useCallback(async () => {
    if (!orderId || !user?.id || isLoadingOrderRef.current) return;
    
    isLoadingOrderRef.current = true;
    setIsLoadingOrder(true);
    try {
      const result = await userApiService.getUserDeliveries(user.id, { limit: 100 });
      if (result.success && result.data) {
        const order = result.data.find((o: any) => o.id === orderId);
        if (order) {
          // Vérifier que la commande n'est pas terminée/annulée
          const orderStatus = order.status;
          const isFinalStatus = orderStatus === 'completed' || orderStatus === 'cancelled' || orderStatus === 'declined';
          
          // Formater la commande
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
            status: orderStatus,
            driverId: order.driver_id,
            createdAt: order.created_at,
          };
          
          // Toujours mettre à jour le store, même si la commande est terminée
          // Cela permet de mettre à jour le statut en temps réel
          const store = useOrderStore.getState();
          const existingOrder = store.activeOrders.find(o => o.id === orderId);
          
          if (__DEV__) {
            console.log(`📥 Commande chargée depuis l'API: ${orderId.slice(0, 8)}... - Statut: ${orderStatus} (existant: ${existingOrder?.status || 'aucun'})`);
          }
          
          if (existingOrder) {
            // Si le statut a changé, utiliser updateFromSocket pour forcer le re-render
            if (existingOrder.status !== orderStatus) {
              if (__DEV__) {
                console.log(`🔄 Statut différent détecté: ${existingOrder.status} → ${orderStatus}, mise à jour du store`);
              }
              store.updateFromSocket({ order: formattedOrder as any });
            } else {
              // Mettre à jour les autres propriétés
              store.updateOrder(orderId, formattedOrder as any);
            }
          } else {
            // Si la commande n'est pas dans un statut final, l'ajouter au store
            if (!isFinalStatus) {
              store.addOrder(formattedOrder as any);
            }
          }
          
          // Toujours stocker dans loadedOrder pour l'affichage
          setLoadedOrder(formattedOrder);
          logger.info('✅ Commande chargée depuis l\'API', 'order-tracking', { orderId, status: orderStatus });
        } else {
          // Commande non trouvée dans l'API - peut-être qu'elle a été supprimée
          logger.warn('⚠️ Commande non trouvée dans l\'API', 'order-tracking', { orderId });
          setLoadedOrder(null);
        }
      }
    } catch (error) {
      logger.error('❌ Erreur chargement commande', 'order-tracking', error);
      // Ne pas effacer loadedOrder en cas d'erreur pour garder l'affichage
    } finally {
      isLoadingOrderRef.current = false;
      setIsLoadingOrder(false);
    }
  }, [orderId, user?.id]);

  // Charger la commande au montage et périodiquement si elle n'est pas dans le store
  useEffect(() => {
    // Charger immédiatement si pas dans le store
    if (!currentOrder && orderId && user?.id) {
      loadOrderFromAPI();
    }
    
    // Recharger périodiquement (toutes les 5 secondes) si la commande est active
    // Cela garantit que le statut est toujours à jour même si le socket rate une mise à jour
    const interval = setInterval(() => {
      if (orderId && user?.id) {
        // Toujours recharger si la commande est active pour s'assurer que le statut est à jour
        if (currentOrder && currentOrder.status !== 'completed' && currentOrder.status !== 'cancelled' && currentOrder.status !== 'declined') {
          if (__DEV__) {
            console.log(`🔄 Rafraîchissement périodique de la commande ${orderId.slice(0, 8)}... (statut actuel: ${currentOrder.status})`);
          }
          loadOrderFromAPI();
        }
      }
    }, 5000); // Toutes les 5 secondes pour une meilleure réactivité
    
    return () => clearInterval(interval);
  }, [orderId, user?.id, currentOrder, storeOrder, loadOrderFromAPI]);

  // Mettre à jour la région de la map depuis la commande
  useEffect(() => {
    if (currentOrder) {
      const pickup = currentOrder.pickup?.coordinates;
      const dropoff = currentOrder.dropoff?.coordinates;
      
      if (pickup && dropoff) {
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
    // Vérifier le statut de la commande avant d'afficher l'alerte
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
                logger.info('✅ Commande annulée', 'order-tracking', { orderId: orderIdToCancel });
                // Retourner à la page principale après annulation
                // Utiliser replace pour éviter les problèmes de navigation
                if (router.canGoBack()) {
                  router.back();
                } else {
                  router.replace('/(tabs)/box');
                }
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
  }, [currentOrder]);

  // Gérer la soumission du rating
  const handleRatingSubmitted = useCallback(() => {
    // Fermer le RatingBottomSheet mais rester sur la page pour voir le TrackingBottomSheet
    resetRatingBottomSheet();
    collapseRatingBottomSheet();
    // S'assurer que le TrackingBottomSheet est visible après soumission
    setTimeout(() => {
      if (!isExpanded) {
        expandBottomSheet();
      }
    }, 300);
  }, [resetRatingBottomSheet, collapseRatingBottomSheet, expandBottomSheet, isExpanded]);

  // Gérer la fermeture du rating
  const handleRatingClose = useCallback(() => {
    // Fermer le RatingBottomSheet mais rester sur la page pour voir le TrackingBottomSheet
    resetRatingBottomSheet();
    collapseRatingBottomSheet();
    // S'assurer que le TrackingBottomSheet est visible après fermeture
    setTimeout(() => {
      if (!isExpanded) {
        expandBottomSheet();
      }
    }, 300);
  }, [resetRatingBottomSheet, collapseRatingBottomSheet, expandBottomSheet, isExpanded]);

  // Gérer l'ouverture de la messagerie
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

  // Gérer la fermeture de la messagerie
  const handleCloseMessage = useCallback(() => {
    collapseMessageBottomSheet();
    setTimeout(() => {
      setShowMessageBottomSheet(false);
    }, 300);
  }, [collapseMessageBottomSheet]);

  // Gérer l'affichage de l'erreur après un délai si la commande n'est pas trouvée
  // ⚠️ IMPORTANT: Ce hook doit être appelé AVANT tout return conditionnel
  React.useEffect(() => {
    if (!currentOrder && !isLoadingOrder) {
      // Attendre 3 secondes avant d'afficher l'erreur pour laisser le temps au chargement
      const timer = setTimeout(() => {
        setShowError(true);
      }, 3000);
      return () => clearTimeout(timer);
    } else {
      // Réinitialiser l'erreur si la commande est trouvée
      setShowError(false);
    }
  }, [currentOrder, isLoadingOrder]);

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

  // Afficher un état de chargement pendant le chargement initial
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

  // Ne montrer "Commande introuvable" que si la commande n'existe vraiment pas
  // (après avoir essayé de la charger depuis l'API)
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
                // Essayer de recharger avant de revenir
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
    
    // Pendant l'attente, afficher le chargement
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
      {/* Bouton Retour */}
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

      {/* Carte dédiée au tracking */}
      <DeliveryMapView
        mapRef={mapRef}
        region={mapRegion}
        pickupCoords={currentOrder?.pickup?.coordinates || null}
        dropoffCoords={currentOrder?.dropoff?.coordinates || null}
        displayedRouteCoords={[]}
        driverCoords={null} // Pas de recherche de driver ici
        orderDriverCoords={orderDriverCoords} // Coordonnées du driver assigné
        orderStatus={currentOrder?.status}
        onlineDrivers={[]} // Pas besoin d'afficher les autres drivers
        isSearchingDriver={currentOrder?.status === 'pending'}
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

      {/* Tracking Bottom Sheet - Rendu en premier (en dessous) */}
      {currentOrder && (
        <TrackingBottomSheet
          key={`tracking-${currentOrder.id}-${currentOrder.status}`} // 🆕 Forcer le re-render quand le statut change
          currentOrder={currentOrder}
          panResponder={panResponder}
          animatedHeight={animatedHeight}
          isExpanded={isExpanded}
          onToggle={toggleBottomSheet}
          onCancel={() => handleCancelOrder(currentOrder.id)}
          onMessage={handleOpenMessage}
          onNewOrder={() => {
            // Rediriger vers la map principale pour créer une nouvelle commande
            router.push('/(tabs)/map');
          }}
          activeOrdersCount={useOrderStore.getState().activeOrders.length}
        />
      )}

      {/* Message Bottom Sheet - Rendu au milieu */}
      {showMessageBottomSheet && currentOrder?.driverId && (
        <MessageBottomSheet
          orderId={currentOrder.id}
          driverId={currentOrder.driverId}
          driverName={currentOrder.driver?.name}
          driverAvatar={currentOrder.driver?.avatar}
          panResponder={messagePanResponder}
          animatedHeight={messageAnimatedHeight}
          isExpanded={messageIsExpanded}
          onToggle={toggleMessageBottomSheet}
          onClose={handleCloseMessage}
        />
      )}

      {/* Rating Bottom Sheet - Rendu en dernier pour être au-dessus de tout (priorité la plus haute) */}
      {/* Afficher si showRatingBottomSheet est true OU si la commande est complétée */}
      {((showRatingBottomSheet && ratingOrderId === orderId) || 
        (currentOrder?.status === 'completed' && currentOrder?.id === orderId && currentOrder?.driverId)) && (
        <RatingBottomSheet
          orderId={ratingOrderId || orderId}
          driverName={ratingDriverName || currentOrder?.driver?.name || 'Votre livreur'}
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

