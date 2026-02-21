'use client'

import React, { useState, useMemo, useEffect, useRef } from 'react'
import { Search, Filter } from 'lucide-react'
import { usePathname } from 'next/navigation'
import DeliveryCard from '@/components/tracking/DeliveryCard'
import MapboxTrackingMap from '@/components/tracking/MapboxTrackingMap'
import { useRealTimeTracking } from '@/hooks/useRealTimeTracking'
import { ScreenTransition } from '@/components/animations'
import { SkeletonLoader } from '@/components/animations'
import { logger } from '@/utils/logger'
import { themeColors } from '@/utils/theme'

const DEFAULT_CENTER = { lat: 5.36, lng: -4.0083 }

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

export default function TrackingPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedDelivery, setSelectedDelivery] = useState<Delivery | null>(null)
  const [adminLocation, setAdminLocation] = useState<{ lat: number; lng: number }>(DEFAULT_CENTER)
  const pathname = usePathname()
  const hasLoadedRef = useRef(false)

  // Utiliser le suivi en temps réel
  const { onlineDrivers, ongoingDeliveries, isLoading, reloadData } = useRealTimeTracking()

  useEffect(() => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setAdminLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        })
      },
      (error) => {
        logger.warn('[TrackingPage] Impossible de récupérer la position admin:', error)
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60 * 1000,
      }
    )
  }, [])

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
        logger.debug('[TrackingPage] Retour sur la page Tracking, rechargement des données...')
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
          logger.debug('[TrackingPage] Onglet redevient visible, rechargement des données...')
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
      logger.debug('[TrackingPage] filteredDeliveries recalculé:', {
        ongoingDeliveriesLength: ongoingDeliveries.length,
        timestamp: new Date().toISOString(),
        stack: new Error().stack?.split('\n').slice(2, 5).join('\n')
      })
    }
    
    const deliveries = ongoingDeliveries.length > 0 ? ongoingDeliveries : []
    if (!deliveries || deliveries.length === 0) {
      if (process.env.NODE_ENV === 'development') {
        logger.warn('[TrackingPage] Aucune livraison disponible')
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
    
    logger.debug(' [TrackingPage] DEBUG - Analyse des drivers:', {
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
          
          logger.debug(`[TrackingPage] Driver ${driver.userId?.substring(0, 8) || 'unknown'} FILTRÉ:`, {
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
    
    logger.debug('[TrackingPage] Drivers après filtrage:', {
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
    backgroundColor: themeColors.background,
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
    color: themeColors.textSecondary,
    pointerEvents: 'none',
  }

  const searchInputStyle: React.CSSProperties = {
    width: '100%',
    paddingLeft: '48px',
    paddingRight: '48px',
    paddingTop: '12px',
    paddingBottom: '12px',
    backgroundColor: themeColors.cardBg,
    borderRadius: '12px',
    border: `1px solid ${themeColors.cardBorder}`,
    fontSize: '14px',
    outline: 'none',
    color: themeColors.textPrimary,
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
    color: themeColors.textPrimary,
    marginBottom: '16px',
  }

  const deliveriesListStyle: React.CSSProperties = {
    flex: 1,
    overflowY: 'auto',
    paddingRight: '8px',
  }

  const rightPanelStyle: React.CSSProperties = {
    flex: 1,
    backgroundColor: themeColors.cardBg,
    borderRadius: '16px',
    padding: '16px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    border: `1px solid ${themeColors.cardBorder}`,
    overflow: 'hidden',
  }

  const emptyStateStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: themeColors.textSecondary,
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
              e.currentTarget.style.backgroundColor = themeColors.grayLight
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent'
            }}
          >
            <Filter size={20} style={{ color: themeColors.textSecondary }} />
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
        <MapboxTrackingMap
          selectedDelivery={selectedDelivery}
          onlineDrivers={onlineDriversArray}
          adminLocation={adminLocation}
        />
      </div>
    </div>
    </ScreenTransition>
  )
}
