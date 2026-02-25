import { useState, useEffect, useCallback, useRef } from 'react'
import { adminSocketService } from '@/lib/adminSocketService'
import { adminApiService } from '@/lib/adminApiService'
import type { Delivery } from './types'
import { mapOrderToDelivery, OrderFromAPI } from './utils/orderMapper'
import { debug, debugError } from '@/utils/debug'

interface OrderUpdateData {
  order: OrderFromAPI
  location?: {
    latitude?: number
    longitude?: number
    lat?: number
    lng?: number
  }
}


export function useDeliveriesTracking(isSocketConnected: boolean) {
  const [ongoingDeliveries, setOngoingDeliveries] = useState<Delivery[]>([])
  const deliveriesRef = useRef<Delivery[]>([])
  const fallbackTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Mettre à jour la ref quand l'état change
  useEffect(() => {
    deliveriesRef.current = ongoingDeliveries
  }, [ongoingDeliveries])

  // Fonction pour mettre à jour une livraison
  const updateDelivery = useCallback((delivery: Delivery) => {
    setOngoingDeliveries((prev) => {
      const index = prev.findIndex((d) => d.id === delivery.id)
      if (index >= 0) {
        const updated = [...prev]
        updated[index] = delivery
        return updated
      } else {
        // Si la livraison n'existe pas, l'ajouter seulement si elle est en cours
        if (['pending', 'accepted', 'enroute', 'picked_up', 'delivering'].includes(delivery.status)) {
          return [...prev, delivery]
        }
        return prev
      }
    })
  }, [])

  // Fonction pour supprimer une livraison
  const removeDelivery = useCallback((deliveryId: string) => {
    setOngoingDeliveries((prev) => prev.filter((d) => d.id !== deliveryId))
  }, [])

  // Charger les livraisons depuis l'API
  const loadDeliveriesFromAPI = useCallback(async () => {
    try {
      debug('[useDeliveriesTracking] Chargement des livraisons via API')
      const result = await adminApiService.getOngoingDeliveries()
      
      if (result.success && result.data) {
        const orders: OrderFromAPI[] = (result.data as OrderFromAPI[]) || []
        const deliveries: Delivery[] = orders.map(mapOrderToDelivery)
        
        // Filtrer les livraisons terminées
        const activeDeliveries = deliveries.filter(
          (d) => d.status !== 'completed' && d.status !== 'cancelled'
        )
        
        setOngoingDeliveries(activeDeliveries)
        debug(`[useDeliveriesTracking] ${activeDeliveries.length} livraisons actives chargées`)
      }
    } catch (apiError) {
      debugError('[useDeliveriesTracking] Erreur lors du chargement des livraisons via API:', apiError)
    }
  }, [])

  useEffect(() => {
    if (!isSocketConnected) {
      // Fallback automatique après 3.5 secondes si le socket n'est pas connecté
      fallbackTimeoutRef.current = setTimeout(() => {
        if (!adminSocketService.isConnected() && deliveriesRef.current.length === 0) {
          debug('[useDeliveriesTracking] Fallback timeout (3.5s), chargement via API')
          loadDeliveriesFromAPI()
        }
      }, 3500)
    } else {
      // Nettoyer le timeout si le socket se reconnecte
      if (fallbackTimeoutRef.current) {
        clearTimeout(fallbackTimeoutRef.current)
        fallbackTimeoutRef.current = null
      }
    }

    // Écouter les mises à jour de commandes
    const unsubscribeOrderUpdate = adminSocketService.on('order:status:update', (data: unknown) => {
      const typedData = data as OrderUpdateData
      if (typedData.order) {
        const delivery = mapOrderToDelivery(typedData.order)

        // Si la commande est terminée ou annulée, la retirer immédiatement
        if (['completed', 'cancelled'].includes(delivery.status)) {
          removeDelivery(delivery.id)
        } else {
          updateDelivery(delivery)
        }
      }
    })

    // Écouter les échecs de connexion pour déclencher le fallback
    const unsubscribeConnectionFailed = adminSocketService.on('admin:connection-failed', () => {
      loadDeliveriesFromAPI()
    })

    return () => {
      if (fallbackTimeoutRef.current) {
        clearTimeout(fallbackTimeoutRef.current)
      }
      unsubscribeOrderUpdate()
      unsubscribeConnectionFailed()
    }
  }, [isSocketConnected, loadDeliveriesFromAPI, updateDelivery, removeDelivery])

  // Polling de secours pour sync statut completed (si socket n'a pas transmis)
  useEffect(() => {
    const hasActiveDeliveries = ongoingDeliveries.some(
      (d) => d.status === 'delivering' || d.status === 'picked_up'
    )
    if (!hasActiveDeliveries) return

    const interval = setInterval(() => {
      debug('[useDeliveriesTracking] Polling de secours pour sync statut')
      loadDeliveriesFromAPI()
    }, 15_000)

    return () => clearInterval(interval)
  }, [ongoingDeliveries, loadDeliveriesFromAPI])

  return {
    ongoingDeliveries,
    reloadDeliveries: loadDeliveriesFromAPI,
  }
}

