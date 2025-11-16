'use client'

import React, { useState, useMemo, useEffect, useRef } from 'react'
import { Search, Filter } from 'lucide-react'
import { GoogleMap, Marker, Polyline, InfoWindow } from '@react-google-maps/api'
import { usePathname } from 'next/navigation'
import DeliveryCard from '@/components/tracking/DeliveryCard'
import { useGoogleMaps } from '@/contexts/GoogleMapsContext'
import { useRealTimeTracking } from '@/hooks/useRealTimeTracking'
import { ScreenTransition } from '@/components/animations'
import { SkeletonLoader } from '@/components/animations'

const mapContainerStyle = {
  width: '100%',
  height: '100%',
  borderRadius: '12px',
}

interface Delivery {
  id: string
  shipmentNumber: string
  type: string
  status: string
  createdAt?: string
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

function TrackingMap({ 
  selectedDelivery, 
  isLoaded, 
  loadError,
  onlineDrivers
}: { 
  selectedDelivery: Delivery | null
  isLoaded: boolean
  loadError: Error | undefined
  onlineDrivers: Array<{
    userId: string
    is_online: boolean
    is_available: boolean
    current_latitude?: number
    current_longitude?: number
    updated_at?: string
  }>
}) {
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null)

  // Trouver le livreur assigné à la livraison sélectionnée
  const assignedDriver = useMemo(() => {
    if (!selectedDelivery || !selectedDelivery.driverId) return null
    return onlineDrivers.find(driver => driver.userId === selectedDelivery.driverId) || null
  }, [selectedDelivery, onlineDrivers])

  const mapOptions = useMemo(
    () => ({
      disableDefaultUI: true,
      zoomControl: true,
      styles: [
        {
          featureType: 'poi',
          elementType: 'labels',
          stylers: [{ visibility: 'off' }],
        },
      ],
    }),
    []
  )

  const center = useMemo(() => {
    if (selectedDelivery?.pickup?.coordinates) {
      return {
        lat: selectedDelivery.pickup.coordinates.lat,
        lng: selectedDelivery.pickup.coordinates.lng,
      }
    }
    return {
      lat: 5.3600, // Abidjan par défaut
      lng: -4.0083,
    }
  }, [selectedDelivery])

  const routePath = useMemo(() => {
    if (selectedDelivery?.pickup?.coordinates && selectedDelivery?.dropoff?.coordinates) {
      return [
        selectedDelivery.pickup.coordinates,
        selectedDelivery.dropoff.coordinates,
      ]
    }
    return []
  }, [selectedDelivery])

  // Calculer la position actuelle du véhicule (position réelle du livreur ou milieu de la route)
  // Ne retourner la position que si le livreur est en ligne
  const currentVehiclePosition = useMemo(() => {
    // Si on a un livreur assigné, en ligne, avec des coordonnées GPS, utiliser sa position réelle
    if (assignedDriver?.is_online === true && assignedDriver?.current_latitude && assignedDriver?.current_longitude) {
      return {
        lat: assignedDriver.current_latitude,
        lng: assignedDriver.current_longitude,
      }
    }
    // Ne pas afficher de position si le livreur n'est pas en ligne
    return null
  }, [assignedDriver])

  // Calculer le trajet du livreur vers le point de livraison
  // Ne calculer que si le livreur est en ligne et a une position
  const driverRoutePath = useMemo(() => {
    // Vérifier que le livreur est en ligne avant de calculer le trajet
    if (!currentVehiclePosition || !assignedDriver || assignedDriver.is_online !== true) {
      return []
    }
    
    // Selon le statut de la commande, le livreur va vers pickup ou dropoff
    if (selectedDelivery?.status === 'accepted' || selectedDelivery?.status === 'enroute') {
      // Le livreur va vers le point de pickup
      if (selectedDelivery?.pickup?.coordinates) {
        return [currentVehiclePosition, selectedDelivery.pickup.coordinates]
      }
    } else if (selectedDelivery?.status === 'picked_up') {
      // Le livreur va vers le point de dropoff
      if (selectedDelivery?.dropoff?.coordinates) {
        return [currentVehiclePosition, selectedDelivery.dropoff.coordinates]
      }
    }
    
    return []
  }, [currentVehiclePosition, selectedDelivery, assignedDriver])

