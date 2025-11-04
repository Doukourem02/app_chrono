import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import React, { useRef, useEffect, useMemo, useCallback, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, Alert, Animated, Dimensions } from 'react-native';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
import MapView from 'react-native-maps';
import { useShipmentStore } from '../../store/useShipmentStore';
import { useMapLogic } from '../../hooks/useMapLogic';
import { useDriverSearch } from '../../hooks/useDriverSearch';
import { useOnlineDrivers } from '../../hooks/useOnlineDrivers';
import { useBottomSheet } from '../../hooks/useBottomSheet';
import { useRequireAuth } from '../../hooks/useRequireAuth';
import { useAuthStore } from '../../store/useAuthStore';
import { DeliveryMapView } from '../../components/DeliveryMapView';
import { DeliveryBottomSheet } from '../../components/DeliveryBottomSheet';
import { DeliveryMethodBottomSheet } from '../../components/DeliveryMethodBottomSheet';
import { OrderDetailsSheet } from '../../components/OrderDetailsSheet';
// Explicit extension to help some editors/resolvers find the file reliably
import TrackingBottomSheet from '../../components/TrackingBottomSheet.tsx';
import RatingBottomSheet from '../../components/RatingBottomSheet';
import { userOrderSocketService } from '../../services/userOrderSocketService';
import { useOrderStore } from '../../store/useOrderStore';
import { useRatingStore } from '../../store/useRatingStore';
import { logger } from '../../utils/logger';
import { calculatePrice, estimateDurationMinutes, formatDurationLabel, getDistanceInKm } from '../../services/orderApi';

type Coordinates = {
  latitude: number;
  longitude: number;
};

