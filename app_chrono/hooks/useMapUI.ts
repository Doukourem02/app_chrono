import { useCallback, useEffect, useRef } from 'react';
import { useFocusEffect } from 'expo-router';
import { useOrderStore } from '../store/useOrderStore';
import { locationService } from '../services/locationService';
import { logger } from '../utils/logger';

interface UseMapUIProps {
  isCreatingNewOrder: boolean;
  setIsCreatingNewOrder: (value: boolean) => void;
  pickupLocation: string;
  deliveryLocation: string;
  region: { latitude: number; longitude: number } | null;
  clearRoute: () => void;
  setPickupCoords: (coords: { latitude: number; longitude: number } | null) => void;
  setDropoffCoords: (coords: { latitude: number; longitude: number } | null) => void;
  setPickupLocation: (location: string) => void;
  setDeliveryLocation: (location: string) => void;
  setSelectedMethod: (method: 'moto' | 'vehicule' | 'cargo') => void;
  animateToCoordinate: (coords: { latitude: number; longitude: number }, duration?: number) => void;
  expandBottomSheet: () => void;
  scheduleBottomSheetOpen: (delay?: number) => void;
  setSelectedOrder: (orderId: string | null) => void;
  currentOrder: ReturnType<typeof useOrderStore.getState>['activeOrders'][0] | null;
  pendingOrder: ReturnType<typeof useOrderStore.getState>['activeOrders'][0] | null;
  isExpanded: boolean;
  showRatingBottomSheet: boolean;
  deliveryMethodIsExpanded: boolean;
  orderDetailsIsExpanded: boolean;
  hasAutoOpenedRef: React.MutableRefObject<boolean>;
  userManuallyClosedRef: React.MutableRefObject<boolean>;
}

export function useMapUI({
  isCreatingNewOrder,
  setIsCreatingNewOrder,
  pickupLocation,
  deliveryLocation,
  region,
  clearRoute,
  setPickupCoords,
  setDropoffCoords,
  setPickupLocation,
  setDeliveryLocation,
  setSelectedMethod,
  animateToCoordinate,
  expandBottomSheet,
  scheduleBottomSheetOpen,
  setSelectedOrder,
  currentOrder,
  pendingOrder,
  isExpanded,
  showRatingBottomSheet,
  deliveryMethodIsExpanded,
  orderDetailsIsExpanded,
  hasAutoOpenedRef,
  userManuallyClosedRef,
}: UseMapUIProps) {
  const isResettingRef = useRef(false);
  const isUserTypingRef = useRef(false);
  const lastFocusTimeRef = useRef(0);

  // Gérer le focus de l'écran
  useFocusEffect(
    useCallback(() => {
      const now = Date.now();
      lastFocusTimeRef.current = now;

      if (isResettingRef.current) {
        return;
      }

      if (isUserTypingRef.current) {
        logger.info(
          '📍 Réinitialisation ignorée - utilisateur en train de saisir',
          'useMapUI'
        );
        return;
      }

      const currentPickup = pickupLocation;
      const currentDelivery = deliveryLocation;
      const hasFilledFields =
        currentPickup.trim().length > 0 || currentDelivery.trim().length > 0;

      if (hasFilledFields) {
        logger.info(
          '📍 Réinitialisation partielle - champs déjà remplis, conservation des données',
          'useMapUI',
          {
            pickup: currentPickup.substring(0, 30),
            delivery: currentDelivery.substring(0, 30),
          }
        );
        const currentSelectedId = useOrderStore.getState().selectedOrderId;
        if (currentSelectedId !== null) {
          setSelectedOrder(null);
        }
        setIsCreatingNewOrder(true);
        return;
      }

      isResettingRef.current = true;
      lastFocusTimeRef.current = now;
      logger.info(
        '📍 Arrivée sur map - réinitialisation complète pour nouvelle commande',
        'useMapUI'
      );

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
        locationService
          .getCurrentPosition()
          .then((coords) => {
            if (coords) {
              animateToCoordinate(
                { latitude: coords.latitude, longitude: coords.longitude },
                0.01
              );
            } else if (region) {
              animateToCoordinate(
                { latitude: region.latitude, longitude: region.longitude },
                0.01
              );
            }
          })
          .catch(() => {
            if (region) {
              animateToCoordinate(
                { latitude: region.latitude, longitude: region.longitude },
                0.01
              );
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
    }, [
      setSelectedOrder,
      clearRoute,
      setPickupCoords,
      setDropoffCoords,
      setPickupLocation,
      setDeliveryLocation,
      pickupLocation,
      deliveryLocation,
      setSelectedMethod,
      animateToCoordinate,
      region,
      scheduleBottomSheetOpen,
      setIsCreatingNewOrder,
      hasAutoOpenedRef,
      userManuallyClosedRef,
    ])
  );

  // Détecter si l'utilisateur est en train de saisir
  useEffect(() => {
    const hasFilledFields =
      pickupLocation.trim().length > 0 || deliveryLocation.trim().length > 0;
    isUserTypingRef.current = hasFilledFields;

    if (hasFilledFields) {
      logger.debug('📍 Champs remplis détectés - protection activée', 'useMapUI', {
        pickup: pickupLocation.substring(0, 20),
        delivery: deliveryLocation.substring(0, 20),
      });
    }
  }, [pickupLocation, deliveryLocation]);

  // Gérer l'ouverture automatique du bottom sheet
  useEffect(() => {
    const isActiveOrder =
      currentOrder &&
      currentOrder.status !== 'completed' &&
      currentOrder.status !== 'cancelled' &&
      currentOrder.status !== 'declined';
    const hasOrderInProgress = Boolean(pendingOrder || isActiveOrder);

    const shouldShowCreationForm = !hasOrderInProgress || isCreatingNewOrder;

    if (
      shouldShowCreationForm &&
      !isExpanded &&
      !showRatingBottomSheet &&
      !userManuallyClosedRef.current &&
      !deliveryMethodIsExpanded &&
      !orderDetailsIsExpanded
    ) {
      if (!hasAutoOpenedRef.current) {
        hasAutoOpenedRef.current = true;
        scheduleBottomSheetOpen(100);
      }
    }
  }, [
    isExpanded,
    currentOrder,
    showRatingBottomSheet,
    isCreatingNewOrder,
    pendingOrder,
    scheduleBottomSheetOpen,
    deliveryMethodIsExpanded,
    orderDetailsIsExpanded,
    hasAutoOpenedRef,
    userManuallyClosedRef,
  ]);

  return {
    isResettingRef,
    isUserTypingRef,
    lastFocusTimeRef,
  };
}

