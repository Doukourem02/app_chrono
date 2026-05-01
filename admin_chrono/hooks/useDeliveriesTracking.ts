import { useState, useEffect, useCallback } from 'react'
import { adminSocketService } from '@/lib/adminSocketService'
import { adminApiService } from '@/lib/adminApiService'
import type { Delivery } from './types'
import { mapOrderToDelivery, OrderFromAPI } from './utils/orderMapper'
import { debug, debugError } from '@/utils/debug'

export function useDeliveriesTracking(isSocketConnected: boolean) {
  const [ongoingDeliveries, setOngoingDeliveries] = useState<Delivery[]>([])

  // Charge (ou recharge) toutes les livraisons actives depuis l'API — source de vérité unique
  const loadDeliveriesFromAPI = useCallback(async () => {
    try {
      debug('[useDeliveriesTracking] Chargement des livraisons via API')
      const result = await adminApiService.getOngoingDeliveries()

      if (result.success && result.data) {
        const orders: OrderFromAPI[] = (result.data as OrderFromAPI[]) || []
        const deliveries: Delivery[] = orders.map(mapOrderToDelivery)
        const activeDeliveries = deliveries.filter(
          (d) => d.status !== 'completed' && d.status !== 'cancelled' && d.status !== 'declined'
        )
        setOngoingDeliveries(activeDeliveries)
        debug(`[useDeliveriesTracking] ${activeDeliveries.length} livraisons actives chargées`)
      }
    } catch (apiError) {
      debugError('[useDeliveriesTracking] Erreur lors du chargement des livraisons via API:', apiError)
    }
  }, [])

  // Chargement initial au montage (indépendant du socket)
  useEffect(() => {
    queueMicrotask(() => { void loadDeliveriesFromAPI() })
  }, [loadDeliveriesFromAPI])

  // À chaque connexion socket : resynchroniser avec l'API immédiatement
  useEffect(() => {
    if (isSocketConnected) {
      queueMicrotask(() => { void loadDeliveriesFromAPI() })
    }
  }, [isSocketConnected, loadDeliveriesFromAPI])

  // Écouter les événements socket → refetch REST (ne jamais appliquer les données socket directement)
  useEffect(() => {
    const applyOrderPayload = () => {
      void loadDeliveriesFromAPI()
    }

    const unsubscribeOrderUpdate = adminSocketService.on('order:status:update', applyOrderPayload)
    const unsubscribeOrderCreated = adminSocketService.on('order:created', applyOrderPayload)
    const unsubscribeOrderAssigned = adminSocketService.on('order:assigned', applyOrderPayload)
    const unsubscribeConnectionFailed = adminSocketService.on('admin:connection-failed', () => {
      void loadDeliveriesFromAPI()
    })

    return () => {
      unsubscribeOrderUpdate()
      unsubscribeOrderCreated()
      unsubscribeOrderAssigned()
      unsubscribeConnectionFailed()
    }
  }, [loadDeliveriesFromAPI])

  // Polling 5s — filet de sécurité si tous les canaux temps réel échouent
  useEffect(() => {
    const interval = setInterval(() => {
      debug('[useDeliveriesTracking] Polling 5s')
      void loadDeliveriesFromAPI()
    }, 5_000)

    return () => clearInterval(interval)
  }, [loadDeliveriesFromAPI])

  return {
    ongoingDeliveries,
    reloadDeliveries: loadDeliveriesFromAPI,
  }
}