export default function MapPage() {
  const { requireAuth } = useRequireAuth();
  const { setSelectedMethod } = useShipmentStore();
  const { user } = useAuthStore();
  
  const mapRef = useRef<MapView | null>(null);
  const hasInitializedRef = useRef<boolean>(false);

  // Vérifier l'authentification dès l'accès à la page
  useEffect(() => {
    requireAuth(() => {
      // L'utilisateur est connecté, ne rien faire
    });
  }, [requireAuth]);

  // 🔌 Connexion Socket pour les commandes
  useEffect(() => {
    if (user?.id) {
      userOrderSocketService.connect(user.id);
    }

    return () => {
      userOrderSocketService.disconnect();
    };
  }, [user?.id]);

  // Hooks personnalisés pour séparer la logique
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

  // Réinitialiser l'état au montage INITIAL du composant (quand on arrive sur la page)
  // S'assurer que le bottom sheet est toujours visible si aucune commande n'est active
  useEffect(() => {
    // Ne s'exécuter qu'une seule fois au montage initial
    if (hasInitializedRef.current) return;
    hasInitializedRef.current = true;
    
    // Au montage initial, nettoyer les commandes bloquées ou terminées
    const store = useOrderStore.getState();
    const ratingStore = useRatingStore.getState();
    
    // Si on a un currentOrder terminé/annulé/refusé, le nettoyer immédiatement
    // MAIS seulement si c'est vraiment ancien (pas une commande qui vient juste d'être complétée)
    if (store.currentOrder && (
      store.currentOrder.status === 'cancelled' || 
      store.currentOrder.status === 'declined'
    )) {
      logger.info('🧹 Nettoyage commande terminée/annulée/refusée au montage initial', 'map.tsx', { status: store.currentOrder.status });
      
      // Nettoyer aussi le RatingBottomSheet s'il est ouvert
      if (ratingStore.showRatingBottomSheet) {
        logger.info('🧹 Fermeture RatingBottomSheet au montage initial (commande terminée)', 'map.tsx');
        ratingStore.resetRatingBottomSheet();
      }
      
      // Nettoyer complètement l'état de la commande
      store.clear();
      
      // Nettoyer aussi les routes et coordonnées
      try {
        clearRoute();
      } catch {}
      setPickupCoords(null);
      setDropoffCoords(null);
      setPickupLocation('');
      setDeliveryLocation('');
    } else if (store.currentOrder && store.currentOrder.status === 'completed') {
      // Pour les commandes complétées, ne pas nettoyer immédiatement si le RatingBottomSheet n'a pas encore été ouvert
      // On attend que le RatingBottomSheet s'ouvre, puis on nettoiera après sa fermeture
      logger.info('✅ Commande complétée au montage initial - attente du RatingBottomSheet', 'map.tsx', { 
        hasRatingBottomSheet: ratingStore.showRatingBottomSheet 
      });
      
      // Si le RatingBottomSheet n'a pas été ouvert et que la commande est ancienne (plus de 1 minute), nettoyer
      // Utiliser completed_at si disponible, sinon calculer depuis createdAt
      const completedAt = (store.currentOrder as any)?.completed_at || (store.currentOrder as any)?.completedAt;
      const orderAge = completedAt 
        ? new Date().getTime() - new Date(completedAt).getTime()
        : Infinity;
      
      if (!ratingStore.showRatingBottomSheet && orderAge > 60000) {
        logger.info('🧹 Nettoyage commande complétée ancienne au montage initial', 'map.tsx', { orderAge });
        store.clear();
        try {
          clearRoute();
        } catch {}
        setPickupCoords(null);
        setDropoffCoords(null);
        setPickupLocation('');
        setDeliveryLocation('');
      }
    }
    
    // Si on a un pendingOrder, vérifier s'il est trop ancien (plus de 10 secondes)
    // et le nettoyer pour permettre une nouvelle commande
    if (store.pendingOrder) {
      const orderAge = store.pendingOrder.createdAt 
        ? new Date().getTime() - new Date(store.pendingOrder.createdAt).getTime()
        : Infinity;
      
      // Nettoyer les pendingOrders anciens (plus de 10 secondes) pour forcer l'affichage du bottom sheet
      if (orderAge > 10000) {
        logger.info('🧹 Nettoyage pendingOrder bloqué au montage initial', 'map.tsx', { orderId: store.pendingOrder.id, orderAge });
        store.setPendingOrder(null);
        store.setDeliveryStage('idle');
      }
    }
    
    // S'assurer que le deliveryStage est 'idle' si aucune commande active
    if (!store.currentOrder && !store.pendingOrder) {
      store.setDeliveryStage('idle');
    }
    
    // Nettoyer aussi le RatingBottomSheet s'il reste ouvert sans raison valide (sauf si c'est une commande récente complétée)
    if (ratingStore.showRatingBottomSheet && !store.currentOrder) {
      logger.info('🧹 Fermeture RatingBottomSheet au montage initial (pas de commande active)', 'map.tsx');
      ratingStore.resetRatingBottomSheet();
    }
    // Ce useEffect doit s'exécuter UNIQUEMENT au montage initial pour nettoyer l'état au retour dans l'app
    // Les fonctions clearRoute, setPickupCoords, etc. sont stables et référencées via useRef pour éviter les re-exécutions
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Hook pour récupérer les chauffeurs online avec position stable
  const stableUserLocation = useMemo(() => {
    if (!region?.latitude || !region?.longitude) return undefined;
    return {
      latitude: Math.round(region.latitude * 10000) / 10000, // 4 décimales max
      longitude: Math.round(region.longitude * 10000) / 10000
    };
  }, [region?.latitude, region?.longitude]);

  const { drivers: onlineDrivers } = useOnlineDrivers({
    userLocation: stableUserLocation,
    autoRefresh: true,
    refreshInterval: 5000 // 5 secondes pendant les tests (plus rapide pour voir les changements)
  });

  const {
    isSearchingDriver,
    searchSeconds,
    driverCoords,
    pulseAnim,
    startDriverSearch,
    stopDriverSearch,
  } = useDriverSearch(resetAfterDriverSearch);

  const orderDriverCoords = useOrderStore((s) => s.driverCoords);
  const currentOrder = useOrderStore((s) => s.currentOrder);
  const pendingOrder = useOrderStore((s) => s.pendingOrder);

  // Réinitialiser l'état si on revient sur la page avec une commande en attente bloquée
  // (par exemple après avoir quitté et réouvert l'app)
  useEffect(() => {
    // Si on a un pendingOrder mais qu'on ne cherche plus de chauffeur et qu'on est sur la page,
    // c'est probablement une commande bloquée qu'on doit nettoyer
    if (pendingOrder && !isSearchingDriver && !currentOrder) {
      // Vérifier si la commande est vraiment en attente depuis trop longtemps (plus de 30 secondes)
      const orderAge = pendingOrder.createdAt
        ? new Date().getTime() - new Date(pendingOrder.createdAt).getTime()
        : Infinity;

      // Si la commande est en attente depuis plus de 30 secondes sans action, la nettoyer
      if (orderAge > 30000) {
        logger.info('🧹 Nettoyage commande bloquée en attente', 'map.tsx', { orderId: pendingOrder.id, orderAge });
        useOrderStore.getState().setPendingOrder(null);
        useOrderStore.getState().setDeliveryStage('idle');
      }
    }
  }, [pendingOrder, isSearchingDriver, currentOrder]);

  // Arrêter la recherche de chauffeur si pendingOrder devient null (aucun chauffeur disponible)
  useEffect(() => {
    if (!pendingOrder && isSearchingDriver) {
      // Si pendingOrder devient null alors qu'on cherche un chauffeur,
      // cela signifie qu'aucun chauffeur n'est disponible
      stopDriverSearch();
      logger.info('🛑 Recherche de chauffeur arrêtée (aucun chauffeur disponible)', 'map.tsx');
    }
  }, [pendingOrder, isSearchingDriver, stopDriverSearch]);

  // 🆕 Nettoyer la route violette dès qu'une commande est acceptée (orderDriverCoords disponible)
  // Pour ne montrer que le tracking en direct (polyline vert/rouge)
  useEffect(() => {
    if (orderDriverCoords && displayedRouteCoords.length > 0) {
      // Nettoyer la route violette pour ne garder que le tracking en direct
      logger.info('🧹 Nettoyage route violette - commande acceptée, affichage tracking direct', 'map.tsx');
      clearRoute();
    }
  }, [orderDriverCoords, displayedRouteCoords.length, clearRoute]);

  // Bottom sheet pour les commandes normales (création/tracking)
  const {
    animatedHeight,
    isExpanded,
    panResponder,
    toggle: toggleBottomSheet,
    expand: expandBottomSheet, // 🆕 Exposer la fonction expand
    collapse: collapseBottomSheet,
  } = useBottomSheet();

  // Bottom sheet séparé pour l'évaluation (ne pas interférer avec le bottom sheet principal)
  const {
    animatedHeight: ratingAnimatedHeight,
    isExpanded: ratingIsExpanded,
    panResponder: ratingPanResponder,
    expand: expandRatingBottomSheet,
    collapse: collapseRatingBottomSheet,
    toggle: toggleRatingBottomSheet,
  } = useBottomSheet();

  // État du rating bottom sheet
  const { showRatingBottomSheet, orderId: ratingOrderId, driverName: ratingDriverName, resetRatingBottomSheet } = useRatingStore();

  // Bottom sheet pour la méthode de livraison
  const {
    animatedHeight: deliveryMethodAnimatedHeight,
    isExpanded: deliveryMethodIsExpanded,
    panResponder: deliveryMethodPanResponder,
    expand: expandDeliveryMethodSheet,
    collapse: collapseDeliveryMethodSheet,
    toggle: toggleDeliveryMethodSheet,
  } = useBottomSheet();

  // Bottom sheet pour les détails de la commande
  const {
    animatedHeight: orderDetailsAnimatedHeight,
    isExpanded: orderDetailsIsExpanded,
    panResponder: orderDetailsPanResponder,
    expand: expandOrderDetailsSheet,
    collapse: collapseOrderDetailsSheet,
    toggle: toggleOrderDetailsSheet,
  } = useBottomSheet();

  // 🧹 Fonction utilitaire pour nettoyer complètement l'état
  const cleanupOrderState = useCallback(async () => {
    logger.info('🧹 Nettoyage complet de l\'état de commande', 'map.tsx');
    
    // 🛑 Arrêter la recherche de chauffeur si elle est en cours
    if (isSearchingDriver) {
      stopDriverSearch();
    }
    
    // Nettoyer immédiatement l'état de la commande (inclut driverCoords)
    useOrderStore.getState().clear();
    
    // Nettoyer aussi le RatingBottomSheet s'il est ouvert
    const ratingStore = useRatingStore.getState();
    if (ratingStore.showRatingBottomSheet) {
      logger.info('🧹 Fermeture RatingBottomSheet lors du nettoyage', 'map.tsx');
      ratingStore.resetRatingBottomSheet();
      collapseRatingBottomSheet();
    }
    
    // Nettoyer la route et les coordonnées
    try {
      clearRoute();
    } catch {}
    
    setPickupCoords(null);
    setDropoffCoords(null);
    
    // 🆕 Nettoyer aussi les adresses du formulaire pour un reset complet
    setPickupLocation('');
    setDeliveryLocation('');
    
    // 🆕 Récupérer la position actuelle du client et recentrer la carte
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const currentLocation = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        
        const { latitude, longitude } = currentLocation.coords;
        
        // Mettre à jour les coordonnées de pickup avec la position actuelle
        setPickupCoords({ latitude, longitude });
        
        // Animer la caméra vers la position actuelle du client
        setTimeout(() => {
          animateToCoordinate({ latitude, longitude }, 0.01);
        }, 100);
      } else {
        // Fallback sur region si pas de permission
        if (region) {
          setTimeout(() => {
            animateToCoordinate({ latitude: region.latitude, longitude: region.longitude }, 0.01);
          }, 100);
        }
      }
    } catch (error) {
      logger.warn('Erreur récupération position actuelle', 'map.tsx', error);
      // Fallback sur region en cas d'erreur
      if (region) {
        setTimeout(() => {
          animateToCoordinate({ latitude: region.latitude, longitude: region.longitude }, 0.01);
        }, 100);
      }
    }
  }, [clearRoute, setPickupCoords, setDropoffCoords, setPickupLocation, setDeliveryLocation, animateToCoordinate, region, isSearchingDriver, stopDriverSearch, collapseRatingBottomSheet]);

  // Détecter quand une commande est terminée/annulée/refusée et nettoyer immédiatement
  useEffect(() => {
    const status = currentOrder?.status;
    
    // Si la commande est terminée, annulée ou refusée, nettoyer immédiatement
    // Pour 'completed', on ne nettoie PAS immédiatement - on attend que le RatingBottomSheet soit fermé
    if (status === 'cancelled' || status === 'declined') {
      logger.info('🧹 Nettoyage commande terminée/annulée/refusée', 'map.tsx', { status });
      cleanupOrderState();
    } else if (status === 'completed') {
      // Pour completed, on ne nettoie PAS l'état immédiatement
      // Le nettoyage se fera quand le RatingBottomSheet sera fermé
      // Le rating bottom sheet sera déclenché par userOrderSocketService
      logger.info('✅ Commande complétée - attente du RatingBottomSheet avant nettoyage', 'map.tsx');
      // Ne pas nettoyer ici - laisser le RatingBottomSheet s'afficher
    }
  }, [currentOrder?.status, cleanupOrderState]);

  // Gérer l'affichage du rating bottom sheet
  useEffect(() => {
    logger.debug('🔍 RatingBottomSheet state changed', 'map.tsx', { 
      showRatingBottomSheet, 
      ratingOrderId,
      isExpanded: ratingIsExpanded
    });
    
    if (showRatingBottomSheet && ratingOrderId) {
      // Ouvrir automatiquement le rating bottom sheet
      logger.info('⭐ Ouverture automatique rating bottom sheet', 'map.tsx', { 
        orderId: ratingOrderId,
        driverName: ratingDriverName 
      });
      
      // Petit délai pour s'assurer que le composant est prêt
      setTimeout(() => {
        expandRatingBottomSheet();
        logger.info('✅ RatingBottomSheet ouvert', 'map.tsx', { orderId: ratingOrderId });
      }, 100);
    } else if (!showRatingBottomSheet) {
      // Fermer si on doit le cacher
      collapseRatingBottomSheet();
      logger.debug('❌ RatingBottomSheet fermé', 'map.tsx');
    }
  }, [showRatingBottomSheet, ratingOrderId, ratingDriverName, expandRatingBottomSheet, collapseRatingBottomSheet, ratingIsExpanded]);

  // Callback quand l'évaluation est soumise
  const handleRatingSubmitted = useCallback(() => {
    logger.info('✅ Évaluation soumise, fermeture rating bottom sheet', 'map.tsx');
    resetRatingBottomSheet();
    collapseRatingBottomSheet();
    // Nettoyer l'état de la commande maintenant que le rating est soumis
    setTimeout(() => {
      cleanupOrderState();
    }, 300); // Petit délai pour laisser le bottom sheet se fermer
  }, [resetRatingBottomSheet, collapseRatingBottomSheet, cleanupOrderState]);

  // Callback quand le rating bottom sheet est fermé
  const handleRatingClose = useCallback(() => {
    logger.info('❌ Rating bottom sheet fermé', 'map.tsx');
    resetRatingBottomSheet();
    collapseRatingBottomSheet();
    // Nettoyer l'état de la commande maintenant que le rating bottom sheet est fermé
    setTimeout(() => {
      cleanupOrderState();
    }, 300); // Petit délai pour laisser le bottom sheet se fermer
  }, [resetRatingBottomSheet, collapseRatingBottomSheet, cleanupOrderState]);

  // 🆕 Vérifier si une commande est trop ancienne et la nettoyer automatiquement
  // (par exemple, si elle est restée en "accepted" ou "enroute" depuis plus de 30 minutes)
  useEffect(() => {
    if (!currentOrder) return;

    const orderAge = currentOrder.createdAt 
      ? new Date().getTime() - new Date(currentOrder.createdAt).getTime()
      : Infinity;
    
    // Si la commande est trop ancienne (plus de 30 minutes), la nettoyer
    // Cela peut arriver si le livreur oublie de marquer la commande comme "completed"
    const MAX_ORDER_AGE = 1000 * 60 * 30; // 30 minutes
    
    if (orderAge > MAX_ORDER_AGE) {
      logger.info('🧹 Nettoyage commande trop ancienne (oubli de finalisation)', 'map.tsx', { 
        orderId: currentOrder.id, 
        status: currentOrder.status, 
        age: `${Math.round(orderAge / 1000 / 60)} minutes` 
      });
      cleanupOrderState();
    }

    // Vérifier périodiquement toutes les 10 secondes si la commande est trop ancienne
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
    }, 10000); // Vérifier toutes les 10 secondes

    return () => clearInterval(checkInterval);
  }, [currentOrder, cleanupOrderState]);

  const hasAutoOpenedRef = useRef(false);

  // 🆕 Ouvrir automatiquement le bottom sheet à chaque fois qu'on arrive sur la page
  // (si aucune commande active n'est en cours)
  useEffect(() => {
    if (hasAutoOpenedRef.current) {
      return;
    }

    const store = useOrderStore.getState();
    const isActiveOrder = store.currentOrder && 
      store.currentOrder.status !== 'completed' && 
      store.currentOrder.status !== 'cancelled' && 
      store.currentOrder.status !== 'declined';
    
    // Ouvrir automatiquement si pas de commande active et que le bottom sheet n'est pas déjà ouvert
    // Cela se déclenchera à chaque montage du composant (chaque fois qu'on arrive sur la page)
    if (!isActiveOrder && !isExpanded) {
      hasAutoOpenedRef.current = true;
      const timer = setTimeout(() => {
        expandBottomSheet();
      }, 100);

      return () => clearTimeout(timer);
    }

    hasAutoOpenedRef.current = true;
  }, [expandBottomSheet, isExpanded]);

  // NOTE: Bouton de test retiré en production — la création de commande
  // est maintenant déclenchée via le flow utilisateur (handleConfirm)
  const handlePickupSelected = ({ description, coords }: { description: string; coords?: Coordinates }) => {
    setPickupLocation(description);
    if (coords) {
      setPickupCoords(coords);
      if (dropoffCoords) fetchRoute(coords, dropoffCoords);
    }
  };

  const handleDeliverySelected = ({ description, coords }: { description: string; coords?: Coordinates }) => {
    setDeliveryLocation(description);
    if (coords) {
      setDropoffCoords(coords);
      if (pickupCoords) fetchRoute(pickupCoords, coords);
    }
  };

  const handleMethodSelected = (method: 'moto' | 'vehicule' | 'cargo') => {
    Haptics.selectionAsync(); // Feedback haptic léger
    setSelectedMethod(method);
    startMethodSelection(); // Déclencher le pulse violet sur "Ma position"
  };

  // Handler pour ouvrir le bottom sheet de méthode de livraison avec hauteur maximale
  const handleShowDeliveryMethod = useCallback(() => {
    collapseBottomSheet();
    setTimeout(() => {
      // Utiliser une hauteur maximale plus grande pour ce bottom sheet (85% de l'écran)
      const { Dimensions } = require('react-native');
      const { height: SCREEN_HEIGHT } = Dimensions.get('window');
      const MAX_HEIGHT = SCREEN_HEIGHT * 0.85;
      
      // Animer vers la hauteur maximale
      Animated.spring(deliveryMethodAnimatedHeight, {
        toValue: MAX_HEIGHT,
        useNativeDriver: false,
        tension: 65,
        friction: 8,
      }).start();
      
      expandDeliveryMethodSheet();
    }, 300);
  }, [collapseBottomSheet, expandDeliveryMethodSheet, deliveryMethodAnimatedHeight]);

  // Handler pour revenir en arrière depuis le bottom sheet de méthode
  const handleDeliveryMethodBack = useCallback(() => {
    collapseDeliveryMethodSheet();
    setTimeout(() => {
      expandBottomSheet();
    }, 300);
  }, [collapseDeliveryMethodSheet, expandBottomSheet]);

  // Calculer le prix et le temps estimé
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

  // Fonction pour créer la commande avec toutes les informations
  const handleCreateOrder = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    if (pickupCoords && dropoffCoords && pickupLocation && deliveryLocation && user && selectedMethod) {
      console.log('📦 Envoi commande...');
      
      const orderData = {
        pickup: {
          address: pickupLocation,
          coordinates: pickupCoords
        },
        dropoff: {
          address: deliveryLocation,
          coordinates: dropoffCoords
        },
        deliveryMethod: selectedMethod as 'moto' | 'vehicule' | 'cargo',
        userInfo: {
          name: user.email?.split('@')[0] || 'Client',
          rating: 4.5,
          phone: user.phone
        },
      };
      
      const success = await userOrderSocketService.createOrder(orderData);
      if (success) {
        collapseDeliveryMethodSheet();
        startDriverSearch();
      } else {
        Alert.alert('❌ Erreur', 'Impossible d\'envoyer la commande');
      }
    }
    
    try {
      if (pickupCoords && dropoffCoords) {
        await fetchRoute(pickupCoords, dropoffCoords);
      }
    } catch {
      // Ignorer les erreurs de route
    }

    if (pickupCoords) {
      animateToCoordinate(pickupCoords, 0.01);
    }

    if (!isSearchingDriver) {
      startDriverSearch();
    }
  }, [pickupCoords, dropoffCoords, pickupLocation, deliveryLocation, user, selectedMethod, fetchRoute, animateToCoordinate, isSearchingDriver, startDriverSearch, collapseDeliveryMethodSheet]);

  const handleConfirm = async () => {
    // Ouvrir le bottom sheet de méthode de livraison
    handleShowDeliveryMethod();
  };

  // Handler pour confirmer depuis le bottom sheet de méthode - Ouvre OrderDetailsSheet
  const handleDeliveryMethodConfirm = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    collapseDeliveryMethodSheet();
    // Attendre un peu avant d'ouvrir OrderDetailsSheet
    setTimeout(() => {
      expandOrderDetailsSheet();
      // Animer à la hauteur maximale (90% de l'écran)
      Animated.spring(orderDetailsAnimatedHeight, {
        toValue: SCREEN_HEIGHT * 0.9,
        useNativeDriver: false,
        tension: 65,
        friction: 8,
      }).start();
    }, 300);
  }, [collapseDeliveryMethodSheet, expandOrderDetailsSheet, orderDetailsAnimatedHeight]);

  // Handler pour confirmer depuis OrderDetailsSheet - Crée la commande avec tous les détails
  const handleOrderDetailsConfirm = useCallback(async (
    pickupDetails: any,
    dropoffDetails: any
  ) => {
    // Créer la commande avec toutes les informations détaillées
    if (pickupCoords && dropoffCoords && pickupLocation && deliveryLocation && user && selectedMethod) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      console.log('📦 Envoi commande avec détails...');
      
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
      };
      
      const success = await userOrderSocketService.createOrder(orderData);
      if (success) {
        collapseOrderDetailsSheet();
        startDriverSearch();
      } else {
        Alert.alert('❌ Erreur', 'Impossible d\'envoyer la commande');
      }
    }
  }, [pickupCoords, dropoffCoords, pickupLocation, deliveryLocation, user, selectedMethod, collapseOrderDetailsSheet, startDriverSearch]);

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
        driverCoords={driverCoords}
        orderDriverCoords={orderDriverCoords}
        orderStatus={currentOrder?.status}
        onlineDrivers={onlineDrivers} // 🚗 NOUVEAU
        isSearchingDriver={isSearchingDriver}
        pulseAnim={pulseAnim}
        destinationPulseAnim={destinationPulseAnim}
        userPulseAnim={userPulseAnim}
        durationText={durationText}
        searchSeconds={searchSeconds}
        selectedMethod={selectedMethod}
        availableVehicles={[]} // Remplacé par une valeur par défaut
        showMethodSelection={showMethodSelection}
        onMapPress={() => {
          // 🆕 Ouvrir automatiquement le bottom sheet au clic sur la carte avec animation fluide
          // Mais uniquement si on n'a pas de commande active (on affiche le DeliveryBottomSheet)
          const isActiveOrder = currentOrder && 
            currentOrder.status !== 'completed' && 
            currentOrder.status !== 'cancelled' && 
            currentOrder.status !== 'declined';
          
          // Ouvrir immédiatement avec animation, sans délai
          if (!isActiveOrder) {
            expandBottomSheet();
          }
        }}
      />

      {/* Rating Bottom Sheet: Priorité la plus haute - s'affiche après qu'une commande soit complétée */}
      {showRatingBottomSheet && ratingOrderId && (
        <RatingBottomSheet
          orderId={ratingOrderId}
          driverName={ratingDriverName || undefined}
          panResponder={ratingPanResponder}
          animatedHeight={ratingAnimatedHeight}
          isExpanded={ratingIsExpanded}
          onToggle={toggleRatingBottomSheet}
          onRatingSubmitted={handleRatingSubmitted}
          onClose={handleRatingClose}
        />
      )}

      {/* Bottom Sheet: render only one at a time depending on delivery stage */}
      {/* Ne pas afficher si le rating bottom sheet est visible */}
      {!showRatingBottomSheet && (() => {
        // Logique : 
        // 1. Si on a une commande ACTIVE (en cours, pas terminée/annulée/refusée), afficher le tracking
        // 2. Sinon, TOUJOURS afficher le formulaire de création de commande
        // Note: Si status = 'completed', on ne montre PAS le TrackingBottomSheet même si currentOrder existe
        // car on attend que le RatingBottomSheet s'affiche
        const isActiveOrder = currentOrder && 
          currentOrder.status !== 'completed' && 
          currentOrder.status !== 'cancelled' && 
          currentOrder.status !== 'declined';

        // Debug logs
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
            {/* Afficher le bottom sheet de création de commande SAUF si on a une commande active */}
            {/* Si status = 'completed', on n'affiche pas non plus le DeliveryBottomSheet - on attend le RatingBottomSheet */}
            {!isActiveOrder && currentOrder?.status !== 'completed' && !deliveryMethodIsExpanded && !orderDetailsIsExpanded && (
              <DeliveryBottomSheet
                animatedHeight={animatedHeight}
                panResponder={panResponder}
                isExpanded={isExpanded}
                onToggle={toggleBottomSheet}
                pickupLocation={pickupLocation}
                deliveryLocation={deliveryLocation}
                selectedMethod={selectedMethod}
                onPickupSelected={handlePickupSelected}
                onDeliverySelected={handleDeliverySelected}
                onMethodSelected={handleMethodSelected}
                onConfirm={handleConfirm}
              />
            )}

            {/* Afficher le bottom sheet de méthode de livraison avec hauteur maximale */}
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
                  pickupCoords={pickupCoords}
                  dropoffCoords={dropoffCoords}
                  onMethodSelected={handleMethodSelected}
                  onConfirm={handleDeliveryMethodConfirm}
                  onBack={handleDeliveryMethodBack}
                />
              );
            })()}

            {/* Afficher le bottom sheet de détails de la commande */}
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

            {/* Afficher le tracking bottom sheet UNIQUEMENT quand on a une commande active */}
            {/* Si status = 'completed', on ne montre PAS le TrackingBottomSheet - on attend le RatingBottomSheet */}
            {isActiveOrder && (
              <TrackingBottomSheet
                currentOrder={currentOrder}
                panResponder={panResponder}
                animatedHeight={animatedHeight}
                isExpanded={isExpanded}
                onToggle={toggleBottomSheet}
              />
            )}
          </>
        );
      })()}

      {/* DEV quick test button removed in production-ready flow */}
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
});
