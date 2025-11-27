import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import React, { useRef, useEffect, useMemo, useCallback } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, Alert, Animated, Dimensions } from 'react-native';
import MapView from 'react-native-maps';
import { useShipmentStore } from '../../store/useShipmentStore';
import { useMapLogic } from '../../hooks/useMapLogic';
import { useDriverSearch } from '../../hooks/useDriverSearch';
import { useOnlineDrivers } from '../../hooks/useOnlineDrivers';
import { useBottomSheet } from '../../hooks/useBottomSheet';
import { useAuthStore } from '../../store/useAuthStore';
import { DeliveryMapView } from '../../components/DeliveryMapView';
import { DeliveryBottomSheet } from '../../components/DeliveryBottomSheet';
import { DeliveryMethodBottomSheet } from '../../components/DeliveryMethodBottomSheet';
import { OrderDetailsSheet } from '../../components/OrderDetailsSheet';
import RatingBottomSheet from '../../components/RatingBottomSheet';
import PaymentBottomSheet from '../../components/PaymentBottomSheet';
import { DriverSearchBottomSheet } from '../../components/DriverSearchBottomSheet';
import { userOrderSocketService } from '../../services/userOrderSocketService';
import { useOrderStore } from '../../store/useOrderStore';
import type { OrderStatus } from '../../store/useOrderStore';
import { useRatingStore } from '../../store/useRatingStore';
import { usePaymentStore } from '../../store/usePaymentStore';
import { logger } from '../../utils/logger';
import { calculatePrice, estimateDurationMinutes, formatDurationLabel, getDistanceInKm } from '../../services/orderApi';
import { locationService } from '../../services/locationService';
import { userApiService } from '../../services/userApiService';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const PENDING_STATUS: OrderStatus = 'pending';

type Coordinates = {
  latitude: number;
  longitude: number;
};

