'use client'

import { Phone, MessageSquare } from 'lucide-react'
import { useMemo } from 'react'
import { GoogleMap, useLoadScript, Marker, Polyline } from '@react-google-maps/api'

const mapContainerStyle = {
  width: '100%',
  height: '200px',
  borderRadius: '12px',
}

const center = {
  lat: 40.7128,
  lng: -74.0060,
}

const routePath = [
  { lat: 40.7580, lng: -73.9855 }, // New York
  { lat: 37.7749, lng: -122.4194 }, // San Francisco
]

const timelineData = [
  {
    title: 'Package heading San Francisco',
    date: '12/12/2024',
    time: '02:00 AM',
  },
  {
    title: 'Checking warehouse',
    date: '11/12/2024',
    time: '10:32 PM',
  },
  {
    title: 'Package check in',
    date: '11/12/2024',
    time: '05:00 PM',
  },
]

function MapComponent() {
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

  if (!googleMapsApiKey) {
    return (
      <div className="w-full h-[200px] bg-gray-100 rounded-xl flex items-center justify-center">
        <p className="text-sm text-gray-500">Carte non disponible</p>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="w-full h-[200px] bg-gray-100 rounded-xl flex items-center justify-center">
        <p className="text-sm text-red-500">Erreur de chargement de la carte</p>
      </div>
    )
  }

  if (!isLoaded) {
    return (
      <div className="w-full h-[200px] bg-gray-100 rounded-xl flex items-center justify-center">
        <p className="text-sm text-gray-500">Chargement de la carte...</p>
      </div>
    )
  }

  return (
    <GoogleMap
      mapContainerStyle={mapContainerStyle}
      center={center}
      zoom={5}
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
        position={routePath[1]}
        icon={{
          url: 'http://maps.google.com/mapfiles/ms/icons/red-dot.png',
          scaledSize:
            typeof window !== 'undefined' && (window as any).google?.maps?.Size
              ? new (window as any).google.maps.Size(32, 32)
              : undefined,
        }}
      />
    </GoogleMap>
  )
}

export default function TrackerCard() {
  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
      {/* Map */}
      <div className="mb-6">
        <MapComponent />
      </div>

      {/* Tracker ID */}
      <div className="mb-6">
        <h3 className="text-sm text-gray-600 font-medium mb-2">Tracker ID</h3>
        <div className="flex items-center justify-between">
          <p className="text-xl font-bold text-gray-900">NY-12321-SF</p>
          <span className="px-3 py-1 bg-orange-100 text-orange-600 rounded-lg text-xs font-semibold">
            On Progress
          </span>
        </div>
      </div>

      {/* Timeline */}
      <div className="space-y-4 mb-6">
        {timelineData.map((item, index) => (
          <div key={index} className="flex gap-4">
            <div className="flex flex-col items-center">
              <div className={`w-3 h-3 rounded-full ${
                index === 0 ? 'bg-blue-600' : 'bg-gray-300'
              }`}></div>
              {index < timelineData.length - 1 && (
                <div className="w-0.5 h-8 bg-gray-200 mt-1"></div>
              )}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">{item.title}</p>
              <p className="text-xs text-gray-500">{item.date} - {item.time}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Driver Info */}
      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center text-white font-bold">
            M
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">Moriarty</p>
            <p className="text-xs text-gray-500">Drive / Courier</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="p-2 hover:bg-gray-200 rounded-lg transition-colors">
            <Phone className="w-5 h-5 text-gray-600" />
          </button>
          <button className="p-2 hover:bg-gray-200 rounded-lg transition-colors">
            <MessageSquare className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </div>
    </div>
  )
}

