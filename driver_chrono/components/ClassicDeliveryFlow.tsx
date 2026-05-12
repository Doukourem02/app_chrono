import "../mapboxInit";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { View, StyleSheet, TouchableOpacity, Text, ActivityIndicator, InteractionManager } from "react-native";
import type { MapRefHandle } from "../hooks/useMapCamera";
import { DriverMapView } from "./DriverMapView";
import { Ionicons } from "@expo/vector-icons";
import { OrdersListBottomSheet } from "./OrdersListBottomSheet";
import DriverOrderBottomSheet from "./DriverOrderBottomSheet";
import { useBottomSheet } from "../hooks/useBottomSheet";
import { useOrdersListBottomSheet } from "../hooks/useOrdersListBottomSheet";
import { useMessageBottomSheet } from "../hooks/useMessageBottomSheet";
import { useDriverStore } from "../store/useDriverStore";
import { useOrderStore } from "../store/useOrderStore";
import { useBatchStore } from "../store/useBatchStore";
import { useUIStore } from "../store/useUIStore";
import { orderSocketService } from "../services/orderSocketService";
import { logger } from '../utils/logger';
import { useMapCamera } from '../hooks/useMapCamera';
import { useAnimatedRoute } from '../hooks/useAnimatedRoute';
import { useAnimatedPosition } from '../hooks/useAnimatedPosition';
import { useGeofencing } from '../hooks/useGeofencing';
import MessageBottomSheet from "./MessageBottomSheet";
import { MapboxNavigationScreen } from "./MapboxNavigationScreen";
import { formatUserName } from '../utils/formatName';
import { speakAnnouncement } from '../utils/speechAnnouncement';
import { logNavigationEvent } from '../utils/navigationTelemetry';
import { getSafetyReminderForVehicleType } from '../constants/driverVehicle';
import { OrderRequestPopup } from "./OrderRequestPopup";

type Coords = { latitude: number; longitude: number };
type NavigationPhase = 'pickup' | 'dropoff';
type NavigationSession = {
  orderId: string;
  phase: NavigationPhase;
  origin: Coords;
  destination: Coords;
};

const navigationPhaseForStatus = (status?: string | null): NavigationPhase | null => {
  const normalized = String(status || '');
  if (normalized === 'accepted' || normalized === 'enroute' || normalized === 'in_progress') return 'pickup';
  if (normalized === 'picked_up' || normalized === 'delivering') return 'dropoff';
  return null;
};

const sameCoords = (a: Coords | null | undefined, b: Coords | null | undefined) =>
  !!a && !!b &&
  Math.abs(a.latitude - b.latitude) < 0.000001 &&
  Math.abs(a.longitude - b.longitude) < 0.000001;

interface Props {
  location: Coords | null;
  rawGpsLocation: { latitude: number; longitude: number; heading?: number } | null;
  isOnline: boolean;
}

