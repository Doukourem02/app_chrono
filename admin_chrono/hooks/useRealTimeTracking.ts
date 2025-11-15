import { useState, useEffect, useCallback, useRef } from 'react'
import { adminSocketService } from '@/lib/adminSocketService'
import { adminApiService } from '@/lib/adminApiService'

export interface OnlineDriver {
  userId: string
  is_online: boolean
  is_available: boolean
  current_latitude?: number
  current_longitude?: number
  updated_at?: string
}

export interface Delivery {
  id: string
  shipmentNumber: string
  type: string
  status: string
  pickup: {
    name: string
    address: string
    coordinates?: { lat: number; lng: number } | null
  }
  dropoff: {
    name: string
    address: string
    coordinates?: { lat: number; lng: number } | null
  }
  driverId?: string
  userId?: string
  client?: {
    id: string
    email: string
    full_name?: string
    phone?: string
    avatar_url?: string
  } | null
  driver?: {
    id: string
    email: string
    full_name?: string
    phone?: string
    avatar_url?: string
  } | null
}

interface OrderFromAPI {
  id: string
  shipmentNumber?: string
  status: string
  driverId?: string
  driver_id?: string
  userId?: string
  user_id?: string
  user?: {
    id: string
    email?: string
    name?: string
    full_name?: string
    phone?: string
    avatar?: string
    avatar_url?: string
  }
  pickup?: {
    name?: string
    address?: string
    formatted_address?: string
    coordinates?: {
      latitude?: number
      lat?: number
      longitude?: number
      lng?: number
    }
  }
  dropoff?: {
    name?: string
    address?: string
    formatted_address?: string
    coordinates?: {
      latitude?: number
      lat?: number
      longitude?: number
      lng?: number
    }
  }
  client?: Delivery['client']
  driver?: {
    id: string
    email?: string
    name?: string
    full_name?: string
    phone?: string
    avatar?: string
    avatar_url?: string
  }
}

interface OrderUpdateData {
  order: OrderFromAPI
  location?: {
    latitude?: number
    longitude?: number
    lat?: number
    lng?: number
  }
}

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
 * Hook pour le suivi en temps réel des drivers et livraisons
 */
