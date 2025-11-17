import { useState, useEffect, useCallback, useRef } from 'react'
import { adminSocketService } from '@/lib/adminSocketService'
import { adminApiService } from '@/lib/adminApiService'
import type { OnlineDriver } from './types'
import { isDriverValid } from './utils/driverValidation'
import { debug, debugWarn, debugError } from '@/utils/debug'


export function useDriversTracking(isSocketConnected: boolean) {
  const [onlineDrivers, setOnlineDrivers] = useState<Map<string, OnlineDriver>>(new Map())
  const driversRef = useRef<Map<string, OnlineDriver>>(new Map())
  const fallbackTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Mettre à jour la ref quand l'état change
  useEffect(() => {
    driversRef.current = onlineDrivers
  }, [onlineDrivers])

  // Fonction pour supprimer un driver (déclarée en premier)
  const removeDriver = useCallback((userId: string) => {
    setOnlineDrivers((prev) => {
      const updated = new Map(prev)
      updated.delete(userId)
      return updated
    })
  }, [])

  // Fonction pour mettre à jour un driver
  const updateDriver = useCallback((driver: OnlineDriver) => {
    if (isDriverValid(driver)) {
      setOnlineDrivers((prev) => {
        const updated = new Map(prev)
        updated.set(driver.userId, driver)
        return updated
      })
    } else {
      removeDriver(driver.userId)
    }
  }, [removeDriver])

  // Charger les drivers depuis l'API
  const loadDriversFromAPI = useCallback(async () => {
    try {
      debug('[useDriversTracking] Chargement des drivers via API')
      const result = await adminApiService.getOnlineDrivers()
      
      if (result.success && result.data) {
        const driversMap = new Map<string, OnlineDriver>()
        
        result.data.forEach((driver) => {
          const onlineDriver: OnlineDriver = {
            userId: driver.user_id,
            is_online: driver.is_online,
            is_available: driver.is_available,
            current_latitude: driver.current_latitude,
            current_longitude: driver.current_longitude,
            // L'API ne retourne pas updated_at, on utilise la date actuelle comme approximation
            updated_at: new Date().toISOString(),
          }
          
          if (isDriverValid(onlineDriver)) {
            driversMap.set(driver.user_id, onlineDriver)
          }
        })
        
        setOnlineDrivers(driversMap)
        debug(`[useDriversTracking] ${driversMap.size} drivers chargés via API`)
      } else {
        debugWarn('[useDriversTracking] Aucun driver trouvé ou erreur API:', result.message)
      }
    } catch (apiError) {
      debugError('[useDriversTracking] Erreur lors du chargement des drivers via API:', apiError)
    }
  }, [])

  useEffect(() => {
    if (!isSocketConnected) {
      // Fallback automatique après 3.5 secondes si le socket n'est pas connecté
      fallbackTimeoutRef.current = setTimeout(() => {
        if (!adminSocketService.isConnected()) {
          debug('[useDriversTracking] Fallback timeout (3.5s), chargement via API')
          loadDriversFromAPI()
        }
      }, 3500)

      // Polling soft si le socket reste déconnecté (toutes les 60 secondes)
      pollingIntervalRef.current = setInterval(() => {
        if (!adminSocketService.isConnected()) {
          debug('[useDriversTracking] Polling soft (socket déconnecté)')
          loadDriversFromAPI()
        } else {
          // Arrêter le polling si le socket se reconnecte
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current)
            pollingIntervalRef.current = null
          }
        }
      }, 60000) // 60 secondes
    } else {
      // Nettoyer les timeouts/intervals si le socket se reconnecte
      if (fallbackTimeoutRef.current) {
        clearTimeout(fallbackTimeoutRef.current)
        fallbackTimeoutRef.current = null
      }
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
        pollingIntervalRef.current = null
      }
    }

    // Écouter les drivers initiaux
    const unsubscribeInitialDrivers = adminSocketService.on('admin:initial-drivers', (data: unknown) => {
      const typedData = data as { drivers: OnlineDriver[] }
      if (typedData.drivers && Array.isArray(typedData.drivers)) {
        debug(`[useDriversTracking] Drivers initiaux reçus: ${typedData.drivers.length}`)
        
        const driversMap = new Map<string, OnlineDriver>()
        typedData.drivers.forEach((driver) => {
          if (isDriverValid(driver)) {
            driversMap.set(driver.userId, driver)
          }
        })
        
        setOnlineDrivers(driversMap)
        debug(`[useDriversTracking] ${driversMap.size} drivers valides après filtrage`)
      }
    })

    // Écouter les événements de drivers
    const unsubscribeDriverOnline = adminSocketService.on('driver:online', (data: unknown) => {
      const typedData = data as OnlineDriver
      if (typedData.is_online === true) {
        updateDriver(typedData)
        const hasCoords = typeof typedData.current_latitude === 'number' && typeof typedData.current_longitude === 'number'
        if (!hasCoords) {
          // Recharger la liste complète pour récupérer la dernière position connue
          loadDriversFromAPI()
        }
      } else {
        removeDriver(typedData.userId)
      }
    })

    const unsubscribeDriverOffline = adminSocketService.on('driver:offline', (data: unknown) => {
      const typedData = data as { userId: string }
      removeDriver(typedData.userId)
    })

    const unsubscribeDriverPosition = adminSocketService.on('driver:position:update', (data: unknown) => {
      const typedData = data as {
        userId: string
        current_latitude?: number
        current_longitude?: number
        updated_at?: string
      }
      
      const currentDriver = driversRef.current.get(typedData.userId)
      const hasCoords =
        typeof typedData.current_latitude === 'number' &&
        typeof typedData.current_longitude === 'number'

      if (!hasCoords) {
        return
      }

      if (currentDriver) {
        updateDriver({
          ...currentDriver,
          current_latitude: typedData.current_latitude,
          current_longitude: typedData.current_longitude,
          updated_at: typedData.updated_at,
        })
      } else {
        updateDriver({
          userId: typedData.userId,
          is_online: true,
          is_available: true,
          current_latitude: typedData.current_latitude,
          current_longitude: typedData.current_longitude,
          updated_at: typedData.updated_at ?? new Date().toISOString(),
        })
      }
    })

    // Écouter les échecs de connexion pour déclencher le fallback
    const unsubscribeConnectionFailed = adminSocketService.on('admin:connection-failed', () => {
      debugWarn('[useDriversTracking] Connexion Socket.IO échouée, fallback API')
      loadDriversFromAPI()
    })

    return () => {
      if (fallbackTimeoutRef.current) {
        clearTimeout(fallbackTimeoutRef.current)
      }
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
      }
      unsubscribeInitialDrivers()
      unsubscribeDriverOnline()
      unsubscribeDriverOffline()
      unsubscribeDriverPosition()
      unsubscribeConnectionFailed()
    }
  }, [isSocketConnected, loadDriversFromAPI, updateDriver, removeDriver])

  return {
    onlineDrivers,
    reloadDrivers: loadDriversFromAPI,
  }
}

