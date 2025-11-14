'use client'

import React, { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, Filter } from 'lucide-react'
import { GoogleMap, useLoadScript, Marker, Polyline } from '@react-google-maps/api'
import { adminApiService } from '@/lib/adminApiService'
import DeliveryCard from '@/components/tracking/DeliveryCard'

// Type pour l'API Google Maps dans window
interface GoogleMapsWindow extends Window {
  google?: {
    maps?: {
      Size?: new (width: number, height: number) => {
        width: number
        height: number
        equals: (other: { width: number; height: number } | null) => boolean
      }
    }
  }
}

// Helper pour créer un Size Google Maps de manière sûre
const createGoogleMapsSize = (width: number, height: number) => {
  if (typeof window === 'undefined') return undefined
  
  const googleMaps = (window as GoogleMapsWindow).google?.maps
  if (!googleMaps?.Size) return undefined
  
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return new googleMaps.Size(width, height) as any
  } catch {
    return undefined
  }
}

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
}

function TrackingMap({ selectedDelivery }: { selectedDelivery: Delivery | null }) {
  const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_API_KEY

  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: googleMapsApiKey || '',
  })

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

  if (!googleMapsApiKey) {
    return (
      <div style={mapPlaceholderStyle}>
        <p style={mapPlaceholderTextStyle}>Carte non disponible</p>
      </div>
    )
  }

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
      mapContainerStyle={mapContainerStyle}
      center={center}
      zoom={routePath.length > 0 ? 12 : 10}
      options={mapOptions}
    >
      {routePath.length > 0 && (
        <>
          <Polyline
            path={routePath}
            options={{
              strokeColor: '#8B5CF6',
              strokeWeight: 4,
              strokeOpacity: 0.8,
            }}
          />
          <Marker
            position={routePath[0]}
            icon={{
              url: 'http://maps.google.com/mapfiles/ms/icons/green-dot.png',
              scaledSize: createGoogleMapsSize(32, 32),
            }}
          />
          <Marker
            position={routePath[1]}
            icon={{
              url: 'http://maps.google.com/mapfiles/ms/icons/purple-dot.png',
              scaledSize: createGoogleMapsSize(32, 32),
            }}
          />
        </>
      )}
    </GoogleMap>
  )
}

export default function TrackingPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedDelivery, setSelectedDelivery] = useState<Delivery | null>(null)

  const { data: deliveries, isLoading } = useQuery<Delivery[]>({
    queryKey: ['ongoing-deliveries'],
    queryFn: async () => {
      const result = await adminApiService.getOngoingDeliveries()
      return (result.data || []) as Delivery[]
    },
    refetchInterval: 30000,
  })

  const filteredDeliveries = useMemo(() => {
    if (!deliveries) return []
    if (!searchQuery) return deliveries
    return deliveries.filter((delivery: Delivery) =>
      delivery.shipmentNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      delivery.pickup.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      delivery.dropoff.name.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [deliveries, searchQuery])

  // Sélectionner la première livraison par défaut
  React.useEffect(() => {
    if (filteredDeliveries.length > 0 && !selectedDelivery) {
      setSelectedDelivery(filteredDeliveries[0])
    }
  }, [filteredDeliveries, selectedDelivery])

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
              <p>Chargement des livraisons...</p>
            </div>
          ) : filteredDeliveries.length === 0 ? (
            <div style={emptyStateStyle}>
              <p>Aucune livraison en cours</p>
            </div>
          ) : (
            filteredDeliveries.map((delivery: Delivery) => (
              <DeliveryCard
                key={delivery.id}
                delivery={delivery}
                isSelected={selectedDelivery?.id === delivery.id}
                onSelect={() => setSelectedDelivery(delivery)}
              />
            ))
          )}
        </div>
      </div>

      {/* Panneau droit : Carte */}
      <div style={rightPanelStyle}>
        <TrackingMap selectedDelivery={selectedDelivery} />
      </div>
    </div>
  )
}