export function useRealTimeTracking(): UseRealTimeTrackingReturn {
  const [onlineDrivers, setOnlineDrivers] = useState<Map<string, OnlineDriver>>(new Map())
  const [ongoingDeliveries, setOngoingDeliveries] = useState<Delivery[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Utiliser des refs pour éviter les re-renders inutiles
  const driversRef = useRef<Map<string, OnlineDriver>>(new Map())
  const deliveriesRef = useRef<Delivery[]>([])
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const isConnectedRef = useRef(false) // Ref pour éviter les mises à jour inutiles de isConnected

  // Mettre à jour les refs quand l'état change
  useEffect(() => {
    driversRef.current = onlineDrivers
  }, [onlineDrivers])

  useEffect(() => {
    deliveriesRef.current = ongoingDeliveries
  }, [ongoingDeliveries])

  // Fonction pour mettre à jour un driver
  const updateDriver = useCallback((driver: OnlineDriver) => {
    setOnlineDrivers((prev) => {
      const updated = new Map(prev)
      updated.set(driver.userId, driver)
      return updated
    })
  }, [])

  // Fonction pour supprimer un driver
  const removeDriver = useCallback((userId: string) => {
    setOnlineDrivers((prev) => {
      const updated = new Map(prev)
      updated.delete(userId)
      return updated
    })
  }, [])

  // Fonction pour mettre à jour une livraison
  const updateDelivery = useCallback((delivery: Delivery) => {
    setOngoingDeliveries((prev) => {
      const index = prev.findIndex((d) => d.id === delivery.id)
      if (index >= 0) {
        const updated = [...prev]
        updated[index] = delivery
        if (process.env.NODE_ENV === 'development') {
          console.log('🔄 [useRealTimeTracking] Livraison mise à jour:', {
            id: delivery.id,
            status: delivery.status,
            totalDeliveries: updated.length,
            timestamp: new Date().toISOString()
          })
        }
        return updated
      } else {
        // Si la livraison n'existe pas, l'ajouter seulement si elle est en cours
        if (['pending', 'accepted', 'enroute', 'picked_up'].includes(delivery.status)) {
          const newList = [...prev, delivery]
          if (process.env.NODE_ENV === 'development') {
            console.log('➕ [useRealTimeTracking] Nouvelle livraison ajoutée:', {
              id: delivery.id,
              status: delivery.status,
              totalDeliveries: newList.length,
              timestamp: new Date().toISOString()
            })
          }
          return newList
        }
        return prev
      }
    })
  }, [])

  // Fonction pour supprimer une livraison
  const removeDelivery = useCallback((deliveryId: string) => {
    setOngoingDeliveries((prev) => prev.filter((d) => d.id !== deliveryId))
  }, [])

  useEffect(() => {
    // Se connecter au socket
    const connectSocket = async () => {
      try {
        await adminSocketService.connect()
      } catch (err: unknown) {
        console.error('❌ [useRealTimeTracking] Erreur de connexion:', err)
        const errorMessage = err instanceof Error ? err.message : 'Erreur de connexion au serveur'
        setError(errorMessage)
        setIsLoading(false)
        
        // Ne pas bloquer l'interface si le socket ne peut pas se connecter
        // Le polling HTTP continuera de fonctionner
        if (process.env.NODE_ENV === 'development') {
          console.warn('⚠️ [useRealTimeTracking] Le suivi en temps réel est désactivé, mais le polling HTTP continuera')
        }
      }
    }
    
    connectSocket()

    // Vérifier l'état de connexion
    // Utiliser une ref pour éviter les mises à jour inutiles qui déclenchent des re-renders
    const checkConnection = () => {
      const nowConnected = adminSocketService.isConnected()
      
      // Ne mettre à jour l'état QUE si la valeur a réellement changé
      // Cela évite les re-renders inutiles qui déclenchent des effets
      if (isConnectedRef.current !== nowConnected) {
        const wasConnected = isConnectedRef.current
        isConnectedRef.current = nowConnected
        setIsConnected(nowConnected)
        
        console.log('🔌 [useRealTimeTracking] Connection state changed:', { 
          wasConnected, 
          nowConnected, 
          timestamp: new Date().toISOString() 
        })
      }
    }
    
    // Vérifier l'état de connexion initial
    checkConnection()
    // Vérifier la connexion toutes les 10 secondes (réduit de 5s pour moins de vérifications)
    const connectionInterval = setInterval(checkConnection, 10000)

    // Écouter la connexion admin
    const unsubscribeConnected = adminSocketService.on('admin:connected', () => {
      isConnectedRef.current = true
      setIsConnected(true)
      setIsLoading(false)
      setError(null)
      
      // Quand on se reconnecte, demander les données initiales
      if (process.env.NODE_ENV === 'development') {
        console.log('✅ [useRealTimeTracking] Admin connecté, en attente des données initiales...')
      }
    })

    // Écouter les drivers initiaux
    const unsubscribeInitialDrivers = adminSocketService.on('admin:initial-drivers', (data: unknown) => {
      const typedData = data as { drivers: OnlineDriver[] }
      if (typedData.drivers && Array.isArray(typedData.drivers)) {
        if (process.env.NODE_ENV === 'development') {
          console.log('📋 [useRealTimeTracking] Drivers initiaux reçus:', typedData.drivers.length)
          typedData.drivers.forEach((driver) => {
            const updatedAt = driver.updated_at ? new Date(driver.updated_at) : null
            const now = new Date()
            const diffInMinutes = updatedAt ? (now.getTime() - updatedAt.getTime()) / (1000 * 60) : null
            const isActive = updatedAt && diffInMinutes !== null && diffInMinutes <= 5
            
            console.log(`  - Driver ${driver.userId.substring(0, 8)}:`, {
              is_online: driver.is_online,
              is_available: driver.is_available,
              hasCoordinates: !!(driver.current_latitude && driver.current_longitude),
              coordinates: driver.current_latitude && driver.current_longitude 
                ? `${driver.current_latitude}, ${driver.current_longitude}` 
                : 'Non disponible',
              updated_at: driver.updated_at,
              diffInMinutes: diffInMinutes !== null ? `${diffInMinutes.toFixed(1)} min` : 'N/A',
              isActive: isActive,
            })
          })
        }
        const driversMap = new Map<string, OnlineDriver>()
        const now = new Date()
        
        // Filtrer uniquement les drivers en ligne avec coordonnées ET actifs (mis à jour dans les 5 dernières minutes)
        typedData.drivers.forEach((driver) => {
          const isOnline = driver.is_online === true
          const hasCoordinates = !!(driver.current_latitude && driver.current_longitude)
          
          // Vérifier si le driver est actif (mis à jour dans les 5 dernières minutes)
          let isActive = false
          if (driver.updated_at) {
            const updatedAt = new Date(driver.updated_at)
            const diffInMinutes = (now.getTime() - updatedAt.getTime()) / (1000 * 60)
            isActive = diffInMinutes <= 5
          }
          
          if (isOnline && hasCoordinates && isActive) {
            driversMap.set(driver.userId, driver)
          } else if (process.env.NODE_ENV === 'development') {
            const reasons = []
            if (!isOnline) reasons.push('hors ligne')
            if (!hasCoordinates) reasons.push('pas de coordonnées')
            if (!isActive) reasons.push('inactif (>5 min)')
            console.log(`❌ [useRealTimeTracking] Driver ${driver.userId.substring(0, 8)} filtré: ${reasons.join(', ')}`)
          }
        })
        setOnlineDrivers(driversMap)
        setIsLoading(false)
        
        if (process.env.NODE_ENV === 'development') {
          console.log('✅ [useRealTimeTracking] Drivers en ligne et actifs après filtrage:', driversMap.size)
        }
      }
    })

    // Écouter les événements de drivers
    const unsubscribeDriverOnline = adminSocketService.on('driver:online', (data: unknown) => {
      const typedData = data as OnlineDriver
      // Ne mettre à jour que si le driver est réellement en ligne
      if (typedData.is_online === true) {
        // Vérifier aussi que le driver est actif (mis à jour récemment)
        const now = new Date()
        let isActive = true
        if (typedData.updated_at) {
          const updatedAt = new Date(typedData.updated_at)
          const diffInMinutes = (now.getTime() - updatedAt.getTime()) / (1000 * 60)
          isActive = diffInMinutes <= 5
        }
        
        if (isActive) {
          if (process.env.NODE_ENV === 'development') {
            console.log('🟢 [useRealTimeTracking] Driver en ligne et actif:', {
              userId: typedData.userId.substring(0, 8),
              is_online: typedData.is_online,
              is_available: typedData.is_available,
              hasCoordinates: !!(typedData.current_latitude && typedData.current_longitude),
              coordinates: typedData.current_latitude && typedData.current_longitude 
                ? `${typedData.current_latitude}, ${typedData.current_longitude}` 
                : 'Non disponible',
              updated_at: typedData.updated_at,
            })
          }
          updateDriver(typedData)
        } else {
          // Driver marqué en ligne mais inactif (pas de mise à jour récente)
          if (process.env.NODE_ENV === 'development') {
            console.log('⚠️ [useRealTimeTracking] Driver marqué en ligne mais inactif (>5 min):', typedData.userId.substring(0, 8))
          }
          removeDriver(typedData.userId)
        }
      } else {
        // Si is_online est false, retirer le driver
        if (process.env.NODE_ENV === 'development') {
          console.log('🔴 [useRealTimeTracking] Driver hors ligne (via driver:online):', typedData.userId.substring(0, 8))
        }
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
      if (currentDriver) {
        // Mettre à jour uniquement si le driver est toujours en ligne
        if (currentDriver.is_online === true) {
          updateDriver({
            ...currentDriver,
            current_latitude: typedData.current_latitude,
            current_longitude: typedData.current_longitude,
            updated_at: typedData.updated_at,
          })
        } else {
          // Si le driver n'est plus en ligne, le retirer
          removeDriver(typedData.userId)
        }
      }
    })

    // Écouter les mises à jour de commandes
    const unsubscribeOrderUpdate = adminSocketService.on('order:status:update', (data: unknown) => {
      const typedData = data as OrderUpdateData
      if (typedData.order) {
        // Convertir l'order en Delivery
        const delivery: Delivery = {
          id: typedData.order.id,
          shipmentNumber: `EV-${typedData.order.id.replace(/-/g, '').substring(0, 10)}`,
          type: 'Orders',
          status: typedData.order.status,
          pickup: {
            name: typedData.order.pickup?.name || typedData.order.pickup?.address || 'Adresse inconnue',
            address: typedData.order.pickup?.address || typedData.order.pickup?.formatted_address || 'Adresse inconnue',
            coordinates: typedData.order.pickup?.coordinates
              ? (() => {
                  const lat = typedData.order.pickup.coordinates.latitude ?? typedData.order.pickup.coordinates.lat
                  const lng = typedData.order.pickup.coordinates.longitude ?? typedData.order.pickup.coordinates.lng
                  return lat !== undefined && lng !== undefined ? { lat, lng } : null
                })()
              : null,
          },
          dropoff: {
            name: typedData.order.dropoff?.name || typedData.order.dropoff?.address || 'Adresse inconnue',
            address: typedData.order.dropoff?.address || typedData.order.dropoff?.formatted_address || 'Adresse inconnue',
            coordinates: typedData.order.dropoff?.coordinates
              ? (() => {
                  const lat = typedData.order.dropoff.coordinates.latitude ?? typedData.order.dropoff.coordinates.lat
                  const lng = typedData.order.dropoff.coordinates.longitude ?? typedData.order.dropoff.coordinates.lng
                  return lat !== undefined && lng !== undefined ? { lat, lng } : null
                })()
              : null,
          },
          driverId: typedData.order.driverId,
          userId: typedData.order.user?.id,
          client: typedData.order.user
            ? {
                id: typedData.order.user.id,
                email: typedData.order.user.email || '',
                full_name: typedData.order.user.name || typedData.order.user.full_name,
                phone: typedData.order.user.phone,
                avatar_url: typedData.order.user.avatar,
              }
            : null,
          driver: typedData.order.driver
            ? {
                id: typedData.order.driver.id,
                email: typedData.order.driver.email || '',
                full_name: typedData.order.driver.full_name ?? typedData.order.driver.name,
                phone: typedData.order.driver.phone,
                avatar_url: typedData.order.driver.avatar_url,
              }
            : null,
        }

        // Si la commande est terminée ou annulée, la retirer immédiatement
        if (['completed', 'cancelled'].includes(delivery.status)) {
          // Retirer immédiatement pour que la carte se rafraîchisse
          removeDelivery(delivery.id)
        } else {
          updateDelivery(delivery)
        }
      }
    })

    // Écouter les erreurs
    const unsubscribeError = adminSocketService.on('admin:error', (data: unknown) => {
      const typedData = data as { message: string }
      setError(typedData.message)
    })

    // Charger les drivers depuis l'API si le socket n'est pas connecté après 5 secondes
    const loadDriversFromAPI = async () => {
      try {
        console.log('🔄 [useRealTimeTracking] loadDriversFromAPI CALLED', { 
          timestamp: new Date().toISOString(), 
          stack: new Error().stack,
          isConnected: adminSocketService.isConnected()
        })
        const result = await adminApiService.getOnlineDrivers()
        if (process.env.NODE_ENV === 'development') {
          console.log('📡 [useRealTimeTracking] Réponse API getOnlineDrivers:', {
            success: result.success,
            dataLength: result.data?.length || 0,
            message: result.message,
          })
        }
        if (result.success && result.data) {
          const driversMap = new Map<string, OnlineDriver>()
          result.data.forEach((driver) => {
            if (process.env.NODE_ENV === 'development') {
              console.log('🚗 [useRealTimeTracking] Driver trouvé:', {
                user_id: driver.user_id?.substring(0, 8),
                is_online: driver.is_online,
                hasCoordinates: !!(driver.current_latitude && driver.current_longitude),
              })
            }
            driversMap.set(driver.user_id, {
              userId: driver.user_id,
              is_online: driver.is_online,
              is_available: driver.is_available,
              current_latitude: driver.current_latitude,
              current_longitude: driver.current_longitude,
            })
          })
          setOnlineDrivers(driversMap)
          setIsLoading(false)
          if (process.env.NODE_ENV === 'development') {
            console.log(`✅ [useRealTimeTracking] ${driversMap.size} drivers chargés via API`)
          }
        } else if (process.env.NODE_ENV === 'development') {
          console.warn('⚠️ [useRealTimeTracking] Aucun driver trouvé ou erreur API:', result.message)
        }
      } catch (apiError) {
        console.error('❌ [useRealTimeTracking] Erreur lors du chargement des drivers via API:', apiError)
      }
    }

    // Écouter les échecs de connexion
    const unsubscribeConnectionFailed = adminSocketService.on('admin:connection-failed', async (data: unknown) => {
      const typedData = data as { message: string; url: string }
      if (process.env.NODE_ENV === 'development') {
        console.warn('⚠️ [useRealTimeTracking] Connexion Socket.IO échouée:', typedData.message)
        console.warn('⚠️ [useRealTimeTracking] Le polling HTTP sera utilisé à la place')
      }
      setError(typedData.message)
      setIsLoading(false)
      
      // Charger les drivers depuis l'API comme fallback
      await loadDriversFromAPI()
      
      // Nettoyer l'ancien intervalle s'il existe
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
        pollingIntervalRef.current = null
      }
      
      // Mettre en place un polling toutes les 5 minutes si le socket ne fonctionne pas
      // DÉSACTIVÉ : Le polling cause des refresh indésirables sur toutes les pages
      // Le socket devrait gérer les mises à jour en temps réel
      // Si le socket ne fonctionne pas, l'utilisateur peut recharger manuellement
      /*
      pollingIntervalRef.current = setInterval(() => {
        if (!adminSocketService.isConnected()) {
          loadDriversFromAPI()
        } else {
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current)
            pollingIntervalRef.current = null
          }
        }
      }, 300000) // 5 minutes (300000ms) - polling très espacé pour éviter les refreshs
      */
      
      // Charger les données initiales via l'API comme fallback
      try {
        const result = await adminApiService.getOngoingDeliveries()
        if (result.success && result.data) {
          // Convertir les données de l'API en format Delivery
          const orders: OrderFromAPI[] = (result.data as OrderFromAPI[]) || []
          const deliveries: Delivery[] = orders.map((order: OrderFromAPI) => ({
            id: order.id,
            shipmentNumber: order.shipmentNumber || `EV-${order.id.replace(/-/g, '').substring(0, 10)}`,
            type: 'Orders',
            status: order.status,
            pickup: {
              name: order.pickup?.name || order.pickup?.address || 'Adresse inconnue',
              address: order.pickup?.address || order.pickup?.formatted_address || 'Adresse inconnue',
              coordinates: order.pickup?.coordinates
                ? (() => {
                    const lat = order.pickup.coordinates.latitude ?? order.pickup.coordinates.lat
                    const lng = order.pickup.coordinates.longitude ?? order.pickup.coordinates.lng
                    return lat !== undefined && lng !== undefined ? { lat, lng } : null
                  })()
                : null,
            },
            dropoff: {
              name: order.dropoff?.name || order.dropoff?.address || 'Adresse inconnue',
              address: order.dropoff?.address || order.dropoff?.formatted_address || 'Adresse inconnue',
              coordinates: order.dropoff?.coordinates
                ? (() => {
                    const lat = order.dropoff.coordinates.latitude ?? order.dropoff.coordinates.lat
                    const lng = order.dropoff.coordinates.longitude ?? order.dropoff.coordinates.lng
                    return lat !== undefined && lng !== undefined ? { lat, lng } : null
                  })()
                : null,
            },
            driverId: order.driverId || order.driver_id,
            userId: order.userId || order.user_id,
            client: order.client,
            driver: order.driver
              ? {
                  id: order.driver.id,
                  email: order.driver.email || '',
                  full_name: order.driver.full_name ?? order.driver.name,
                  phone: order.driver.phone,
                  avatar_url: order.driver.avatar_url ?? order.driver.avatar,
                }
              : null,
          }))
          
          setOngoingDeliveries(deliveries)
        }
      } catch (apiError) {
        console.error('❌ [useRealTimeTracking] Erreur lors du chargement des données via API:', apiError)
      }
    })
    
        // Charger les drivers depuis l'API si le socket n'est pas connecté après 5 secondes
        const fallbackTimeout = setTimeout(async () => {
          if (!adminSocketService.isConnected()) {
            console.log('⏰ [useRealTimeTracking] Fallback timeout triggered (5s), loading drivers via API', {
              timestamp: new Date().toISOString(),
              isConnected: adminSocketService.isConnected()
            })
            await loadDriversFromAPI()
          } else {
            console.log('✅ [useRealTimeTracking] Socket connected, skipping fallback')
          }
        }, 5000)
        
        // Charger les livraisons initiales depuis l'API si le socket n'est pas connecté après 5 secondes
        const deliveriesFallbackTimeout = setTimeout(async () => {
          if (!adminSocketService.isConnected() && deliveriesRef.current.length === 0) {
            if (process.env.NODE_ENV === 'development') {
              console.log('🔄 [useRealTimeTracking] Chargement des livraisons via API (fallback)')
            }
            
            try {
              const result = await adminApiService.getOngoingDeliveries()
              if (result.success && result.data) {
                const orders: OrderFromAPI[] = (result.data as OrderFromAPI[]) || []
                const deliveries: Delivery[] = orders.map((order: OrderFromAPI) => ({
                  id: order.id,
                  shipmentNumber: order.shipmentNumber || `EV-${order.id.replace(/-/g, '').substring(0, 10)}`,
                  type: 'Orders',
                  status: order.status,
                  pickup: {
                    name: order.pickup?.name || order.pickup?.address || 'Adresse inconnue',
                    address: order.pickup?.address || order.pickup?.formatted_address || 'Adresse inconnue',
                    coordinates: order.pickup?.coordinates
                      ? (() => {
                          const lat = order.pickup.coordinates.latitude ?? order.pickup.coordinates.lat
                          const lng = order.pickup.coordinates.longitude ?? order.pickup.coordinates.lng
                          return lat !== undefined && lng !== undefined ? { lat, lng } : null
                        })()
                      : null,
                  },
                  dropoff: {
                    name: order.dropoff?.name || order.dropoff?.address || 'Adresse inconnue',
                    address: order.dropoff?.address || order.dropoff?.formatted_address || 'Adresse inconnue',
                    coordinates: order.dropoff?.coordinates
                      ? (() => {
                          const lat = order.dropoff.coordinates.latitude ?? order.dropoff.coordinates.lat
                          const lng = order.dropoff.coordinates.longitude ?? order.dropoff.coordinates.lng
                          return lat !== undefined && lng !== undefined ? { lat, lng } : null
                        })()
                      : null,
                  },
                  driverId: order.driverId || order.driver_id,
                  userId: order.userId || order.user_id,
                  client: order.client,
                  driver: order.driver
                    ? {
                        id: order.driver.id,
                        email: order.driver.email || '',
                        full_name: order.driver.full_name ?? order.driver.name,
                        phone: order.driver.phone,
                        avatar_url: order.driver.avatar_url ?? order.driver.avatar,
                      }
                    : null,
                }))
                
                // Filtrer les livraisons terminées avant de les définir
                const activeDeliveries = deliveries.filter(
                  (d) => d.status !== 'completed' && d.status !== 'cancelled'
                )
                setOngoingDeliveries(activeDeliveries)
                setIsLoading(false)
                if (process.env.NODE_ENV === 'development') {
                  console.log('📦 [useRealTimeTracking] Livraisons chargées via API (fallback):', {
                    total: deliveries.length,
                    active: activeDeliveries.length,
                    timestamp: new Date().toISOString()
                  })
                }
              }
            } catch (apiError) {
              console.error('❌ [useRealTimeTracking] Erreur lors du chargement des livraisons via API:', apiError)
              setIsLoading(false)
            }
          }
        }, 5000)

    // Cleanup
    return () => {
      clearInterval(connectionInterval)
      clearTimeout(fallbackTimeout)
      clearTimeout(deliveriesFallbackTimeout)
      // Nettoyer le polling interval s'il existe
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
        pollingIntervalRef.current = null
      }
      unsubscribeConnected()
      unsubscribeInitialDrivers()
      unsubscribeDriverOnline()
      unsubscribeDriverOffline()
      unsubscribeDriverPosition()
      unsubscribeOrderUpdate()
      unsubscribeError()
      unsubscribeConnectionFailed()
      // Ne pas déconnecter ici car d'autres composants pourraient utiliser le service
    }
    // Ne pas inclure isConnected dans les dépendances pour éviter les réexécutions inutiles
    // On utilise isConnectedRef pour vérifier l'état sans déclencher de re-renders
  }, [updateDriver, removeDriver, updateDelivery, removeDelivery])

  // Fonction pour recharger les données manuellement
  const reloadData = useCallback(async () => {
    try {
      // Recharger les drivers
      const driversResult = await adminApiService.getOnlineDrivers()
      if (driversResult.success && driversResult.data) {
        const driversMap = new Map<string, OnlineDriver>()
        driversResult.data.forEach((driver) => {
          if (driver.is_online === true && driver.current_latitude && driver.current_longitude) {
            driversMap.set(driver.user_id, {
              userId: driver.user_id,
              is_online: driver.is_online,
              is_available: driver.is_available,
              current_latitude: driver.current_latitude,
              current_longitude: driver.current_longitude,
            })
          }
        })
        setOnlineDrivers(driversMap)
        
        if (process.env.NODE_ENV === 'development') {
          console.log('🔄 [useRealTimeTracking] Données rechargées manuellement:', {
            drivers: driversMap.size,
          })
        }
      }
      
      // Recharger les livraisons
      const deliveriesResult = await adminApiService.getOngoingDeliveries()
      if (deliveriesResult.success && deliveriesResult.data) {
        const orders: OrderFromAPI[] = (deliveriesResult.data as OrderFromAPI[]) || []
        const deliveries: Delivery[] = orders.map((order: OrderFromAPI) => ({
          id: order.id,
          shipmentNumber: order.shipmentNumber || `EV-${order.id.replace(/-/g, '').substring(0, 10)}`,
          type: 'Orders',
          status: order.status,
          pickup: {
            name: order.pickup?.name || order.pickup?.address || 'Adresse inconnue',
            address: order.pickup?.address || order.pickup?.formatted_address || 'Adresse inconnue',
            coordinates: order.pickup?.coordinates
              ? (() => {
                  const lat = order.pickup.coordinates.latitude ?? order.pickup.coordinates.lat
                  const lng = order.pickup.coordinates.longitude ?? order.pickup.coordinates.lng
                  return lat !== undefined && lng !== undefined ? { lat, lng } : null
                })()
              : null,
          },
          dropoff: {
            name: order.dropoff?.name || order.dropoff?.address || 'Adresse inconnue',
            address: order.dropoff?.address || order.dropoff?.formatted_address || 'Adresse inconnue',
            coordinates: order.dropoff?.coordinates
              ? (() => {
                  const lat = order.dropoff.coordinates.latitude ?? order.dropoff.coordinates.lat
                  const lng = order.dropoff.coordinates.longitude ?? order.dropoff.coordinates.lng
                  return lat !== undefined && lng !== undefined ? { lat, lng } : null
                })()
              : null,
          },
          driverId: order.driverId || order.driver_id,
          userId: order.userId || order.user_id,
          client: order.client,
          driver: order.driver
            ? {
                id: order.driver.id,
                email: order.driver.email || '',
                full_name: order.driver.full_name ?? order.driver.name,
                phone: order.driver.phone,
                avatar_url: order.driver.avatar_url ?? order.driver.avatar,
              }
            : null,
        }))
        
        // Filtrer les livraisons terminées
        const activeDeliveries = deliveries.filter(
          (d) => d.status !== 'completed' && d.status !== 'cancelled'
        )
        setOngoingDeliveries(activeDeliveries)
        
        if (process.env.NODE_ENV === 'development') {
          console.log('🔄 [useRealTimeTracking] Livraisons rechargées manuellement:', activeDeliveries.length)
        }
      }
    } catch (error) {
      console.error('❌ [useRealTimeTracking] Erreur lors du rechargement des données:', error)
    }
  }, [])

  return {
    onlineDrivers,
    isConnected,
    ongoingDeliveries,
    isLoading,
    error,
    reloadData, // Exposer la fonction de rechargement
  }
}

