/**
 * Orchestrateur de synchronisation des commandes — driver_chrono.
 *
 * Le backend driver n'expose pas d'endpoint REST pour les commandes actives :
 * le resync passe par socket (requestServerOrdersResync → resync-order-state).
 * Ce hook ajoute deux canaux supplémentaires pour réduire la dépendance au socket :
 *
 *   - Supabase Realtime → postgres_changes sur `orders` (driver_id = driverId)
 *                         → déclenche requestServerOrdersResync immédiatement
 *   - Socket refetch listener → après order-accepted-confirmation / order:status:update
 *                               → confirme l'état depuis le serveur
 *
 * Le polling 5s existant (usePeriodicDriverOrderResync) reste le filet de sécurité.
 */
import { useEffect, useCallback } from 'react';
import { useDriverStore } from '../store/useDriverStore';
import { orderSocketService } from '../services/orderSocketService';
import { supabase } from '../utils/supabase';
import { logger } from '../utils/logger';

export function useOrderAssignmentSync() {
  const driverId = useDriverStore((s) => s.user?.id);
  const isOnline = useDriverStore((s) => s.isOnline);

  const syncNow = useCallback(() => {
    if (!driverId) return;
    orderSocketService.requestServerOrdersResync(driverId);
  }, [driverId]);

  // Supabase Realtime → resync socket immédiat quand une commande du driver change en DB
  useEffect(() => {
    if (!driverId) return;

    const channel = supabase
      .channel(`driver-orders-${driverId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `driver_id=eq.${driverId}`,
        },
        (payload) => {
          logger.debug(
            '[useOrderAssignmentSync] Supabase event reçu',
            'useOrderAssignmentSync',
            { event: payload.eventType }
          );
          syncNow();
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          logger.debug('[useOrderAssignmentSync] Supabase Realtime connecté', 'useOrderAssignmentSync');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          logger.warn(
            '[useOrderAssignmentSync] Supabase Realtime dégradé — polling socket prend le relais',
            'useOrderAssignmentSync',
            { status }
          );
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [driverId, syncNow]);

  // Socket refetch listener → après les événements critiques, confirme l'état depuis le serveur
  useEffect(() => {
    if (!driverId) return;
    return orderSocketService.addRefetchListener(() => syncNow());
  }, [driverId, syncNow]);

  // Polling 15s — filet de sécurité si socket ET Supabase RT sont dégradés simultanément
  useEffect(() => {
    if (!driverId || !isOnline) return;
    const id = setInterval(() => syncNow(), 15_000);
    return () => clearInterval(id);
  }, [driverId, isOnline, syncNow]);
}
