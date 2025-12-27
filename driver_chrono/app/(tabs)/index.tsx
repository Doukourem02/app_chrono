import React, { useState, useEffect, useRef } from "react";
import { View, StyleSheet, TouchableOpacity, Alert, Text } from "react-native";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import { Ionicons } from "@expo/vector-icons";
import { StatusToggle } from "../../components/StatusToggle";
import { StatsCards } from "../../components/StatsCards";
import { OrderRequestPopup } from "../../components/OrderRequestPopup";
import { OrdersListBottomSheet } from "../../components/OrdersListBottomSheet";
import DriverOrderBottomSheet from "../../components/DriverOrderBottomSheet";
import { useDriverLocation } from "../../hooks/useDriverLocation";
import { useBottomSheet } from "../../hooks/useBottomSheet";
import { useOrdersListBottomSheet } from "../../hooks/useOrdersListBottomSheet";
import { useMessageBottomSheet } from "../../hooks/useMessageBottomSheet";
import { useDriverStore } from "../../store/useDriverStore";
import { useOrderStore } from "../../store/useOrderStore";
import { useUIStore } from "../../store/useUIStore";
import { apiService } from "../../services/apiService";
import { orderSocketService } from "../../services/orderSocketService";
import { driverMessageSocketService } from "../../services/driverMessageSocketService";
import { logger } from '../../utils/logger';
import { useMapCamera } from '../../hooks/useMapCamera';
import { useAnimatedRoute } from '../../hooks/useAnimatedRoute';
import { useAnimatedPosition } from '../../hooks/useAnimatedPosition';
import { calculateFullETA } from '../../utils/etaCalculator';
import { useGeofencing } from '../../hooks/useGeofencing';
import { useWeather } from '../../hooks/useWeather';
import MessageBottomSheet from "../../components/MessageBottomSheet";
import { formatUserName } from '../../utils/formatName';

