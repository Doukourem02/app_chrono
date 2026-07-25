import { useEffect, useRef, useState } from 'react'
import { adminSocketService } from '@/lib/adminSocketService'
import { useSocketConnection } from './useSocketConnection'

/**
 * Statut en ligne/hors ligne des livreurs, synchronisé en temps réel via les mêmes
 * événements Socket.IO que la carte de suivi (admin:initial-drivers, driver:online,
 * driver:offline) — sans le filtre GPS/fraîcheur de useDriversTracking (qui n'a de sens
 * que pour l'affichage sur une carte). Un userId absent de la map est considéré hors ligne.
 */
export interface UseDriverOnlineStatusReturn {
  onlineStatus: Map<string, boolean>
  isConnected: boolean
}

export function useDriverOnlineStatus(): UseDriverOnlineStatusReturn {
  const { isConnected } = useSocketConnection()
  const [onlineStatus, setOnlineStatus] = useState<Map<string, boolean>>(new Map())
  const statusRef = useRef<Map<string, boolean>>(new Map())

  useEffect(() => {
    statusRef.current = onlineStatus
  }, [onlineStatus])

  useEffect(() => {
    const unsubscribeInitialDrivers = adminSocketService.on('admin:initial-drivers', (data: unknown) => {
      const typedData = data as { drivers: Array<{ userId: string; is_online?: boolean }> }
      if (!typedData?.drivers || !Array.isArray(typedData.drivers)) return

      const next = new Map<string, boolean>()
      typedData.drivers.forEach((driver) => {
        if (driver.is_online === true) next.set(driver.userId, true)
      })
      setOnlineStatus(next)
    })

    const unsubscribeDriverOnline = adminSocketService.on('driver:online', (data: unknown) => {
      const typedData = data as { userId: string; is_online?: boolean }
      if (!typedData?.userId) return
      const updated = new Map(statusRef.current)
      updated.set(typedData.userId, true)
      setOnlineStatus(updated)
    })

    const unsubscribeDriverOffline = adminSocketService.on('driver:offline', (data: unknown) => {
      const typedData = data as { userId: string }
      if (!typedData?.userId) return
      const updated = new Map(statusRef.current)
      updated.delete(typedData.userId)
      setOnlineStatus(updated)
    })

    return () => {
      unsubscribeInitialDrivers()
      unsubscribeDriverOnline()
      unsubscribeDriverOffline()
    }
  }, [])

  return { onlineStatus, isConnected }
}
