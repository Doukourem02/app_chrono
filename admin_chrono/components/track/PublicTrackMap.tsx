'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useMapbox } from '@/contexts/MapboxContext'
import { useInterpolateLngLat } from '@/hooks/useInterpolateLngLat'
import { bearingDegrees, distanceMeters } from '@/utils/geoBearing'
import { fetchMapboxDirections } from '@/utils/mapboxDirections'
import { COTE_IVOIRE_MAX_BOUNDS } from '@/utils/mapBounds'

export type PublicTrackMapProps = {
  pickup: { address: string; coordinates: { latitude: number; longitude: number } | null }
  dropoff: { address: string; coordinates: { latitude: number; longitude: number } | null }
  driver: {
    latitude: number | null
    longitude: number | null
    heading?: number | null
  } | null
}

function trackDriverIconUrl(): string {
  const u = process.env.NEXT_PUBLIC_TRACK_DRIVER_ICON_URL
  if (u && String(u).trim() !== '') return String(u).trim()
  return '/assets/track-driver-marker.svg'
}

function buildDriverMarkerShell(iconUrl: string): {
  element: HTMLDivElement
  setRotation: (deg: number) => void
} {
  const outer = document.createElement('div')
  outer.style.width = '52px'
  outer.style.height = '52px'
  outer.style.display = 'flex'
  outer.style.alignItems = 'center'
  outer.style.justifyContent = 'center'
  outer.style.pointerEvents = 'auto'
  outer.title = 'Position du livreur'

  const inner = document.createElement('div')
  inner.style.width = '48px'
  inner.style.height = '48px'
  inner.style.display = 'flex'
  inner.style.alignItems = 'center'
  inner.style.justifyContent = 'center'
  inner.style.transformOrigin = '50% 50%'
  inner.style.transition = 'transform 0.4s ease-out'
  inner.style.transform = 'rotate(0deg)'

  const img = document.createElement('img')
  img.src = iconUrl
  img.alt = ''
  img.width = 44
  img.height = 44
  img.style.display = 'block'
  img.style.objectFit = 'contain'
  img.draggable = false

  inner.appendChild(img)
  outer.appendChild(inner)

  return {
    element: outer,
    setRotation(deg: number) {
      inner.style.transform = `rotate(${deg}deg)`
    },
  }
}

function toPoint(
  c: { latitude: number; longitude: number } | null | undefined
): { lat: number; lng: number } | null {
  if (!c || typeof c.latitude !== 'number' || typeof c.longitude !== 'number') return null
  if (!Number.isFinite(c.latitude) || !Number.isFinite(c.longitude)) return null
  return { lat: c.latitude, lng: c.longitude }
}

function markerEl(color: string, title: string): HTMLDivElement {
  const el = document.createElement('div')
  el.style.width = '26px'
  el.style.height = '26px'
  el.style.borderRadius = '50%'
  el.style.background = color
  el.style.border = '3px solid #fff'
  el.style.boxShadow = '0 2px 10px rgba(0,0,0,.28)'
  el.style.cursor = 'pointer'
  el.title = title
  return el
}

