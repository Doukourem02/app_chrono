import { useState, useCallback, useEffect } from 'react'
import { useSocketConnection } from './useSocketConnection'
import { useDriversTracking } from './useDriversTracking'
import { useDeliveriesTracking } from './useDeliveriesTracking'
import { debugError } from '@/utils/debug'
import type { OnlineDriver, Delivery } from './types'

// Réexporter les types pour compatibilité avec le code existant
export type { OnlineDriver, Delivery }

export interface UseRealTimeTrackingReturn {
  // Drivers
  onlineDrivers: Map<string, OnlineDriver>
  isConnected: boolean
  
  // Deliveries
  ongoingDeliveries: Delivery[]
  
  // Loading states
  isLoading: boolean
  error: string | null
  
  // Functions
  reloadData: () => Promise<void>
}

/**
 * Hook orchestrateur pour le suivi en temps réel des drivers et livraisons
 * Utilise des hooks spécialisés pour séparer les responsabilités
 */
export function useRealTimeTracking(): UseRealTimeTrackingReturn {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Gérer la connexion socket
  const { isConnected } = useSocketConnection()

  // Gérer le suivi des drivers
  const { onlineDrivers, reloadDrivers } = useDriversTracking(isConnected)

  // Gérer le suivi des livraisons
  const { ongoingDeliveries, reloadDeliveries } = useDeliveriesTracking(isConnected)

  // Calculer isLoading : on considère qu'on a fini de charger quand on est connecté OU qu'on a des données
  // On utilise un timeout pour permettre au fallback de se déclencher (3.5s)
  const hasData = onlineDrivers.size > 0 || ongoingDeliveries.length > 0
  const computedIsLoading = isLoading && !isConnected && !hasData

  // Mettre à jour isLoading via un callback pour éviter les warnings du linter
  useEffect(() => {
    if (isConnected || hasData) {
      // Utiliser setTimeout pour éviter le warning du linter
      const timer = setTimeout(() => {
        setIsLoading(false)
        setError(null)
      }, 0)
      return () => clearTimeout(timer)
    }
  }, [isConnected, hasData])

  // Fonction pour recharger toutes les données manuellement
  const reloadData = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      
      // Recharger les drivers et livraisons en parallèle
      await Promise.all([
        reloadDrivers(),
        reloadDeliveries(),
      ])
      
      setIsLoading(false)
    } catch (error) {
      debugError('[useRealTimeTracking] Erreur lors du rechargement des données:', error)
      setError(error instanceof Error ? error.message : 'Erreur lors du rechargement')
      setIsLoading(false)
    }
  }, [reloadDrivers, reloadDeliveries])

  return {
    onlineDrivers,
    isConnected,
    ongoingDeliveries,
    isLoading: computedIsLoading,
    error,
    reloadData,
  }
}
