/**
 * Polling de secours pour synchroniser le statut des commandes
 * quand le socket n'a pas transmis.
 * - Pending → accepted/enroute : 3s (recherche livreur)
 * - Accepted/enroute → picked_up/delivering : 5s (colis récupéré)
 * - Delivering/picked_up → completed : 12s
 */
import { useEffect } from 'react';
import { useOrderStore } from '../store/useOrderStore';
import { useAuthStore } from '../store/useAuthStore';
import { syncClientOrdersFromApi } from '../services/userAppResync';
import { logger } from '../utils/logger';

const POLL_PENDING_MS = 3_000;
const POLL_ENROUTE_MS = 5_000;
const POLL_ACTIVE_MS = 12_000;

export function useOrderStatusPolling() {
  const user = useAuthStore((s) => s.user);
  const activeOrders = useOrderStore((s) => s.activeOrders);

  const hasPending = activeOrders.some((o) => o.status === 'pending');
  const hasEnroute = activeOrders.some((o) => o.status === 'accepted' || o.status === 'enroute');
  const hasActive = activeOrders.some((o) => o.status === 'delivering' || o.status === 'picked_up');
  const ordersKey = activeOrders.map((o) => o.id).join(',');

  useEffect(() => {
    if (!user?.id || (!hasPending && !hasEnroute && !hasActive)) return;

    const pollInterval = hasPending ? POLL_PENDING_MS : hasEnroute ? POLL_ENROUTE_MS : POLL_ACTIVE_MS;

    const poll = async () => {
      try {
        await syncClientOrdersFromApi(user.id);
      } catch (err) {
        logger.warn('[useOrderStatusPolling] Erreur polling', 'useOrderStatusPolling', err);
      }
    };

    poll();
    const id = setInterval(poll, pollInterval);
    return () => clearInterval(id);
  }, [user?.id, ordersKey, hasPending, hasEnroute, hasActive]);
}
