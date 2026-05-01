/**
 * Orchestrateur central de synchronisation des livraisons (admin_chrono).
 *
 * Wraps useDeliveriesTracking et ajoute Supabase Realtime pour déclencher
 * un refetch immédiat dès qu'une ligne `orders` change en DB.
 *
 * Sources :
 *   - Socket.IO       → déjà géré dans useDeliveriesTracking (trigger refetch)
 *   - Supabase RT     → postgres_changes → reloadDeliveries()
 *   - Polling 30s     → déjà géré dans useDeliveriesTracking (filet de sécurité)
 *
 * Source de vérité unique : getOngoingDeliveries() (REST API)
 */
import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useDeliveriesTracking } from './useDeliveriesTracking'
import { logger } from '@/utils/logger'

export function useDeliveriesSyncEngine(isSocketConnected: boolean) {
  const { ongoingDeliveries, reloadDeliveries } = useDeliveriesTracking(isSocketConnected)

  // Supabase Realtime → refetch immédiat quand la DB change
  useEffect(() => {
    const channel = supabase
      .channel('admin-orders-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        (payload) => {
          logger.debug(
            '[useDeliveriesSyncEngine] Supabase event reçu',
            { event: payload.eventType }
          )
          void reloadDeliveries()
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          logger.debug('[useDeliveriesSyncEngine] Supabase Realtime connecté')
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          logger.warn(
            '[useDeliveriesSyncEngine] Supabase Realtime dégradé — polling 30s prend le relais',
            { status }
          )
        }
      })

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [reloadDeliveries])

  return { ongoingDeliveries, reloadDeliveries }
}