  // État pour l'animation du polyline
  const [animationOffset, setAnimationOffset] = useState(0)

  // Animation du polyline
  useEffect(() => {
    if (driverRoutePath.length < 2) return

    const interval = setInterval(() => {
      setAnimationOffset((prev) => (prev + 0.01) % 1)
    }, 50) // Mise à jour toutes les 50ms pour une animation fluide

    return () => clearInterval(interval)
  }, [driverRoutePath.length])

  const mapPlaceholderStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    backgroundColor: '#F3F4F6',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  }

  const mapPlaceholderTextStyle: React.CSSProperties = {
    fontSize: '14px',
    color: '#6B7280',
  }

      // Créer une clé unique pour forcer le re-render complet quand on change de livraison
      // Inclure aussi le statut pour forcer le refresh quand une commande est terminée
      const mapKey = useMemo(() => {
        if (!selectedDelivery) return 'map-default'
        return `map-${selectedDelivery.id}-${selectedDelivery.status}`
      }, [selectedDelivery])

  // Gérer les états de chargement et d'erreur
  if (loadError) {
    return (
      <div style={mapPlaceholderStyle}>
        <p style={mapPlaceholderTextStyle}>Erreur de chargement de la carte</p>
      </div>
    )
  }

  if (!isLoaded) {
    return (
      <div style={mapPlaceholderStyle}>
        <p style={mapPlaceholderTextStyle}>Chargement de la carte...</p>
      </div>
    )
  }

  return (
    <GoogleMap
      key={mapKey}
      mapContainerStyle={mapContainerStyle}
      center={center}
      zoom={routePath.length > 0 ? 12 : 10}
      options={mapOptions}
    >
      {/* Afficher uniquement le polyline et les marqueurs de la livraison sélectionnée */}
      {selectedDelivery && routePath.length >= 2 && (
        <>
          {/* Polyline entre le point de départ et d'arrivée (route complète) */}
          <Polyline
            key={`polyline-full-${selectedDelivery.id}`}
            path={routePath}
            options={{
              strokeColor: '#E5E7EB',
              strokeWeight: 3,
              strokeOpacity: 0.5,
              zIndex: 1,
            }}
          />
          
          {/* Polyline du livreur vers le point de livraison (trajet actuel avec animation) */}
          {driverRoutePath.length >= 2 && (
            <Polyline
              key={`polyline-driver-${selectedDelivery.id}-${animationOffset}`}
              path={driverRoutePath}
              options={{
                strokeColor: '#8B5CF6',
                strokeWeight: 6,
                strokeOpacity: 1,
                zIndex: 2,
                icons: [
                  {
                    icon: {
                      // Créer une flèche personnalisée pointant vers l'avant
                      path: window.google?.maps?.SymbolPath?.FORWARD_CLOSED_ARROW || 
                            (window.google?.maps?.SymbolPath?.FORWARD_OPEN_ARROW) ||
                            // Fallback: créer un chemin de flèche manuellement
                            'M 0,-2 0,2 M -2,-2 0,0 -2,2',
                      scale: 5,
                      strokeColor: '#FFFFFF',
                      strokeWeight: 2.5,
                      fillColor: '#8B5CF6',
                      fillOpacity: 1,
                      rotation: 0,
                    },
                    offset: `${(animationOffset * 100).toFixed(0)}%`,
                    repeat: '80px',
                  },
                ],
              }}
            />
          )}
          
          {/* Marqueur de départ (vert) */}
          <Marker
            key={`marker-pickup-${selectedDelivery.id}`}
            position={routePath[0]}
            icon={{
              path: window.google?.maps?.SymbolPath?.CIRCLE || 0,
              scale: 10,
              fillColor: '#10B981',
              fillOpacity: 1,
              strokeColor: '#FFFFFF',
              strokeWeight: 2,
            }}
          />
          <InfoWindow position={routePath[0]}>
            <div style={{ padding: '4px' }}>
              <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '4px' }}>
                {selectedDelivery.pickup?.name || 'Point de départ'}
              </div>
              <div style={{ fontSize: '12px', color: '#6B7280' }}>
                {selectedDelivery.pickup?.address || ''}
              </div>
            </div>
          </InfoWindow>
          
          {/* Marqueur d'arrivée (violet) */}
          <Marker
            key={`marker-dropoff-${selectedDelivery.id}`}
            position={routePath[1]}
            icon={{
              path: window.google?.maps?.SymbolPath?.CIRCLE || 0,
              scale: 10,
              fillColor: '#8B5CF6',
              fillOpacity: 1,
              strokeColor: '#FFFFFF',
              strokeWeight: 2,
            }}
          />
          <InfoWindow position={routePath[1]}>
            <div style={{ padding: '4px' }}>
              <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '4px' }}>
                {selectedDelivery.dropoff?.name || 'Point d\'arrivée'}
              </div>
              <div style={{ fontSize: '12px', color: '#6B7280' }}>
                {selectedDelivery.dropoff?.address || ''}
              </div>
            </div>
          </InfoWindow>
          
          {/* Position actuelle du livreur (si assigné, en ligne et avec coordonnées GPS) */}
          {currentVehiclePosition && assignedDriver && assignedDriver.is_online === true && (
            <>
              {/* Cercle pulsant pour la position actuelle du livreur */}
              <Marker
                key={`driver-inner-${selectedDelivery.id}`}
                position={currentVehiclePosition}
                icon={{
                  path: window.google?.maps?.SymbolPath?.CIRCLE || 0,
                  scale: 14,
                  fillColor: '#3B82F6',
                  fillOpacity: 0.8,
                  strokeColor: '#FFFFFF',
                  strokeWeight: 3,
                }}
              />
              {/* Cercle extérieur pulsant */}
              <Marker
                key={`driver-outer-${selectedDelivery.id}`}
                position={currentVehiclePosition}
                icon={{
                  path: window.google?.maps?.SymbolPath?.CIRCLE || 0,
                  scale: 24,
                  fillColor: '#3B82F6',
                  fillOpacity: 0.2,
                  strokeColor: '#3B82F6',
                  strokeWeight: 2,
                }}
              />
              {/* InfoWindow pour le livreur */}
              <InfoWindow position={currentVehiclePosition}>
                <div style={{ padding: '4px' }}>
                  <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '4px' }}>
                    {assignedDriver.userId ? `Livreur ${assignedDriver.userId.substring(0, 8)}` : 'Livreur'}
                  </div>
                  <div style={{ fontSize: '12px', color: '#6B7280' }}>
                    {selectedDelivery.status === 'accepted' || selectedDelivery.status === 'enroute' 
                      ? 'En route vers le point de collecte'
                      : selectedDelivery.status === 'picked_up'
                      ? 'En route vers la destination'
                      : 'En livraison'}
                  </div>
                </div>
              </InfoWindow>
            </>
          )}
        </>
      )}

          {/* Afficher tous les drivers connectés sur la carte */}
          {/* Note: onlineDrivers est déjà filtré pour ne contenir que les drivers en ligne avec coordonnées */}
          {(() => {
            if (onlineDrivers.length > 0) {
              if (process.env.NODE_ENV === 'development') {
                console.log('🗺️ [TrackingMap] Tentative d\'affichage de', onlineDrivers.length, 'drivers sur la carte')
              }
            }
            return null
          })()}
          {onlineDrivers.map((driver) => {
            // Vérification de sécurité supplémentaire (normalement déjà filtré dans onlineDriversArray)
            const isOnlineStrict = driver.is_online === true
            const hasCoords = !!(driver.current_latitude && driver.current_longitude)
            
            if (!isOnlineStrict || !hasCoords) {
              if (process.env.NODE_ENV === 'development') {
                console.warn('⚠️ [TrackingMap] Driver filtré au dernier moment:', {
                  userId: driver.userId?.substring(0, 8),
                  is_online: driver.is_online,
                  is_online_strict: isOnlineStrict,
                  hasCoords,
                })
              }
              return null
            }
            
            if (process.env.NODE_ENV === 'development') {
              console.log('✅ [TrackingMap] Affichage du driver:', {
                userId: driver.userId?.substring(0, 8),
                is_online: driver.is_online,
                coords: `${driver.current_latitude}, ${driver.current_longitude}`,
              })
            }
            
            // Type assertion car on a déjà vérifié que les coordonnées existent
            const driverPosition = {
              lat: driver.current_latitude!,
              lng: driver.current_longitude!,
            }
            
            return (
              <React.Fragment key={`driver-${driver.userId}`}>
                <Marker
                  position={driverPosition}
                  icon={{
                    path: window.google?.maps?.SymbolPath?.CIRCLE || 0,
                    scale: 8,
                    fillColor: '#3B82F6',
                    fillOpacity: 1,
                    strokeColor: '#FFFFFF',
                    strokeWeight: 2,
                  }}
                  onClick={() => setSelectedDriverId(selectedDriverId === driver.userId ? null : driver.userId)}
                />
                {selectedDriverId === driver.userId && (
                  <InfoWindow position={driverPosition} onCloseClick={() => setSelectedDriverId(null)}>
                    <div style={{ padding: '4px' }}>
                      <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '4px' }}>
                        Driver {driver.userId.substring(0, 8)}
                      </div>
                      <div style={{ fontSize: '12px', color: '#6B7280' }}>
                        {driver.is_available ? 'Disponible' : 'Occupé'}
                      </div>
                    </div>
                  </InfoWindow>
                )}
              </React.Fragment>
            )
          })}
    </GoogleMap>
  )
}