export default function PublicTrackMap({ pickup, dropoff, driver }: PublicTrackMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<import('mapbox-gl').Map | null>(null)
  const mapboxglRef = useRef<typeof import('mapbox-gl').default | null>(null)
  const markersRef = useRef<import('mapbox-gl').Marker[]>([])
  const driverMarkerRef = useRef<import('mapbox-gl').Marker | null>(null)
  const driverRotateRef = useRef<((deg: number) => void) | null>(null)
  const lastRotationRef = useRef(0)
  const prevRawDriverRef = useRef<{ lat: number; lng: number } | null>(null)
  const { accessToken, isLoaded, loadError } = useMapbox()
  const [mapLoaded, setMapLoaded] = useState(false)

  const pickupPt = useMemo(
    () => toPoint(pickup.coordinates),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- lat/lng only: parent may pass a new `coordinates` object each render with the same values
    [pickup.coordinates?.latitude, pickup.coordinates?.longitude]
  )
  const dropoffPt = useMemo(
    () => toPoint(dropoff.coordinates),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- lat/lng only: parent may pass a new `coordinates` object each render with the same values
    [dropoff.coordinates?.latitude, dropoff.coordinates?.longitude]
  )
  const driverPt = useMemo(
    () => {
      if (!driver || driver.latitude == null || driver.longitude == null) return null
      return { lat: driver.latitude, lng: driver.longitude }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- lat/lng only: parent may pass a new `driver` object each render with the same position
    [driver?.latitude, driver?.longitude]
  )

  const headingFromApi =
    driver?.heading != null && Number.isFinite(driver.heading) && driver.heading >= 0 && driver.heading <= 360
      ? driver.heading
      : null

  const hasAnyPoint = Boolean(pickupPt || dropoffPt || driverPt)

  useInterpolateLngLat(driverPt, (pt) => {
    const m = driverMarkerRef.current
    if (m && pt) {
      m.setLngLat([pt.lng, pt.lat])
    }
  })

  useEffect(() => {
    const container = containerRef.current
    if (!container || !isLoaded || loadError || !accessToken) return

    let cancelled = false
    setMapLoaded(false)

    const run = async () => {
      const mapboxgl = (await import('mapbox-gl')).default
      if (cancelled) return
      mapboxglRef.current = mapboxgl
      mapboxgl.accessToken = accessToken

      markersRef.current.forEach((m) => m.remove())
      markersRef.current = []
      driverMarkerRef.current?.remove()
      driverMarkerRef.current = null
      driverRotateRef.current = null

      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }

      const fallback = { lat: 5.36, lng: -4.0083 }
      const center = pickupPt || dropoffPt || driverPt || fallback

      const map = new mapboxgl.Map({
        container,
        style: 'mapbox://styles/mapbox/light-v11',
        center: [center.lng, center.lat],
        zoom: pickupPt && dropoffPt ? 11 : 12,
        maxBounds: COTE_IVOIRE_MAX_BOUNDS,
      })
      map.addControl(new mapboxgl.NavigationControl(), 'top-right')
      mapRef.current = map

      map.on('load', async () => {
        if (cancelled) return
        try {
          let routeCoords: { lat: number; lng: number }[] = []

          if (pickupPt && dropoffPt) {
            const route = await fetchMapboxDirections(pickupPt, dropoffPt, accessToken)
            if (route?.coordinates?.length) {
              routeCoords = route.coordinates
            } else {
              routeCoords = [pickupPt, dropoffPt]
            }
          }

          if (cancelled) return

          if (routeCoords.length >= 2 && !map.getSource('track-route')) {
            map.addSource('track-route', {
              type: 'geojson',
              data: {
                type: 'Feature',
                properties: {},
                geometry: {
                  type: 'LineString',
                  coordinates: routeCoords.map((p) => [p.lng, p.lat]),
                },
              },
            })
            map.addLayer({
              id: 'track-route-line',
              type: 'line',
              source: 'track-route',
              layout: { 'line-join': 'round', 'line-cap': 'round' },
              paint: {
                'line-color': '#7c3aed',
                'line-width': 5,
                'line-opacity': 0.88,
              },
            })
          }

          if (pickupPt) {
            const m = new mapboxgl.Marker({ element: markerEl('#10b981', 'Point de retrait') })
              .setLngLat([pickupPt.lng, pickupPt.lat])
              .addTo(map)
            markersRef.current.push(m)
          }
          if (dropoffPt) {
            const m = new mapboxgl.Marker({ element: markerEl('#7c3aed', 'Livraison') })
              .setLngLat([dropoffPt.lng, dropoffPt.lat])
              .addTo(map)
            markersRef.current.push(m)
          }

          const bounds = new mapboxgl.LngLatBounds()
          let hasBounds = false
          for (const p of routeCoords) {
            bounds.extend([p.lng, p.lat])
            hasBounds = true
          }
          if (pickupPt) {
            bounds.extend([pickupPt.lng, pickupPt.lat])
            hasBounds = true
          }
          if (dropoffPt) {
            bounds.extend([dropoffPt.lng, dropoffPt.lat])
            hasBounds = true
          }
          if (driverPt) {
            bounds.extend([driverPt.lng, driverPt.lat])
            hasBounds = true
          }
          if (hasBounds) {
            map.fitBounds(bounds, { padding: 56, maxZoom: 14, duration: 0 })
          }
        } finally {
          if (!cancelled) setMapLoaded(true)
        }
      })
    }

    void run()

    return () => {
      cancelled = true
      setMapLoaded(false)
      driverMarkerRef.current?.remove()
      driverMarkerRef.current = null
      driverRotateRef.current = null
      markersRef.current.forEach((m) => m.remove())
      markersRef.current = []
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [accessToken, isLoaded, loadError, pickupPt, dropoffPt, driverPt])

  useEffect(() => {
    const map = mapRef.current
    const mapboxgl = mapboxglRef.current
    if (!mapLoaded || !map || !mapboxgl) return

    if (!driverPt) {
      driverMarkerRef.current?.remove()
      driverMarkerRef.current = null
      driverRotateRef.current = null
      prevRawDriverRef.current = null
      return
    }

    let rot = lastRotationRef.current
    if (headingFromApi != null) {
      rot = headingFromApi
    } else {
      const prev = prevRawDriverRef.current
      if (prev && distanceMeters(prev, driverPt) > 4) {
        rot = bearingDegrees(prev, driverPt)
      }
    }
    lastRotationRef.current = rot
    prevRawDriverRef.current = driverPt

    if (!driverMarkerRef.current) {
      const { element, setRotation } = buildDriverMarkerShell(trackDriverIconUrl())
      driverRotateRef.current = setRotation
      setRotation(rot)
      const m = new mapboxgl.Marker({ element, anchor: 'center' })
        .setLngLat([driverPt.lng, driverPt.lat])
        .addTo(map)
      driverMarkerRef.current = m
      try {
        const b = map.getBounds()
        if (b) {
          b.extend([driverPt.lng, driverPt.lat])
          map.fitBounds(b, { padding: 48, maxZoom: 14, duration: 450 })
        }
      } catch {
        /* ignore */
      }
    } else {
      driverRotateRef.current?.(rot)
    }
  }, [mapLoaded, driverPt, headingFromApi])

  if (!isLoaded || loadError || !accessToken) {
    return (
      <div className="flex h-full min-h-[280px] flex-col items-center justify-center gap-2 bg-gray-100 px-4 text-center">
        <p className="text-sm font-medium text-gray-700">Carte indisponible</p>
        <p className="text-xs text-gray-500">
          Configurez NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN sur l’hébergement (Vercel) pour afficher l’itinéraire.
        </p>
      </div>
    )
  }

  if (!hasAnyPoint) {
    return (
      <div className="flex h-full min-h-[280px] flex-col items-center justify-center gap-2 bg-gray-100 px-4 text-center">
        <p className="text-sm font-medium text-gray-700">Aucune position GPS pour cette commande</p>
        <p className="text-xs text-gray-500">
          Les adresses s’affichent à gauche. La carte apparaîtra lorsque les coordonnées seront disponibles.
        </p>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col bg-gray-50">
      <div
        ref={containerRef}
        className="relative min-h-[min(45dvh,320px)] w-full flex-1 lg:min-h-[280px]"
      />
      <div className="flex flex-wrap gap-3 border-t border-gray-200 bg-white px-3 py-2 text-[11px] text-gray-600">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500" />
          Retrait
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-violet-600" />
          Livraison
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-orange-500" />
          Livreur
        </span>
        {pickupPt && dropoffPt && (
          <span className="w-full text-gray-400 lg:w-auto">Trait violet = itinéraire estimé (route)</span>
        )}
      </div>
    </div>
  )
}
