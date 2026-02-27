/**
 * Polling de secours pour synchroniser le statut des commandes
 * quand le socket n'a pas transmis (ex: order-accepted, completed).
 * - Pending → accepted/enroute : polling toutes les 3s (fallback si socket échoue)
 * - Delivering/picked_up → completed : polling toutes les 12s
 */
import { useEffect, useRef } from 'react';
import { useOrderStore } from '../store/useOrderStore';
import { useAuthStore } from '../store/useAuthStore';
import { userApiService } from '../services/userApiService';
import { logger } from '../utils/logger';

const POLL_PENDING_MS = 3_000; // 3 secondes pour pending (recherche livreur)
const POLL_ACTIVE_MS = 12_000; // 12 secondes pour delivering/picked_up

export function useOrderStatusPolling() {
  const user = useAuthStore((s) => s.user);
  const activeOrders = useOrderStore((s) => s.activeOrders);
  const updateFromSocket = useOrderStore((s) => s.updateFromSocket);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const pendingIds = activeOrders.filter((o) => o.status === 'pending').map((o) => o.id);
  const activeToPollIds = activeOrders
    .filter((o) => o.status === 'delivering' || o.status === 'picked_up')
    .map((o) => o.id);
  const hasPending = pendingIds.length > 0;
  const hasActiveToPoll = activeToPollIds.length > 0;
  const ordersKey = [...pendingIds, ...activeToPollIds].join(',');

  useEffect(() => {
    const cleanup = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };

    if (!user?.id || (!hasPending && !hasActiveToPoll)) {
      cleanup();
      return cleanup;
    }

    const pollInterval = hasPending ? POLL_PENDING_MS : POLL_ACTIVE_MS;
    const idsToPoll = [...pendingIds, ...activeToPollIds];

    const poll = async () => {
      try {
        const result = await userApiService.getUserDeliveries(user.id, {
          limit: 50,
          page: 1,
        });
        if (!result.success || !result.data) return;

        const currentOrders = useOrderStore.getState().activeOrders;
        for (const orderId of idsToPoll) {
          const order = currentOrders.find((o) => o.id === orderId);
          if (!order) continue;
          const apiOrder = result.data.find((a: any) => a.id === orderId);
          if (!apiOrder) continue;

          const newStatus = String(apiOrder.status || '');

          // Pending → accepted/enroute/picked_up/delivering : sync si socket a raté
          if (order.status === 'pending' && ['accepted', 'enroute', 'picked_up', 'delivering'].includes(newStatus)) {
            logger.info(
              '[useOrderStatusPolling] Livreur assigné détecté via API (socket raté)',
              'useOrderStatusPolling',
              { orderId: order.id, newStatus }
            );
            updateFromSocket({
              order: {
                ...order,
                ...apiOrder,
                id: apiOrder.id,
                status: newStatus as any,
                driver: apiOrder.driver || apiOrder.driverInfo,
              },
              location: undefined,
            });
          }
          // Delivering/picked_up → completed
          else if ((order.status === 'delivering' || order.status === 'picked_up') && newStatus === 'completed') {
            logger.info(
              '[useOrderStatusPolling] Statut completed détecté via API, sync store',
              'useOrderStatusPolling',
              { orderId: order.id }
            );
            updateFromSocket({
              order: {
                ...order,
                ...apiOrder,
                id: apiOrder.id,
                status: 'completed',
                completed_at: apiOrder.completed_at || new Date().toISOString(),
              },
              location: undefined,
            });
          }
        }
      } catch (err) {
        logger.warn('[useOrderStatusPolling] Erreur polling', 'useOrderStatusPolling', err);
      }
    };

    poll(); // Premier appel immédiat
    intervalRef.current = setInterval(poll, pollInterval);

    return cleanup;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ordersKey dérive de pendingIds/activeToPollIds, évite refs instables
  }, [user?.id, ordersKey, hasPending, hasActiveToPoll, updateFromSocket]);
}
