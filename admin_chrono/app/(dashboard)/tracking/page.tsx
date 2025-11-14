'use client'

import React, { useState, useMemo } from 'react'
import { Search, Filter } from 'lucide-react'
import { GoogleMap, Marker, Polyline, InfoWindow } from '@react-google-maps/api'
import DeliveryCard from '@/components/tracking/DeliveryCard'
import { useGoogleMaps } from '@/contexts/GoogleMapsContext'

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
  loadError 
}: { 
  selectedDelivery: Delivery | null
  isLoaded: boolean
  loadError: Error | undefined
}) {

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

  // Calculer la position actuelle du véhicule (milieu de la route pour l'instant)
  const currentVehiclePosition = useMemo(() => {
    if (routePath.length >= 2) {
      // Position au milieu de la route (approximation)
      return {
        lat: (routePath[0].lat + routePath[1].lat) / 2,
        lng: (routePath[0].lng + routePath[1].lng) / 2,
      }
    }
    return null
  }, [routePath])

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
  const mapKey = useMemo(() => {
    return selectedDelivery ? `map-${selectedDelivery.id}` : 'map-default'
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
          {/* Polyline entre le point de départ et d'arrivée - UN SEUL à la fois */}
          <Polyline
            key={`polyline-${selectedDelivery.id}`}
            path={routePath}
            options={{
              strokeColor: '#8B5CF6',
              strokeWeight: 4,
              strokeOpacity: 0.8,
            }}
          />
          
          {/* Marqueur de départ (vert) */}
          <Marker
            key={`marker-pickup-${selectedDelivery.id}`}
            position={routePath[0]}
            icon={{
              url: 'http://maps.google.com/mapfiles/ms/icons/green-dot.png',
              scaledSize: createGoogleMapsSize(32, 32),
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
              url: 'http://maps.google.com/mapfiles/ms/icons/purple-dot.png',
              scaledSize: createGoogleMapsSize(32, 32),
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
          
          {/* Position actuelle du véhicule (cercle pulsant violet) */}
          {currentVehiclePosition && (
            <>
              {/* Cercle pulsant pour la position actuelle du véhicule */}
              <Marker
                key={`vehicle-inner-${selectedDelivery.id}`}
                position={currentVehiclePosition}
                icon={{
                  path: window.google?.maps?.SymbolPath?.CIRCLE || 0,
                  scale: 12,
                  fillColor: '#8B5CF6',
                  fillOpacity: 0.6,
                  strokeColor: '#FFFFFF',
                  strokeWeight: 3,
                }}
              />
              {/* Cercle extérieur pulsant */}
              <Marker
                key={`vehicle-outer-${selectedDelivery.id}`}
                position={currentVehiclePosition}
                icon={{
                  path: window.google?.maps?.SymbolPath?.CIRCLE || 0,
                  scale: 20,
                  fillColor: '#8B5CF6',
                  fillOpacity: 0.2,
                  strokeColor: '#8B5CF6',
                  strokeWeight: 2,
                }}
              />
            </>
          )}
        </>
      )}
    </GoogleMap>
  )
}

// Données fictives pour les livraisons en cours
const mockDeliveries: Delivery[] = [
  {
    id: '1',
    shipmentNumber: 'EV-2017002346',
    type: 'Orders',
    status: 'enroute',
    pickup: {
      name: 'Cocody',
      address: 'Carrefour Saint Jean',
      coordinates: { lat: 5.3600, lng: -4.0083 },
    },
    dropoff: {
      name: 'Marcory',
      address: 'Zone 4',
      coordinates: { lat: 5.3204, lng: -4.0267 },
    },
    driverId: 'driver-1',
    userId: 'user-1',
    client: {
      id: 'user-1',
      email: 'entreprise@example.com',
      full_name: 'Entreprise un tel',
      phone: '+225 01 23 45 67 89',
      avatar_url: undefined,
    },
    driver: null,
  },
  {
    id: '2',
    shipmentNumber: 'EV-2017003323',
    type: 'Orders',
    status: 'enroute',
    pickup: {
      name: 'Plateaux',
      address: 'Vers Felicia',
      coordinates: { lat: 5.3300, lng: -4.0200 },
    },
    dropoff: {
      name: 'Abobo Dokui',
      address: 'Route du Zoo',
      coordinates: { lat: 5.4000, lng: -4.0500 },
    },
    driverId: 'driver-2',
    userId: 'user-2',
    client: {
      id: 'user-2',
      email: 'jayson@example.com',
      full_name: 'Jayson Tatum',
      phone: '+225 07 89 12 34 56',
      avatar_url: undefined,
    },
    driver: null,
  },
  {
    id: '3',
    shipmentNumber: 'EV-2017003323',
    type: 'Orders',
    status: 'picked_up',
    pickup: {
      name: 'Yopougon',
      address: 'Siporex',
      coordinates: { lat: 5.3500, lng: -4.0300 },
    },
    dropoff: {
      name: 'Cocody',
      address: 'Angré 7ème Tranche',
      coordinates: { lat: 5.3700, lng: -4.0100 },
    },
    driverId: 'driver-3',
    userId: 'user-3',
    client: {
      id: 'user-3',
      email: 'client@example.com',
      full_name: 'Client Test',
      phone: '+225 05 67 89 01 23',
      avatar_url: undefined,
    },
    driver: null,
  },
]

export default function TrackingPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedDelivery, setSelectedDelivery] = useState<Delivery | null>(null)

  // Utiliser le contexte Google Maps partagé
  const { isLoaded, loadError } = useGoogleMaps()

  // Utiliser les données fictives pour l'instant
  const deliveries = mockDeliveries
  const isLoading = false

  // Code commenté pour récupérer les vraies données plus tard
  // const { data: deliveries, isLoading } = useQuery<Delivery[]>({
  //   queryKey: ['ongoing-deliveries'],
  //   queryFn: async () => {
  //     const result = await adminApiService.getOngoingDeliveries()
  //     return (result.data || []) as Delivery[]
  //   },
  //   refetchInterval: 30000,
  // })

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
                onSelect={() => handleDeliverySelect(delivery)}
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
        />
      </div>
    </div>
  )
}