export default function MapPage() {
  

  const [isCreatingNewOrder, setIsCreatingNewOrder] = React.useState(false);
  const { setSelectedMethod } = useShipmentStore();
  const { user } = useAuthStore();
  const { loadPaymentMethods } = usePaymentStore();
  
  const mapRef = useRef<MapView | null>(null);
  const hasInitializedRef = useRef<boolean>(false);
  const isResettingRef = useRef<boolean>(false); 
  const isUserTypingRef = useRef<boolean>(false); 
  const lastFocusTimeRef = useRef<number>(0); 
  
  const [showPaymentSheet, setShowPaymentSheet] = React.useState(false);
  const [paymentPayerType, setPaymentPayerType] = React.useState<'client' | 'recipient'>('client');
  const [selectedPaymentMethodType, setSelectedPaymentMethodType] = React.useState<'orange_money' | 'wave' | 'cash' | 'deferred' | null>(null);
  const [recipientInfo, setRecipientInfo] = React.useState<{
    userId?: string;
    phone?: string;
    isRegistered?: boolean;
  }>({});
  const [paymentPartialInfo, setPaymentPartialInfo] = React.useState<{
    isPartial?: boolean;
    partialAmount?: number;
  }>({});

  // Ne plus rediriger automatiquement vers l'authentification
  // L'utilisateur peut explorer la carte en mode invité
  // L'authentification sera demandée seulement lors de la création d'une commande

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
      loadPaymentMethods();
    }
  }, [user?.id, loadPaymentMethods]);

  useEffect(() => {
    locationService.startWatching();
    
    return () => {
    };
  }, []);

  // Hooks personnalisés pour séparer la logique de la map
  const {
    region,
    pickupCoords,
    dropoffCoords,
    displayedRouteCoords,
    durationText,
    pickupLocation,
    deliveryLocation,
    selectedMethod,
    showMethodSelection,
    destinationPulseAnim,
    userPulseAnim,
    setPickupCoords,
    setDropoffCoords,
    clearRoute,
    setPickupLocation,
    setDeliveryLocation,
    fetchRoute,
    animateToCoordinate,
    startMethodSelection,
    resetAfterDriverSearch,
  } = useMapLogic({ mapRef: mapRef as React.RefObject<MapView> });

  useEffect(() => {
    if (hasInitializedRef.current) return;
    hasInitializedRef.current = true;
    
    const store = useOrderStore.getState();
    const ratingStore = useRatingStore.getState();
    
    const currentOrder = store.getCurrentOrder();
    const pendingOrder = store.getPendingOrder();
    
    if (currentOrder && (
      currentOrder.status === 'cancelled' || 
      currentOrder.status === 'declined'
    )) {
      logger.info('🧹 Nettoyage commande terminée/annulée/refusée au montage initial', 'map.tsx', { status: currentOrder.status });
      
      if (ratingStore.showRatingBottomSheet) {
        logger.info('🧹 Fermeture RatingBottomSheet au montage initial (commande terminée)', 'map.tsx');
        ratingStore.resetRatingBottomSheet();
      }
      
      store.removeOrder(currentOrder.id);
      
      try {
        clearRoute();
      } catch {}
      setPickupCoords(null);
      setDropoffCoords(null);
      setPickupLocation('');
      setDeliveryLocation('');
    } else if (currentOrder && currentOrder.status === 'completed') {
      logger.info('✅ Commande complétée au montage initial - attente du RatingBottomSheet', 'map.tsx', { 
        hasRatingBottomSheet: ratingStore.showRatingBottomSheet 
      });
      
      const completedAt = (currentOrder as any)?.completed_at || (currentOrder as any)?.completedAt;
      const orderAge = completedAt 
        ? new Date().getTime() - new Date(completedAt).getTime()
        : Infinity;
      
      if (!ratingStore.showRatingBottomSheet && orderAge > 60000) {
        logger.info('🧹 Nettoyage commande complétée ancienne au montage initial', 'map.tsx', { orderAge });
        store.removeOrder(currentOrder.id);
        try {
          clearRoute();
        } catch {}
        setPickupCoords(null);
        setDropoffCoords(null);
        setPickupLocation('');
        setDeliveryLocation('');
      }
    }
    
    if (pendingOrder) {
      const orderAge = pendingOrder.createdAt 
        ? new Date().getTime() - new Date(pendingOrder.createdAt).getTime()
        : Infinity;
      
      if (orderAge > 10000) {
        logger.info('🧹 Nettoyage pendingOrder bloqué au montage initial', 'map.tsx', { orderId: pendingOrder.id, orderAge });
        store.removeOrder(pendingOrder.id);
      }
    }
    
    if (ratingStore.showRatingBottomSheet && !currentOrder) {
      logger.info('🧹 Fermeture RatingBottomSheet au montage initial (pas de commande active)', 'map.tsx');
      ratingStore.resetRatingBottomSheet();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const stableUserLocation = useMemo(() => {
    if (!region?.latitude || !region?.longitude) return undefined;
    return {
      latitude: Math.round(region.latitude * 10000) / 10000, 
      longitude: Math.round(region.longitude * 10000) / 10000
    };
  }, [region?.latitude, region?.longitude]);

  const { drivers: onlineDrivers } = useOnlineDrivers({
    userLocation: stableUserLocation,
    autoRefresh: true,
    refreshInterval: 5000 
  });

  const {
    isSearchingDriver,
    searchSeconds,
    driverCoords: searchDriverCoords,
    startDriverSearch,
    stopDriverSearch,
  } = useDriverSearch(resetAfterDriverSearch);

  const { selectedOrderId, driverCoords: orderDriverCoordsMap, setSelectedOrder } = useOrderStore();
  
  const {
    animatedHeight,
    isExpanded,
    panResponder,
    toggle: toggleBottomSheet,
    expand: expandBottomSheet,
    collapse: collapseBottomSheet,
  } = useBottomSheet();

  const hasAutoOpenedRef = useRef(false);
  const userManuallyClosedRef = useRef(false);
  const isProgrammaticCloseRef = useRef(false);
  const previousIsExpandedRef = useRef(isExpanded);
  const autoOpenTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleBottomSheetOpen = useCallback((delay = 0) => {
    if (userManuallyClosedRef.current) {
      return;
    }
    if (autoOpenTimeoutRef.current) {
      clearTimeout(autoOpenTimeoutRef.current);
    }
    autoOpenTimeoutRef.current = setTimeout(() => {
      if (!userManuallyClosedRef.current) {
        expandBottomSheet();
      }
      autoOpenTimeoutRef.current = null;
    }, delay);
  }, [expandBottomSheet]);
  
  useFocusEffect(
    useCallback(() => {
      const now = Date.now();
      lastFocusTimeRef.current = now;
      
      if (isResettingRef.current) {
        return;
      }
      
      if (isUserTypingRef.current) {
        logger.info('📍 Réinitialisation ignorée - utilisateur en train de saisir', 'map.tsx');
        return;
      }
      
      const currentPickup = pickupLocation;
      const currentDelivery = deliveryLocation;
      const hasFilledFields = currentPickup.trim().length > 0 || currentDelivery.trim().length > 0;
      
      if (hasFilledFields) {
        logger.info('📍 Réinitialisation partielle - champs déjà remplis, conservation des données', 'map.tsx', {
          pickup: currentPickup.substring(0, 30),
          delivery: currentDelivery.substring(0, 30),
        });
        const currentSelectedId = useOrderStore.getState().selectedOrderId;
        if (currentSelectedId !== null) {
          setSelectedOrder(null);
        }
        setIsCreatingNewOrder(true);
        return;
      }
      
      isResettingRef.current = true;
      lastFocusTimeRef.current = now;
      logger.info('📍 Arrivée sur map - réinitialisation complète pour nouvelle commande', 'map.tsx');
      
      const currentSelectedId = useOrderStore.getState().selectedOrderId;
      if (currentSelectedId !== null) {
        setSelectedOrder(null);
      }
      
            setIsCreatingNewOrder(true);
      
      hasAutoOpenedRef.current = false;
      userManuallyClosedRef.current = false;
      
      try {
        clearRoute();
      } catch {}
      setPickupCoords(null);
      setDropoffCoords(null);
      setPickupLocation('');
      setDeliveryLocation('');
      setSelectedMethod('moto');
      
      setTimeout(() => {
        locationService.getCurrentPosition().then((coords) => {
          if (coords) {
            animateToCoordinate({ latitude: coords.latitude, longitude: coords.longitude }, 0.01);
          } else if (region) {
            animateToCoordinate({ latitude: region.latitude, longitude: region.longitude }, 0.01);
          }
        }).catch(() => {
          if (region) {
            animateToCoordinate({ latitude: region.latitude, longitude: region.longitude }, 0.01);
          }
        });
      }, 200);
      
      scheduleBottomSheetOpen(400);
      const resetTimer = setTimeout(() => {
        isResettingRef.current = false;
      }, 1400);

      return () => {
        clearTimeout(resetTimer);
      };
    }, [setSelectedOrder, clearRoute, setPickupCoords, setDropoffCoords, setPickupLocation, setDeliveryLocation, pickupLocation, deliveryLocation, setSelectedMethod, animateToCoordinate, region, scheduleBottomSheetOpen])
  );

  useEffect(() => {
    const hasFilledFields = pickupLocation.trim().length > 0 || deliveryLocation.trim().length > 0;
    isUserTypingRef.current = hasFilledFields;
    
    if (hasFilledFields) {
      logger.debug('📍 Champs remplis détectés - protection activée', 'map.tsx', {
        pickup: pickupLocation.substring(0, 20),
        delivery: deliveryLocation.substring(0, 20),
      });
    }
  }, [pickupLocation, deliveryLocation]);
  
  const currentOrder = useOrderStore((s) => {
    if (s.selectedOrderId) {
      return s.activeOrders.find(o => o.id === s.selectedOrderId) || null;
    }
    return s.activeOrders.find(o => o.status !== 'pending') || s.activeOrders[0] || null;
  });
  const pendingOrder = useOrderStore((s) => s.activeOrders.find(o => o.status === PENDING_STATUS) || null);

  const radarPulseCoords = useMemo(() => {
    if (pickupCoords) {
      return pickupCoords;
    }
    if (pendingOrder?.pickup?.coordinates) {
      const coords = pendingOrder.pickup.coordinates;
      return {
        latitude: coords.latitude,
        longitude: coords.longitude,
      };
    }
    return null;
  }, [pickupCoords, pendingOrder?.pickup?.coordinates]);
  const orderDriverCoords = selectedOrderId ? orderDriverCoordsMap.get(selectedOrderId) || null : null;
  
  useEffect(() => {
    const orderStatus = currentOrder?.status || pendingOrder?.status;
    
    if (orderStatus === 'accepted' && !showPaymentSheet && (currentOrder || pendingOrder)) {
      const order = currentOrder || pendingOrder;
      const paymentStatus = (order as any)?.payment_status;
      
      if (paymentStatus !== 'paid') {
        if (selectedPaymentMethodType === 'cash' || selectedPaymentMethodType === 'deferred') {
          console.log('✅ Paiement en espèces ou différé - pas de paiement électronique requis');
          return;
        }
        
          if (selectedPaymentMethodType === 'orange_money' || selectedPaymentMethodType === 'wave' || !selectedPaymentMethodType) {
          const timer = setTimeout(() => {
            setShowPaymentSheet(true);
          }, 500);
          
          return () => clearTimeout(timer);
        }
      }
    }
  }, [currentOrder?.status, pendingOrder?.status, showPaymentSheet, currentOrder, pendingOrder, selectedPaymentMethodType]);

  useEffect(() => {
    if (pendingOrder && !isSearchingDriver && !currentOrder) {
      const orderAge = pendingOrder.createdAt
        ? new Date().getTime() - new Date(pendingOrder.createdAt).getTime()
        : Infinity;

      if (orderAge > 30000) {
        logger.info('🧹 Nettoyage commande bloquée en attente', 'map.tsx', { orderId: pendingOrder.id, orderAge });
        useOrderStore.getState().removeOrder(pendingOrder.id);
        clearRoute();
        setPickupCoords(null);
        setDropoffCoords(null);
        setPickupLocation('');
        setDeliveryLocation('');
      }
    }

    if (currentOrder && currentOrder.status === 'accepted') {
      const driverCoordsForOrder = selectedOrderId ? orderDriverCoordsMap.get(selectedOrderId) : null;
      if (!driverCoordsForOrder) {
        const orderAge = currentOrder.createdAt
          ? new Date().getTime() - new Date(currentOrder.createdAt).getTime()
          : Infinity;
        
        if (orderAge > 60000) {
          logger.warn('⚠️ Commande acceptée sans driver connecté depuis trop longtemps', 'map.tsx', { 
            orderId: currentOrder.id, 
            orderAge 
          });
        }
      }
    }
  }, [pendingOrder, isSearchingDriver, currentOrder, selectedOrderId, orderDriverCoordsMap, clearRoute, setPickupCoords, setDropoffCoords, setPickupLocation, setDeliveryLocation]);

  useEffect(() => {
    if (!pendingOrder && isSearchingDriver) {
      stopDriverSearch();
      logger.info('🛑 Recherche de chauffeur arrêtée (aucun chauffeur disponible)', 'map.tsx');
    }
  }, [pendingOrder, isSearchingDriver, stopDriverSearch]);

  useEffect(() => {
    if (pendingOrder?.status === PENDING_STATUS) {
      if (!isSearchingDriver) {
        logger.info('📡 Démarrage animation radar (commande en attente)', 'map.tsx', {
          orderId: pendingOrder.id,
        });
        startDriverSearch();
        // Réduire automatiquement le bottom sheet "Envoyer un colis" quand la recherche commence
        collapseBottomSheet();
        userManuallyClosedRef.current = false;
      }
    } else if (isSearchingDriver && pendingOrder && pendingOrder.status !== PENDING_STATUS) {
      logger.info('📡 Arrêt animation radar (commande plus en attente)', 'map.tsx', {
        orderId: pendingOrder.id,
        status: pendingOrder.status,
      });
      stopDriverSearch();
    }
  }, [pendingOrder?.id, pendingOrder?.status, isSearchingDriver, startDriverSearch, stopDriverSearch, pendingOrder, collapseBottomSheet]);

  useEffect(() => {
    if (orderDriverCoords && displayedRouteCoords.length > 0) {
      logger.info('🧹 Nettoyage route violette - commande acceptée, affichage tracking direct', 'map.tsx');
      clearRoute();
    }
  }, [orderDriverCoords, displayedRouteCoords.length, clearRoute]);


  const {
    animatedHeight: ratingAnimatedHeight,
    isExpanded: ratingIsExpanded,
    panResponder: ratingPanResponder,
    expand: expandRatingBottomSheet,
    collapse: collapseRatingBottomSheet,
    toggle: toggleRatingBottomSheet,
  } = useBottomSheet();

  const { showRatingBottomSheet, orderId: ratingOrderId, driverName: ratingDriverName, resetRatingBottomSheet } = useRatingStore();

  const {
    animatedHeight: deliveryMethodAnimatedHeight,
    isExpanded: deliveryMethodIsExpanded,
    panResponder: deliveryMethodPanResponder,
    expand: expandDeliveryMethodSheet,
    collapse: collapseDeliveryMethodSheet,
    toggle: toggleDeliveryMethodSheet,
  } = useBottomSheet();

  const {
    animatedHeight: orderDetailsAnimatedHeight,
    isExpanded: orderDetailsIsExpanded,
    panResponder: orderDetailsPanResponder,
    expand: expandOrderDetailsSheet,
    collapse: collapseOrderDetailsSheet,
    toggle: toggleOrderDetailsSheet,
  } = useBottomSheet();

  const cleanupOrderState = useCallback(async () => {
    logger.info('🧹 Nettoyage complet de l\'état de commande', 'map.tsx');
    
    if (isSearchingDriver) {
      stopDriverSearch();
    }
    
    useOrderStore.getState().clear();
    
    const ratingStore = useRatingStore.getState();
    if (ratingStore.showRatingBottomSheet) {
      logger.info('🧹 Fermeture RatingBottomSheet lors du nettoyage', 'map.tsx');
      ratingStore.resetRatingBottomSheet();
      collapseRatingBottomSheet();
    }
    
    try {
      clearRoute();
    } catch {}
    
    setPickupCoords(null);
    setDropoffCoords(null);
    
    setPickupLocation('');
    setDeliveryLocation('');
    
    try {
      const coords = await locationService.getCurrentPosition();
      
      if (coords) {
        const { latitude, longitude } = coords;
        
        setPickupCoords({ latitude, longitude });

        try {
          const refreshedAddress = await locationService.reverseGeocode({
            latitude,
            longitude,
            timestamp: Date.now(),
          });
          
          if (refreshedAddress) {
            setPickupLocation(refreshedAddress);
          } else {
            setPickupLocation(`Ma position (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`);
          }
        } catch (geoError) {
          logger.warn('Erreur reverse geocode pendant cleanup', 'map.tsx', geoError);
          setPickupLocation(`Ma position (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`);
        }
        
        setTimeout(() => {
          animateToCoordinate({ latitude, longitude }, 0.01);
        }, 100);
      } else {
        if (region) {
          setPickupCoords({ latitude: region.latitude, longitude: region.longitude });
          setPickupLocation('Votre position actuelle');
          setTimeout(() => {
            animateToCoordinate({ latitude: region.latitude, longitude: region.longitude }, 0.01);
          }, 100);
        }
      }
    } catch (error) {
      logger.warn('Erreur récupération position actuelle', 'map.tsx', error);
      if (region) {
        setPickupCoords({ latitude: region.latitude, longitude: region.longitude });
        setPickupLocation('Votre position actuelle');
        setTimeout(() => {
          animateToCoordinate({ latitude: region.latitude, longitude: region.longitude }, 0.01);
        }, 100);
      }
    }
  }, [clearRoute, setPickupCoords, setDropoffCoords, setPickupLocation, setDeliveryLocation, animateToCoordinate, region, isSearchingDriver, stopDriverSearch, collapseRatingBottomSheet]);

  useEffect(() => {
    const status = currentOrder?.status;
    
    if (status === 'cancelled' || status === 'declined') {
      logger.info('🧹 Nettoyage commande terminée/annulée/refusée', 'map.tsx', { status });
      cleanupOrderState();
    } else if (status === 'completed') {
          logger.info('✅ Commande complétée - attente du RatingBottomSheet avant nettoyage', 'map.tsx');
    }
  }, [currentOrder?.status, cleanupOrderState]);


  useEffect(() => {
    if (currentOrder && currentOrder.status === 'completed' && currentOrder.driverId) {
      if (!showRatingBottomSheet || ratingOrderId !== currentOrder.id) {
        const checkAndShowRating = async () => {
          try {
            const ratingResult = await userApiService.getOrderRating(currentOrder.id);
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
                logger.info('⭐ Affichage automatique RatingBottomSheet pour commande complétée', 'map.tsx', { 
                  orderId: currentOrder.id 
                });
              }
            }
          } catch (error) {
            logger.warn('Erreur vérification rating', 'map.tsx', error);
            const driverId = currentOrder.driverId || currentOrder.driver?.id;
            const driverName = currentOrder.driver?.name || 'Votre livreur';
            
            if (driverId) {
              useRatingStore.getState().setRatingBottomSheet(
                true,
                currentOrder.id,
                driverId,
                driverName
              );
            }
          }
        };
        
        checkAndShowRating();
      }
    }
  }, [currentOrder, showRatingBottomSheet, ratingOrderId]);

  useEffect(() => {
    logger.debug('🔍 RatingBottomSheet state changed', 'map.tsx', { 
      showRatingBottomSheet, 
      ratingOrderId,
      isExpanded: ratingIsExpanded
    });
    
    if (showRatingBottomSheet && ratingOrderId) {
      logger.info('⭐ Ouverture automatique rating bottom sheet', 'map.tsx', { 
        orderId: ratingOrderId,
        driverName: ratingDriverName 
      });
      
      setTimeout(() => {
        expandRatingBottomSheet();
        logger.info('✅ RatingBottomSheet ouvert', 'map.tsx', { orderId: ratingOrderId });
      }, 100);
    } else if (!showRatingBottomSheet) {
      collapseRatingBottomSheet();
      logger.debug('❌ RatingBottomSheet fermé', 'map.tsx');
    }
  }, [showRatingBottomSheet, ratingOrderId, ratingDriverName, expandRatingBottomSheet, collapseRatingBottomSheet, ratingIsExpanded]);

  const handleRatingSubmitted = useCallback(() => {
    logger.info('✅ Évaluation soumise, fermeture rating bottom sheet', 'map.tsx');
    resetRatingBottomSheet();
    collapseRatingBottomSheet();
    setTimeout(() => {
      cleanupOrderState();
      hasAutoOpenedRef.current = false;
      userManuallyClosedRef.current = false;
      isProgrammaticCloseRef.current = true;
      scheduleBottomSheetOpen(200);
    }, 300);
  }, [resetRatingBottomSheet, collapseRatingBottomSheet, cleanupOrderState, scheduleBottomSheetOpen]);

  const handleRatingClose = useCallback(() => {
    logger.info('❌ Rating bottom sheet fermé', 'map.tsx');
    resetRatingBottomSheet();
    collapseRatingBottomSheet();
    setTimeout(() => {
      cleanupOrderState();
      hasAutoOpenedRef.current = false;
      userManuallyClosedRef.current = false;
      isProgrammaticCloseRef.current = true;
      scheduleBottomSheetOpen(200);
    }, 300);
  }, [resetRatingBottomSheet, collapseRatingBottomSheet, cleanupOrderState, scheduleBottomSheetOpen]);

  useEffect(() => {
    if (!currentOrder) return;

    const orderAge = currentOrder.createdAt 
      ? new Date().getTime() - new Date(currentOrder.createdAt).getTime()
      : Infinity;
    
        const MAX_ORDER_AGE = 1000 * 60 * 30;
    
    if (orderAge > MAX_ORDER_AGE) {
      logger.info('🧹 Nettoyage commande trop ancienne (oubli de finalisation)', 'map.tsx', { 
        orderId: currentOrder.id, 
        status: currentOrder.status, 
        age: `${Math.round(orderAge / 1000 / 60)} minutes` 
      });
      cleanupOrderState();
    }

    const checkInterval = setInterval(() => {
      if (currentOrder?.createdAt) {
        const age = new Date().getTime() - new Date(currentOrder.createdAt).getTime();
        if (age > MAX_ORDER_AGE) {
          logger.info('🧹 Nettoyage périodique commande trop ancienne', 'map.tsx', { 
            orderId: currentOrder.id, 
            status: currentOrder.status, 
            age: `${Math.round(age / 1000 / 60)} minutes` 
          });
          cleanupOrderState();
        }
      }
    }, 10000);

    return () => clearInterval(checkInterval);
  }, [currentOrder, cleanupOrderState]);


  useEffect(() => {
    return () => {
      if (autoOpenTimeoutRef.current) {
        clearTimeout(autoOpenTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (previousIsExpandedRef.current && !isExpanded && !isProgrammaticCloseRef.current) {
      userManuallyClosedRef.current = true;
      logger.debug('🔒 Bottom sheet fermé manuellement par l\'utilisateur', 'map.tsx');
      if (autoOpenTimeoutRef.current) {
        clearTimeout(autoOpenTimeoutRef.current);
        autoOpenTimeoutRef.current = null;
      }
    }
    previousIsExpandedRef.current = isExpanded;
    isProgrammaticCloseRef.current = false;
  }, [isExpanded]);

  useEffect(() => {
    const store = useOrderStore.getState();
    const currentOrder = store.getCurrentOrder();
    const isActiveOrder = currentOrder && 
      currentOrder.status !== 'completed' && 
      currentOrder.status !== 'cancelled' && 
      currentOrder.status !== 'declined';
    const hasOrderInProgress = Boolean(pendingOrder || isActiveOrder);

    const shouldShowCreationForm = !hasOrderInProgress || isCreatingNewOrder;
    
    if (shouldShowCreationForm && 
        !isExpanded && 
        !showRatingBottomSheet && 
        !userManuallyClosedRef.current &&
        !deliveryMethodIsExpanded &&
        !orderDetailsIsExpanded) {
      if (!hasAutoOpenedRef.current) {
        hasAutoOpenedRef.current = true;
        scheduleBottomSheetOpen(100);
      }
    }
  }, [isExpanded, currentOrder, showRatingBottomSheet, isCreatingNewOrder, pendingOrder, scheduleBottomSheetOpen, deliveryMethodIsExpanded, orderDetailsIsExpanded]);

  useEffect(() => {
    const store = useOrderStore.getState();
    const currentOrder = store.getCurrentOrder();
    const isActiveOrder = currentOrder && 
      currentOrder.status !== 'completed' && 
      currentOrder.status !== 'cancelled' && 
      currentOrder.status !== 'declined';
    const hasOrderInProgress = Boolean(pendingOrder || isActiveOrder);
    
    if (!hasOrderInProgress && !currentOrder && !isExpanded && !showRatingBottomSheet && !userManuallyClosedRef.current) {
      hasAutoOpenedRef.current = false;
      isProgrammaticCloseRef.current = true;
      scheduleBottomSheetOpen(300);
      const resetTimer = setTimeout(() => {
        isProgrammaticCloseRef.current = false;
        hasAutoOpenedRef.current = true;
      }, 300);

      return () => clearTimeout(resetTimer);
    }
  }, [currentOrder, pendingOrder, isExpanded, showRatingBottomSheet, scheduleBottomSheetOpen]);

  const handlePickupSelected = ({ description, coords }: { description: string; coords?: Coordinates }) => {
    isUserTypingRef.current = true;
    setPickupLocation(description);
    if (coords) {
      setPickupCoords(coords);
      if (dropoffCoords) fetchRoute(coords, dropoffCoords);
    }
    setTimeout(() => {
      isUserTypingRef.current = false;
    }, 2000);
  };

  const handleDeliverySelected = ({ description, coords }: { description: string; coords?: Coordinates }) => {
    isUserTypingRef.current = true;
    setDeliveryLocation(description);
    if (coords) {
      setDropoffCoords(coords);
      if (pickupCoords) fetchRoute(pickupCoords, coords);
    } 
    setTimeout(() => {
      isUserTypingRef.current = false;
    }, 2000);
  };

  const handleMethodSelected = (method: 'moto' | 'vehicule' | 'cargo') => {
    Haptics.selectionAsync();
    setSelectedMethod(method);
    startMethodSelection();
  };

  const handleShowDeliveryMethod = useCallback(() => {
    collapseBottomSheet();
    setTimeout(() => {
      const MAX_HEIGHT = SCREEN_HEIGHT * 0.85;
      
      Animated.spring(deliveryMethodAnimatedHeight, {
        toValue: MAX_HEIGHT,
        useNativeDriver: false,
        tension: 65,
        friction: 8,
      }).start();
      
      expandDeliveryMethodSheet();
    }, 300);
  }, [collapseBottomSheet, expandDeliveryMethodSheet, deliveryMethodAnimatedHeight]);

  const handleDeliveryMethodBack = useCallback(() => {
    collapseDeliveryMethodSheet();
    setTimeout(() => {
      expandBottomSheet();
    }, 300);
  }, [collapseDeliveryMethodSheet, expandBottomSheet]);

  const getPriceAndTime = useCallback(() => {
    if (!pickupCoords || !dropoffCoords || !selectedMethod) {
      return { price: 0, estimatedTime: '0 min.' };
    }
    const distance = getDistanceInKm(pickupCoords, dropoffCoords);
    const price = calculatePrice(distance, selectedMethod as 'moto' | 'vehicule' | 'cargo');
    const minutes = estimateDurationMinutes(distance, selectedMethod as 'moto' | 'vehicule' | 'cargo');
    const estimatedTime = formatDurationLabel(minutes) || `${minutes} min.`;
    return { price, estimatedTime };
  }, [pickupCoords, dropoffCoords, selectedMethod]);

  const handleConfirm = async () => {
    handleShowDeliveryMethod();
  };

  const handleDeliveryMethodConfirm = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    collapseDeliveryMethodSheet();
    setTimeout(() => {
      expandOrderDetailsSheet();
      Animated.spring(orderDetailsAnimatedHeight, {
        toValue: SCREEN_HEIGHT * 0.9,
        useNativeDriver: false,
        tension: 65,
        friction: 8,
      }).start();
    }, 300);
  }, [collapseDeliveryMethodSheet, expandOrderDetailsSheet, orderDetailsAnimatedHeight]);

  const handleOrderDetailsConfirm = useCallback(async (
    pickupDetails: any,
    dropoffDetails: any,
        payerType?: 'client' | 'recipient',
    isPartialPayment?: boolean,
    partialAmount?: number,
    paymentMethodType?: 'orange_money' | 'wave' | 'cash' | 'deferred',
    paymentMethodId?: string | null
  ) => {
    // Vérifier l'authentification avant de créer la commande
    if (!user) {
      Alert.alert(
        'Connexion requise',
        'Vous devez vous connecter ou créer un compte pour passer une commande.',
        [
          {
            text: 'Annuler',
            style: 'cancel',
          },
          {
            text: 'Se connecter',
            onPress: () => {
              router.push('/(auth)/register' as any);
            },
          },
        ]
      );
      return;
    }

    if (pickupCoords && dropoffCoords && pickupLocation && deliveryLocation && selectedMethod) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      console.log('📦 Envoi commande avec détails...');

      try {
        stopDriverSearch();
        resetAfterDriverSearch();
      } catch {}
      
      const orderData = {
        pickup: {
          address: pickupLocation,
          coordinates: pickupCoords,
          details: pickupDetails,
        },
        dropoff: {
          address: deliveryLocation,
          coordinates: dropoffCoords,
          details: dropoffDetails,
        },
        deliveryMethod: selectedMethod as 'moto' | 'vehicule' | 'cargo',
        userInfo: {
          name: user.email?.split('@')[0] || 'Client',
          rating: 4.5,
          phone: user.phone
        },
        recipient: {
          phone: dropoffDetails.phone,
        },
        packageImages: dropoffDetails.photos || [],
        paymentMethodType: paymentMethodType,
        paymentMethodId: paymentMethodId || null,
        paymentPayerType: payerType,
        isPartialPayment: isPartialPayment,
        partialAmount: isPartialPayment && partialAmount ? partialAmount : undefined,
        recipientUserId: recipientInfo.userId,
        recipientIsRegistered: recipientInfo.isRegistered,
      };
      
      const success = await userOrderSocketService.createOrder(orderData);
      if (success) {
        collapseOrderDetailsSheet();
        collapseDeliveryMethodSheet();
        
        let recipientIsRegistered = false;
        let recipientUserId: string | undefined;
        
        if (payerType === 'recipient' && dropoffDetails.phone) {
          try {
            recipientIsRegistered = false;
          } catch (error) {
            console.error('Erreur vérification destinataire:', error);
            recipientIsRegistered = false;
          }
        }
        
        setPaymentPayerType(payerType || 'client');
        setSelectedPaymentMethodType(paymentMethodType || null);
        setRecipientInfo({
          phone: dropoffDetails.phone,
          userId: recipientUserId,
          isRegistered: recipientIsRegistered,
        });
        
        if (isPartialPayment && partialAmount) {
          setPaymentPartialInfo({
            isPartial: true,
            partialAmount: partialAmount,
          });
        } else {
          setPaymentPartialInfo({});
        }
        
        setTimeout(() => {
          try {
            clearRoute();
          } catch {}
          setPickupCoords(null);
          setDropoffCoords(null);
          setPickupLocation('');
          setDeliveryLocation('');
          setSelectedMethod('moto');
          
          setIsCreatingNewOrder(true);
          
          locationService.getCurrentPosition().then((coords) => {
            if (coords && region) {
              setTimeout(() => {
                animateToCoordinate({ latitude: coords.latitude, longitude: coords.longitude }, 0.01);
              }, 100);
            } else if (region) {
              setTimeout(() => {
                animateToCoordinate({ latitude: region.latitude, longitude: region.longitude }, 0.01);
              }, 100);
            }
          }).catch(() => {
            if (region) {
              setTimeout(() => {
                animateToCoordinate({ latitude: region.latitude, longitude: region.longitude }, 0.01);
              }, 100);
            }
          });

          setTimeout(() => {
            userManuallyClosedRef.current = false;
            hasAutoOpenedRef.current = false;
            setIsCreatingNewOrder(true);
            scheduleBottomSheetOpen();
          }, 500);
        }, 300);
        
      } else {
        Alert.alert('❌ Erreur', 'Impossible d\'envoyer la commande');
        setIsCreatingNewOrder(true);
        collapseOrderDetailsSheet();
        collapseDeliveryMethodSheet();
        // Réouvrir le bottom sheet de création
        setTimeout(() => {
          scheduleBottomSheetOpen();
        }, 300);
      }
    }
  }, [pickupCoords, dropoffCoords, pickupLocation, deliveryLocation, user, selectedMethod, collapseOrderDetailsSheet, collapseDeliveryMethodSheet, clearRoute, setPickupCoords, setDropoffCoords, setPickupLocation, setDeliveryLocation, setSelectedMethod, setIsCreatingNewOrder, animateToCoordinate, region, scheduleBottomSheetOpen, recipientInfo.isRegistered, recipientInfo.userId, stopDriverSearch, resetAfterDriverSearch]);

  const _handleCancelOrder = useCallback(async (orderId: string) => {
    const currentOrder = useOrderStore.getState().activeOrders.find(o => o.id === orderId);
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
          text: 'Oui',
          style: 'destructive',
          onPress: async () => {
            try {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              logger.info('🔄 Annulation commande...', 'map.tsx', { orderId });
              
              const result = await userApiService.cancelOrder(orderId, currentOrder?.status);
              if (result.success) {
                useOrderStore.getState().clear();
                clearRoute();
                setPickupCoords(null);
                setDropoffCoords(null);
                setPickupLocation('');
                setDeliveryLocation('');
                setSelectedMethod('moto');
                
                logger.info('✅ Commande annulée avec succès', 'map.tsx', { orderId });
                Alert.alert('Succès', 'Commande annulée avec succès');
              } else {
                logger.warn('❌ Erreur annulation commande', 'map.tsx', { message: result.message });
                Alert.alert('Erreur', result.message || 'Impossible d\'annuler la commande');
              }
            } catch (error) {
              logger.error('❌ Erreur annulation commande', 'map.tsx', error);
              Alert.alert('Erreur', 'Impossible d\'annuler la commande');
            }
          },
        },
      ]
    );
  }, [clearRoute, setPickupCoords, setDropoffCoords, setPickupLocation, setDeliveryLocation, setSelectedMethod]);

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

      {/* Carte */}
      <DeliveryMapView
        mapRef={mapRef}
        region={region}
        pickupCoords={pickupCoords}
        dropoffCoords={dropoffCoords}
        displayedRouteCoords={displayedRouteCoords}
        driverCoords={searchDriverCoords}
        orderDriverCoords={orderDriverCoords}
        orderStatus={currentOrder?.status}
        onlineDrivers={onlineDrivers}
        isSearchingDriver={isSearchingDriver}
        destinationPulseAnim={destinationPulseAnim}
        userPulseAnim={userPulseAnim}
        durationText={durationText}
        searchSeconds={searchSeconds}
        selectedMethod={selectedMethod}
        availableVehicles={[]}
        showMethodSelection={showMethodSelection}
        radarCoords={radarPulseCoords}
        onMapPress={() => {
          const isActiveOrder = currentOrder && 
            currentOrder.status !== 'completed' && 
            currentOrder.status !== 'cancelled' && 
            currentOrder.status !== 'declined';
          
          if (!isActiveOrder) {
            userManuallyClosedRef.current = false;
            expandBottomSheet();
          }
        }}
      />

      {/* Bouton retour flottant pour la recherche de livreur ou driver accepté - au-dessus du bottom sheet */}
      {(isSearchingDriver || (currentOrder?.status === 'accepted' && currentOrder?.driver)) && (
        <TouchableOpacity 
          style={styles.driverSearchBackButton}
          onPress={async () => {
            // Nettoyer l'état et afficher le bottom sheet "Envoyer un colis" pour créer une nouvelle commande
            await cleanupOrderState();
            setIsCreatingNewOrder(true);
            userManuallyClosedRef.current = false;
            expandBottomSheet();
          }}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
      )}

      {((showRatingBottomSheet && ratingOrderId) || 
        (currentOrder?.status === 'completed' && currentOrder?.driverId)) && (
        <RatingBottomSheet
          orderId={ratingOrderId || currentOrder?.id || null}
          driverName={ratingDriverName || currentOrder?.driver?.name || undefined}
          panResponder={ratingPanResponder}
          animatedHeight={ratingAnimatedHeight}
          isExpanded={ratingIsExpanded}
          onToggle={toggleRatingBottomSheet}
          onRatingSubmitted={handleRatingSubmitted}
          onClose={handleRatingClose}
        />
      )}

      {!showRatingBottomSheet && (() => {
        const isActiveOrder = currentOrder && 
          currentOrder.status !== 'completed' && 
          currentOrder.status !== 'cancelled' && 
          currentOrder.status !== 'declined';

        if (__DEV__) {
          logger.debug('Bottom Sheet Debug', 'map.tsx', {
            isActiveOrder,
            currentOrderStatus: currentOrder?.status,
            pendingOrder: !!pendingOrder,
            showRatingBottomSheet,
          });
        }

        return (
          <>
            {!deliveryMethodIsExpanded && !orderDetailsIsExpanded && isCreatingNewOrder && !isSearchingDriver && !pendingOrder && !currentOrder && (
              <DeliveryBottomSheet
                animatedHeight={animatedHeight}
                panResponder={panResponder}
                isExpanded={isExpanded}
                onToggle={() => {
                  if (isExpanded) {
                    userManuallyClosedRef.current = true;
                    isProgrammaticCloseRef.current = false;
                  } else {
                    userManuallyClosedRef.current = false;
                  }
                  toggleBottomSheet();
                }}
                pickupLocation={pickupLocation}
                deliveryLocation={deliveryLocation}
                selectedMethod={selectedMethod}
                onPickupSelected={handlePickupSelected}
                onDeliverySelected={handleDeliverySelected}
                onMethodSelected={handleMethodSelected}
                onConfirm={handleConfirm}
              />
            )}

            {deliveryMethodIsExpanded && (() => {
              const { price, estimatedTime } = getPriceAndTime();
              return (
                <DeliveryMethodBottomSheet
                  animatedHeight={deliveryMethodAnimatedHeight}
                  panResponder={deliveryMethodPanResponder}
                  isExpanded={deliveryMethodIsExpanded}
                  onToggle={toggleDeliveryMethodSheet}
                  selectedMethod={selectedMethod || 'moto'}
                  pickupLocation={pickupLocation}
                  deliveryLocation={deliveryLocation}
                  price={price}
                  estimatedTime={estimatedTime}
                  pickupCoords={pickupCoords ?? undefined}
                  dropoffCoords={dropoffCoords ?? undefined}
                  onMethodSelected={handleMethodSelected}
                  onConfirm={handleDeliveryMethodConfirm}
                  onBack={handleDeliveryMethodBack}
                />
              );
            })()}

            {orderDetailsIsExpanded && (() => {
              const { price } = getPriceAndTime();
              return (
                <OrderDetailsSheet
                  animatedHeight={orderDetailsAnimatedHeight}
                  panResponder={orderDetailsPanResponder}
                  isExpanded={orderDetailsIsExpanded}
                  onToggle={toggleOrderDetailsSheet}
                  pickupLocation={pickupLocation}
                  deliveryLocation={deliveryLocation}
                  selectedMethod={selectedMethod || 'moto'}
                  price={price}
                  onBack={() => {
                    collapseOrderDetailsSheet();
                    expandDeliveryMethodSheet();
                  }}
                  onConfirm={handleOrderDetailsConfirm}
                />
              );
            })()}

            {showPaymentSheet && pendingOrder && (() => {
              const { price } = getPriceAndTime();
              const distance = pickupCoords && dropoffCoords 
                ? getDistanceInKm(pickupCoords, dropoffCoords)
                : 0;
              
              return (
                <PaymentBottomSheet
                  orderId={pendingOrder.id}
                  distance={distance}
                  deliveryMethod={selectedMethod || 'moto'}
                  price={pendingOrder.price || price}
                  isUrgent={false}
                  visible={showPaymentSheet}
                  payerType={paymentPayerType}
                  recipientUserId={recipientInfo.userId}
                  recipientPhone={recipientInfo.phone}
                  recipientIsRegistered={recipientInfo.isRegistered || false}
                  initialIsPartial={paymentPartialInfo.isPartial}
                  initialPartialAmount={paymentPartialInfo.partialAmount}
                  preselectedPaymentMethod={selectedPaymentMethodType || undefined}
                  onClose={() => {
                    setShowPaymentSheet(false);
                    Alert.alert(
                      'Paiement requis',
                      'Le paiement est requis pour continuer. Voulez-vous payer maintenant ?',
                      [
                        { text: 'Annuler', style: 'cancel', onPress: () => {
                          useOrderStore.getState().clear();
                        }},
                        { text: 'Payer', onPress: () => setShowPaymentSheet(true) }
                      ]
                    );
                  }}
                  onPaymentSuccess={(transactionId) => {
                    console.log('✅ Paiement réussi:', transactionId);
                    setShowPaymentSheet(false);
                  }}
                  onPaymentError={(error) => {
                    console.error('❌ Erreur paiement:', error);
                    Alert.alert('Erreur de paiement', error);
                  }}
                />
              );
            })()}

            {/* Bottom sheet de recherche de livreur */}
            {((isSearchingDriver || (pendingOrder && !isCreatingNewOrder)) || 
              (currentOrder?.status === 'accepted' && currentOrder?.driver && !showPaymentSheet)) && !showPaymentSheet && (
              <DriverSearchBottomSheet
                isSearching={isSearchingDriver}
                searchSeconds={searchSeconds}
                driver={currentOrder?.status === 'accepted' && currentOrder?.driver ? currentOrder.driver : null}
                onCancel={() => {
                  if (pendingOrder) {
                    _handleCancelOrder(pendingOrder.id);
                  } else if (currentOrder) {
                    _handleCancelOrder(currentOrder.id);
                  }
                }}
                onDetails={() => {
                  if (pendingOrder) {
                    router.push(`/order-tracking/${pendingOrder.id}` as any);
                  } else if (currentOrder) {
                    router.push(`/order-tracking/${currentOrder.id}` as any);
                  }
                }}
                onBack={async () => {
                  // Nettoyer l'état et afficher le bottom sheet "Envoyer un colis" pour créer une nouvelle commande
                  await cleanupOrderState();
                  setIsCreatingNewOrder(true);
                  userManuallyClosedRef.current = false;
                  expandBottomSheet();
                }}
              />
            )}
          </>
        );
      })()}

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
    shadowRadius: 4,
    elevation: 5,
  },
  devButton: {
    position: 'absolute',
    right: 20,
    bottom: 40,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#ff6b6b',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverSearchBackButton: {
    position: 'absolute',
    bottom: 220, // Positionné au-dessus du bottom sheet de recherche (environ 200px de hauteur + padding)
    left: 20,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
});
