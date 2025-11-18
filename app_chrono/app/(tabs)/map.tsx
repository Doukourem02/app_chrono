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
import { useRequireAuth } from '../../hooks/useRequireAuth';
import { useAuthStore } from '../../store/useAuthStore';
import { DeliveryMapView } from '../../components/DeliveryMapView';
import { DeliveryBottomSheet } from '../../components/DeliveryBottomSheet';
import { DeliveryMethodBottomSheet } from '../../components/DeliveryMethodBottomSheet';
import { OrderDetailsSheet } from '../../components/OrderDetailsSheet';
import RatingBottomSheet from '../../components/RatingBottomSheet';
import PaymentBottomSheet from '../../components/PaymentBottomSheet';
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
  const { requireAuth } = useRequireAuth();
  
  // État pour forcer l'affichage du formulaire de création même avec des commandes actives
  const [isCreatingNewOrder, setIsCreatingNewOrder] = React.useState(false);
  const { setSelectedMethod } = useShipmentStore();
  const { user } = useAuthStore();
  const { loadPaymentMethods } = usePaymentStore();
  
  const mapRef = useRef<MapView | null>(null);
  const hasInitializedRef = useRef<boolean>(false);
  const isResettingRef = useRef<boolean>(false); // 🆕 Protection contre les boucles infinies
  const isUserTypingRef = useRef<boolean>(false); // 🆕 Protection contre la réinitialisation pendant la saisie
  const lastFocusTimeRef = useRef<number>(0); // 🆕 Suivre le moment du dernier focus
  
  // État pour le paiement
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

  // 💳 Charger les méthodes de paiement au montage
  useEffect(() => {
    if (user?.id) {
      loadPaymentMethods();
    }
  }, [user?.id, loadPaymentMethods]);

  // 🗺️ Nettoyer le service de localisation quand on quitte la page
  useEffect(() => {
    // Démarrer le watch de localisation au montage
    locationService.startWatching();
    
    return () => {
      // Arrêter le watch quand on quitte la page (mais pas le nettoyer complètement car il peut être utilisé ailleurs)
      // On laisse le service gérer son cycle de vie
    };
  }, []);

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
    
    const currentOrder = store.getCurrentOrder();
    const pendingOrder = store.getPendingOrder();
    
    // Si on a un currentOrder terminé/annulé/refusé, le nettoyer immédiatement
    // MAIS seulement si c'est vraiment ancien (pas une commande qui vient juste d'être complétée)
    if (currentOrder && (
      currentOrder.status === 'cancelled' || 
      currentOrder.status === 'declined'
    )) {
      logger.info('🧹 Nettoyage commande terminée/annulée/refusée au montage initial', 'map.tsx', { status: currentOrder.status });
      
      // Nettoyer aussi le RatingBottomSheet s'il est ouvert
      if (ratingStore.showRatingBottomSheet) {
        logger.info('🧹 Fermeture RatingBottomSheet au montage initial (commande terminée)', 'map.tsx');
        ratingStore.resetRatingBottomSheet();
      }
      
      // Nettoyer complètement l'état de la commande
      store.removeOrder(currentOrder.id);
      
      // Nettoyer aussi les routes et coordonnées
      try {
        clearRoute();
      } catch {}
      setPickupCoords(null);
      setDropoffCoords(null);
      setPickupLocation('');
      setDeliveryLocation('');
    } else if (currentOrder && currentOrder.status === 'completed') {
      // Pour les commandes complétées, ne pas nettoyer immédiatement si le RatingBottomSheet n'a pas encore été ouvert
      // On attend que le RatingBottomSheet s'ouvre, puis on nettoiera après sa fermeture
      logger.info('✅ Commande complétée au montage initial - attente du RatingBottomSheet', 'map.tsx', { 
        hasRatingBottomSheet: ratingStore.showRatingBottomSheet 
      });
      
      // Si le RatingBottomSheet n'a pas été ouvert et que la commande est ancienne (plus de 1 minute), nettoyer
      // Utiliser completed_at si disponible, sinon calculer depuis createdAt
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
    
    // Si on a un pendingOrder, vérifier s'il est trop ancien (plus de 10 secondes)
    // et le nettoyer pour permettre une nouvelle commande
    if (pendingOrder) {
      const orderAge = pendingOrder.createdAt 
        ? new Date().getTime() - new Date(pendingOrder.createdAt).getTime()
        : Infinity;
      
      // Nettoyer les pendingOrders anciens (plus de 10 secondes) pour forcer l'affichage du bottom sheet
      if (orderAge > 10000) {
        logger.info('🧹 Nettoyage pendingOrder bloqué au montage initial', 'map.tsx', { orderId: pendingOrder.id, orderAge });
        store.removeOrder(pendingOrder.id);
      }
    }
    
    // Nettoyer aussi le RatingBottomSheet s'il reste ouvert sans raison valide (sauf si c'est une commande récente complétée)
    if (ratingStore.showRatingBottomSheet && !currentOrder) {
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
    driverCoords: searchDriverCoords,
    startDriverSearch,
    stopDriverSearch,
  } = useDriverSearch(resetAfterDriverSearch);

  const { selectedOrderId, driverCoords: orderDriverCoordsMap, setSelectedOrder } = useOrderStore();
  
  // Bottom sheet pour les commandes normales (création/tracking) - déclaré avant useFocusEffect
  const {
    animatedHeight,
    isExpanded,
    panResponder,
    toggle: toggleBottomSheet,
    expand: expandBottomSheet,
    collapse: collapseBottomSheet,
  } = useBottomSheet();
  
  // 🆕 Réinitialiser complètement la map quand on arrive sur la page (depuis n'importe où)
  // Utiliser useFocusEffect pour détecter chaque fois qu'on arrive sur la page
  // TOUJOURS nettoyer pour permettre la création d'une nouvelle commande, même avec des commandes actives
  useFocusEffect(
    useCallback(() => {
      const now = Date.now();
      lastFocusTimeRef.current = now;
      
      // 🛡️ Protection contre les boucles infinies : ne pas réinitialiser si déjà en cours
      if (isResettingRef.current) {
        return;
      }
      
      // 🛡️ Protection contre la réinitialisation pendant la saisie :
      // Ne pas réinitialiser si l'utilisateur est en train de taper
      if (isUserTypingRef.current) {
        logger.info('📍 Réinitialisation ignorée - utilisateur en train de saisir', 'map.tsx');
        return;
      }
      
      // 🛡️ Ne réinitialiser les champs que s'ils sont vides OU si l'utilisateur vient vraiment d'arriver
      // Vérifier l'état actuel des champs
      const currentPickup = pickupLocation;
      const currentDelivery = deliveryLocation;
      const hasFilledFields = currentPickup.trim().length > 0 || currentDelivery.trim().length > 0;
      
      // Si les champs sont remplis, ne pas les vider (l'utilisateur est en train de créer une commande)
      if (hasFilledFields) {
        logger.info('📍 Réinitialisation partielle - champs déjà remplis, conservation des données', 'map.tsx', {
          pickup: currentPickup.substring(0, 30),
          delivery: currentDelivery.substring(0, 30),
        });
        // Réinitialiser seulement selectedOrderId et isCreatingNewOrder, mais CONSERVER les champs
        const currentSelectedId = useOrderStore.getState().selectedOrderId;
        if (currentSelectedId !== null) {
          setSelectedOrder(null);
        }
        setIsCreatingNewOrder(true);
        // Ne pas vider les champs, ne pas nettoyer les coordonnées, ne pas recentrer la map
        // Juste s'assurer que le mode création est activé
        return;
      }
      
      isResettingRef.current = true;
      lastFocusTimeRef.current = now;
      logger.info('📍 Arrivée sur map - réinitialisation complète pour nouvelle commande', 'map.tsx');
      
      // Vérifier si selectedOrderId est déjà null pour éviter les modifications inutiles du store
      const currentSelectedId = useOrderStore.getState().selectedOrderId;
      if (currentSelectedId !== null) {
        setSelectedOrder(null);
      }
      
      // Réinitialiser le mode création (TOUJOURS permettre de créer une nouvelle commande)
      setIsCreatingNewOrder(true);
      
      // Réinitialiser les flags
      hasAutoOpenedRef.current = false;
      userManuallyClosedRef.current = false;
      
      // 🆕 Nettoyer les coordonnées et routes pour que la map revienne à l'état initial
      // Cela permet de créer une nouvelle commande même avec des commandes actives
      try {
        clearRoute();
      } catch {}
      setPickupCoords(null);
      setDropoffCoords(null);
      setPickupLocation('');
      setDeliveryLocation('');
      setSelectedMethod('moto');
      
      // Recentrer la map sur la position actuelle de l'utilisateur
      // Utiliser un timeout pour s'assurer que region est disponible
      setTimeout(() => {
        locationService.getCurrentPosition().then((coords) => {
          if (coords) {
            animateToCoordinate({ latitude: coords.latitude, longitude: coords.longitude }, 0.01);
          } else if (region) {
            animateToCoordinate({ latitude: region.latitude, longitude: region.longitude }, 0.01);
          }
        }).catch(() => {
          // Fallback sur region en cas d'erreur
          if (region) {
            animateToCoordinate({ latitude: region.latitude, longitude: region.longitude }, 0.01);
          }
        });
      }, 200);
      
      // Réouvrir le bottom sheet après un court délai pour permettre la création
      scheduleBottomSheetOpen(400);
      const resetTimer = setTimeout(() => {
        isResettingRef.current = false;
      }, 1400);

      return () => {
        clearTimeout(resetTimer);
      };
    }, [setSelectedOrder, clearRoute, setPickupCoords, setDropoffCoords, setPickupLocation, setDeliveryLocation, pickupLocation, deliveryLocation, setSelectedMethod, animateToCoordinate, region, scheduleBottomSheetOpen])
  );

  // 🆕 Détecter quand l'utilisateur commence à remplir les champs pour éviter la réinitialisation
  useEffect(() => {
    // Si les champs contiennent du texte, marquer que l'utilisateur est en train de créer une commande
    // Le flag reste actif tant que les champs sont remplis pour éviter qu'ils soient vidés
    const hasFilledFields = pickupLocation.trim().length > 0 || deliveryLocation.trim().length > 0;
    isUserTypingRef.current = hasFilledFields;
    
    if (hasFilledFields) {
      logger.debug('📍 Champs remplis détectés - protection activée', 'map.tsx', {
        pickup: pickupLocation.substring(0, 20),
        delivery: deliveryLocation.substring(0, 20),
      });
    }
  }, [pickupLocation, deliveryLocation]);
  
  // Utiliser les getters pour obtenir les commandes actuelles
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
  // Récupérer les coordonnées du driver pour la commande sélectionnée
  const orderDriverCoords = selectedOrderId ? orderDriverCoordsMap.get(selectedOrderId) || null : null;
  
  // 🆕 Ne PAS réinitialiser isCreatingNewOrder à false quand une commande est créée
  // On veut permettre de créer plusieurs commandes simultanément
  // Le mode création reste actif même avec des commandes actives
  // (isCreatingNewOrder sera réinitialisé à true par useFocusEffect quand on arrive sur la page)

  // Écouter l'acceptation de la commande par le livreur pour gérer le paiement
  // Le paiement se fait APRÈS l'acceptation, pas avant
  useEffect(() => {
    // Vérifier si la commande a été acceptée (status = 'accepted')
    const orderStatus = currentOrder?.status || pendingOrder?.status;
    
    // Gérer le paiement seulement si :
    // 1. La commande est acceptée (status = 'accepted')
    // 2. Le bottom sheet de paiement n'est pas déjà affiché
    // 3. On a une commande en cours
    // 4. Le paiement n'a pas déjà été effectué (vérifier si la commande a déjà un payment_status = 'paid')
    if (orderStatus === 'accepted' && !showPaymentSheet && (currentOrder || pendingOrder)) {
      // Vérifier si le paiement n'a pas déjà été effectué
      const order = currentOrder || pendingOrder;
      const paymentStatus = (order as any)?.payment_status;
      
      // Si le paiement n'est pas déjà effectué
      if (paymentStatus !== 'paid') {
        // Si c'est un paiement en espèces ou différé, on ne demande pas de paiement électronique
        // On considère que le paiement sera effectué à la livraison
        if (selectedPaymentMethodType === 'cash' || selectedPaymentMethodType === 'deferred') {
          // Pour espèces ou différé, on ne demande pas de paiement électronique
          // Le paiement sera confirmé à la livraison
          console.log('✅ Paiement en espèces ou différé - pas de paiement électronique requis');
          return;
        }
        
        // Pour Orange Money, Wave, ou si aucune méthode n'est choisie, afficher le bottom sheet de paiement
        if (selectedPaymentMethodType === 'orange_money' || selectedPaymentMethodType === 'wave' || !selectedPaymentMethodType) {
          // Attendre un peu pour que la commande soit bien mise à jour
          const timer = setTimeout(() => {
            setShowPaymentSheet(true);
          }, 500);
          
          return () => clearTimeout(timer);
        }
      }
    }
  }, [currentOrder?.status, pendingOrder?.status, showPaymentSheet, currentOrder, pendingOrder, selectedPaymentMethodType]);

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
        useOrderStore.getState().removeOrder(pendingOrder.id);
        // Nettoyer aussi la map
        clearRoute();
        setPickupCoords(null);
        setDropoffCoords(null);
        setPickupLocation('');
        setDeliveryLocation('');
      }
    }

    // Vérifier si on a une commande acceptée mais sans driver connecté (driver a quitté l'app)
    if (currentOrder && currentOrder.status === 'accepted') {
      const driverCoordsForOrder = selectedOrderId ? orderDriverCoordsMap.get(selectedOrderId) : null;
      if (!driverCoordsForOrder) {
        const orderAge = currentOrder.createdAt
          ? new Date().getTime() - new Date(currentOrder.createdAt).getTime()
          : Infinity;
        
        // Si la commande est acceptée depuis plus de 60 secondes sans coordonnées du driver,
        // c'est probablement que le driver a quitté l'app - proposer d'annuler
        if (orderAge > 60000) {
          logger.warn('⚠️ Commande acceptée sans driver connecté depuis trop longtemps', 'map.tsx', { 
            orderId: currentOrder.id, 
            orderAge 
          });
          // Ne pas nettoyer automatiquement, mais permettre à l'utilisateur d'annuler via le bouton
        }
      }
    }
  }, [pendingOrder, isSearchingDriver, currentOrder, selectedOrderId, orderDriverCoordsMap, clearRoute, setPickupCoords, setDropoffCoords, setPickupLocation, setDeliveryLocation]);

  // Arrêter la recherche de chauffeur si pendingOrder devient null (aucun chauffeur disponible)
  useEffect(() => {
    if (!pendingOrder && isSearchingDriver) {
      // Si pendingOrder devient null alors qu'on cherche un chauffeur,
      // cela signifie qu'aucun chauffeur n'est disponible
      stopDriverSearch();
      logger.info('🛑 Recherche de chauffeur arrêtée (aucun chauffeur disponible)', 'map.tsx');
    }
  }, [pendingOrder, isSearchingDriver, stopDriverSearch]);

  // Démarrer automatiquement la pulsation radar quand une commande est en attente d'un livreur
  useEffect(() => {
    if (pendingOrder?.status === PENDING_STATUS) {
      if (!isSearchingDriver) {
        logger.info('📡 Démarrage animation radar (commande en attente)', 'map.tsx', {
          orderId: pendingOrder.id,
        });
        startDriverSearch();
      }
    } else if (isSearchingDriver && pendingOrder && pendingOrder.status !== PENDING_STATUS) {
      // La commande a changé d'état (acceptée/refusée) → arrêter le pulse
      logger.info('📡 Arrêt animation radar (commande plus en attente)', 'map.tsx', {
        orderId: pendingOrder.id,
        status: pendingOrder.status,
      });
      stopDriverSearch();
    }
  }, [pendingOrder?.id, pendingOrder?.status, isSearchingDriver, startDriverSearch, stopDriverSearch, pendingOrder]);

  // 🆕 Nettoyer la route violette dès qu'une commande est acceptée (orderDriverCoords disponible)
  // Pour ne montrer que le tracking en direct (polyline vert/rouge)
  useEffect(() => {
    if (orderDriverCoords && displayedRouteCoords.length > 0) {
      // Nettoyer la route violette pour ne garder que le tracking en direct
      logger.info('🧹 Nettoyage route violette - commande acceptée, affichage tracking direct', 'map.tsx');
      clearRoute();
    }
  }, [orderDriverCoords, displayedRouteCoords.length, clearRoute]);


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
      // Utiliser le service centralisé de localisation
      const coords = await locationService.getCurrentPosition();
      
      if (coords) {
        const { latitude, longitude } = coords;
        
        // Mettre à jour les coordonnées de pickup avec la position actuelle
        setPickupCoords({ latitude, longitude });

        // Rafraîchir également l'adresse affichée dans le champ "Où récupérer ?"
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
        
        // Animer la caméra vers la position actuelle du client
        setTimeout(() => {
          animateToCoordinate({ latitude, longitude }, 0.01);
        }, 100);
      } else {
        // Fallback sur region si pas de permission ou erreur
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
      // Fallback sur region en cas d'erreur
      if (region) {
        setPickupCoords({ latitude: region.latitude, longitude: region.longitude });
        setPickupLocation('Votre position actuelle');
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
      // Réinitialiser les refs pour permettre la réouverture automatique
      hasAutoOpenedRef.current = false;
      userManuallyClosedRef.current = false; // 🆕 Réinitialiser le flag de fermeture manuelle
      isProgrammaticCloseRef.current = true; // 🆕 Marquer comme fermeture programmatique
      // Réouvrir le bottom sheet de création de commande
      scheduleBottomSheetOpen(200);
    }, 300); // Petit délai pour laisser le bottom sheet se fermer
  }, [resetRatingBottomSheet, collapseRatingBottomSheet, cleanupOrderState, scheduleBottomSheetOpen]);

  // Callback quand le rating bottom sheet est fermé
  const handleRatingClose = useCallback(() => {
    logger.info('❌ Rating bottom sheet fermé', 'map.tsx');
    resetRatingBottomSheet();
    collapseRatingBottomSheet();
    // Nettoyer l'état de la commande maintenant que le rating bottom sheet est fermé
    setTimeout(() => {
      cleanupOrderState();
      // Réinitialiser les refs pour permettre la réouverture automatique
      hasAutoOpenedRef.current = false;
      userManuallyClosedRef.current = false; // 🆕 Réinitialiser le flag de fermeture manuelle
      isProgrammaticCloseRef.current = true; // 🆕 Marquer comme fermeture programmatique
      // Réouvrir le bottom sheet de création de commande
      scheduleBottomSheetOpen(200);
    }, 300); // Petit délai pour laisser le bottom sheet se fermer
  }, [resetRatingBottomSheet, collapseRatingBottomSheet, cleanupOrderState, scheduleBottomSheetOpen]);

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
  const userManuallyClosedRef = useRef(false); // 🆕 Suivre si l'utilisateur a fermé manuellement
  const isProgrammaticCloseRef = useRef(false); // 🆕 Suivre si on ferme programmatiquement (pour éviter de marquer comme fermeture manuelle)
  const previousIsExpandedRef = useRef(isExpanded); // 🆕 Suivre l'état précédent de isExpanded
  const autoOpenTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null); // 🆕 Permettre d'annuler les ouvertures auto en attente

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

  useEffect(() => {
    return () => {
      if (autoOpenTimeoutRef.current) {
        clearTimeout(autoOpenTimeoutRef.current);
      }
    };
  }, []);

  // 🆕 Détecter quand le bottom sheet est fermé (par glissement ou toggle)
  // et marquer comme fermeture manuelle si ce n'est pas une fermeture programmatique
  useEffect(() => {
    // Si le bottom sheet passe de expanded à collapsed, et que ce n'est pas une fermeture programmatique
    // alors c'est une fermeture manuelle
    if (previousIsExpandedRef.current && !isExpanded && !isProgrammaticCloseRef.current) {
      userManuallyClosedRef.current = true;
      logger.debug('🔒 Bottom sheet fermé manuellement par l\'utilisateur', 'map.tsx');
      if (autoOpenTimeoutRef.current) {
        clearTimeout(autoOpenTimeoutRef.current);
        autoOpenTimeoutRef.current = null;
      }
    }
    // Mettre à jour l'état précédent
    previousIsExpandedRef.current = isExpanded;
    // Réinitialiser le flag de fermeture programmatique après chaque changement
    isProgrammaticCloseRef.current = false;
  }, [isExpanded]);

  // 🆕 Ouvrir automatiquement le bottom sheet à chaque fois qu'on arrive sur la page
  // (si aucune commande active n'est en cours OU si on est en mode création)
  useEffect(() => {
    const store = useOrderStore.getState();
    const currentOrder = store.getCurrentOrder();
    const isActiveOrder = currentOrder && 
      currentOrder.status !== 'completed' && 
      currentOrder.status !== 'cancelled' && 
      currentOrder.status !== 'declined';
    const hasOrderInProgress = Boolean(pendingOrder || isActiveOrder);

    if (hasOrderInProgress) {
      return;
    }
    
    // Ouvrir automatiquement le formulaire de création si :
    // 1. Pas de commande active
    // 2. Le bottom sheet n'est pas déjà ouvert
    // 3. L'utilisateur ne l'a pas fermé manuellement
    const shouldShowCreationForm = !isActiveOrder || isCreatingNewOrder;
    
    if (shouldShowCreationForm && !isExpanded && !showRatingBottomSheet && !userManuallyClosedRef.current) {
      if (!hasAutoOpenedRef.current) {
        hasAutoOpenedRef.current = true;
        scheduleBottomSheetOpen(100);
      }
    }
  }, [isExpanded, currentOrder, showRatingBottomSheet, isCreatingNewOrder, pendingOrder, scheduleBottomSheetOpen]);

  // 🆕 Réouvrir automatiquement le bottom sheet après le nettoyage d'une commande
  // MAIS seulement si l'utilisateur ne l'a pas fermé manuellement
  useEffect(() => {
    const store = useOrderStore.getState();
    const currentOrder = store.getCurrentOrder();
    const isActiveOrder = currentOrder && 
      currentOrder.status !== 'completed' && 
      currentOrder.status !== 'cancelled' && 
      currentOrder.status !== 'declined';
    const hasOrderInProgress = Boolean(pendingOrder || isActiveOrder);
    
    // Si on n'a pas de commande active et que le bottom sheet n'est pas ouvert, le réouvrir
    // MAIS seulement si l'utilisateur ne l'a pas fermé manuellement
    if (!hasOrderInProgress && !currentOrder && !isExpanded && !showRatingBottomSheet && !userManuallyClosedRef.current) {
      // Réinitialiser hasAutoOpenedRef pour permettre la réouverture
      hasAutoOpenedRef.current = false;
      isProgrammaticCloseRef.current = true; // 🆕 Marquer comme fermeture programmatique (si on ferme avant)
      scheduleBottomSheetOpen(300);
      const resetTimer = setTimeout(() => {
        isProgrammaticCloseRef.current = false; // Réinitialiser avant l'ouverture
        hasAutoOpenedRef.current = true;
      }, 300);

      return () => clearTimeout(resetTimer);
    }
  }, [currentOrder, pendingOrder, isExpanded, showRatingBottomSheet, scheduleBottomSheetOpen]);

  // NOTE: Bouton de test retiré en production — la création de commande
  // est maintenant déclenchée via le flow utilisateur (handleConfirm)
  const handlePickupSelected = ({ description, coords }: { description: string; coords?: Coordinates }) => {
    // 🆕 Marquer que l'utilisateur est en train de saisir pour éviter la réinitialisation
    isUserTypingRef.current = true;
    setPickupLocation(description);
    if (coords) {
      setPickupCoords(coords);
      if (dropoffCoords) fetchRoute(coords, dropoffCoords);
    }
    // Réinitialiser le flag après un délai pour permettre la réinitialisation si nécessaire
    setTimeout(() => {
      isUserTypingRef.current = false;
    }, 2000);
  };

  const handleDeliverySelected = ({ description, coords }: { description: string; coords?: Coordinates }) => {
    // 🆕 Marquer que l'utilisateur est en train de saisir pour éviter la réinitialisation
    isUserTypingRef.current = true;
    setDeliveryLocation(description);
    if (coords) {
      setDropoffCoords(coords);
      if (pickupCoords) fetchRoute(pickupCoords, coords);
    }
    // Réinitialiser le flag après un délai pour permettre la réinitialisation si nécessaire
    setTimeout(() => {
      isUserTypingRef.current = false;
    }, 2000);
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

  const handleConfirm = async () => {
    // Ouvrir le bottom sheet de méthode de livraison
    handleShowDeliveryMethod();
  };

  // Handler pour confirmer depuis le bottom sheet de méthode - Ouvre OrderDetailsSheet
  const handleDeliveryMethodConfirm = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    collapseDeliveryMethodSheet();
    setIsCreatingNewOrder(false); // Réinitialiser l'état après confirmation
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
    dropoffDetails: any,
    payerType?: 'client' | 'recipient', // Qui paie (optionnel, par défaut client)
    isPartialPayment?: boolean,
    partialAmount?: number,
    paymentMethodType?: 'orange_money' | 'wave' | 'cash' | 'deferred', // Méthode de paiement choisie
    paymentMethodId?: string | null // ID de la méthode de paiement depuis payment_methods
  ) => {
    // Créer la commande avec toutes les informations détaillées
    if (pickupCoords && dropoffCoords && pickupLocation && deliveryLocation && user && selectedMethod) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      console.log('📦 Envoi commande avec détails...');

      // Toujours repartir d'un état de recherche propre avant de lancer une nouvelle commande
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
        // Informations de paiement à envoyer au backend
        paymentMethodType: paymentMethodType,
        paymentMethodId: paymentMethodId || null, // ID de la méthode de paiement depuis payment_methods
        paymentPayerType: payerType,
        isPartialPayment: isPartialPayment,
        partialAmount: isPartialPayment && partialAmount ? partialAmount : undefined,
        recipientUserId: recipientInfo.userId,
        recipientIsRegistered: recipientInfo.isRegistered,
      };
      
      const success = await userOrderSocketService.createOrder(orderData);
      if (success) {
        collapseOrderDetailsSheet();
        
        // Vérifier si le destinataire est enregistré (si le destinataire paie)
        let recipientIsRegistered = false;
        let recipientUserId: string | undefined;
        
        if (payerType === 'recipient' && dropoffDetails.phone) {
          try {
            // Vérifier si le destinataire est enregistré via son téléphone
            // TODO: Implémenter une API pour vérifier si un utilisateur est enregistré via son téléphone
            // Pour l'instant, on suppose qu'il n'est pas enregistré
            recipientIsRegistered = false;
          } catch (error) {
            console.error('Erreur vérification destinataire:', error);
            recipientIsRegistered = false;
          }
        }
        
        // Définir qui paie (stocké pour plus tard, après acceptation)
        setPaymentPayerType(payerType || 'client');
        setSelectedPaymentMethodType(paymentMethodType || null); // Stocker la méthode de paiement choisie
        setRecipientInfo({
          phone: dropoffDetails.phone,
          userId: recipientUserId,
          isRegistered: recipientIsRegistered,
        });
        
        // Si paiement partiel, stocker les informations
        if (isPartialPayment && partialAmount) {
          setPaymentPartialInfo({
            isPartial: true,
            partialAmount: partialAmount,
          });
        } else {
          setPaymentPartialInfo({});
        }
        
        // 🆕 Réinitialiser la map pour permettre une nouvelle commande
        // Nettoyer les routes et coordonnées pour que la map revienne à l'état initial
        setTimeout(() => {
          try {
            clearRoute();
          } catch {}
          setPickupCoords(null);
          setDropoffCoords(null);
          setPickupLocation('');
          setDeliveryLocation('');
          setSelectedMethod('moto');
          
          // Réinitialiser le mode création pour permettre une nouvelle commande
          setIsCreatingNewOrder(true);
          
          // Recentrer la map sur la position actuelle de l'utilisateur
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
            // Fallback sur region en cas d'erreur
            if (region) {
              setTimeout(() => {
                animateToCoordinate({ latitude: region.latitude, longitude: region.longitude }, 0.01);
              }, 100);
            }
          });
          
          // Réouvrir le bottom sheet de création après un court délai
          setTimeout(() => {
            userManuallyClosedRef.current = false;
            hasAutoOpenedRef.current = false;
            scheduleBottomSheetOpen();
          }, 500);
        }, 300);
        
        // NE PAS afficher le paiement maintenant - attendre l'acceptation par le livreur
        // Le paiement sera déclenché automatiquement quand la commande sera acceptée (voir useEffect ci-dessus)
      } else {
        Alert.alert('❌ Erreur', 'Impossible d\'envoyer la commande');
      }
    }
  }, [pickupCoords, dropoffCoords, pickupLocation, deliveryLocation, user, selectedMethod, collapseOrderDetailsSheet, clearRoute, setPickupCoords, setDropoffCoords, setPickupLocation, setDeliveryLocation, setSelectedMethod, setIsCreatingNewOrder, animateToCoordinate, region, scheduleBottomSheetOpen, recipientInfo.isRegistered, recipientInfo.userId, stopDriverSearch, resetAfterDriverSearch]);

  // Handler pour annuler une commande
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _handleCancelOrder = useCallback(async (orderId: string) => {
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
              
              const result = await userApiService.cancelOrder(orderId);
              if (result.success) {
                // Nettoyer l'état local
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
        onlineDrivers={onlineDrivers} // 🚗 NOUVEAU
        isSearchingDriver={isSearchingDriver}
        destinationPulseAnim={destinationPulseAnim}
        userPulseAnim={userPulseAnim}
        durationText={durationText}
        searchSeconds={searchSeconds}
        selectedMethod={selectedMethod}
        availableVehicles={[]} // Remplacé par une valeur par défaut
        showMethodSelection={showMethodSelection}
        radarCoords={radarPulseCoords}
        onMapPress={() => {
          // 🆕 Ouvrir automatiquement le bottom sheet au clic sur la carte avec animation fluide
          // Mais uniquement si on n'a pas de commande active (on affiche le DeliveryBottomSheet)
          const isActiveOrder = currentOrder && 
            currentOrder.status !== 'completed' && 
            currentOrder.status !== 'cancelled' && 
            currentOrder.status !== 'declined';
          
          // Ouvrir immédiatement avec animation, sans délai
          // Réinitialiser le flag de fermeture manuelle car l'utilisateur veut voir le bottom sheet
          if (!isActiveOrder) {
            userManuallyClosedRef.current = false;
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
            {/* Afficher le bottom sheet de création de commande - TOUJOURS disponible même avec des commandes actives */}
            {/* Seulement si on n'est pas en train de sélectionner une méthode ou de voir les détails */}
            {/* TOUJOURS afficher si on est en mode création (permet plusieurs commandes simultanées) */}
            {!deliveryMethodIsExpanded && !orderDetailsIsExpanded && isCreatingNewOrder && (
              <DeliveryBottomSheet
                animatedHeight={animatedHeight}
                panResponder={panResponder}
                isExpanded={isExpanded}
                onToggle={() => {
                  // 🆕 Si l'utilisateur ferme manuellement (toggle), marquer le flag
                  if (isExpanded) {
                    userManuallyClosedRef.current = true;
                    isProgrammaticCloseRef.current = false; // C'est une fermeture manuelle
                  } else {
                    // Si l'utilisateur ouvre le bottom sheet, réinitialiser le flag
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
                  pickupCoords={pickupCoords ?? undefined}
                  dropoffCoords={dropoffCoords ?? undefined}
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

            {/* Le tracking est maintenant géré dans une page dédiée (/order-tracking/[orderId]) */}
            {/* On n'affiche plus le TrackingBottomSheet ici - la map est uniquement pour créer des commandes */}

            {/* Afficher le bottom sheet de paiement après création de commande */}
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
                  preselectedPaymentMethod={selectedPaymentMethodType || undefined} // Passer la méthode déjà choisie
                  onClose={() => {
                    setShowPaymentSheet(false);
                    // Si l'utilisateur ferme sans payer, demander confirmation
                    Alert.alert(
                      'Paiement requis',
                      'Le paiement est requis pour continuer. Voulez-vous payer maintenant ?',
                      [
                        { text: 'Annuler', style: 'cancel', onPress: () => {
                          // Annuler la commande si l'utilisateur ne veut pas payer
                          useOrderStore.getState().clear();
                        }},
                        { text: 'Payer', onPress: () => setShowPaymentSheet(true) }
                      ]
                    );
                  }}
                  onPaymentSuccess={(transactionId) => {
                    console.log('✅ Paiement réussi:', transactionId);
                    setShowPaymentSheet(false);
                    // Le paiement est effectué après l'acceptation, donc pas besoin de démarrer la recherche
                    // La commande est déjà acceptée et en cours de livraison
                  }}
                  onPaymentError={(error) => {
                    console.error('❌ Erreur paiement:', error);
                    Alert.alert('Erreur de paiement', error);
                  }}
                />
              );
            })()}
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
