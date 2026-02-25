/**
 * Polling de secours pour synchroniser le statut des commandes
 * quand le socket n'a pas transmis order:status:update (ex: completed).
 * Utilisé quand une commande est en delivering/picked_up.
 */
import { useEffect, useRef } from 'react';
import { useOrderStore } from '../store/useOrderStore';
import { useAuthStore } from '../store/useAuthStore';
import { userApiService } from '../services/userApiService';
import { logger } from '../utils/logger';

const POLL_INTERVAL_MS = 12_000; // 12 secondes

export function useOrderStatusPolling() {
  const user = useAuthStore((s) => s.user);
  const activeOrders = useOrderStore((s) => s.activeOrders);
  const updateFromSocket = useOrderStore((s) => s.updateFromSocket);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const ordersToPollKey = activeOrders
    .filter((o) => o.status === 'delivering' || o.status === 'picked_up')
    .map((o) => `${o.id}:${o.status}`)
    .join(',');

  useEffect(() => {
    const cleanup = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };

    if (!user?.id || !ordersToPollKey) {
      cleanup();
      return cleanup;
    }

    const ordersToPoll = activeOrders.filter(
      (o) => o.status === 'delivering' || o.status === 'picked_up'
    );
    if (ordersToPoll.length === 0) {
      cleanup();
      return cleanup;
    }

    const poll = async () => {
      try {
        const result = await userApiService.getUserDeliveries(user.id, {
          limit: 50,
          page: 1,
        });
        if (!result.success || !result.data) return;

        for (const order of ordersToPoll) {
          const apiOrder = result.data.find((a: any) => a.id === order.id);
          if (apiOrder && apiOrder.status === 'completed') {
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
    intervalRef.current = setInterval(poll, POLL_INTERVAL_MS);

    return cleanup;
  }, [user?.id, ordersToPollKey, activeOrders, updateFromSocket]);
}
