import React, { useState, useEffect, useRef, useCallback } from "react";
import { View, StyleSheet, TouchableOpacity, Alert, Text, ActivityIndicator, InteractionManager } from "react-native";
import type { MapRefHandle } from "../../hooks/useMapCamera";
import { DriverMapView } from "../../components/DriverMapView";
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
import { useGeofencing } from '../../hooks/useGeofencing';
import MessageBottomSheet from "../../components/MessageBottomSheet";
import { MapboxNavigationScreen } from "../../components/MapboxNavigationScreen";
import { formatUserName } from '../../utils/formatName';
import { speakAnnouncement } from '../../utils/speechAnnouncement';

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
  const mapRef = useRef<MapRefHandle | null>(null);

  const resolveCoords = (candidate?: any) => {
    if (!candidate) return null;

    const c = candidate.coordinates || candidate.coords || candidate.location || candidate;
    // GeoJSON : [lng, lat]
    if (Array.isArray(c) && c.length >= 2) {
      const lng = Number(c[0]);
      const lat = Number(c[1]);
      if (Number.isFinite(lat) && Number.isFinite(lng)) return { latitude: lat, longitude: lng };
      return null;
    }
    const lat = c?.latitude ?? c?.lat ?? c?.Lat ?? c?.y;
    const lng = c?.longitude ?? c?.lng ?? c?.Lng ?? c?.x;

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
    // Filtrer les commandes complétées/annulées avant de sélectionner
    const validActiveOrders = s.activeOrders.filter(o => 
      o.status !== 'completed' && o.status !== 'cancelled' && o.status !== 'declined'
    );
    
    if (s.selectedOrderId) {
      const selected = validActiveOrders.find(o => o.id === s.selectedOrderId);
      // Si la commande sélectionnée est complétée/annulée, la désélectionner
      if (!selected && s.selectedOrderId) {
        useOrderStore.getState().setSelectedOrder(null);
      }
      return selected || null;
    }
    
    // Fallback : retourner la première commande active valide si aucune n'est sélectionnée
    return validActiveOrders[0] || null;
  });

  // Suivi temps réel : envoyer position au client (throttle 3s + distance filter 15m)
  const lastEmitRef = useRef<{ lat: number; lng: number; ts: number } | null>(null);
  useEffect(() => {
    const status = String(currentOrder?.status || '');
    const needsTracking = ['accepted', 'enroute', 'picked_up', 'delivering', 'in_progress'].includes(status);
    if (!currentOrder?.id || !location || !needsTracking) return;

    const distMeters = (a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) => {
      const R = 6371000;
      const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
      const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
      const x = Math.sin(dLat / 2) ** 2 + Math.cos((a.latitude * Math.PI) / 180) * Math.cos((b.latitude * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
      return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
    };

    const maybeEmit = () => {
      const now = Date.now();
      const last = lastEmitRef.current;
      const shouldEmit = !last ||
        now - last.ts >= 3000 ||
        distMeters(location, { latitude: last.lat, longitude: last.lng }) >= 15;

      if (shouldEmit) {
        orderSocketService.emitDriverLocation(currentOrder.id, location);
        lastEmitRef.current = { lat: location.latitude, lng: location.longitude, ts: now };
      }
    };

    maybeEmit();
    const iv = setInterval(maybeEmit, 3000);
    return () => clearInterval(iv);
  }, [currentOrder?.id, currentOrder?.status, location]);

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
  const [isNavigationActive, setIsNavigationActive] = useState(false);
  /** Mode minimisé : Mapbox reste monté (ETA continue), on affiche la carte avec bouton "Reprendre" */
  const [isNavigationMinimized, setIsNavigationMinimized] = useState(false);
  const [lastEtaMinutes, setLastEtaMinutes] = useState<number | null>(null);

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
  const [showRecalcOverlay, setShowRecalcOverlay] = useState(false);
  /** Force unmount/remount Mapbox lors du passage pickup→dropoff (évite navigation figée) */
  const [mapboxMountedForDropoff, setMapboxMountedForDropoff] = useState(true);
  const hasValidatedViaMapboxRef = useRef<Set<string>>(new Set());
  const lastEtaAnnouncedMinRef = useRef<number>(99);
  // Commande terminée mais navigation gardée ouverte : le livreur quitte quand il veut
  const [navigationCompletedOrder, setNavigationCompletedOrder] = useState<typeof currentOrder | null>(null);
  const [mapboxVoiceMuted, setMapboxVoiceMuted] = useState(false);
  const [showColisRecupereButton, setShowColisRecupereButton] = useState(false);
  const [showLivraisonEffectueeButton, setShowLivraisonEffectueeButton] = useState(false);
  const atPickupZoneAnnouncedRef = useRef(false);
  const atDropoffZoneAnnouncedRef = useRef(false);

  /** Annonce vocale en mutant Mapbox pour éviter les doublons (ex: "tournez à droite" + notre annonce) */
  const speakWithMapboxMuted = useCallback((text: string, onDone?: () => void) => {
    setMapboxVoiceMuted(true);
    speakAnnouncement(text, {
      onDone: () => {
        setMapboxVoiceMuted(false);
        onDone?.();
      },
    });
  }, []);

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
  const navDisplayOrder = currentOrder || navigationCompletedOrder;
  const navDestination = destination || (navigationCompletedOrder ? resolveCoords(navigationCompletedOrder.dropoff) : null);
  const currentPickupCoord = currentOrder ? resolveCoords(currentOrder.pickup) : null;
  const currentDropoffCoord = currentOrder ? resolveCoords(currentOrder.dropoff) : null;

  /** Pendant transition pickup→dropoff : passer directement au dropoff pour éviter navigation figée */
  const effectiveNavDestination = navDestination;

  /** Origine : vers dropoff le livreur part du pickup (calcul fiable). Sinon position actuelle. */
  const navOrigin =
    effectiveNavDestination === currentDropoffCoord && currentPickupCoord
      ? currentPickupCoord
      : location;

  // Cacher la tab bar quand la navigation full-screen est active
  useEffect(() => {
    setHideTabBar(isNavigationActive);
  }, [isNavigationActive, setHideTabBar]);

  // Auto-démarrage navigation : Livreur accepte → phase 1 (pickup), Colis récupéré → phase 2 (dropoff)
  useEffect(() => {
    if (!currentOrder) {
      lastOrderStatusRef.current = null;
      return;
    }
    if (!location || !destination) return;

    const status = String(currentOrder.status || '');
    const prevStatus = lastOrderStatusRef.current;
    lastOrderStatusRef.current = status;

    // Phase 1 : transition vers accepted (ouverture avec commande acceptée)
    // Auto-enroute pour synchroniser app/admin : "Livreur en route pour récupérer le colis"
    if (status === 'accepted' && prevStatus !== 'accepted') {
      logger.info('Auto-démarrage navigation phase 1 (point de collecte)', 'driver-index');
      setIsNavigationActive(true);
      if (location) {
        setTimeout(() => {
          orderSocketService.updateDeliveryStatus(currentOrder.id, 'enroute', location);
        }, 600);
      }
    }
    // Phase 2 : transition vers picked_up (colis récupéré → navigation vers livraison)
    // Unmount Mapbox 500ms puis remount avec dropoff pour éviter navigation figée
    if ((status === 'picked_up' || status === 'delivering') && (prevStatus === 'enroute' || prevStatus === 'in_progress')) {
      logger.info('Auto-démarrage navigation phase 2 (adresse de livraison)', 'driver-index');
      setShowRecalcOverlay(true);
      setMapboxMountedForDropoff(false); // Unmount Mapbox pour reset état interne
      setIsNavigationMinimized(false);
      if (!isNavigationActive) {
        speakWithMapboxMuted('Colis pris en charge. Nous pouvons entamer la course.');
      }
      setIsNavigationActive(true);
      InteractionManager.runAfterInteractions(() => {
        setTimeout(() => {
          setMapboxMountedForDropoff(true); // Remount avec destination = dropoff
        }, 500);
      });
      if (status === 'picked_up' && location) {
        setTimeout(() => {
          orderSocketService.updateDeliveryStatus(currentOrder.id, 'delivering', location);
        }, 400);
      }
    }
  }, [currentOrder?.id, currentOrder?.status, currentOrder, location, destination, isNavigationActive, speakWithMapboxMuted]);

  // Masquer l'overlay "Recalcul..." après 5 s (fallback si transition lente)
  useEffect(() => {
    if (!showRecalcOverlay) return;
    const t = setTimeout(() => setShowRecalcOverlay(false), 5000);
    return () => clearTimeout(t);
  }, [showRecalcOverlay]);

  // Réinitialiser la transition quand la commande change
  useEffect(() => {
    if (!currentOrder?.id) setMapboxMountedForDropoff(true);
  }, [currentOrder?.id]);

  // Géofencing : détection automatique d'arrivée
  // CRITIQUE : Désactiver le géofencing si le statut est 'accepted'
  // Le livreur doit d'abord cliquer sur "Je pars" pour passer à 'enroute'
  // Sinon, le géofencing valide automatiquement et fait disparaître le menu "Je pars"
  const shouldEnableGeofencing = isOnline && 
    !!currentOrder && 
    !!destination && 
    !!location &&
    currentOrder.status !== 'accepted'; // Désactiver si statut est 'accepted'
  
  const { isInZone } = useGeofencing({
    driverPosition: location,
    targetPosition: destination,
    orderId: currentOrder?.id || null,
    orderStatus: currentOrder?.status || null,
    enabled: shouldEnableGeofencing,
    onEnteredZone: () => {
      logger.info('Vous êtes arrivé dans la zone', 'geofencing');
    },
    onEnteredPickupZone: () => {
      if (atPickupZoneAnnouncedRef.current) return;
      atPickupZoneAnnouncedRef.current = true;
      setShowColisRecupereButton(true);
      speakWithMapboxMuted('Vous êtes arrivés au point de collecte de colis.');
    },
    onEnteredDropoffZone: () => {
      if (atDropoffZoneAnnouncedRef.current) return;
      atDropoffZoneAnnouncedRef.current = true;
      setShowLivraisonEffectueeButton(true);
      speakWithMapboxMuted('Vous êtes arrivés à destination.');
    },
    onValidated: (newStatus) => {
      if (newStatus !== 'completed') return;
      logger.info('Validation automatique géofencing (destination)', 'geofencing');
      const orderId = currentOrder?.id;
      if (!orderId) return;
      if (hasValidatedViaMapboxRef.current.has(orderId)) return;
      hasValidatedViaMapboxRef.current.add(orderId);
      setShowLivraisonEffectueeButton(false);
      atDropoffZoneAnnouncedRef.current = true;
      speakWithMapboxMuted('Vous êtes arrivés à destination.');
      if (currentOrder && isNavigationActive) {
        setNavigationCompletedOrder(currentOrder);
      }
    },
  });

  // Réinitialiser quand le livreur sort de la zone pickup (pour réafficher le bouton s'il revient)
  useEffect(() => {
    if (!isInZone && (currentOrder?.status === 'enroute' || currentOrder?.status === 'in_progress')) {
      atPickupZoneAnnouncedRef.current = false;
      setShowColisRecupereButton(false);
    }
  }, [isInZone, currentOrder?.status]);

  // Réinitialiser quand le livreur sort de la zone dropoff (pour réafficher le bouton s'il revient)
  useEffect(() => {
    if (!isInZone && (currentOrder?.status === 'picked_up' || currentOrder?.status === 'delivering')) {
      atDropoffZoneAnnouncedRef.current = false;
      setShowLivraisonEffectueeButton(false);
    }
  }, [isInZone, currentOrder?.status]);

  useEffect(() => {
    if (!currentOrder?.id) {
      hasValidatedViaMapboxRef.current.clear();
      lastEtaAnnouncedMinRef.current = 99;
      atPickupZoneAnnouncedRef.current = false;
      atDropoffZoneAnnouncedRef.current = false;
      setShowColisRecupereButton(false);
      setShowLivraisonEffectueeButton(false);
      setLastEtaMinutes(null);
    }
  }, [currentOrder?.id]);

  // Masquer le bouton Colis récupéré quand on passe à picked_up
  useEffect(() => {
    if (currentOrder?.status === 'picked_up' || currentOrder?.status === 'delivering') {
      setShowColisRecupereButton(false);
      atPickupZoneAnnouncedRef.current = false;
    }
  }, [currentOrder?.status]);

  const handleLivraisonEffectuee = useCallback(() => {
    if (!currentOrder || !location) return;
    setShowLivraisonEffectueeButton(false);
    atDropoffZoneAnnouncedRef.current = true;
    hasValidatedViaMapboxRef.current.add(currentOrder.id);
    orderSocketService.updateDeliveryStatus(currentOrder.id, 'completed', location);
    speakWithMapboxMuted('Vous êtes arrivés à destination.');
    setNavigationCompletedOrder(currentOrder);
  }, [currentOrder, location, speakWithMapboxMuted]);

  // Annonces pré-arrivée : "Arrivée à destination dans X minutes" (3, 2, 1 min)
  // Stocke aussi lastEtaMinutes pour la barre "Reprendre la navigation"
  const handleRouteProgressChange = useCallback((event: { nativeEvent?: { durationRemaining?: number }; durationRemaining?: number }) => {
    const durationRemaining = event?.nativeEvent?.durationRemaining ?? event?.durationRemaining;
    if (durationRemaining != null && durationRemaining > 0) {
      setLastEtaMinutes(Math.ceil(durationRemaining / 60));
    }

    const status = String(currentOrder?.status || '');
    if (status !== 'picked_up' && status !== 'delivering') return;
    if (durationRemaining == null || durationRemaining <= 0) return;

    const minsRemaining = Math.ceil(durationRemaining / 60);
    const last = lastEtaAnnouncedMinRef.current;

    if (minsRemaining <= 3 && last > 3) {
      lastEtaAnnouncedMinRef.current = 3;
      speakWithMapboxMuted('Arrivée à destination dans 3 minutes.');
    } else if (minsRemaining <= 2 && last > 2) {
      lastEtaAnnouncedMinRef.current = 2;
      speakWithMapboxMuted('Arrivée à destination dans 2 minutes.');
    } else if (minsRemaining <= 1 && last > 1) {
      lastEtaAnnouncedMinRef.current = 1;
      speakWithMapboxMuted('Arrivée à destination dans 1 minute.');
    }
  }, [currentOrder?.status, speakWithMapboxMuted]);

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
    mapRef,
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

  const handleColisRecupere = useCallback(() => {
    if (!currentOrder || !location) return;
    setShowColisRecupereButton(false);
    atPickupZoneAnnouncedRef.current = false;
    orderSocketService.updateDeliveryStatus(currentOrder.id, 'picked_up', location);
    speakWithMapboxMuted('Colis pris en charge. Nous pouvons entamer la course.');
  }, [currentOrder, location, speakWithMapboxMuted]);

  const handleAcceptOrder = (orderId: string) => {
    // Mise à jour optimiste : afficher la commande et ouvrir la navigation immédiatement
    useOrderStore.getState().acceptOrder(orderId, user?.id || '');
    orderSocketService.acceptOrder(orderId);
    // Annonce vocale dès l'acceptation
    speakWithMapboxMuted('Course acceptée, en route pour récupérer le colis.');
    setIsNavigationActive(true);
    // Émettre immédiatement la position pour que le client voie la route dès l'acceptation
    if (location) {
      orderSocketService.emitDriverLocation(orderId, location);
    }
  };

  const handleDeclineOrder = (orderId: string) => {
    orderSocketService.declineOrder(orderId);
  };

  const isTogglingRef = useRef(false);
  
  const handleToggleOnline = async (value: boolean) => {
    if (isTogglingRef.current) {
      if (__DEV__) {
        logger.debug('Toggle déjà en cours, ignoré');
      }
      return;
    }
    
    if (value === isOnline) {
      if (__DEV__) {
        logger.debug('Statut déjà à', undefined, { value, isOnline });
      }
      return;
    }
    
    if (value && error) {
      Alert.alert(
        "Erreur de localisation", 
        "Impossible de vous mettre en ligne sans accès à votre localisation.",
        [{ text: "Fermer" }]
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
            logger.warn('Échec synchronisation:', result.message);
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
              [{ text: "Fermer" }]
            );
          }
        } else {
          sessionExpiredRef.current = false;
        }
      }).catch((error) => {
        isTogglingRef.current = false;
        
        if (__DEV__) {
          logger.error('Erreur updateDriverStatus:', error);
        }
        
        // Rollback en cas d'erreur
        setOnlineStatus(!value);
        
        // Ne pas afficher d'erreur si c'est une session expirée (déjà géré par logout)
        const errorMessage = error instanceof Error ? error.message : '';
        if (!errorMessage.includes('Session expirée')) {
          Alert.alert(
            "Erreur",
            "Impossible de synchroniser votre statut avec le serveur.",
            [{ text: "Fermer" }]
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

          if (!result.success && result.message?.includes('Session expirée')) {
            sessionExpiredRef.current = true;
            if (__DEV__) {
              logger.debug('Session expirée - arrêt de la synchronisation automatique de la position');
            }
            return;
          }

          if (result.success) {
            sessionExpiredRef.current = false;
          }
        } catch (error) {
          if (__DEV__) {
            logger.debug('Erreur sync position:', undefined, error);
          }
        }
      }
    };

    const timeoutId = setTimeout(syncLocation, 5000);
    const heartbeatInterval = setInterval(syncLocation, 2 * 60 * 1000); // Heartbeat toutes les 2 min pour rester dans la liste
    return () => {
      clearTimeout(timeoutId);
      clearInterval(heartbeatInterval);
    };
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
    const isTransitioningToAccepted =
      status === 'accepted' && lastStatus !== status && lastStatus !== 'accepted';
    const isTransitioningToPickedUp =
      (status === 'picked_up' || status === 'delivering') &&
      lastStatus !== status &&
      lastStatus !== 'picked_up' &&
      lastStatus !== 'delivering';

    lastOrderStatusRef.current = status;
    if (currentOrder && (isTransitioningToAccepted || isTransitioningToPickedUp) && !userClosedBottomSheetRef.current) {
      userClosedBottomSheetRef.current = false;
      setTimeout(() => {
        expandOrderBottomSheet();
      }, isTransitioningToAccepted ? 300 : 500);
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
          logger.debug('[Index] Pas de user.id ou utilisateur non authentifié pour charger les stats');
        }
        return;
      }

      try {
        const todayResult = await apiService.getTodayStats(user.id);
        
        if (todayResult.success && todayResult.data) {
          if (__DEV__) {
            logger.debug('[Index] getTodayStats réussi:', undefined, {
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
            logger.warn('[Index] getTodayStats échoué ou pas de données');
          }
        }
        const statsResult = await apiService.getDriverStatistics(user.id);
        
        if (statsResult.success && statsResult.data) {
          if (__DEV__) {
            logger.debug('[Index] getDriverStatistics réussi:', undefined, {
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
            logger.warn('[Index] getDriverStatistics échoué ou pas de données');
          }
        }
      } catch (err) {
        if (__DEV__) {
          logger.error('[Index] Erreur chargement stats:', undefined, err);
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

  const orderFullRouteCoords =
    currentPickupCoord && currentDropoffCoord
      ? orderFullRoute.routeCoordinates.length > 0
        ? orderFullRoute.routeCoordinates
        : [currentPickupCoord, currentDropoffCoord]
      : [];

  const animatedRouteCoords =
    isOnline && location && currentOrder && animatedRoute.animatedCoordinates.length > 0
      ? [animatedDriverPosition || location, ...animatedRoute.animatedCoordinates.slice(1)]
      : [];

  return (
    <View style={styles.container}>
      <DriverMapView
        mapRef={mapRef}
        location={location}
        animatedDriverPosition={animatedDriverPosition || null}
        animatedRouteCoords={animatedRouteCoords}
        orderFullRouteCoords={orderFullRouteCoords}
        currentPickupCoord={currentPickupCoord}
        currentDropoffCoord={currentDropoffCoord}
        activeOrders={activeOrders}
        pendingOrders={pendingOrders}
        resolveCoords={resolveCoords}
        calculateDistanceToPickup={calculateDistanceToPickup as (order: unknown) => number | null}
        setSelectedOrder={(orderId) => {
          setSelectedOrder(orderId);
          logger.info('Commande sélectionnée depuis marqueur', 'driver-index', { orderId });
        }}
        isOnline={!!isOnline}
      />

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

      {/* Menu Carte/Liste : uniquement quand il y a des commandes actives (évite apparition confuse après fin de course) */}
      {activeOrders.length > 0 && (
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
      )}

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
            if (status === 'completed') {
              speakAnnouncement('Vous êtes arrivés à destination.');
            }
            if (status === 'picked_up') {
              const dropoffCoord = resolveCoords(currentOrder.dropoff);
              await orderSocketService.updateDeliveryStatus(currentOrder.id, status, location);
              if (location && dropoffCoord) {
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
          onStartNavigation={
            currentOrder && location && destination
              ? () => setIsNavigationActive(true)
              : undefined
          }
          onCancelOrder={() => {
            setIsNavigationActive(false);
            orderSocketService.updateDeliveryStatus(currentOrder.id, 'cancelled', location);
          }}
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

      {/* Navigation intégrée Mapbox (style Yango) - full screen */}
      {/* Reste affichée après livraison (navDisplayOrder) jusqu'à fermeture manuelle par le livreur */}
      {/* En mode minimisé : Mapbox reste monté (opacity 0) pour garder ETA et annonces, carte visible */}
      {isNavigationActive && navDisplayOrder && (location || navOrigin) && effectiveNavDestination && (
        <>
          <View
            style={[
              StyleSheet.absoluteFill,
              {
                opacity: isNavigationMinimized ? 0 : 1,
                pointerEvents: isNavigationMinimized ? 'none' : 'auto',
              },
            ]}
          >
            {/* Phase 2 : unmount/remount pour éviter navigation figée pickup→dropoff */}
            {((currentOrder?.status === 'accepted' || currentOrder?.status === 'enroute' || currentOrder?.status === 'in_progress') || mapboxMountedForDropoff) && (
            <MapboxNavigationScreen
              key={`nav-${currentOrder?.status}-${mapboxMountedForDropoff}-${effectiveNavDestination.latitude}-${effectiveNavDestination.longitude}`}
              origin={navOrigin || location!}
              destination={effectiveNavDestination}
              mute={mapboxVoiceMuted}
              onBackPress={
                navigationCompletedOrder
                  ? () => {
                      setShowRecalcOverlay(false);
                      setNavigationCompletedOrder(null);
                      setIsNavigationActive(false);
                      setIsNavigationMinimized(false);
                      setShowColisRecupereButton(false);
                      setShowLivraisonEffectueeButton(false);
                      setLastEtaMinutes(null);
                      atPickupZoneAnnouncedRef.current = false;
                      atDropoffZoneAnnouncedRef.current = false;
                    }
                  : () => setIsNavigationMinimized(true)
              }
          onArrive={() => {
            const order = navDisplayOrder;
            if (!order) return;
            const status = String(order.status || '');
            // Phase 1 : arrivée au point de collecte → annonce + bouton "Colis récupéré" (pas de validation auto)
            if (status === 'accepted' || status === 'enroute' || status === 'in_progress') {
              if (atPickupZoneAnnouncedRef.current) return;
              atPickupZoneAnnouncedRef.current = true;
              setShowColisRecupereButton(true);
              speakWithMapboxMuted('Vous êtes arrivés au point de collecte de colis.');
            }
            // Phase 2 : arrivée à la destination de livraison → afficher bouton "Livraison effectuée"
            // Le livreur clique pour confirmer (comme "Colis récupéré" au pickup)
            else if (status === 'picked_up' || status === 'delivering') {
              if (atDropoffZoneAnnouncedRef.current) return;
              atDropoffZoneAnnouncedRef.current = true;
              setShowLivraisonEffectueeButton(true);
              speakWithMapboxMuted('Vous êtes arrivés à destination.');
            }
          }}
          showColisRecupereButton={showColisRecupereButton}
          onColisRecupere={handleColisRecupere}
          showLivraisonEffectueeButton={showLivraisonEffectueeButton}
          onLivraisonEffectuee={handleLivraisonEffectuee}
          onCancel={() => {
            setShowRecalcOverlay(false);
            setNavigationCompletedOrder(null);
            setIsNavigationActive(false);
            setIsNavigationMinimized(false);
            setShowColisRecupereButton(false);
            setShowLivraisonEffectueeButton(false);
            setLastEtaMinutes(null);
            atPickupZoneAnnouncedRef.current = false;
            atDropoffZoneAnnouncedRef.current = false;
          }}
          onRouteProgressChange={handleRouteProgressChange}
          onMessagePress={() => setShowMessageBottomSheet(true)}
          onSettingsPress={() => {
            // Paramètres navigation - pourrait ouvrir un modal
          }}
        />
            )}
          {/* Overlay "Recalcul..." pendant transition pickup→dropoff (masque latence chargement) */}
          {showRecalcOverlay && (
            <View style={styles.recalcOverlay} pointerEvents="none">
              <ActivityIndicator size="large" color="#fff" />
              <Text style={styles.recalcOverlayText}>Recalcul de l&apos;itinéraire vers la livraison...</Text>
            </View>
          )}
        </View>

        {/* Barre "Reprendre la navigation" + boutons Colis/Livraison quand minimisé */}
        {isNavigationMinimized && (
          <>
            {showColisRecupereButton && (
              <TouchableOpacity
                style={[styles.reprendreNavBar, { bottom: 180 }]}
                onPress={handleColisRecupere}
                activeOpacity={0.8}
              >
                <Ionicons name="cube" size={24} color="#fff" />
                <Text style={styles.reprendreNavText}>Colis récupéré</Text>
              </TouchableOpacity>
            )}
            {showLivraisonEffectueeButton && (
              <TouchableOpacity
                style={[styles.reprendreNavBar, { bottom: 180, backgroundColor: '#16A34A' }]}
                onPress={handleLivraisonEffectuee}
                activeOpacity={0.8}
              >
                <Ionicons name="checkmark-circle" size={24} color="#fff" />
                <Text style={styles.reprendreNavText}>Livraison effectuée</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.reprendreNavBar}
              onPress={() => setIsNavigationMinimized(false)}
              activeOpacity={0.8}
            >
              <Ionicons name="navigate" size={24} color="#fff" />
              <Text style={styles.reprendreNavText}>Reprendre la navigation</Text>
              {lastEtaMinutes != null && (
                <Text style={styles.reprendreNavEta}>{lastEtaMinutes} min</Text>
              )}
            </TouchableOpacity>
          </>
        )}
        </>
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
  recalcOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  recalcOverlayText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 16,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  reprendreNavBar: {
    position: 'absolute',
    bottom: 100,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: '#8B5CF6',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 16,
    zIndex: 2000,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  reprendreNavText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  reprendreNavEta: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 15,
    fontWeight: '600',
  },
});
