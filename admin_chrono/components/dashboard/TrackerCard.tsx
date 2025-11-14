'use client'

import { Phone, MessageSquare } from 'lucide-react'
import { useMemo } from 'react'
import { GoogleMap, Marker, Polyline } from '@react-google-maps/api'
import { useQuery } from '@tanstack/react-query'
import { adminApiService } from '@/lib/adminApiService'
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
  height: '150px',
  borderRadius: '12px',
}

const center = {
  lat: 5.3600, // Abidjan, Côte d'Ivoire
  lng: -4.0083,
}

const routePath = [
  { lat: 5.3600, lng: -4.0083 }, // Abidjan (départ)
  { lat: 5.3204, lng: -4.0267 }, // Abidjan (arrivée)
]

const timelineData = [
  {
    title: 'Colis en route vers Abidjan',
    date: '12/12/2024',
    time: '02:00 AM',
  },
  {
    title: 'Vérification de l\'entrepôt',
    date: '11/12/2024',
    time: '22:32',
  },
  {
    title: 'Enregistrement du colis',
    date: '11/12/2024',
    time: '17:00',
  }, 
]

function MapComponent() {
  const { isLoaded, loadError } = useGoogleMaps()

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

  const mapPlaceholderStyle: React.CSSProperties = {
    width: '100%',
    height: '200px',
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

  const mapPlaceholderErrorStyle: React.CSSProperties = {
    ...mapPlaceholderTextStyle,
    color: '#EF4444',
  }

  if (loadError) {
    return (
      <div style={mapPlaceholderStyle}>
        <p style={mapPlaceholderErrorStyle}>Erreur de chargement de la carte</p>
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
      zoom={12}
      options={mapOptions}
    >
      <Polyline
        path={routePath}
        options={{
          strokeColor: '#2563eb',
          strokeWeight: 3,
          strokeOpacity: 0.8,
        }}
      />
      <Marker
        position={routePath[0]}
        icon={{
          url: 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png',
          scaledSize: createGoogleMapsSize(32, 32),
        }}
      />
      <Marker
        position={routePath[1]}
        icon={{
          url: 'http://maps.google.com/mapfiles/ms/icons/red-dot.png',
          scaledSize: createGoogleMapsSize(32, 32),
        }}
      />
    </GoogleMap>
  )
}

export default function TrackerCard() {
  // Récupérer une commande en cours avec un driver assigné
  const { data: ordersData } = useQuery({
    queryKey: ['active-orders-with-driver'],
    queryFn: async () => {
      // Récupérer les commandes en cours (enroute, picked_up, accepted)
      const result = await adminApiService.getOrdersByStatus('onProgress')
      return result
    },
    refetchInterval: 30000, // Refetch toutes les 30 secondes
  })

  // Trouver une commande avec un driver assigné
  const orders = ordersData?.data || []
  const activeOrder = orders.find((order: any) => order.driver_id || order.driverId)
  const driverId = activeOrder?.driver_id || activeOrder?.driverId

  const { data: driverData } = useQuery({
    queryKey: ['driver-details', driverId],
    queryFn: async () => {
      if (!driverId) return null
      const result = await adminApiService.getDriverDetails(driverId)
      return result
    },
    enabled: !!driverId,
  })

  const driver = driverData?.data

  // Fonction pour obtenir le nom d'affichage du driver
  const getDisplayName = () => {
    if (driver?.full_name && driver.full_name.trim()) {
      return driver.full_name
    }
    if (driver?.email) {
      return driver.email
    }
    // Si pas de driver, essayer de récupérer depuis l'order
    if (activeOrder?.driver?.full_name) {
      return activeOrder.driver.full_name
    }
    if (activeOrder?.driver?.email) {
      return activeOrder.driver.email
    }
    return 'Jayson Tatum'
  }

  // Fonction pour obtenir l'initiale du driver
  const getInitial = () => {
    if (driver?.full_name && driver.full_name.trim()) {
      return driver.full_name.charAt(0).toUpperCase()
    }
    if (driver?.email) {
      return driver.email.charAt(0).toUpperCase()
    }
    // Si pas de driver, essayer de récupérer depuis l'order
    if (activeOrder?.driver?.full_name) {
      return activeOrder.driver.full_name.charAt(0).toUpperCase()
    }
    if (activeOrder?.driver?.email) {
      return activeOrder.driver.email.charAt(0).toUpperCase()
    }
    return 'J'
  }

  const cardStyle: React.CSSProperties = {
    backgroundColor: '#FFFFFF',
    borderRadius: '16px',
    padding: '16px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    border: '1px solid #F3F4F6',
    flex: 1.5,
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
  }

  const sectionStyle: React.CSSProperties = {
    marginBottom: '12px',
    flexShrink: 0,
  }

  const trackerHeaderStyle: React.CSSProperties = {
    fontSize: '14px',
    color: '#4B5563',
    fontWeight: 500,
    marginBottom: '8px',
  }

  const trackerRowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  }

  const trackerIdStyle: React.CSSProperties = {
    fontSize: '20px',
    fontWeight: 700,
    color: '#111827',
  }

  const statusBadgeStyle: React.CSSProperties = {
    paddingLeft: '12px',
    paddingRight: '12px',
    paddingTop: '4px',
    paddingBottom: '4px',
    backgroundColor: '#FEF3C7',
    color: '#D97706',
    borderRadius: '8px',
    fontSize: '12px',
    fontWeight: 600,
  }

  const timelineStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  }

  const timelineItemStyle: React.CSSProperties = {
    display: 'flex',
    gap: '16px',
  }

  const timelineDotContainerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  }

  const timelineDotStyle = (active: boolean): React.CSSProperties => ({
    width: '12px',
    height: '12px',
    borderRadius: '50%',
    backgroundColor: active ? '#2563EB' : '#D1D5DB',
  })

  const timelineLineStyle: React.CSSProperties = {
    width: '2px',
    height: '24px',
    backgroundColor: '#E5E7EB',
    marginTop: '4px',
  }

  const timelineContentStyle: React.CSSProperties = {
    flex: 1,
  }

  const timelineTitleStyle: React.CSSProperties = {
    fontSize: '14px',
    fontWeight: 500,
    color: '#111827',
  }

  const timelineDateStyle: React.CSSProperties = {
    fontSize: '12px',
    color: '#6B7280',
  }

  const driverInfoStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px',
    backgroundColor: '#FEF9C3',
    borderRadius: '12px',
  }

  const driverLeftStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  }

  const avatarStyle: React.CSSProperties = {
    width: '48px',
    height: '48px',
    backgroundColor: '#9333EA',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#FFFFFF',
    fontWeight: 700,
    fontSize: '14px',
  }

  const driverNameStyle: React.CSSProperties = {
    fontSize: '14px',
    fontWeight: 600,
    color: '#111827',
  }

  const driverRoleStyle: React.CSSProperties = {
    fontSize: '12px',
    color: '#6B7280',
  }

  const driverActionsStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  }

  const actionButtonStyle: React.CSSProperties = {
    padding: '8px',
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  }

  return (
    <div style={cardStyle}>
      <div style={sectionStyle}>
        <MapComponent />
      </div>

      <div style={sectionStyle}>
        <h3 style={trackerHeaderStyle}>Tracker ID</h3>
        <div style={trackerRowStyle}>
          <p style={trackerIdStyle}>ABJ-12321-CI</p>
          <span style={statusBadgeStyle}>En cours</span>
        </div>
      </div>

      <div style={{ ...sectionStyle, marginBottom: '12px', flex: 1, minHeight: 0, overflow: 'auto' }}>
        <div style={timelineStyle}>
          {timelineData.map((item, index) => (
            <div key={index} style={timelineItemStyle}>
              <div style={timelineDotContainerStyle}>
                <div style={timelineDotStyle(index === 0)}></div>
                {index < timelineData.length - 1 && (
                  <div style={timelineLineStyle}></div>
                )}
              </div>
              <div style={timelineContentStyle}>
                <p style={timelineTitleStyle}>{item.title}</p>
                <p style={timelineDateStyle}>{item.date} - {item.time}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ ...driverInfoStyle, flexShrink: 0 }}>
        <div style={driverLeftStyle}>
          <div style={avatarStyle}>{getInitial()}</div>
          <div>
            <p style={driverNameStyle}>{getDisplayName()}</p>
            <p style={driverRoleStyle}>Drive, Actif il y a 1h</p>
          </div>
        </div>
        <div style={driverActionsStyle}>
          <button
            style={actionButtonStyle}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#FEF3C7'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent'
            }}
          >
            <Phone size={20} style={{ color: '#4B5563' }} />
          </button>
          <button
            style={actionButtonStyle}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#FEF3C7'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent'
            }}
          >
            <MessageSquare size={20} style={{ color: '#4B5563' }} />
          </button>
        </div>
      </div>
    </div>
  )
}