export default function ClassicDeliveryFlow({ location, rawGpsLocation, isOnline }: Props) {
  const { setHideTabBar } = useUIStore();
  const user = useDriverStore((s) => s.user);

  const pendingOrders = useOrderStore((s) => s.pendingOrders);
  const activeOrders = useOrderStore((s) => s.activeOrders);
  const selectedOrderId = useOrderStore((s) => s.selectedOrderId);
  const setSelectedOrder = useOrderStore((s) => s.setSelectedOrder);

  const pendingOrder = pendingOrders.length > 0 ? pendingOrders[0] : null;

  const mapRef = useRef<MapRefHandle | null>(null);

  const resolveCoords = useCallback((candidate?: any) => {
    if (!candidate) return null;
    const c = candidate.coordinates || candidate.coords || candidate.location || candidate;
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
  }, []);

  const calculateDistanceToPickup = useCallback((order: typeof activeOrders[0]): number | null => {
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
    return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
  }, [location, resolveCoords]);

  const sortedActiveOrdersByDistance = React.useMemo(() => {
    const nonBatchOrders = activeOrders.filter(o => !o.batch_id);
    if (!location || nonBatchOrders.length === 0) return nonBatchOrders;
    return [...nonBatchOrders].sort((a, b) => {
      const distA = calculateDistanceToPickup(a);
      const distB = calculateDistanceToPickup(b);
      if (distA === null && distB === null) return 0;
      if (distA === null) return 1;
      if (distB === null) return -1;
      return distA - distB;
    });
  }, [activeOrders, location, calculateDistanceToPickup]);

  // Sélection automatique de la commande la plus prioritaire
  useEffect(() => {
    const store = useOrderStore.getState();
    if (store.selectedOrderId) {
      const selectedOrderExists = store.activeOrders.some(o => o.id === store.selectedOrderId);
      if (selectedOrderExists) return;
    }
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
    if (priorityOrder) { store.setSelectedOrder(priorityOrder.id); return; }
    const firstOrder = store.activeOrders[0];
    if (firstOrder) store.setSelectedOrder(firstOrder.id);
  }, [activeOrders, sortedActiveOrdersByDistance, location]);

  const currentOrder = useOrderStore((s) => {
    const validActiveOrders = s.activeOrders.filter(o =>
      o.status !== 'completed' && o.status !== 'cancelled' && o.status !== 'declined' && !o.batch_id
    );
    if (s.selectedOrderId) {
      const selected = validActiveOrders.find(o => o.id === s.selectedOrderId);
      return selected || null;
    }
    return validActiveOrders[0] || null;
  });

  // Nettoyer selectedOrderId quand il pointe vers une commande invalide
  useEffect(() => {
    const store = useOrderStore.getState();
    if (!store.selectedOrderId) return;
    const validActive = store.activeOrders.filter(o =>
      o.status !== 'completed' && o.status !== 'cancelled' && o.status !== 'declined' && !o.batch_id
    );
    if (!validActive.find(o => o.id === store.selectedOrderId)) {
      store.setSelectedOrder(null);
    }
  }, [activeOrders]);

  // Suivi temps réel : envoyer position au client (throttle 3s + distance filter 15m)
  const lastEmitRef = useRef<{ lat: number; lng: number; ts: number } | null>(null);
  const latestNavigationProgressRef = useRef<{
    orderId: string;
    phase: 'pickup' | 'dropoff';
    durationRemainingSec: number;
    distanceRemainingM?: number;
    ts: number;
  } | null>(null);

  useEffect(() => {
    const status = String(currentOrder?.status || '');
    const needsTracking = ['accepted', 'enroute', 'picked_up', 'delivering', 'in_progress'].includes(status);
    if (!currentOrder?.id || !location || !needsTracking) return;

    const distMeters = (a: Coords, b: Coords) => {
      const R = 6371000;
      const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
      const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
      const x = Math.sin(dLat / 2) ** 2 + Math.cos((a.latitude * Math.PI) / 180) * Math.cos((b.latitude * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
      return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
    };

    const maybeEmit = () => {
      const now = Date.now();
      const last = lastEmitRef.current;
      const shouldEmit = !last || now - last.ts >= 3000 || distMeters(location, { latitude: last.lat, longitude: last.lng }) >= 15;
      if (shouldEmit) {
        const currentPhase =
          status === 'accepted' || status === 'enroute' || status === 'in_progress' ? 'pickup'
          : status === 'picked_up' || status === 'delivering' ? 'dropoff' : null;
        const navProgress =
          latestNavigationProgressRef.current?.orderId === currentOrder.id &&
          latestNavigationProgressRef.current.phase === currentPhase &&
          now - latestNavigationProgressRef.current.ts <= 10_000
            ? latestNavigationProgressRef.current : null;
        orderSocketService.emitDriverLocation(currentOrder.id, {
          latitude: location.latitude,
          longitude: location.longitude,
          ...(rawGpsLocation?.heading != null ? { heading: rawGpsLocation.heading } : {}),
          ...(navProgress ? {
            navigationDurationRemainingSec: navProgress.durationRemainingSec,
            navigationDistanceRemainingM: navProgress.distanceRemainingM,
          } : {}),
        });
        lastEmitRef.current = { lat: location.latitude, lng: location.longitude, ts: now };
      }
    };

    maybeEmit();
    const iv = setInterval(maybeEmit, 3000);
    return () => clearInterval(iv);
  }, [currentOrder?.id, currentOrder?.status, location, rawGpsLocation?.heading]);

  // Bottom sheets
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
  const [isNavigationMinimized, setIsNavigationMinimized] = useState(false);
  const [lastEtaMinutes, setLastEtaMinutes] = useState<number | null>(null);
  const [showRecalcOverlay, setShowRecalcOverlay] = useState(false);
  const [phase1MountReady, setPhase1MountReady] = useState(false);
  const [navStuckSince, setNavStuckSince] = useState<number | null>(null);
  const [showNavStuckEscape, setShowNavStuckEscape] = useState(false);
  const [navigationCompletedOrder, setNavigationCompletedOrder] = useState<typeof currentOrder | null>(null);
  const [navigationSession, setNavigationSession] = useState<NavigationSession | null>(null);
  const [mapboxVoiceMuted, setMapboxVoiceMuted] = useState(false);
  const [showColisRecupereButton, setShowColisRecupereButton] = useState(false);
  const [showLivraisonEffectueeButton, setShowLivraisonEffectueeButton] = useState(false);

  const userClosedBottomSheetRef = useRef(false);
  const lastOrderStatusRef = useRef<string | null>(null);
  const lastAutoNavStatusRef = useRef<string | null>(null);
  const lastAutoNavKeyRef = useRef<string | null>(null);
  const suppressedAutoNavKeysRef = useRef<Set<string>>(new Set());
  const hasValidatedViaMapboxRef = useRef<Set<string>>(new Set());
  const lastEtaAnnouncedMinRef = useRef<number>(99);
  const atPickupZoneAnnouncedRef = useRef(false);
  const atDropoffZoneAnnouncedRef = useRef(false);
  const spokenDropoffArrivalRef = useRef(false);

  const speakWithMapboxMuted = useCallback((text: string, onDone?: () => void) => {
    setMapboxVoiceMuted(true);
    speakAnnouncement(text, {
      onDone: () => {
        setMapboxVoiceMuted(false);
        onDone?.();
      },
    });
  }, []);

  const colisRecupereLabel = React.useMemo(() => {
    const pickupPhaseOrders = activeOrders.filter(o =>
      !o.batch_id &&
      (o.status === 'accepted' || o.status === 'enroute' || o.status === 'in_progress')
    );
    return pickupPhaseOrders.length > 1 ? 'Tous les colis récupérés' : 'Colis récupéré';
  }, [activeOrders]);

  const currentPickupCoord = React.useMemo(
    () => currentOrder ? resolveCoords(currentOrder.pickup) : null,
    [currentOrder, resolveCoords]
  );
  const currentDropoffCoord = React.useMemo(
    () => currentOrder ? resolveCoords(currentOrder.dropoff) : null,
    [currentOrder, resolveCoords]
  );
  const currentNavigationPhase = navigationPhaseForStatus(currentOrder?.status);
  const currentAutoNavKey =
    currentOrder?.id && currentNavigationPhase
      ? `${currentOrder.id}:${currentNavigationPhase}` : null;
  const destination = React.useMemo(
    () =>
      currentNavigationPhase === 'pickup' ? currentPickupCoord
      : currentNavigationPhase === 'dropoff' ? currentDropoffCoord
      : null,
    [currentDropoffCoord, currentNavigationPhase, currentPickupCoord]
  );
  const navDisplayOrder = currentOrder || navigationCompletedOrder;
  const navDestination = destination || (navigationCompletedOrder ? resolveCoords(navigationCompletedOrder.dropoff) : null);
  const effectiveNavDestination = navigationSession?.destination ?? navDestination;
  const navOrigin = navigationSession?.origin ?? location;

  const resetNavigationUi = useCallback((suppressAutoRestart = false) => {
    if (suppressAutoRestart) {
      setNavigationSession((prev) => {
        if (prev) suppressedAutoNavKeysRef.current.add(`${prev.orderId}:${prev.phase}`);
        return null;
      });
    } else {
      setNavigationSession(null);
    }
    setShowRecalcOverlay(false);
    setPhase1MountReady(false);
    setNavigationCompletedOrder(null);
    setIsNavigationActive(false);
    setIsNavigationMinimized(false);
    setShowColisRecupereButton(false);
    setShowLivraisonEffectueeButton(false);
    setLastEtaMinutes(null);
    atPickupZoneAnnouncedRef.current = false;
    atDropoffZoneAnnouncedRef.current = false;
    spokenDropoffArrivalRef.current = false;
  }, []);

  const openNavigationManually = useCallback(() => {
    if (currentAutoNavKey) suppressedAutoNavKeysRef.current.delete(currentAutoNavKey);
    if (currentNavigationPhase === 'pickup') setPhase1MountReady(true);
    setIsNavigationMinimized(false);
    setIsNavigationActive(true);
  }, [currentAutoNavKey, currentNavigationPhase]);

  const handleOpenMessage = () => {
    if (!currentOrder?.user?.id) return;
    setShowMessageBottomSheet(true);
    setHideTabBar(true);
    setTimeout(() => expandMessageBottomSheet(), 300);
  };

  const handleCloseMessage = () => {
    collapseMessageBottomSheet();
    setHideTabBar(false);
    setTimeout(() => setShowMessageBottomSheet(false), 300);
  };

  // Session de navigation
  useEffect(() => {
    if (!currentOrder?.id || !currentNavigationPhase || !destination) {
      if (!navigationCompletedOrder) setNavigationSession(null);
      return;
    }
    const defaultOrigin =
      currentNavigationPhase === 'dropoff' ? currentPickupCoord ?? location : location;
    if (!defaultOrigin) return;

    setNavigationSession((previous) => {
      const sameLeg = previous?.orderId === currentOrder.id && previous.phase === currentNavigationPhase;
      if (sameLeg && sameCoords(previous.destination, destination)) return previous;
      return {
        orderId: currentOrder.id,
        phase: currentNavigationPhase,
        origin: sameLeg ? previous.origin : defaultOrigin,
        destination,
      };
    });
  }, [currentOrder?.id, currentNavigationPhase, currentPickupCoord, destination, location, navigationCompletedOrder]);

  // Cacher la tab bar quand la navigation full-screen est active
  useEffect(() => {
    setHideTabBar(isNavigationActive);
  }, [isNavigationActive, setHideTabBar]);

  // Auto-démarrage navigation
  useEffect(() => {
    if (!currentOrder) {
      lastAutoNavStatusRef.current = null;
      lastAutoNavKeyRef.current = null;
      return;
    }
    if (currentOrder.batch_id) return;
    // Guard : si un batch est actif, bloquer toute navigation classique
    if (useBatchStore.getState().activeBatch) return;
    if (!location || !destination) return;

    const status = String(currentOrder.status || '');
    const prevStatus = lastAutoNavStatusRef.current;
    lastAutoNavStatusRef.current = status;
    const autoNavKey = currentAutoNavKey;
    const isAutoRestartSuppressed = !!autoNavKey && suppressedAutoNavKeysRef.current.has(autoNavKey);
    const hasAutoStartedThisLeg = !!autoNavKey && lastAutoNavKeyRef.current === autoNavKey;

    let phase1FallbackId: ReturnType<typeof setTimeout> | null = null;

    // Phase 1 : vers le point de collecte
    if (autoNavKey && !isAutoRestartSuppressed && !hasAutoStartedThisLeg && status === 'accepted' && prevStatus !== 'accepted') {
      lastAutoNavKeyRef.current = autoNavKey;
      logger.info('Auto-démarrage navigation phase 1 (point de collecte)', 'driver-index');
      logNavigationEvent('nav_phase_pickup_start', { orderId: currentOrder.id, status });
      setPhase1MountReady(false);
      setIsNavigationActive(true);
      InteractionManager.runAfterInteractions(() => {
        setTimeout(() => setPhase1MountReady(true), 400);
      });
      phase1FallbackId = setTimeout(() => setPhase1MountReady(true), 2000);
      if (location) {
        setTimeout(() => {
          orderSocketService.updateDeliveryStatus(currentOrder.id, 'enroute', location);
        }, 600);
      }
    }

    // Phase 2 : vers la livraison
    if (
      autoNavKey && !isAutoRestartSuppressed && !hasAutoStartedThisLeg &&
      (status === 'picked_up' || status === 'delivering') &&
      (prevStatus === 'enroute' || prevStatus === 'in_progress')
    ) {
      lastAutoNavKeyRef.current = autoNavKey;
      logger.info('Auto-démarrage navigation phase 2 (adresse de livraison)', 'driver-index');
      logNavigationEvent('nav_phase_dropoff_reroute', { orderId: currentOrder.id, status, previousStatus: prevStatus });
      lastEtaAnnouncedMinRef.current = 99;
      setShowRecalcOverlay(true);
      setIsNavigationMinimized(false);
      setIsNavigationActive(true);
      if (status === 'picked_up' && location) {
        setTimeout(() => {
          orderSocketService.updateDeliveryStatus(currentOrder.id, 'delivering', location);
        }, 400);
      }
    }
    return () => { if (phase1FallbackId) clearTimeout(phase1FallbackId); };
  }, [currentOrder?.id, currentOrder?.status, currentOrder, location, destination, currentAutoNavKey]);

  // Masquer l'overlay "Recalcul..." après 5s
  useEffect(() => {
    if (!showRecalcOverlay) return;
    const t = setTimeout(() => setShowRecalcOverlay(false), 5000);
    return () => clearTimeout(t);
  }, [showRecalcOverlay]);

  useEffect(() => {
    if (!currentOrder?.id && !isNavigationActive) setPhase1MountReady(false);
  }, [currentOrder?.id, isNavigationActive]);

  useEffect(() => {
    if (isNavigationActive && !phase1MountReady) setNavStuckSince(Date.now());
    else { setNavStuckSince(null); setShowNavStuckEscape(false); }
  }, [isNavigationActive, phase1MountReady]);

  useEffect(() => {
    if (!navStuckSince) return;
    const t = setTimeout(() => setShowNavStuckEscape(true), 4000);
    return () => clearTimeout(t);
  }, [navStuckSince]);

  // Géofencing classique — indépendant du batch
  const shouldEnableGeofencing =
    isOnline &&
    !!currentOrder &&
    !!destination &&
    !!location &&
    currentOrder.status !== 'accepted';

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
    },
    onEnteredDropoffZone: () => {
      if (!atDropoffZoneAnnouncedRef.current) {
        atDropoffZoneAnnouncedRef.current = true;
        setShowLivraisonEffectueeButton(true);
      }
      if (!spokenDropoffArrivalRef.current) {
        spokenDropoffArrivalRef.current = true;
        speakWithMapboxMuted('Vous êtes arrivés à destination.');
      }
    },
  });

  // Réinitialiser quand le livreur sort de la zone pickup
  useEffect(() => {
    if (!isInZone && (currentOrder?.status === 'enroute' || currentOrder?.status === 'in_progress')) {
      atPickupZoneAnnouncedRef.current = false;
      setShowColisRecupereButton(false);
    }
  }, [isInZone, currentOrder?.status]);

  // Réinitialiser quand le livreur sort de la zone dropoff
  useEffect(() => {
    if (!isInZone && (currentOrder?.status === 'picked_up' || currentOrder?.status === 'delivering')) {
      atDropoffZoneAnnouncedRef.current = false;
      spokenDropoffArrivalRef.current = false;
      setShowLivraisonEffectueeButton(false);
    }
  }, [isInZone, currentOrder?.status]);

  useEffect(() => {
    latestNavigationProgressRef.current = null;
    if (!currentOrder?.id) {
      hasValidatedViaMapboxRef.current.clear();
      lastEtaAnnouncedMinRef.current = 99;
      atPickupZoneAnnouncedRef.current = false;
      atDropoffZoneAnnouncedRef.current = false;
      spokenDropoffArrivalRef.current = false;
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
    setNavigationCompletedOrder(currentOrder);
  }, [currentOrder, location]);

  const handleRouteProgressChange = useCallback(
    (event: {
      nativeEvent?: { durationRemaining?: number; distanceRemaining?: number };
      durationRemaining?: number;
      distanceRemaining?: number;
    }) => {
      const durationRemaining = event?.nativeEvent?.durationRemaining ?? event?.durationRemaining;
      const distanceRemaining = event?.nativeEvent?.distanceRemaining ?? event?.distanceRemaining;
      const status = String(currentOrder?.status || '');

      if (durationRemaining != null && durationRemaining > 0) {
        if (currentOrder?.id) {
          const phase =
            status === 'accepted' || status === 'enroute' || status === 'in_progress' ? 'pickup'
            : status === 'picked_up' || status === 'delivering' ? 'dropoff' : null;
          latestNavigationProgressRef.current = {
            orderId: currentOrder.id,
            phase: phase ?? 'dropoff',
            durationRemainingSec: durationRemaining,
            ...(distanceRemaining != null && distanceRemaining >= 0 ? { distanceRemainingM: distanceRemaining } : {}),
            ts: Date.now(),
          };
        }
        setLastEtaMinutes(Math.ceil(durationRemaining / 60));
      }

      if (status !== 'picked_up' && status !== 'delivering') return;
      if (durationRemaining == null || durationRemaining <= 0) return;

      const minsRemaining = Math.ceil(durationRemaining / 60);
      const last = lastEtaAnnouncedMinRef.current;
      if (minsRemaining <= 2 && last > 2) {
        lastEtaAnnouncedMinRef.current = 2;
        speakWithMapboxMuted('Arrivée à destination dans environ deux minutes.');
      } else if (minsRemaining <= 1 && last > 1) {
        lastEtaAnnouncedMinRef.current = 1;
        speakWithMapboxMuted('Arrivée à destination dans environ une minute.');
      }
    },
    [currentOrder?.id, currentOrder?.status, speakWithMapboxMuted]
  );

  const animatedRoute = useAnimatedRoute({
    origin: location,
    destination,
    enabled: isOnline && !!currentOrder && !!destination && !!location,
  });

  const orderFullRoute = useAnimatedRoute({
    origin: currentPickupCoord,
    destination: currentDropoffCoord,
    enabled: !!currentOrder && !!currentPickupCoord && !!currentDropoffCoord,
  });

  const previousLocationRef = useRef<Coords | null>(null);
  const animatedDriverPosition = useAnimatedPosition({
    currentPosition: location,
    previousPosition: previousLocationRef.current,
    animationDuration: 5000,
  });

  useEffect(() => {
    if (location) previousLocationRef.current = location;
  }, [location]);

  const polyPulseIntervalRef = useRef<number | null>(null);
  const animationTimeoutsRef = useRef<number[]>([]);
  useEffect(() => {
    return () => {
      if (polyPulseIntervalRef.current) clearInterval(polyPulseIntervalRef.current);
      animationTimeoutsRef.current.forEach(id => clearTimeout(id));
    };
  }, []);

  const { fitToRoute, centerOnDriver } = useMapCamera(
    mapRef,
    location,
    animatedRoute.routeCoordinates.length > 0 ? { coordinates: animatedRoute.routeCoordinates } : null,
    currentOrder,
    isOnline
  );

  useEffect(() => {
    if (currentOrder && location) {
      const pickupCoord = resolveCoords(currentOrder.pickup);
      const dropoffCoord = resolveCoords(currentOrder.dropoff);
      const status = String(currentOrder.status || '');
      let targetCoord = null;
      if ((status === 'accepted' || status === 'enroute' || status === 'in_progress') && pickupCoord) targetCoord = pickupCoord;
      else if ((status === 'picked_up' || status === 'delivering') && dropoffCoord) targetCoord = dropoffCoord;
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
  }, [selectedOrderId, currentOrder?.id, currentOrder, location, resolveCoords]);

  const handleColisRecupere = useCallback(() => {
    if (!location) return;
    const ordersToPickup = activeOrders.filter(o =>
      !o.batch_id &&
      (o.status === 'accepted' || o.status === 'enroute' || o.status === 'in_progress')
    );
    if (ordersToPickup.length === 0) return;
    setShowColisRecupereButton(false);
    atPickupZoneAnnouncedRef.current = false;
    ordersToPickup.forEach(order => {
      orderSocketService.updateDeliveryStatus(order.id, 'picked_up', location);
    });
    const isGrouped = ordersToPickup.length > 1;
    speakWithMapboxMuted(
      isGrouped
        ? 'Tous les colis pris en charge. Nous pouvons entamer la course.'
        : 'Colis pris en charge. Nous pouvons entamer la course.'
    );
  }, [activeOrders, location, speakWithMapboxMuted]);

  const handleAcceptOrder = (orderId: string) => {
    useOrderStore.getState().acceptOrder(orderId, user?.id || '');
    orderSocketService.acceptOrder(orderId);
    const accepted = useOrderStore.getState().getOrderById(orderId);
    const profileVt = useDriverStore.getState().profile?.vehicle_type;
    const vehicleForSafety = String(profileVt || accepted?.deliveryMethod || '').trim().toLowerCase();
    const safety = getSafetyReminderForVehicleType(vehicleForSafety);
    const allNonBatchActive = useOrderStore.getState().activeOrders.filter(o => !o.batch_id);
    const isGroupedAccept = allNonBatchActive.length > 1;
    speakWithMapboxMuted(`Course acceptée, en route pour récupérer ${isGroupedAccept ? 'les colis' : 'le colis'}. ${safety}`);
    setIsNavigationActive(true);
    if (location) {
      orderSocketService.emitDriverLocation(orderId, {
        latitude: location.latitude,
        longitude: location.longitude,
        ...(rawGpsLocation?.heading != null ? { heading: rawGpsLocation.heading } : {}),
      });
    }
  };

  const handleDeclineOrder = (orderId: string) => {
    orderSocketService.declineOrder(orderId);
  };

  // Debug currentOrder
  useEffect(() => {
    if (currentOrder) {
      logger.debug('DEBUG currentOrder', 'driverIndex', {
        id: currentOrder.id,
        status: currentOrder.status,
        pickup_resolved: resolveCoords(currentOrder.pickup),
        dropoff_resolved: resolveCoords(currentOrder.dropoff),
      });
    }
  }, [currentOrder, resolveCoords]);

  useEffect(() => {
    const status = String(currentOrder?.status || '');
    if (!currentOrder || status === 'completed') {
      if (polyPulseIntervalRef.current) { clearInterval(polyPulseIntervalRef.current); polyPulseIntervalRef.current = null; }
      animationTimeoutsRef.current.forEach(id => clearTimeout(id));
      animationTimeoutsRef.current = [];
      const remainingActiveOrders = useOrderStore.getState().activeOrders.filter(o => !o.batch_id);
      if (remainingActiveOrders.length === 0) {
        if (isOnline && location) setTimeout(() => centerOnDriver(), 300);
      } else if (location) {
        const sortedRemaining = [...remainingActiveOrders].sort((a, b) => {
          const distA = calculateDistanceToPickup(a);
          const distB = calculateDistanceToPickup(b);
          if (distA === null && distB === null) return 0;
          if (distA === null) return 1;
          if (distB === null) return -1;
          return distA - distB;
        });
        const nextOrder = sortedRemaining.find(o =>
          o.status === 'picked_up' || o.status === 'delivering' || o.status === 'enroute' || o.status === 'in_progress'
        ) || sortedRemaining[0];
        if (nextOrder) {
          setTimeout(() => {
            useOrderStore.getState().setSelectedOrder(nextOrder.id);
          }, 500);
        }
      }
    }
  }, [currentOrder?.status, currentOrder, location, isOnline, centerOnDriver, calculateDistanceToPickup]);

  useEffect(() => {
    const status = String(currentOrder?.status || '');
    const lastStatus = lastOrderStatusRef.current;
    const isTransitioningToAccepted = status === 'accepted' && lastStatus !== status && lastStatus !== 'accepted';
    const isTransitioningToPickedUp =
      (status === 'picked_up' || status === 'delivering') &&
      lastStatus !== status && lastStatus !== 'picked_up' && lastStatus !== 'delivering';
    lastOrderStatusRef.current = status;
    if (currentOrder && (isTransitioningToAccepted || isTransitioningToPickedUp) && !userClosedBottomSheetRef.current) {
      userClosedBottomSheetRef.current = false;
      setTimeout(() => expandOrderBottomSheet(), isTransitioningToAccepted ? 300 : 500);
    } else if (status === 'completed' || !currentOrder) {
      userClosedBottomSheetRef.current = false;
      collapseOrderBottomSheet();
    }
  }, [currentOrder?.status, currentOrder, expandOrderBottomSheet, collapseOrderBottomSheet]);

  // Fermer la navigation quand la livraison est terminée et plus aucune commande active
  useEffect(() => {
    if (!currentOrder && activeOrders.length === 0 && navigationCompletedOrder) {
      setNavigationCompletedOrder(null);
      setIsNavigationActive(false);
      setIsNavigationMinimized(false);
      setShowColisRecupereButton(false);
      setShowLivraisonEffectueeButton(false);
      setLastEtaMinutes(null);
      setNavigationSession(null);
      atPickupZoneAnnouncedRef.current = false;
      atDropoffZoneAnnouncedRef.current = false;
      setShowRecalcOverlay(false);
      setPhase1MountReady(false);
    }
  }, [currentOrder, activeOrders.length, navigationCompletedOrder]);

  useEffect(() => {
    if (!orderBottomSheetIsExpanded && currentOrder) {
      const status = String(currentOrder?.status || '');
      if (status === 'picked_up' || status === 'delivering') userClosedBottomSheetRef.current = true;
    } else if (orderBottomSheetIsExpanded) {
      userClosedBottomSheetRef.current = false;
    }
  }, [orderBottomSheetIsExpanded, currentOrder]);

  const orderFullRouteCoords =
    currentPickupCoord && currentDropoffCoord
      ? orderFullRoute.routeCoordinates.length > 0 ? orderFullRoute.routeCoordinates : [currentPickupCoord, currentDropoffCoord]
      : [];

  const animatedRouteCoords =
    isOnline && location && currentOrder && animatedRoute.animatedCoordinates.length > 0
      ? [animatedDriverPosition || location, ...animatedRoute.animatedCoordinates.slice(1)]
      : [];

  const activeBatch = useBatchStore((s) => s.activeBatch);

  return (
    <>
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

      {activeOrders.length > 1 && !ordersListIsExpanded && !activeBatch && (
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

      {activeOrders.length > 0 && (
        <View style={styles.floatingMenu}>
          <TouchableOpacity
            style={[styles.menuButton, !ordersListIsExpanded && styles.activeButton]}
            onPress={() => { if (ordersListIsExpanded) collapseOrdersListSheet(); }}
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

      <OrderRequestPopup
        order={pendingOrder}
        visible={!!pendingOrder}
        onAccept={handleAcceptOrder}
        onDecline={handleDeclineOrder}
        autoDeclineTimer={30}
      />

      {currentOrder && !activeBatch && (
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
                setTimeout(() => { animatedRoute.refetch(); fitToRoute(); }, 500);
              }
            } else {
              await orderSocketService.updateDeliveryStatus(currentOrder.id, status, location);
            }
          }}
          location={location}
          onMessage={handleOpenMessage}
          onStartNavigation={currentOrder && location && destination ? openNavigationManually : undefined}
          isNavigationMinimized={isNavigationMinimized}
          onResumeNavigation={() => setIsNavigationMinimized(false)}
          lastEtaMinutes={lastEtaMinutes}
          onExpandSheet={expandOrderBottomSheet}
          onCancelOrder={() => {
            setIsNavigationActive(false);
            setNavigationSession(null);
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
            {(((currentOrder?.status === 'accepted' || currentOrder?.status === 'enroute' || currentOrder?.status === 'in_progress') && phase1MountReady)
              || (currentOrder?.status === 'picked_up' || currentOrder?.status === 'delivering')) && (
              <MapboxNavigationScreen
                key={`nav-${navigationSession?.orderId}`}
                origin={navOrigin || location!}
                destination={effectiveNavDestination}
                mute={mapboxVoiceMuted}
                onBackPress={
                  navigationCompletedOrder
                    ? () => resetNavigationUi(false)
                    : () => setIsNavigationMinimized(true)
                }
                onArrive={() => {
                  const order = navDisplayOrder;
                  if (!order) return;
                  const status = String(order.status || '');
                  if (status === 'accepted' || status === 'enroute' || status === 'in_progress') {
                    if (atPickupZoneAnnouncedRef.current) return;
                    atPickupZoneAnnouncedRef.current = true;
                    setShowColisRecupereButton(true);
                  } else if (status === 'picked_up' || status === 'delivering') {
                    if (!atDropoffZoneAnnouncedRef.current) {
                      atDropoffZoneAnnouncedRef.current = true;
                      setShowLivraisonEffectueeButton(true);
                    }
                    if (!spokenDropoffArrivalRef.current) {
                      spokenDropoffArrivalRef.current = true;
                      speakWithMapboxMuted('Vous êtes arrivés à destination.');
                    }
                  }
                }}
                showColisRecupereButton={showColisRecupereButton}
                onColisRecupere={handleColisRecupere}
                colisRecupereLabel={colisRecupereLabel}
                showLivraisonEffectueeButton={showLivraisonEffectueeButton}
                onLivraisonEffectuee={handleLivraisonEffectuee}
                onCancel={() => resetNavigationUi(true)}
                onRouteProgressChange={handleRouteProgressChange}
                onMessagePress={() => setShowMessageBottomSheet(true)}
                onSettingsPress={() => {}}
              />
            )}
            {((!phase1MountReady && (currentOrder?.status === 'accepted' || currentOrder?.status === 'enroute' || currentOrder?.status === 'in_progress')) || showRecalcOverlay) && (
              <View style={styles.recalcOverlay} pointerEvents="box-none">
                <ActivityIndicator size="large" color="#fff" />
                <Text style={styles.recalcOverlayText}>
                  {showRecalcOverlay ? "Recalcul de l'itinéraire vers la livraison..." : "Lancement de la navigation..."}
                </Text>
                {showNavStuckEscape && (
                  <TouchableOpacity style={styles.navStuckEscapeBtn} onPress={() => resetNavigationUi(true)}>
                    <Text style={styles.navStuckEscapeText}>Annuler</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>

          {isNavigationMinimized && (
            <>
              {showColisRecupereButton && (
                <TouchableOpacity
                  style={[styles.reprendreNavBar, { bottom: 100 }]}
                  onPress={handleColisRecupere}
                  activeOpacity={0.8}
                >
                  <Ionicons name="cube" size={24} color="#fff" />
                  <Text style={styles.reprendreNavText}>{colisRecupereLabel}</Text>
                </TouchableOpacity>
              )}
              {showLivraisonEffectueeButton && (
                <TouchableOpacity
                  style={[styles.reprendreNavBar, { bottom: 100, backgroundColor: '#16A34A' }]}
                  onPress={handleLivraisonEffectuee}
                  activeOpacity={0.8}
                >
                  <Ionicons name="checkmark-circle" size={24} color="#fff" />
                  <Text style={styles.reprendreNavText}>Livraison effectuée</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </>
      )}

      {showMessageBottomSheet && currentOrder?.user?.id && (
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
    </>
  );
}

const styles = StyleSheet.create({
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
  activeButton: { backgroundColor: "#8B5CF6" },
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
  menuBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
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
  multipleOrdersText: { fontSize: 14, fontWeight: '600', color: '#8B5CF6' },
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
  reprendreNavText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  navStuckEscapeBtn: {
    marginTop: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  navStuckEscapeText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
