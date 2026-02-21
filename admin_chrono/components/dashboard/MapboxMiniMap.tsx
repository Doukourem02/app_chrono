'use client'

import React, { useRef, useEffect } from 'react'
import { useMapbox } from '@/contexts/MapboxContext'
import { themeColors } from '@/utils/theme'

const mapContainerStyle: React.CSSProperties = {
  width: '100%',
  height: '150px',
  borderRadius: '12px',
}

interface LatLng {
  lat: number
  lng: number
}

const defaultCenter: LatLng = { lat: 5.36, lng: -4.0083 }
const defaultRoutePath: LatLng[] = [
  { lat: 5.36, lng: -4.0083 },
  { lat: 5.32, lng: -4.0267 },
]

export default function MapboxMiniMap({ routePath }: { routePath?: LatLng[] }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<import('mapbox-gl').Map | null>(null)
  const markersRef = useRef<import('mapbox-gl').Marker[]>([])
  const { accessToken, isLoaded, loadError } = useMapbox()

  const computedRoute = routePath && routePath.length >= 2 ? routePath : defaultRoutePath
  const computedCenter = computedRoute[0] ?? defaultCenter

  const mapPlaceholderStyle: React.CSSProperties = {
    width: '100%',
    height: '200px',
    backgroundColor: themeColors.grayLight,
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  }

  const mapPlaceholderTextStyle: React.CSSProperties = {
    fontSize: '14px',
    color: themeColors.textSecondary,
  }

  useEffect(() => {
    const container = containerRef.current
    if (!container || !accessToken || !isLoaded || loadError) return

    const initMap = async () => {
      const mapboxgl = (await import('mapbox-gl')).default
      mapboxgl.accessToken = accessToken

      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
      markersRef.current.forEach((m) => m.remove())
      markersRef.current = []

      const map = new mapboxgl.Map({
        container,
        style: 'mapbox://styles/mapbox/light-v11',
        center: [computedCenter.lng, computedCenter.lat],
        zoom: 12,
      })

      mapRef.current = map

      map.on('load', () => {
        if (computedRoute.length >= 2) {
          map.addSource('route', {
            type: 'geojson',
            data: {
              type: 'Feature',
              properties: {},
              geometry: {
                type: 'LineString',
                coordinates: computedRoute.map((p) => [p.lng, p.lat]),
              },
            },
          })
          map.addLayer({
            id: 'route',
            type: 'line',
            source: 'route',
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: {
              'line-color': '#2563eb',
              'line-width': 3,
              'line-opacity': 0.8,
            },
          })

          const addMarker = (pos: LatLng, color: string) => {
            const el = document.createElement('div')
            el.style.width = '16px'
            el.style.height = '16px'
            el.style.borderRadius = '50%'
            el.style.backgroundColor = color
            el.style.border = '2px solid white'
            el.style.boxShadow = '0 1px 3px rgba(0,0,0,0.2)'
            const m = new mapboxgl.Marker(el).setLngLat([pos.lng, pos.lat]).addTo(map)
            markersRef.current.push(m)
          }
          addMarker(computedRoute[0], '#2563eb')
          addMarker(computedRoute[computedRoute.length - 1], '#EF4444')
        }
      })

      return () => {
        map.remove()
        mapRef.current = null
      }
    }

    initMap()
    // computedRoute utilisé dans load callback ; le 2e useEffect gère les mises à jour de route
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, isLoaded, loadError, computedCenter.lat, computedCenter.lng])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.isStyleLoaded()) return

    if (map.getLayer('route')) map.removeLayer('route')
    if (map.getSource('route')) map.removeSource('route')
    markersRef.current.forEach((m) => m.remove())
    markersRef.current = []

    if (computedRoute.length >= 2) {
      import('mapbox-gl').then(({ default: mapboxgl }) => {
        map.addSource('route', {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'LineString',
              coordinates: computedRoute.map((p) => [p.lng, p.lat]),
            },
          },
        })
        map.addLayer({
          id: 'route',
          type: 'line',
          source: 'route',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': '#2563eb',
            'line-width': 3,
            'line-opacity': 0.8,
          },
        })
        const addMarker = (pos: LatLng, color: string) => {
          const el = document.createElement('div')
          el.style.width = '16px'
          el.style.height = '16px'
          el.style.borderRadius = '50%'
          el.style.backgroundColor = color
          el.style.border = '2px solid white'
          el.style.boxShadow = '0 1px 3px rgba(0,0,0,0.2)'
          const m = new mapboxgl.Marker(el).setLngLat([pos.lng, pos.lat]).addTo(map)
          markersRef.current.push(m)
        }
        addMarker(computedRoute[0], '#2563eb')
        addMarker(computedRoute[computedRoute.length - 1], '#EF4444')
      })
    }
  }, [computedRoute])

  if (loadError) {
    return (
      <div style={mapPlaceholderStyle}>
        <p style={mapPlaceholderTextStyle}>Erreur de chargement de la carte</p>
        {loadError.message && (
          <p style={{ ...mapPlaceholderTextStyle, fontSize: '11px', marginTop: '8px' }}>
            {loadError.message}
          </p>
        )}
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

  return <div ref={containerRef} style={mapContainerStyle} />
}