export default function TrackingPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedDelivery, setSelectedDelivery] = useState<Delivery | null>(null)
  const pathname = usePathname()
  const hasLoadedRef = useRef(false)

  // Utiliser le contexte Google Maps partagé
  const { isLoaded, loadError } = useGoogleMaps()

  // Utiliser le suivi en temps réel
  const { onlineDrivers, ongoingDeliveries, isLoading, reloadData } = useRealTimeTracking()

  // Recharger les données quand on revient sur la page Tracking
  useEffect(() => {
    // Si c'est la première fois qu'on charge la page, marquer comme chargé
    if (!hasLoadedRef.current) {
      hasLoadedRef.current = true
      return
    }

    // Si on revient sur la page Tracking (pathname change vers /tracking)
    if (pathname === '/tracking') {
      if (process.env.NODE_ENV === 'development') {
        console.log('🔄 [TrackingPage] Retour sur la page Tracking, rechargement des données...')
      }
      // Recharger les données après un court délai pour s'assurer que le composant est monté
      const timer = setTimeout(() => {
        reloadData()
      }, 500)
      
      return () => clearTimeout(timer)
    }
  }, [pathname, reloadData])

  // Recharger aussi quand la page redevient visible (onglet du navigateur)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && pathname === '/tracking') {
        // Recharger les données quand on revient sur l'onglet
        if (process.env.NODE_ENV === 'development') {
          console.log('🔄 [TrackingPage] Onglet redevient visible, rechargement des données...')
        }
        reloadData()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [pathname, reloadData])

  // Ne plus charger les livraisons initiales ici - elles sont gérées par useRealTimeTracking
  // Le hook gère déjà le chargement via Socket.IO et l'API en fallback

  // Utiliser les vraies données du suivi en temps réel
  // Filtrer les commandes terminées ou annulées
  const filteredDeliveries = useMemo(() => {
    // Log pour déboguer les changements
    if (process.env.NODE_ENV === 'development') {
      console.log('🔍 [TrackingPage] filteredDeliveries recalculé:', {
        ongoingDeliveriesLength: ongoingDeliveries.length,
        timestamp: new Date().toISOString(),
        stack: new Error().stack?.split('\n').slice(2, 5).join('\n')
      })
    }
    
    const deliveries = ongoingDeliveries.length > 0 ? ongoingDeliveries : []
    if (!deliveries || deliveries.length === 0) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('⚠️ [TrackingPage] Aucune livraison disponible')
      }
      return []
    }
    
    // Filtrer les commandes terminées ou annulées
    const activeDeliveries = deliveries.filter((delivery: Delivery) => 
      delivery.status !== 'completed' && delivery.status !== 'cancelled'
    )
    
    if (!searchQuery) return activeDeliveries
    
    return activeDeliveries.filter((delivery: Delivery) =>
      delivery.shipmentNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      delivery.pickup.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      delivery.dropoff.name.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [ongoingDeliveries, searchQuery])

  // Sélectionner la première livraison par défaut
  useEffect(() => {
    if (filteredDeliveries.length > 0 && !selectedDelivery) {
      // Utiliser un setTimeout pour éviter le rendu synchrone
      const timer = setTimeout(() => {
        setSelectedDelivery(filteredDeliveries[0])
      }, 0)
      return () => clearTimeout(timer)
    }
  }, [filteredDeliveries, selectedDelivery])

  // Désélectionner la livraison si elle est terminée ou annulée
  useEffect(() => {
    if (selectedDelivery) {
      const isStillActive = filteredDeliveries.some(
        (delivery: Delivery) => delivery.id === selectedDelivery.id
      )
      
      if (!isStillActive) {
        // La livraison sélectionnée n'est plus dans la liste active
        // Désélectionner et sélectionner la première disponible
        const timer = setTimeout(() => {
          if (filteredDeliveries.length > 0) {
            setSelectedDelivery(filteredDeliveries[0])
          } else {
            setSelectedDelivery(null)
          }
        }, 0)
        return () => clearTimeout(timer)
      }
    }
  }, [filteredDeliveries, selectedDelivery])

  // Convertir les drivers en ligne en array pour l'affichage
  // Filtrer uniquement les drivers qui sont réellement en ligne
  const onlineDriversArray = useMemo(() => {
    const allDrivers = Array.from(onlineDrivers.values())
    
    // Vérifier si un driver est vraiment actif (mis à jour dans les 5 dernières minutes)
    const isDriverReallyActive = (driver: typeof allDrivers[0]): boolean => {
      if (!driver.updated_at) {
        // Si pas de date de mise à jour, considérer comme inactif
        return false
      }
      
      const updatedAt = new Date(driver.updated_at)
      const now = new Date()
      const diffInMinutes = (now.getTime() - updatedAt.getTime()) / (1000 * 60)
      
      // Si la dernière mise à jour date de plus de 5 minutes, considérer comme inactif
      return diffInMinutes <= 5
    }
    
    console.log('🔍 [TrackingPage] DEBUG - Analyse des drivers:', {
      totalInMap: allDrivers.length,
      drivers: allDrivers.map((d) => {
        const updatedAt = d.updated_at ? new Date(d.updated_at) : null
        const now = new Date()
        const diffInMinutes = updatedAt ? (now.getTime() - updatedAt.getTime()) / (1000 * 60) : null
        const isActive = isDriverReallyActive(d)
        
        return {
          userId: d.userId?.substring(0, 8) || 'unknown',
          is_online: d.is_online,
          is_online_type: typeof d.is_online,
          is_online_strict: d.is_online === true,
          hasLat: !!d.current_latitude,
          hasLng: !!d.current_longitude,
          updated_at: d.updated_at,
          diffInMinutes: diffInMinutes !== null ? `${diffInMinutes.toFixed(1)} min` : 'N/A',
          isReallyActive: isActive,
        }
      }),
    })
    
    // Filtrer uniquement les drivers qui sont en ligne, ont des coordonnées ET sont actifs
    const filteredDrivers = allDrivers.filter((driver) => {
      // Vérification stricte : is_online doit être exactement true (pas truthy)
      const isOnline = driver.is_online === true
      const hasCoordinates = !!(driver.current_latitude && driver.current_longitude)
      const isActive = isDriverReallyActive(driver)
      const shouldDisplay = isOnline && hasCoordinates && isActive
      
      if (process.env.NODE_ENV === 'development') {
        if (!shouldDisplay) {
          const reasons = []
          if (!isOnline) reasons.push('hors ligne (is_online !== true)')
          if (!hasCoordinates) reasons.push('pas de coordonnées')
          if (!isActive) reasons.push('inactif (>5 min)')
          
          console.log(`❌ [TrackingPage] Driver ${driver.userId?.substring(0, 8) || 'unknown'} FILTRÉ:`, {
            is_online: driver.is_online,
            is_online_strict: isOnline,
            hasCoordinates,
            isActive,
            updated_at: driver.updated_at,
            reasons: reasons.join(', '),
          })
        }
      }
      
      return shouldDisplay
    })
    
    console.log('✅ [TrackingPage] Drivers après filtrage:', {
      total: allDrivers.length,
      filtered: filteredDrivers.length,
      willBeDisplayed: filteredDrivers.map((d) => d.userId?.substring(0, 8) || 'unknown'),
    })
    
    return filteredDrivers
  }, [onlineDrivers])

  // Fonction pour gérer la sélection d'une livraison
  const handleDeliverySelect = (delivery: Delivery) => {
    setSelectedDelivery(delivery)
  }

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    height: '100vh',
    gap: '24px',
    padding: '24px',
    backgroundColor: '#F5F6FA',
  }

  const leftPanelStyle: React.CSSProperties = {
    width: '420px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    overflow: 'hidden',
  }

  const searchContainerStyle: React.CSSProperties = {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  }

  const searchIconStyle: React.CSSProperties = {
    position: 'absolute',
    left: '16px',
    color: '#6B7280',
    pointerEvents: 'none',
  }

  const searchInputStyle: React.CSSProperties = {
    width: '100%',
    paddingLeft: '48px',
    paddingRight: '48px',
    paddingTop: '12px',
    paddingBottom: '12px',
    backgroundColor: '#FFFFFF',
    borderRadius: '12px',
    border: '1px solid #E5E7EB',
    fontSize: '14px',
    outline: 'none',
  }

  const filterButtonStyle: React.CSSProperties = {
    position: 'absolute',
    right: '12px',
    padding: '8px',
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
  }

  const titleStyle: React.CSSProperties = {
    fontSize: '18px',
    fontWeight: 700,
    color: '#111827',
    marginBottom: '16px',
  }

  const deliveriesListStyle: React.CSSProperties = {
    flex: 1,
    overflowY: 'auto',
    paddingRight: '8px',
  }

  const rightPanelStyle: React.CSSProperties = {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: '16px',
    padding: '16px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    border: '1px solid #F3F4F6',
    overflow: 'hidden',
  }

  const emptyStateStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: '#6B7280',
  }

  return (
    <ScreenTransition direction="fade" duration={0.3}>
      <div style={containerStyle}>
      {/* Panneau gauche : Liste des livraisons */}
      <div style={leftPanelStyle}>
        <div style={searchContainerStyle}>
          <Search size={20} style={searchIconStyle} />
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={searchInputStyle}
          />
          <button
            style={filterButtonStyle}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#F3F4F6'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent'
            }}
          >
            <Filter size={20} style={{ color: '#6B7280' }} />
          </button>
        </div>

        <h2 style={titleStyle}>Ongoing Delivery</h2>

        <div style={deliveriesListStyle}>
          {isLoading ? (
            <div style={emptyStateStyle}>
              <SkeletonLoader width="100%" height={200} borderRadius={16} />
              <SkeletonLoader width="100%" height={200} borderRadius={16} style={{ marginTop: '16px' }} />
              <SkeletonLoader width="100%" height={200} borderRadius={16} style={{ marginTop: '16px' }} />
            </div>
          ) : filteredDeliveries.length === 0 ? (
            <div style={emptyStateStyle}>
              <p>Aucune livraison en cours</p>
            </div>
          ) : (
            filteredDeliveries.map((delivery: Delivery, index: number) => (
              <DeliveryCard
                key={delivery.id}
                delivery={delivery}
                isSelected={selectedDelivery?.id === delivery.id}
                onSelect={() => handleDeliverySelect(delivery)}
                index={index}
              />
            ))
          )}
        </div>
      </div>

      {/* Panneau droit : Carte */}
      <div style={rightPanelStyle}>
        <TrackingMap 
          selectedDelivery={selectedDelivery} 
          isLoaded={isLoaded}
          loadError={loadError}
          onlineDrivers={onlineDriversArray}
        />
      </div>
    </div>
    </ScreenTransition>
  )
}
