import { useEffect, useRef } from 'react';
import { useOrderStore } from '../store/useOrderStore';
import { useShipmentStore } from '../store/useShipmentStore';
import { useRatingStore } from '../store/useRatingStore';
import { logger } from '../utils/logger';
import type { OrderStatus } from '../store/useOrderStore';

const PENDING_STATUS: OrderStatus = 'pending';

interface UseMapOrderManagementProps {
  isSearchingDriver: boolean;
  startDriverSearch: () => void;
  stopDriverSearch: () => void;
  collapseBottomSheet: () => void;
  clearRoute: () => void;
  setPickupCoords: (coords: { latitude: number; longitude: number } | null) => void;
  setDropoffCoords: (coords: { latitude: number; longitude: number } | null) => void;
  setPickupLocation: (location: string) => void;
  setDeliveryLocation: (location: string) => void;
  selectedOrderId: string | null;
  orderDriverCoordsMap: Map<string, { latitude: number; longitude: number }>;
  displayedRouteCoords: any[];
  orderDriverCoords: { latitude: number; longitude: number } | null;
  userManuallyClosedRef: React.MutableRefObject<boolean>;
}

export function useMapOrderManagement({
  isSearchingDriver,
  startDriverSearch,
  stopDriverSearch,
  collapseBottomSheet,
  clearRoute,
  setPickupCoords,
  setDropoffCoords,
  setPickupLocation,
  setDeliveryLocation,
  selectedOrderId,
  orderDriverCoordsMap,
  displayedRouteCoords,
  orderDriverCoords,
  userManuallyClosedRef,
}: UseMapOrderManagementProps) {
  // Utiliser un sélecteur qui force la réévaluation quand le statut ou le driver change
  // En créant une chaîne de statuts, on force React à détecter les changements
  const activeOrders = useOrderStore((s) => s.activeOrders);
  const ordersStatuses = useOrderStore((s) => 
    s.activeOrders.map(o => `${o.id}:${o.status}:${o.driver ? 'hasDriver' : 'noDriver'}`).join(',')
  );
  
  const currentOrder = useOrderStore((s) => {
    if (s.selectedOrderId) {
      return s.activeOrders.find((o) => o.id === s.selectedOrderId) || null;
    }
    return (
      s.activeOrders.find((o) => o.status !== 'pending') ||
      s.activeOrders[0] ||
      null
    );
  });
  const pendingOrder = useOrderStore((s) => {
    const pending = s.activeOrders.filter((o) => o.status === PENDING_STATUS);
    if (pending.length === 0) return null;
    pending.sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    });
    return pending[0];
  });

  // Gérer la recherche de livreur pour plusieurs commandes en attente
  useEffect(() => {
    // Une commande est "en attente de recherche" si :
    // 1. Son statut est 'pending' ET elle n'a pas de driver
    // 2. Elle n'est PAS 'accepted', 'completed', 'cancelled', ou 'declined'
    const allPendingOrders = activeOrders.filter((o) => {
      // Commande avec driver assigné ou en cours : plus en attente de recherche
      if (o.driver && ['accepted', 'enroute', 'picked_up', 'delivering'].includes(o.status)) {
        return false;
      }
      // Si la commande est dans un état final, elle n'est plus en attente
      if (['completed', 'cancelled', 'declined'].includes(o.status)) {
        return false;
      }
      // En attente seulement si status pending ET pas de driver
      return o.status === PENDING_STATUS && !o.driver;
    });

    const allAcceptedOrders = activeOrders.filter(
      (o) =>
        (o.status === 'accepted' || (o.status === PENDING_STATUS && o.driver)) &&
        o.driver
    );

    logger.debug('📊 État des commandes (useEffect recherche)', 'useMapOrderManagement', {
      totalActiveOrders: activeOrders.length,
      pendingCount: allPendingOrders.length,
      acceptedCount: allAcceptedOrders.length,
      isSearchingDriver,
      ordersStatuses: activeOrders.map((o) => ({
        id: o.id.slice(0, 8),
        status: o.status,
        hasDriver: !!o.driver,
        isPending: o.status === PENDING_STATUS && !o.driver,
        isAccepted: o.status === 'accepted',
      })),
    });

    // S'il y a au moins une commande en attente (sans driver), démarrer/continuer la recherche
    if (allPendingOrders.length > 0) {
      if (!isSearchingDriver) {
        logger.info(
          '📡 Démarrage animation radar (commande(s) en attente)',
          'useMapOrderManagement',
          {
            pendingCount: allPendingOrders.length,
            orderIds: allPendingOrders.map((o) => o.id),
          }
        );
        startDriverSearch();
        collapseBottomSheet();
        userManuallyClosedRef.current = false;
      }
    } else {
      // Aucune commande en attente (toutes ont un driver ou sont acceptées), arrêter la recherche
      if (isSearchingDriver) {
        stopDriverSearch();
        logger.info(
          '🛑 Recherche de chauffeur arrêtée (aucune commande en attente)',
          'useMapOrderManagement',
          {
            acceptedOrdersCount: allAcceptedOrders.length,
            acceptedOrderIds: allAcceptedOrders.map((o) => o.id),
            totalOrders: activeOrders.length,
            allOrdersStatuses: activeOrders.map((o) => ({
              id: o.id.slice(0, 8),
              status: o.status,
              hasDriver: !!o.driver,
            })),
          }
        );
      }
    }
  }, [
    isSearchingDriver,
    startDriverSearch,
    stopDriverSearch,
    collapseBottomSheet,
    activeOrders,
    ordersStatuses, // Ajouter ordersStatuses pour forcer la réévaluation
    userManuallyClosedRef,
  ]);

  // Nettoyer les routes quand une commande est acceptée
  useEffect(() => {
    if (orderDriverCoords && displayedRouteCoords.length > 0) {
      logger.info(
        '🧹 Nettoyage route violette - commande acceptée, affichage tracking direct',
        'useMapOrderManagement'
      );
      clearRoute();
    }
  }, [orderDriverCoords, displayedRouteCoords.length, clearRoute]);

  // Nettoyer les commandes bloquées ou anciennes
  useEffect(() => {
    // Ne nettoyer les routes/coordonnées que si c'est la commande sélectionnée ou s'il n'y a qu'une seule commande
    if (pendingOrder && !isSearchingDriver && !currentOrder) {
      const orderAge = pendingOrder.createdAt
        ? new Date().getTime() - new Date(pendingOrder.createdAt).getTime()
        : Infinity;

      const isSelectedOrder =
        selectedOrderId === pendingOrder.id || selectedOrderId === null;

      if (orderAge > 30000 && isSelectedOrder) {
        logger.info('🧹 Nettoyage commande bloquée en attente', 'useMapOrderManagement', {
          orderId: pendingOrder.id,
          orderAge,
        });
        const store = useOrderStore.getState();
        const remainingOrdersCount = store.activeOrders.length;
        store.removeOrder(pendingOrder.id);
        if (remainingOrdersCount <= 1 || selectedOrderId === pendingOrder.id) {
          clearRoute();
          setPickupCoords(null);
          setDropoffCoords(null);
          setPickupLocation('');
          setDeliveryLocation('');
          useShipmentStore.getState().clearAddressRoutingOverrides();
        }
      }
    }

    if (currentOrder && currentOrder.status === 'accepted') {
      const driverCoordsForOrder = selectedOrderId
        ? orderDriverCoordsMap.get(selectedOrderId)
        : null;
      if (!driverCoordsForOrder) {
        const orderAge = currentOrder.createdAt
          ? new Date().getTime() - new Date(currentOrder.createdAt).getTime()
          : Infinity;

        if (orderAge > 60000) {
          logger.warn(
            '⚠️ Commande acceptée sans driver connecté depuis trop longtemps',
            'useMapOrderManagement',
            {
              orderId: currentOrder.id,
              orderAge,
            }
          );
        }
      }
    }
  }, [
    pendingOrder,
    isSearchingDriver,
    currentOrder,
    selectedOrderId,
    orderDriverCoordsMap,
    clearRoute,
    setPickupCoords,
    setDropoffCoords,
    setPickupLocation,
    setDeliveryLocation,
  ]);

  // Initialisation : nettoyer les commandes terminées au montage
  const hasInitializedRef = useRef(false);
  useEffect(() => {
    if (hasInitializedRef.current) return;
    hasInitializedRef.current = true;

    const store = useOrderStore.getState();
    const ratingStore = useRatingStore.getState();

    const currentOrder = store.getCurrentOrder();
    const pendingOrder = store.getPendingOrder();

    if (
      currentOrder &&
      (currentOrder.status === 'cancelled' || currentOrder.status === 'declined')
    ) {
      logger.info(
        '🧹 Nettoyage commande terminée/annulée/refusée au montage initial',
        'useMapOrderManagement',
        { status: currentOrder.status }
      );

      if (ratingStore.showRatingBottomSheet) {
        logger.info(
          '🧹 Fermeture RatingBottomSheet au montage initial (commande terminée)',
          'useMapOrderManagement'
        );
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
      useShipmentStore.getState().clearAddressRoutingOverrides();
    } else if (currentOrder && currentOrder.status === 'completed') {
      logger.info(
        '✅ Commande complétée au montage initial - attente du RatingBottomSheet',
        'useMapOrderManagement',
        {
          hasRatingBottomSheet: ratingStore.showRatingBottomSheet,
        }
      );

      const completedAt =
        (currentOrder as any)?.completed_at ||
        (currentOrder as any)?.completedAt;
      const orderAge = completedAt
        ? new Date().getTime() - new Date(completedAt).getTime()
        : Infinity;

      if (!ratingStore.showRatingBottomSheet && orderAge > 60000) {
        logger.info(
          '🧹 Nettoyage commande complétée ancienne au montage initial',
          'useMapOrderManagement',
          { orderAge }
        );
        store.removeOrder(currentOrder.id);
        try {
          clearRoute();
        } catch {}
        setPickupCoords(null);
        setDropoffCoords(null);
        setPickupLocation('');
        setDeliveryLocation('');
        useShipmentStore.getState().clearAddressRoutingOverrides();
      }
    }

    if (pendingOrder) {
      const orderAge = pendingOrder.createdAt
        ? new Date().getTime() - new Date(pendingOrder.createdAt).getTime()
        : Infinity;

      if (orderAge > 10000) {
        logger.info('🧹 Nettoyage pendingOrder bloqué au montage initial', 'useMapOrderManagement', {
          orderId: pendingOrder.id,
          orderAge,
        });
        store.removeOrder(pendingOrder.id);
      }
    }

    if (ratingStore.showRatingBottomSheet && !currentOrder) {
      logger.info(
        '🧹 Fermeture RatingBottomSheet au montage initial (pas de commande active)',
        'useMapOrderManagement'
      );
      ratingStore.resetRatingBottomSheet();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    currentOrder,
    pendingOrder,
    activeOrders,
  };
}

