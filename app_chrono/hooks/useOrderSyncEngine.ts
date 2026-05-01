/**
 * Orchestrateur central de synchronisation des commandes.
 *
 * Sources d'événements (Tier 2 + 3) :
 *   - Socket.IO  → optimistic déjà appliqué dans userOrderSocketService,
 *                  ici on confirme avec l'API REST dès que le service notifie
 *   - Supabase Realtime → postgres_changes sur la table `orders` déclenche refetch
 *
 * Source de vérité unique : REST API (syncClientOrdersFromApi)
 */
import { useEffect, useCallback, useRef } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { supabase } from '../utils/supabase';
import { syncClientOrdersFromApi } from '../services/userAppResync';
import { userOrderSocketService } from '../services/userOrderSocketService';
import { logger } from '../utils/logger';

export function useOrderSyncEngine() {
  const userId = useAuthStore((s) => s.user?.id);
  const syncingRef = useRef(false);

  const syncNow = useCallback(async () => {
    if (!userId || syncingRef.current) return;
    syncingRef.current = true;
    try {
      await syncClientOrdersFromApi(userId);
    } catch (err) {
      logger.warn('[useOrderSyncEngine] sync échouée', 'useOrderSyncEngine', err);
    } finally {
      syncingRef.current = false;
    }
  }, [userId]);

  // Phase 0 — Supabase Realtime : postgres_changes → refetch REST immédiat
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`order-sync-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          logger.debug(
            '[useOrderSyncEngine] Supabase event reçu',
            'useOrderSyncEngine',
            { event: payload.eventType }
          );
          void syncNow();
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          logger.debug('[useOrderSyncEngine] Supabase Realtime connecté', 'useOrderSyncEngine');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          logger.warn(
            '[useOrderSyncEngine] Supabase Realtime dégradé — polling prend le relais',
            'useOrderSyncEngine',
            { status }
          );
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, syncNow]);

  // Phase 1 — Socket refetch : après order-accepted / order:status:update → confirme avec REST
  useEffect(() => {
    if (!userId) return;
    return userOrderSocketService.addRefetchListener(() => void syncNow());
  }, [userId, syncNow]);
}