export default function Index() {
  const { setHideTabBar } = useUIStore();
  const { 
    isOnline: storeIsOnline, 
    setOnlineStatus, 
    setLocation,
    todayStats,
    updateTodayStats,
    user,
    profile,
    isAuthenticated
  } = useDriverStore();
  
  const [driverStats, setDriverStats] = useState<{
    todayDeliveries: number;
    totalRevenue: number;
  }>({
    todayDeliveries: 0,
    totalRevenue: 0,
  });
  
  const pendingOrders = useOrderStore((s) => s.pendingOrders);
  const activeOrders = useOrderStore((s) => s.activeOrders);
  const selectedOrderId = useOrderStore((s) => s.selectedOrderId);
  const setSelectedOrder = useOrderStore((s) => s.setSelectedOrder);
  
  const pendingOrder = pendingOrders.length > 0 ? pendingOrders[0] : null;
  
  const isOnline = storeIsOnline;
  
  const { location, error } = useDriverLocation(isOnline);
  const mapRef = useRef<MapView | null>(null);

  const resolveCoords = (candidate?: any) => {
    if (!candidate) return null;

    const c = candidate.coordinates || candidate.coords || candidate.location || candidate;
    const lat = c?.latitude ?? c?.lat ?? c?.latitude ?? c?.Lat ?? c?.y;
    const lng = c?.longitude ?? c?.lng ?? c?.longitude ?? c?.Lng ?? c?.x;
    
    if (lat == null || lng == null) return null;
    return { latitude: Number(lat), longitude: Number(lng) };
  };
  
  const calculateDistanceToPickup = React.useCallback((order: typeof activeOrders[0]): number | null => {
    if (!location || !order?.pickup) return null;
    const pickupCoord = resolveCoords(order.pickup);
    if (!pickupCoord) return null;

    const R = 6371;
    const dLat = (pickupCoord.latitude - location.latitude) * Math.PI / 180;
    const dLon = (pickupCoord.longitude - location.longitude) * Math.PI / 180;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(location.latitude * Math.PI / 180) * Math.cos(pickupCoord.latitude * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    
    return Math.round(R * c * 10) / 10;
  }, [location]);

  const sortedActiveOrdersByDistance = React.useMemo(() => {
    if (!location || activeOrders.length === 0) return activeOrders;
    
    return [...activeOrders].sort((a, b) => {
      const distA = calculateDistanceToPickup(a);
      const distB = calculateDistanceToPickup(b);
      
      if (distA === null && distB === null) return 0;
      if (distA === null) return 1;
      if (distB === null) return -1;
      
      return distA - distB;
    });
  }, [activeOrders, location, calculateDistanceToPickup]);

  // Sélection automatique de la commande la plus prioritaire si aucune n'est sélectionnée
  useEffect(() => {
    const store = useOrderStore.getState();
    
    // Si une commande est déjà sélectionnée et existe toujours, ne rien faire
    if (store.selectedOrderId) {
      const selectedOrderExists = store.activeOrders.some(o => o.id === store.selectedOrderId);
      if (selectedOrderExists) {
        return;
    }
    }
    
    // Sinon, sélectionner automatiquement la commande la plus prioritaire
    if (location && sortedActiveOrdersByDistance.length > 0) {
      const inProgressOrder = sortedActiveOrdersByDistance.find(o => 
        o.status === 'picked_up' || o.status === 'delivering' || o.status === 'enroute' || o.status === 'in_progress'
      );
      
      const orderToSelect = inProgressOrder || sortedActiveOrdersByDistance[0];
      if (orderToSelect) {
        store.setSelectedOrder(orderToSelect.id);
        return;
      }
    }
    
    const priorityOrder = store.activeOrders.find(o => 
      o.status === 'picked_up' || o.status === 'delivering' || o.status === 'enroute' || o.status === 'in_progress'
    );
    if (priorityOrder) {
      store.setSelectedOrder(priorityOrder.id);
      return;
    }
    
    const firstOrder = store.activeOrders[0];
    if (firstOrder) {
      store.setSelectedOrder(firstOrder.id);
    }
  }, [activeOrders, sortedActiveOrdersByDistance, location]);

  const currentOrder = useOrderStore((s) => {
    if (s.selectedOrderId) {
      return s.activeOrders.find(o => o.id === s.selectedOrderId) || null;
    }
    
    // Fallback : retourner la première commande active si aucune n'est sélectionnée
    // (la sélection automatique sera gérée par le useEffect ci-dessus)
    return s.activeOrders[0] || null;
  });
  
  // Bottom sheet pour les détails de la commande (remplace RecipientDetailsSheet)
  const {
    animatedHeight: orderBottomSheetAnimatedHeight,
    panResponder: orderBottomSheetPanResponder,
    isExpanded: orderBottomSheetIsExpanded,
    expand: expandOrderBottomSheet,
    collapse: collapseOrderBottomSheet,
    toggle: toggleOrderBottomSheet,
  } = useBottomSheet();

  const {
    animatedHeight: ordersListAnimatedHeight,
    isExpanded: ordersListIsExpanded,
    panResponder: ordersListPanResponder,
    collapse: collapseOrdersListSheet,
    toggle: toggleOrdersListSheet,
  } = useOrdersListBottomSheet();

  // Bottom sheet pour la messagerie
  const {
    animatedHeight: messageAnimatedHeight,
    panResponder: messagePanResponder,
    isExpanded: messageIsExpanded,
    expand: expandMessageBottomSheet,
    collapse: collapseMessageBottomSheet,
    toggle: toggleMessageBottomSheet,
  } = useMessageBottomSheet();

  const [showMessageBottomSheet, setShowMessageBottomSheet] = useState(false);

  const handleOpenMessage = () => {
    if (!currentOrder || !currentOrder.user || !currentOrder.user.id) {
      return;
    }
    
    setShowMessageBottomSheet(true);
    setHideTabBar(true); // Cacher la barre de navigation
    setTimeout(() => {
      expandMessageBottomSheet();
    }, 300);
  };

  const handleCloseMessage = () => {
    collapseMessageBottomSheet();
    setHideTabBar(false); // Afficher la barre de navigation
    setTimeout(() => {
      setShowMessageBottomSheet(false);
    }, 300);
  };
  
  const userClosedBottomSheetRef = useRef(false);
  const lastOrderStatusRef = useRef<string | null>(null);

  const getCurrentDestination = () => {
    if (!currentOrder || !location) return null;
    const status = String(currentOrder.status || '');
    const pickupCoord = resolveCoords(currentOrder.pickup);
    const dropoffCoord = resolveCoords(currentOrder.dropoff);

    if ((status === 'accepted' || status === 'enroute' || status === 'in_progress') && pickupCoord) {
      return pickupCoord;
    }
    
    if ((status === 'picked_up' || status === 'delivering') && dropoffCoord) {
      return dropoffCoord;
    }

    return null;
  };

  const destination = getCurrentDestination();
  const currentPickupCoord = currentOrder ? resolveCoords(currentOrder.pickup) : null;
  const currentDropoffCoord = currentOrder ? resolveCoords(currentOrder.dropoff) : null;
  
  // Données météo pour ajuster l'ETA
  const weatherData = useWeather({
    latitude: location?.latitude || destination?.latitude || null,
    longitude: location?.longitude || destination?.longitude || null,
    vehicleType: profile?.vehicle_type as 'moto' | 'vehicule' | 'cargo' | null || null,
    enabled: isOnline && !!location && !!destination,
  });
  
  // Géofencing : détection automatique d'arrivée
  const geofencing = useGeofencing({
    driverPosition: location,
    targetPosition: destination,
    orderId: currentOrder?.id || null,
    orderStatus: currentOrder?.status || null,
    enabled: isOnline && !!currentOrder && !!destination && !!location,
    onEnteredZone: () => {
      // Notification visuelle ou sonore quand on entre dans la zone
      logger.info('📍 Vous êtes arrivé dans la zone de livraison', 'geofencing');
    },
    onValidated: () => {
      // Notification quand la validation automatique est déclenchée
      logger.info('✅ Livraison validée automatiquement', 'geofencing');
    },
  });
  
  // Route animée vers la destination
  const animatedRoute = useAnimatedRoute({
    origin: location,
    destination: destination,
    enabled: isOnline && !!currentOrder && !!destination && !!location,
  });

  const orderFullRoute = useAnimatedRoute({
    origin: currentPickupCoord,
    destination: currentDropoffCoord,
    enabled: !!currentOrder && !!currentPickupCoord && !!currentDropoffCoord,
  });

  useEffect(() => {
    if (currentOrder && location) {
      const pickupCoord = resolveCoords(currentOrder.pickup);
      const dropoffCoord = resolveCoords(currentOrder.dropoff);
      const status = String(currentOrder.status || '');
      
      let targetCoord = null;
      if ((status === 'accepted' || status === 'enroute' || status === 'in_progress') && pickupCoord) {
        targetCoord = pickupCoord;
      } else if ((status === 'picked_up' || status === 'delivering') && dropoffCoord) {
        targetCoord = dropoffCoord;
      }
      
      if (targetCoord && mapRef.current) {
        setTimeout(() => {
          mapRef.current?.animateToRegion({
            latitude: targetCoord!.latitude,
            longitude: targetCoord!.longitude,
            latitudeDelta: 0.02,
            longitudeDelta: 0.02,
          }, 500);
        }, 300);
      }
    }
  }, [selectedOrderId, currentOrder?.id, currentOrder, location]);

  const { fitToRoute, centerOnDriver } = useMapCamera(
    mapRef as React.RefObject<MapView>,
    location,
    animatedRoute.routeCoordinates.length > 0 ? { coordinates: animatedRoute.routeCoordinates } : null,
    currentOrder,
    isOnline
  );

  // Garder une trace de la position précédente pour l'animation fluide
  const previousLocationRef = useRef<{ latitude: number; longitude: number } | null>(null);
  
  // Animation fluide de la position du driver
  const animatedDriverPosition = useAnimatedPosition({
    currentPosition: location,
    previousPosition: previousLocationRef.current,
    animationDuration: 5000, // 5 secondes (fréquence GPS)
  });
  
  // Mettre à jour la position précédente quand la position actuelle change
  useEffect(() => {
    if (location) {
      previousLocationRef.current = location;
    }
  }, [location]);
  
  // Calculer l'ETA en temps réel vers la destination
  const realTimeETA = React.useMemo(() => {
    if (!animatedDriverPosition || !currentOrder || !location) return null;
    
    // Calculer la destination directement selon le statut de la commande
    const status = String(currentOrder.status || '');
    const pickupCoord = resolveCoords(currentOrder.pickup);
    const dropoffCoord = resolveCoords(currentOrder.dropoff);
    
    let destination = null;
    if ((status === 'accepted' || status === 'enroute' || status === 'in_progress') && pickupCoord) {
      destination = pickupCoord;
    } else if ((status === 'picked_up' || status === 'delivering') && dropoffCoord) {
      destination = dropoffCoord;
    }
    
    if (!destination) return null;
    
    const vehicleType = profile?.vehicle_type as 'moto' | 'vehicule' | 'cargo' | null;
    
    // Utiliser les données de trafic de la route active
    const activeRoute = (status === 'accepted' || status === 'enroute' || status === 'in_progress')
      ? animatedRoute
      : orderFullRoute;
    const trafficData = activeRoute?.trafficData || null;
    
    return calculateFullETA(
      animatedDriverPosition,
      destination,
      vehicleType,
      trafficData,
      weatherData.adjustment || null
    );
  }, [animatedDriverPosition, currentOrder, location, profile?.vehicle_type, animatedRoute, orderFullRoute, weatherData.adjustment]);
  
  const polyPulseIntervalRef = useRef<number | null>(null);
  const animationTimeoutsRef = useRef<number[]>([]);

  useEffect(() => {
    return () => {
      if (polyPulseIntervalRef.current) clearInterval(polyPulseIntervalRef.current);
      animationTimeoutsRef.current.forEach(id => clearTimeout(id));
    };
  }, []);

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

  // Connexion Socket pour la messagerie
  useEffect(() => {
    if (user?.id) {
      driverMessageSocketService.connect(user.id);
    }
    return () => {
      driverMessageSocketService.disconnect();
    };
  }, [user?.id]);

  const handleAcceptOrder = (orderId: string) => {
    orderSocketService.acceptOrder(orderId);
  };

  const handleDeclineOrder = (orderId: string) => {
    orderSocketService.declineOrder(orderId);
  };

  const isTogglingRef = useRef(false);
  
  const handleToggleOnline = async (value: boolean) => {
    if (isTogglingRef.current) {
      if (__DEV__) {
        console.debug('Toggle déjà en cours, ignoré');
      }
      return;
    }
    
    if (value === isOnline) {
      if (__DEV__) {
        console.debug('Statut déjà à', value, ', ignoré');
      }
      return;
    }
    
    if (value && error) {
      Alert.alert(
        "Erreur de localisation", 
        "Impossible de vous mettre en ligne sans accès à votre localisation.",
        [{ text: "OK" }]
      );
      return;
    }
    
    isTogglingRef.current = true;
    
    setOnlineStatus(value);
    
    if (user?.id) {
      const statusData: any = {
        is_online: value,
        is_available: value
      };

      if (value && location) {
        statusData.current_latitude = location.latitude;
        statusData.current_longitude = location.longitude;
        setLocation(location);
      }

      apiService.updateDriverStatus(user.id, statusData).then((result) => {
        isTogglingRef.current = false;
        
        if (!result.success) {
          if (__DEV__) {
            console.warn('Échec synchronisation:', result.message);
          }
          
          // Si la session est expirée, le logout() a déjà été appelé
          // Le système de redirection gérera la navigation vers la page de connexion
          if (result.message?.includes('Session expirée')) {
            sessionExpiredRef.current = true;
            // Ne pas afficher d'alerte, laisser le système de redirection faire son travail
            return;
          }
          
          // Rollback du changement de statut en cas d'erreur (sauf erreur réseau)
          if (result.message && !result.message.includes('réseau') && !result.message.includes('connexion')) {
            setOnlineStatus(!value);
            Alert.alert(
              "Erreur de synchronisation",
              result.message || "Impossible de synchroniser votre statut avec le serveur.",
              [{ text: "OK" }]
            );
          }
        } else {
          sessionExpiredRef.current = false;
        }
      }).catch((error) => {
        isTogglingRef.current = false;
        
        if (__DEV__) {
          console.error('Erreur updateDriverStatus:', error);
        }
        
        // Rollback en cas d'erreur
        setOnlineStatus(!value);
        
        // Ne pas afficher d'erreur si c'est une session expirée (déjà géré par logout)
        const errorMessage = error instanceof Error ? error.message : '';
        if (!errorMessage.includes('Session expirée')) {
          Alert.alert(
            "Erreur",
            "Impossible de synchroniser votre statut avec le serveur.",
            [{ text: "OK" }]
          );
        }
      });
    } else {
      isTogglingRef.current = false;
    }
  };

  const sessionExpiredRef = useRef(false);
  
  useEffect(() => {
    if (sessionExpiredRef.current) {
      return;
    }

    // Ne pas synchroniser si l'utilisateur n'est pas authentifié
    if (!isAuthenticated || !user?.id) {
      return;
    }

    const syncLocation = async () => {
      if (isOnline && location && user?.id && isAuthenticated && !sessionExpiredRef.current) {
        try {
          const result = await apiService.updateDriverStatus(user.id, {
            current_latitude: location.latitude,
            current_longitude: location.longitude
          });
          
          // Si la session est expirée, marquer le ref pour éviter les appels futurs
          if (!result.success && result.message?.includes('Session expirée')) {
            sessionExpiredRef.current = true;
            if (__DEV__) {
              console.debug('Session expirée - arrêt de la synchronisation automatique de la position');
            }
            return;
          }
          
          if (result.success) {
            sessionExpiredRef.current = false;
          }
        } catch (error) {
          if (__DEV__) {
            console.debug('Erreur sync position:', error);
          }
        }
      }
    };

    const timeoutId = setTimeout(syncLocation, 5000);
    return () => clearTimeout(timeoutId);
  }, [location, isOnline, user?.id, isAuthenticated]);

  useEffect(() => {
    if (currentOrder) {
      logger.debug('DEBUG currentOrder', 'driverIndex', {
        id: currentOrder.id,
        status: currentOrder.status,
        pickup_resolved: resolveCoords(currentOrder.pickup),
        dropoff_resolved: resolveCoords(currentOrder.dropoff),
      });
    }
  }, [currentOrder]);
  useEffect(() => {
    const status = String(currentOrder?.status || '');

    if (!currentOrder || status === 'completed') {
      // Animation gérée par useAnimatedPosition

      if (polyPulseIntervalRef.current) {
        clearInterval(polyPulseIntervalRef.current);
        polyPulseIntervalRef.current = null;
      }

      animationTimeoutsRef.current.forEach(id => clearTimeout(id));
      animationTimeoutsRef.current = [];

      const remainingActiveOrders = useOrderStore.getState().activeOrders;
      if (remainingActiveOrders.length === 0) {
        if (isOnline && location) {
          setTimeout(() => {
            centerOnDriver();
          }, 300);
        }
      } else {
        if (location) {
          const sortedRemaining = [...remainingActiveOrders].sort((a, b) => {
            const distA = calculateDistanceToPickup(a);
            const distB = calculateDistanceToPickup(b);
            
            if (distA === null && distB === null) return 0;
            if (distA === null) return 1;
            if (distB === null) return -1;
            
            return distA - distB;
          });
          
          const inProgressOrder = sortedRemaining.find(o => 
            o.status === 'picked_up' || o.status === 'delivering' || o.status === 'enroute' || o.status === 'in_progress'
          );
          
          const nextOrder = inProgressOrder || sortedRemaining[0];
          if (nextOrder) {
            setTimeout(() => {
              useOrderStore.getState().setSelectedOrder(nextOrder.id);
              logger.info('Commande terminée, sélection automatique de la prochaine', 'driver-index', {
                nextOrderId: nextOrder.id,
                distance: calculateDistanceToPickup(nextOrder),
                remainingCount: remainingActiveOrders.length,
              });
            }, 500);
          }
        } else {
          logger.info('Commande terminée, autres commandes actives disponibles', 'driver-index', {
            remainingCount: remainingActiveOrders.length,
            nextSelectedId: useOrderStore.getState().selectedOrderId,
          });
        }
      }
    }
  }, [currentOrder?.status, currentOrder, location, isOnline, centerOnDriver, calculateDistanceToPickup]);

  useEffect(() => {
    const status = String(currentOrder?.status || '');
    const lastStatus = lastOrderStatusRef.current;
    const isTransitioningToPickedUp = 
      (status === 'picked_up' || status === 'delivering') && 
      lastStatus !== status && 
      lastStatus !== 'picked_up' && 
      lastStatus !== 'delivering';
    
    lastOrderStatusRef.current = status;
    if (currentOrder && isTransitioningToPickedUp && !userClosedBottomSheetRef.current) {
      userClosedBottomSheetRef.current = false;
      setTimeout(() => {
        expandOrderBottomSheet();
      }, 500);
    } else if (status === 'completed' || !currentOrder) {
      userClosedBottomSheetRef.current = false;
      collapseOrderBottomSheet();
    }
  }, [currentOrder?.status, currentOrder, expandOrderBottomSheet, collapseOrderBottomSheet]);

  useEffect(() => {
    if (!orderBottomSheetIsExpanded && currentOrder) {
      const status = String(currentOrder?.status || '');
      if (status === 'picked_up' || status === 'delivering') {
        userClosedBottomSheetRef.current = true;
      }
    } else if (orderBottomSheetIsExpanded) {
      userClosedBottomSheetRef.current = false;
    }
  }, [orderBottomSheetIsExpanded, currentOrder]);

  useEffect(() => {
    const loadStats = async () => {
      // Vérifier que l'utilisateur est toujours authentifié
      if (!isAuthenticated || !user?.id) {
        if (__DEV__) {
          console.debug('[Index] Pas de user.id ou utilisateur non authentifié pour charger les stats');
        }
        return;
      }

      try {
        const todayResult = await apiService.getTodayStats(user.id);
        
        if (todayResult.success && todayResult.data) {
          if (__DEV__) {
            console.debug('[Index] getTodayStats réussi:', {
              deliveries: todayResult.data.deliveries,
              earnings: todayResult.data.earnings
            });
          }
          updateTodayStats(todayResult.data);
          setDriverStats(prev => ({
            ...prev,
            todayDeliveries: todayResult.data?.deliveries || 0,
          }));
        } else {
          if (__DEV__) {
            console.warn('[Index] getTodayStats échoué ou pas de données');
          }
        }
        const statsResult = await apiService.getDriverStatistics(user.id);
        
        if (statsResult.success && statsResult.data) {
          if (__DEV__) {
            console.debug('[Index] getDriverStatistics réussi:', {
              completedDeliveries: statsResult.data.completedDeliveries,
              totalEarnings: statsResult.data.totalEarnings
            });
          }
          setDriverStats(prev => ({
            ...prev,
            totalRevenue: statsResult.data?.totalEarnings || 0,
          }));
        } else {
          if (__DEV__) {
            console.warn('[Index] getDriverStatistics échoué ou pas de données');
          }
        }
      } catch (err) {
        if (__DEV__) {
          console.error('[Index] Erreur chargement stats:', err);
        }
      }
    };

    // Ne charger les stats que si l'utilisateur est authentifié
    if (isAuthenticated && user?.id) {
      loadStats();
      const interval = setInterval(loadStats, isOnline ? 30000 : 60000);
      return () => {
        if (interval) clearInterval(interval);
      };
    }
  }, [user?.id, isAuthenticated, isOnline, updateTodayStats]);

  return (
    <View style={styles.container}>
      <MapView
        provider={PROVIDER_GOOGLE}
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
        customMapStyle={minimalMapStyle}
        showsUserLocation={false}
        showsMyLocationButton={false}
        showsCompass={false}
        showsScale={false}
        showsBuildings={false}
        showsTraffic={true}
        showsIndoors={false}
        showsPointsOfInterest={false}
        mapType="standard"
        toolbarEnabled={false}
        rotateEnabled={true}
        pitchEnabled={false}
        scrollEnabled={true}
        zoomEnabled={true}
        followsUserLocation={false}
      >
        {isOnline && (animatedDriverPosition || location) && (
          <Marker
            coordinate={{
              latitude: (animatedDriverPosition || location)!.latitude,
              longitude: (animatedDriverPosition || location)!.longitude,
            }}
            title="Ma position"
            description={realTimeETA ? `Arrivée dans ${realTimeETA.formattedETA}` : 'Chauffeur en ligne'}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={false}
          >
            <View style={styles.driverMarkerContainer}>
              <View style={styles.driverPulseOuter} />
              <View style={styles.driverMarkerInner} />
            </View>
          </Marker>
        )}
        
        {/* Affichage ETA en temps réel */}
        {realTimeETA && animatedDriverPosition && isOnline && (
          <Marker
            coordinate={animatedDriverPosition}
            anchor={{ x: 0.5, y: 1.2 }}
            tracksViewChanges={false}
          >
            <View style={styles.realTimeETABadge}>
              <Text style={styles.realTimeETAText}>{realTimeETA.formattedETA}</Text>
            </View>
          </Marker>
        )}

        {/* Route animée vers la destination */}
        {isOnline && location && currentOrder && animatedRoute.animatedCoordinates.length > 0 && (
          <>
            {/* Route complète pickup -> dropoff (ligne grise discrète) */}
            {currentPickupCoord && currentDropoffCoord && (
              <Polyline
                coordinates={
                  orderFullRoute.routeCoordinates.length > 0
                    ? orderFullRoute.routeCoordinates
                    : [currentPickupCoord, currentDropoffCoord]
                }
                strokeColor="rgba(229,231,235,0.9)"
                strokeWidth={3}
                lineCap="round"
                lineJoin="round"
              />
            )}

            {/* Route animée active (violet comme admin_chrono) */}
            {animatedDriverPosition && (
              <Polyline
                coordinates={[
                  animatedDriverPosition,
                  ...animatedRoute.animatedCoordinates.slice(1),
                ]}
                strokeColor="#8B5CF6"
                strokeWidth={6}
                lineCap="round"
                lineJoin="round"
              />
            )}
          </>
        )}

        {/* Afficher toutes les commandes - toujours visibles */}
        {[...activeOrders, ...pendingOrders].map((order) => {
          const pickupCoord = resolveCoords(order.pickup);
          const dropoffCoord = resolveCoords(order.dropoff);
          const status = String(order.status || '');
          const isPending = status === 'pending';
          const distance = calculateDistanceToPickup(order);

          return (
            <React.Fragment key={order.id}>
              {/* Marqueur pickup (vert comme admin_chrono) */}
              {pickupCoord && (
                <Marker
                  coordinate={pickupCoord}
                  title={order.user?.name ? `Récupérer : ${order.user.name}` : `Récupérer #${order.id.slice(0, 8)}`}
                  description={
                    distance !== null 
                      ? `${order.pickup?.address} • ${distance} km`
                      : order.pickup?.address
                  }
                  onPress={() => {
                    setSelectedOrder(order.id);
                    logger.info('Commande sélectionnée depuis marqueur pickup', 'driver-index', { orderId: order.id });
                  }}
                  tracksViewChanges={false}
                >
                  <View style={styles.pickupMarker}>
                    <View style={styles.pickupPin} />
                  </View>
                </Marker>
              )}

              {/* Marqueur dropoff (violet comme admin_chrono) */}
              {dropoffCoord && !isPending && (
                <Marker
                  coordinate={dropoffCoord}
                  title={`Livrer #${order.id.slice(0, 8)}`}
                  description={order.dropoff?.address}
                  onPress={() => {
                    setSelectedOrder(order.id);
                    logger.info('Commande sélectionnée depuis marqueur dropoff', 'driver-index', { orderId: order.id });
                  }}
                  tracksViewChanges={false}
                >
                  <View style={styles.dropoffMarker}>
                    <View style={styles.dropoffPin} />
                  </View>
                </Marker>
              )}
            </React.Fragment>
          );
        })}
      </MapView>

      <StatusToggle 
        isOnline={isOnline} 
        onToggle={handleToggleOnline}
        hasLocationError={!!error}
      />

      <StatsCards 
        todayDeliveries={driverStats.todayDeliveries || todayStats.deliveries}
        totalRevenue={driverStats.totalRevenue || profile?.total_earnings || 0}
        isOnline={isOnline}
      />

      {activeOrders.length > 1 && !ordersListIsExpanded && (
        <View style={styles.multipleOrdersIndicator}>
          <TouchableOpacity 
            style={styles.multipleOrdersButton}
            onPress={toggleOrdersListSheet}
            activeOpacity={0.7}
          >
            <Ionicons name="cube" size={16} color="#8B5CF6" />
            <Text style={styles.multipleOrdersText}>
              {activeOrders.length} commande{activeOrders.length > 1 ? 's' : ''} active{activeOrders.length > 1 ? 's' : ''}
            </Text>
            <Ionicons name="chevron-up" size={16} color="#8B5CF6" />
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.floatingMenu}>
        <TouchableOpacity 
          style={[styles.menuButton, !ordersListIsExpanded && styles.activeButton]}
          onPress={() => {
            if (ordersListIsExpanded) {
              collapseOrdersListSheet();
            }
          }}
        >
          <Ionicons name="map" size={22} color={ordersListIsExpanded ? "#8B5CF6" : "#fff"} />
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.menuButton, ordersListIsExpanded && styles.activeButton]}
          onPress={toggleOrdersListSheet}
        >
          <Ionicons name="list" size={22} color={ordersListIsExpanded ? "#fff" : "#8B5CF6"} />
          {activeOrders.length > 0 && (
            <View style={styles.menuBadge}>
              <Text style={styles.menuBadgeText}>{activeOrders.length}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Les actions sont maintenant dans le DriverOrderBottomSheet */}

      <OrderRequestPopup
        order={pendingOrder}
        visible={!!pendingOrder}
        onAccept={handleAcceptOrder}
        onDecline={handleDeclineOrder}
        autoDeclineTimer={30}
      />

      {/* Nouveau bottom sheet unifié pour les détails et la messagerie */}
      {currentOrder && (
        <DriverOrderBottomSheet
          currentOrder={currentOrder}
          panResponder={orderBottomSheetPanResponder}
          animatedHeight={orderBottomSheetAnimatedHeight}
          isExpanded={orderBottomSheetIsExpanded}
          onToggle={toggleOrderBottomSheet}
          onUpdateStatus={async (status: string) => {
            if (status === 'picked_up') {
              const dropoffCoord = resolveCoords(currentOrder.dropoff);
              await orderSocketService.updateDeliveryStatus(currentOrder.id, status, location);
              if (location && dropoffCoord) {
                // Animation gérée par useAnimatedPosition
                setTimeout(() => {
                  animatedRoute.refetch();
                  fitToRoute();
                }, 500);
              }
            } else {
              await orderSocketService.updateDeliveryStatus(currentOrder.id, status, location);
            }
          }}
          location={location}
          onMessage={handleOpenMessage}
        />
      )}

      {ordersListIsExpanded && (
        <OrdersListBottomSheet
          animatedHeight={ordersListAnimatedHeight}
          panResponder={ordersListPanResponder}
          isExpanded={ordersListIsExpanded}
          onToggle={toggleOrdersListSheet}
          onOrderSelect={(orderId) => {
            logger.info('Commande sélectionnée', 'driver-index', { orderId });
          }}
        />
      )}

      {/* Message Bottom Sheet - Rendu en dernier pour être au-dessus */}
      {showMessageBottomSheet && currentOrder && currentOrder.user && currentOrder.user.id && (
        <MessageBottomSheet
          orderId={currentOrder.id}
          clientId={currentOrder.user.id}
          clientName={formatUserName(currentOrder.user, 'Client')}
          clientAvatar={currentOrder.user.avatar}
          panResponder={messagePanResponder}
          animatedHeight={messageAnimatedHeight}
          isExpanded={messageIsExpanded}
          onToggle={toggleMessageBottomSheet}
          onClose={handleCloseMessage}
        />
      )}
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
    position: 'relative',
  },
  activeButton: {
    backgroundColor: "#8B5CF6",
  },
  menuBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: '#fff',
  },
  menuBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  multipleOrdersIndicator: {
    position: 'absolute',
    top: 120,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 1000,
  },
  multipleOrdersButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    gap: 8,
  },
  multipleOrdersText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8B5CF6',
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
  // Marqueurs uniformisés comme admin_chrono
  pickupMarker: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 20,
    height: 20,
  },
  pickupPin: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  dropoffMarker: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 20,
    height: 20,
  },
  dropoffPin: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#8B5CF6',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  // Driver marker avec cercle extérieur comme admin_chrono
  driverMarkerContainer: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverPulseOuter: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#3B82F6',
    backgroundColor: 'rgba(59,130,246,0.15)',
  },
  driverMarkerInner: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#3B82F6',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 6,
    position: 'absolute',
  },
  realTimeETABadge: {
    backgroundColor: '#10B981',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  realTimeETAText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
});

// Style minimal de la carte (similaire à admin_chrono)
const minimalMapStyle = [
  {
    elementType: 'geometry',
    stylers: [{ color: '#F7F8FC' }],
  },
  {
    elementType: 'labels.icon',
    stylers: [{ visibility: 'off' }],
  },
  {
    elementType: 'labels.text.fill',
    stylers: [{ color: '#94A3B8' }],
  },
  {
    elementType: 'labels.text.stroke',
    stylers: [{ color: '#FFFFFF' }],
  },
  {
    featureType: 'administrative',
    elementType: 'geometry',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'poi',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{ color: '#E4E7EC' }],
  },
  {
    featureType: 'road',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#A0AEC0' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry',
    stylers: [{ color: '#C7D2FE' }],
  },
  {
    featureType: 'transit',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#D8E7FB' }],
  },
];
