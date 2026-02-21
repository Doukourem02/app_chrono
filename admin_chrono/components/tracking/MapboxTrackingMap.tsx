'use client'

import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react'
import { Search, X } from 'lucide-react'
import { useThemeStore } from '@/stores/themeStore'
import { themeColors } from '@/utils/theme'
import { useMapbox } from '@/contexts/MapboxContext'
import { fetchMapboxDirections } from '@/utils/mapboxDirections'
import { extractMapboxTrafficData, type TrafficData } from '@/utils/trafficUtils'
import { calculateDriverOffsets } from '@/utils/markerOffset'
import { useAnimatedPosition } from '@/hooks/useAnimatedPosition'
import { logger } from '@/utils/logger'

const MAPBOX_SUGGEST_URL = 'https://api.mapbox.com/search/searchbox/v1/suggest'
const MAPBOX_RETRIEVE_URL = 'https://api.mapbox.com/search/searchbox/v1/retrieve'
const MAPBOX_GEOCODE_URL = 'https://api.mapbox.com/search/geocode/v6/forward'
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search'

const NOMINATIM_HEADERS: HeadersInit = {
  'User-Agent': 'ChronoLivraison/1.0 (admin-map-search)',
}

/** Parse coordonnées GPS : "5.36, -4.0083" | "5.36 -4" | "-4.0083, 5.36" */
function parseCoordinates(q: string): { lat: number; lng: number } | null {
  const trimmed = q.trim()
  const match = trimmed.match(/^(-?\d+\.?\d*)\s*[,;\s]\s*(-?\d+\.?\d*)$/)
  if (!match) return null
  const a = parseFloat(match[1])
  const b = parseFloat(match[2])
  if (isNaN(a) || isNaN(b)) return null
  if (a < -90 || a > 90) return { lat: b, lng: a }
  if (b < -90 || b > 90) return { lat: a, lng: b }
  if (a > 0 && b < 0) return { lat: a, lng: b }
  if (a < 0 && b > 0) return { lat: b, lng: a }
  return { lat: a, lng: b }
}

/** Parse adresse structurée : "rue panama city, 772" | "772 rue panama city" | "rue panama city 772" */
function parseStructuredAddress(q: string): { street: string; address_number: string; place?: string } | null {
  const trimmed = q.trim()
  const withComma = trimmed.match(/^(.+?),\s*(\d+)\s*$/)
  if (withComma) {
    const street = withComma[1].trim()
    if (street.length >= 2) return { street, address_number: withComma[2], place: 'Abidjan' }
  }
  const numberFirst = trimmed.match(/^(\d+)\s+(.+)$/)
  if (numberFirst) {
    const street = numberFirst[2].trim()
    if (street.length >= 2) return { street, address_number: numberFirst[1], place: 'Abidjan' }
  }
  const numberLast = trimmed.match(/^(.+?)\s+(\d+)$/)
  if (numberLast) {
    const street = numberLast[1].trim()
    if (street.length >= 2) return { street, address_number: numberLast[2], place: 'Abidjan' }
  }
  return null
}

/** Vérifie si la requête est principalement numérique (code postal, numéro) */
function isNumericQuery(q: string): boolean {
  return /^\d[\d\s]*$/.test(q.trim())
}

interface MapboxSuggestion {
  name: string
  mapbox_id: string
  feature_type: string
  full_address?: string
  place_formatted: string
  /** Coordonnées directes (API Geocoding / Nominatim) - évite l'appel retrieve */
  coordinates?: { lat: number; lng: number }
  source?: 'searchbox' | 'geocode' | 'nominatim'
}

interface MapboxRetrieveFeature {
  geometry?: { coordinates: [number, number]; type: string }
  properties?: { coordinates?: { latitude: number; longitude: number } }
}

interface MapboxSuggestItem {
  name?: string
  mapbox_id?: string
  feature_type?: string
  [key: string]: unknown
}

interface GeocodeFeature {
  id?: string
  geometry?: { coordinates: [number, number] | [number, number][] }
  properties?: {
    name?: string
    name_preferred?: string
    full_address?: string
    place_formatted?: string
    mapbox_id?: string
    feature_type?: string
    context?: {
      street?: { name?: string } | string
      address?: { street_name?: string }
      place?: { name?: string }
      locality?: { name?: string }
      district?: { name?: string }
      neighborhood?: { name?: string }
    }
  }
}

interface NominatimResult {
  place_id: string
  lat: string
  lon: string
  display_name: string
  type?: string
  class?: string
}

interface MapboxStyleLayer {
  id?: string
  type?: string
  source?: string
  'source-layer'?: string
}

const DELIVERY_ZOOM = 12.8
const OVERVIEW_ZOOM = 13.1

const mapContainerStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
  minHeight: 300,
  borderRadius: '12px',
  overflow: 'hidden',
  boxShadow: '0 0 0 2px rgba(196, 181, 253, 0.2)',
  border: '1px solid rgba(196, 181, 253, 0.35)',
}

const mapPlaceholderStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
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
  client?: { id: string; email: string; full_name?: string; phone?: string; avatar_url?: string } | null
  driver?: { id: string; email: string; full_name?: string; phone?: string; avatar_url?: string } | null
}

interface MapboxTrackingMapProps {
  selectedDelivery: Delivery | null
  onlineDrivers: Array<{
    userId: string
    is_online: boolean
    is_available: boolean
    current_latitude?: number
    current_longitude?: number
    updated_at?: string
    vehicle_type?: 'moto' | 'vehicule' | 'cargo'
  }>
  adminLocation: { lat: number; lng: number }
  onTrafficData?: (data: TrafficData | null) => void
}

export default function MapboxTrackingMap({
  selectedDelivery,
  onlineDrivers,
  adminLocation,
  onTrafficData,
}: MapboxTrackingMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<import('mapbox-gl').Map | null>(null)
  const mapboxglRef = useRef<typeof import('mapbox-gl').default | null>(null)
  const markersRef = useRef<import('mapbox-gl').Marker[]>([])
  const [previousDriverPosition, setPreviousDriverPosition] = useState<{ lat: number; lng: number } | null>(null)
  const [fullRoutePath, setFullRoutePath] = useState<Array<{ lat: number; lng: number }>>([])
  const previousDeliveryIdRef = useRef<string | null>(null)
  const [currentZoom, setCurrentZoom] = useState<number>(OVERVIEW_ZOOM)
  const [searchExpanded, setSearchExpanded] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchSuggestions, setSearchSuggestions] = useState<MapboxSuggestion[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const searchDropdownRef = useRef<HTMLDivElement>(null)
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const searchSessionToken = useRef(
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0
      const v = c === 'x' ? r : (r & 0x3) | 0x8
      return v.toString(16)
    })
  ).current

  const theme = useThemeStore((state) => state.theme)
  const isDarkMode = theme === 'dark'
  const { accessToken, isLoaded, loadError } = useMapbox()

  const routePathFallback = useMemo(() => {
    if (selectedDelivery?.pickup?.coordinates && selectedDelivery?.dropoff?.coordinates) {
      return [
        selectedDelivery.pickup.coordinates,
        selectedDelivery.dropoff.coordinates,
      ]
    }
    return []
  }, [selectedDelivery])

  const assignedDriver = useMemo(() => {
    if (!selectedDelivery || !selectedDelivery.driverId) return null
    return onlineDrivers.find((d) => d.userId === selectedDelivery.driverId) || null
  }, [selectedDelivery, onlineDrivers])

  const currentVehiclePosition = useMemo(() => {
    if (assignedDriver?.is_online === true && assignedDriver?.current_latitude && assignedDriver?.current_longitude) {
      return {
        lat: assignedDriver.current_latitude,
        lng: assignedDriver.current_longitude,
      }
    }
    return null
  }, [assignedDriver])

  const animatedDriverPosition = useAnimatedPosition({
    currentPosition: currentVehiclePosition,
    previousPosition: previousDriverPosition,
    animationDuration: 5000,
  })

  const driverOffsets = useMemo(() => {
    const validDrivers = onlineDrivers.filter(
      (d) => d.is_online === true && d.current_latitude && d.current_longitude
    )
    return calculateDriverOffsets(validDrivers, currentZoom)
  }, [onlineDrivers, currentZoom])

  const center = useMemo(() => {
    if (selectedDelivery?.pickup?.coordinates) {
      return selectedDelivery.pickup.coordinates
    }
    return adminLocation
  }, [selectedDelivery, adminLocation])

  // Recherche de lieu sur la carte
  const fetchSearchSuggestions = useCallback(
    async (q: string) => {
      const trimmed = q.trim()
      if (!trimmed || !accessToken) {
        setSearchSuggestions([])
        return
      }
      if (trimmed.length < 2 && !isNumericQuery(trimmed)) {
        setSearchSuggestions([])
        return
      }

      // Coordonnées GPS : suggestion immédiate
      const coords = parseCoordinates(trimmed)
      if (coords) {
        const coordSuggestion: MapboxSuggestion = {
          name: `Coordonnées ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`,
          mapbox_id: `coords-${coords.lat}-${coords.lng}`,
          feature_type: 'address',
          place_formatted: 'Aller à cet emplacement',
          coordinates: coords,
          source: 'geocode',
        }
        setSearchSuggestions([coordSuggestion])
        setSearchLoading(false)
        return
      }

      setSearchLoading(true)
      try {
        const baseParams = { country: 'ci', language: 'fr', proximity: '-4.0083,5.36' }

        // Adresse structurée (rue X, 772) : appel dédié Mapbox structured
        const structured = parseStructuredAddress(trimmed)
        const structuredFetches: Promise<Response>[] = []
        if (structured) {
          const params = new URLSearchParams({
            street: structured.street,
            address_number: structured.address_number,
            place: structured.place || 'Abidjan',
            country: 'ci',
            access_token: accessToken,
            limit: '5',
            autocomplete: 'false',
          })
          structuredFetches.push(fetch(`${MAPBOX_GEOCODE_URL}?${params}`))
        }

        // Types adaptés : postcode/address si requête numérique
        const extraTypes = isNumericQuery(trimmed) ? 'postcode,address' : undefined

        // Appels parallèles : Search Box + Geocoding général + Geocoding rues/adresses
        const fetches: Promise<Response>[] = [
          fetch(
            `${MAPBOX_SUGGEST_URL}?${new URLSearchParams({
              q: trimmed,
              access_token: accessToken,
              session_token: searchSessionToken,
              ...baseParams,
              limit: '8',
            })}`
          ),
          fetch(
            `${MAPBOX_GEOCODE_URL}?${new URLSearchParams({
              q: trimmed,
              access_token: accessToken,
              ...baseParams,
              limit: '10',
              autocomplete: 'true',
              ...(extraTypes ? { types: extraTypes } : {}),
            })}`
          ),
        ]
        // Appel dédié aux rues et adresses (avec numéro si pertinent)
        fetches.push(
          fetch(
            `${MAPBOX_GEOCODE_URL}?${new URLSearchParams({
              q: trimmed,
              access_token: accessToken,
              ...baseParams,
              limit: '8',
              autocomplete: 'true',
              types: extraTypes || 'street,address',
            })}`
          )
        )

        // Nominatim en parallèle, ne pas faire échouer la recherche si bloqué (CSP, etc.)
        const nominatimQ = trimmed.toLowerCase().includes('abidjan') ? trimmed : `${trimmed}, Abidjan`
        const nominatimParams: Record<string, string> = {
          q: nominatimQ,
          format: 'json',
          limit: '10',
          countrycodes: 'ci',
          bounded: '0',
          viewbox: '-4.15,5.2,-3.85,5.45',
        }
        const nominatimPromise = fetch(
          `${NOMINATIM_URL}?${new URLSearchParams(nominatimParams)}`,
          { headers: NOMINATIM_HEADERS }
        )
          .then((r) => (r.ok ? r.json() : []))
          .catch((err) => {
            logger.warn('[MapboxTrackingMap] Nominatim non disponible:', err)
            return []
          })

        const allFetches = [...fetches, nominatimPromise, ...structuredFetches]
        const results = await Promise.all(allFetches)
        const suggestRes = results[0]
        const geocodeRes = results[1]
        const geocodeStreetRes = results[2]
        const nominatimData = results[3]
        const structuredRes = structuredFetches.length > 0 ? results[4] : null

        const suggestData = await suggestRes.json()
        const geocodeData = await geocodeRes.json()
        const geocodeStreetData = await geocodeStreetRes.json()

        const fromSearchBox: MapboxSuggestion[] = (suggestData?.suggestions || []).map((s: MapboxSuggestItem) => ({
          ...s,
          source: 'searchbox' as const,
        }))

        const parseGeocodeFeature = (f: GeocodeFeature): MapboxSuggestion | null => {
          const coords = f.geometry?.coordinates
          let lng: number | null = null
          let lat: number | null = null
          if (Array.isArray(coords) && coords.length > 0) {
            const first = coords[0]
            if (typeof first === 'number') {
              ;[lng, lat] = coords as [number, number]
            } else if (Array.isArray(first)) {
              ;[lng, lat] = first as [number, number]
            }
          }
          if (lat == null || lng == null) return null
          const props = f.properties || {}
          const ctx = props.context || {}
          const streetVal = ctx.street
          const streetName =
            (typeof streetVal === 'string' ? streetVal : (streetVal as { name?: string })?.name) ??
            ctx.address?.street_name ??
            null
          const name =
            props.name ||
            props.name_preferred ||
            props.full_address ||
            streetName ||
            (props.place_formatted ? String(props.place_formatted).split(',')[0]?.trim() : '') ||
            ''
          if (!name) return null
          const placeParts = [
            ctx.place?.name,
            ctx.locality?.name,
            ctx.district?.name,
            ctx.neighborhood?.name,
          ].filter(Boolean)
          const place_formatted = props.place_formatted || placeParts.join(', ') || ''
          return {
            name,
            mapbox_id: props.mapbox_id || f.id || '',
            feature_type: props.feature_type || 'address',
            full_address: props.full_address,
            place_formatted,
            coordinates: { lat, lng },
            source: 'geocode' as const,
          }
        }

        const fromGeocode = (geocodeData?.features || []).map(parseGeocodeFeature).filter(Boolean) as MapboxSuggestion[]
        const fromGeocodeStreet = (geocodeStreetData?.features || [])
          .map(parseGeocodeFeature)
          .filter(Boolean) as MapboxSuggestion[]

        // Adresses structurées (rue X, 772) : priorité haute
        let fromStructured: MapboxSuggestion[] = []
        if (structuredRes) {
          try {
            const structuredData = await (structuredRes as Response).json()
            fromStructured = (structuredData?.features || [])
              .map(parseGeocodeFeature)
              .filter(Boolean) as MapboxSuggestion[]
          } catch {
            /* ignore */
          }
        }

        // Nominatim (OSM) : quartiers, rues, POI visibles sur la carte
        const fromNominatim: MapboxSuggestion[] = (nominatimData || [])
          .filter((r: NominatimResult) => r.lat && r.lon && r.display_name)
          .map((r: NominatimResult) => ({
            name: r.display_name.split(',')[0]?.trim() || r.display_name,
            mapbox_id: `nominatim-${r.place_id}`,
            feature_type: r.type || r.class || 'place',
            full_address: r.display_name,
            place_formatted: r.display_name,
            coordinates: { lat: parseFloat(r.lat), lng: parseFloat(r.lon) },
            source: 'nominatim' as const,
          }))

        const seen = new Set<string>()
        const merged: MapboxSuggestion[] = []
        // Priorité : adresses structurées > rues > geocode > searchbox > Nominatim
        for (const s of [...fromStructured, ...fromGeocodeStreet, ...fromGeocode, ...fromSearchBox, ...fromNominatim]) {
          const key = `${(s.name || '').toLowerCase()}|${(s.place_formatted || '').toLowerCase()}`
          if (key && !seen.has(key) && s.name) {
            seen.add(key)
            merged.push(s)
          }
        }
        setSearchSuggestions(merged.slice(0, 10))
      } catch (err) {
        logger.warn('[MapboxTrackingMap] Erreur suggest:', err)
        setSearchSuggestions([])
      } finally {
        setSearchLoading(false)
      }
    },
    [accessToken, searchSessionToken]
  )

  const handleSearchInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = e.target.value
      setSearchQuery(v)
      setSearchSuggestions([])
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
      const minLen = isNumericQuery(v) ? 1 : 2
      if (v.trim().length >= minLen) {
        searchDebounceRef.current = setTimeout(() => fetchSearchSuggestions(v), 300)
      }
    },
    [fetchSearchSuggestions]
  )

  /** Géocode une requête brute et vole vers le premier résultat */
  const geocodeAndFly = useCallback(
    async (q: string) => {
      const map = mapRef.current
      if (!map || !accessToken || !q.trim()) return
      try {
        const params = new URLSearchParams({
          q: q.trim(),
          access_token: accessToken,
          country: 'ci',
          language: 'fr',
          proximity: '-4.0083,5.36',
          limit: '1',
          autocomplete: 'false',
        })
        const res = await fetch(`${MAPBOX_GEOCODE_URL}?${params}`)
        const data = await res.json()
        const f = data?.features?.[0]
        if (!f?.geometry?.coordinates) return
        const [lng, lat] = Array.isArray(f.geometry.coordinates[0])
          ? f.geometry.coordinates[0]
          : f.geometry.coordinates
        map.flyTo({ center: [lng, lat], zoom: 17, duration: 1200 })
      } catch (err) {
        logger.warn('[MapboxTrackingMap] Geocode direct failed:', err)
      }
    },
    [accessToken]
  )

  const handleSelectSearchSuggestion = useCallback(
    async (suggestion: MapboxSuggestion) => {
      setSearchQuery(suggestion.full_address || suggestion.name)
      setSearchSuggestions([])
      setSearchExpanded(false)

      const map = mapRef.current
      if (!map) return

      let lng: number | null = null
      let lat: number | null = null

      if (suggestion.coordinates) {
        lng = suggestion.coordinates.lng
        lat = suggestion.coordinates.lat
      } else if (accessToken) {
        try {
          const params = new URLSearchParams({
            access_token: accessToken,
            session_token: searchSessionToken,
          })
          const res = await fetch(
            `${MAPBOX_RETRIEVE_URL}/${encodeURIComponent(suggestion.mapbox_id)}?${params}`
          )
          const data = await res.json()
          const feature = data?.features?.[0] as MapboxRetrieveFeature | undefined
          if (feature?.geometry?.coordinates) {
            ;[lng, lat] = feature.geometry.coordinates
          } else if (feature?.properties?.coordinates) {
            lat = feature.properties.coordinates.latitude
            lng = feature.properties.coordinates.longitude
          }
        } catch (err) {
          logger.warn('[MapboxTrackingMap] Search retrieve error:', err)
        }
      }

      if (lat != null && lng != null) {
        map.flyTo({ center: [lng, lat], zoom: 17, duration: 1200 })
      }
    },
    [accessToken, searchSessionToken]
  )

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node
      const btn = (e.target as HTMLElement).closest?.('[data-map-search-btn]')
      if (btn) return
      // Ne pas fermer si le clic est dans le dropdown (suggestions)
      if (searchExpanded && searchDropdownRef.current && !searchDropdownRef.current.contains(target)) {
        setSearchExpanded(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [searchExpanded])

  useEffect(() => {
    if (searchExpanded) {
      searchInputRef.current?.focus()
    }
  }, [searchExpanded])

  // Fetch route from Mapbox Directions API
  useEffect(() => {
    if (loadError || !isLoaded || !accessToken) return
    if (!selectedDelivery?.pickup?.coordinates || !selectedDelivery?.dropoff?.coordinates) return

    const currentDeliveryId = selectedDelivery.id
    const isNewDelivery = previousDeliveryIdRef.current !== currentDeliveryId

    if (isNewDelivery) {
      previousDeliveryIdRef.current = currentDeliveryId
      setFullRoutePath([])
    }

    const pickupCoords = selectedDelivery.pickup.coordinates
    const dropoffCoords = selectedDelivery.dropoff.coordinates

    fetchMapboxDirections(pickupCoords, dropoffCoords, accessToken).then((result) => {
      if (previousDeliveryIdRef.current !== currentDeliveryId) return
      if (!result) {
        logger.warn('[MapboxTrackingMap] Directions API failed')
        setFullRoutePath([])
        return
      }

      const traffic = extractMapboxTrafficData(result.duration, result.durationTypical)
      onTrafficData?.(traffic)

      const ensureExactEndpoints = (path: Array<{ lat: number; lng: number }>) => {
        if (!path || path.length === 0) return path
        const almostEqual = (a: { lat: number; lng: number }, b: { lat: number; lng: number }, eps = 0.0001) =>
          Math.abs(a.lat - b.lat) < eps && Math.abs(a.lng - b.lng) < eps
        let finalPath = [...path]
        if (finalPath.length > 0 && pickupCoords && !almostEqual(finalPath[0], pickupCoords)) {
          finalPath = [{ lat: pickupCoords.lat, lng: pickupCoords.lng }, ...finalPath]
        }
        if (finalPath.length > 0 && dropoffCoords && !almostEqual(finalPath[finalPath.length - 1], dropoffCoords)) {
          finalPath = [...finalPath, { lat: dropoffCoords.lat, lng: dropoffCoords.lng }]
        }
        return finalPath
      }

      setFullRoutePath(ensureExactEndpoints(result.coordinates))
    })
  }, [selectedDelivery, accessToken, isLoaded, loadError, onTrafficData])

  useEffect(() => {
    if (currentVehiclePosition) {
      requestAnimationFrame(() => setPreviousDriverPosition(currentVehiclePosition))
    }
  }, [currentVehiclePosition])

  // Initialize Mapbox map
  useEffect(() => {
    const container = mapContainerRef.current
    if (!container || !accessToken || !isLoaded || loadError) return
    if (typeof window === 'undefined') return

    let cleanup: (() => void) | null = null
    let didCancel = false

    const initMap = async () => {
      const mapboxgl = (await import('mapbox-gl')).default
      if (didCancel) return
      if (!mapContainerRef.current || !document.body.contains(mapContainerRef.current)) return
      mapboxglRef.current = mapboxgl
      mapboxgl.accessToken = accessToken

      if (mapRef.current) {
        try {
          mapRef.current.remove()
        } catch {
          // Ignorer si la map a déjà été supprimée
        }
        mapRef.current = null
      }

      markersRef.current.forEach((m) => {
        try {
          m.remove()
        } catch {
          // Ignorer
        }
      })
      markersRef.current = []

      const map = new mapboxgl.Map({
        container,
        style: isDarkMode
          ? 'mapbox://styles/mapbox/dark-v11'
          : 'mapbox://styles/mapbox/light-v11',
        center: [center.lng, center.lat],
        zoom: selectedDelivery && routePathFallback.length > 0 ? DELIVERY_ZOOM : OVERVIEW_ZOOM,
      })

      map.on('zoom', () => {
        const z = map.getZoom()
        if (z !== undefined) setCurrentZoom(z)
      })

      // Corriger les dimensions si le conteneur flex n'était pas encore calculé
      const onStyleData = () => {
        if (didCancel) return
        map.resize()
      }
      const purpleAccent = '#C4B5FD'
      const purpleLight = '#DDD6FE'

      const applyWaterPurpleStyle = () => {
        const style = map.getStyle()
        if (!style?.layers) return
        for (const layer of style.layers) {
          const id = (layer.id || '').toLowerCase()
          const sourceLayer = ((layer as MapboxStyleLayer)['source-layer'] || '').toLowerCase()
          const isWaterRelated = id.includes('water') || sourceLayer.includes('water')
          if (!isWaterRelated) continue
          try {
            const layerObj = map.getLayer(layer.id)
            if (!layerObj) continue
            if (layerObj.type === 'fill') {
              map.setPaintProperty(layer.id, 'fill-color', purpleLight)
            } else if (layerObj.type === 'line') {
              map.setPaintProperty(layer.id, 'line-color', purpleAccent)
            }
          } catch {
            // Ignorer
          }
        }
      }

      const addWaterOverlayLayer = () => {
        if (map.getLayer('chrono-water-overlay')) return
        const style = map.getStyle()
        const waterLayer = style?.layers?.find((l: MapboxStyleLayer) => (l['source-layer'] || '').toLowerCase() === 'water')
        const sourceId = (waterLayer as MapboxStyleLayer)?.source ?? 'composite'
        if (!sourceId || !style?.sources?.[sourceId]) return
        try {
          const beforeSymbol = style.layers?.find((l: MapboxStyleLayer) => l.type === 'symbol')?.id
          map.addLayer(
            {
              id: 'chrono-water-overlay',
              type: 'fill',
              source: sourceId,
              'source-layer': 'water',
              paint: { 'fill-color': purpleLight, 'fill-opacity': 1 },
            },
            beforeSymbol
          )
        } catch {
          // Source/layer non disponible
        }
      }

      map.on('style.load', onStyleData)
      map.once('load', () => {
        if (didCancel) return
        try {
          const containerEl = map.getContainer()
          if (containerEl && document.body.contains(containerEl)) {
            map.addControl(new mapboxgl.NavigationControl(), 'top-right')
          }
        } catch (err) {
          logger.warn('[MapboxTrackingMap] Impossible d\'ajouter NavigationControl:', err)
        }
        map.resize()
        applyWaterPurpleStyle()
        addWaterOverlayLayer()
      })
      map.once('style.load', () => {
        if (didCancel) return
        applyWaterPurpleStyle()
      })

      const ro = new ResizeObserver(() => {
        if (didCancel || !mapRef.current) return
        mapRef.current.resize()
      })
      ro.observe(container)

      mapRef.current = map
      cleanup = () => {
        ro.disconnect()
        map.off('style.load', onStyleData)
        try {
          if (map.getLayer('chrono-water-overlay')) map.removeLayer('chrono-water-overlay')
        } catch {
          // Ignorer
        }
        map.remove()
        mapRef.current = null
      }
      if (didCancel) cleanup()
    }

    initMap()

    return () => {
      didCancel = true
      cleanup?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- center, selectedDelivery, routePathFallback, isDarkMode mis à jour par le 2e useEffect
  }, [accessToken, isLoaded, loadError])

  // Update map center and markers when data changes
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    map.setCenter([center.lng, center.lat])
    map.setZoom(selectedDelivery && routePathFallback.length > 0 ? DELIVERY_ZOOM : OVERVIEW_ZOOM)
  }, [center, selectedDelivery, routePathFallback])

  // Draw route layer
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const drawRoute = () => {
      if (map.getLayer('route')) map.removeLayer('route')
      if (map.getSource('route')) map.removeSource('route')

      if (fullRoutePath.length >= 2) {
        const geojson: GeoJSON.Feature<GeoJSON.LineString> = {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: fullRoutePath.map((p) => [p.lng, p.lat]),
          },
        }
        map.addSource('route', {
          type: 'geojson',
          data: geojson,
        })
        map.addLayer({
          id: 'route',
          type: 'line',
          source: 'route',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': '#C4B5FD',
            'line-width': 6,
          },
        })
      }
    }

    if (map.isStyleLoaded()) {
      drawRoute()
    } else {
      map.on('load', drawRoute)
      return () => {
        map.off('load', drawRoute)
      }
    }
  }, [fullRoutePath])

  // Update markers
  useEffect(() => {
    const map = mapRef.current
    const mapboxgl = mapboxglRef.current
    if (!map || !mapboxgl) return

    markersRef.current.forEach((m) => m.remove())
    markersRef.current = []

    const addMarker = (pos: { lat: number; lng: number }, color: string, scale = 10) => {
      const el = document.createElement('div')
      el.style.width = `${scale * 2}px`
      el.style.height = `${scale * 2}px`
      el.style.borderRadius = '50%'
      el.style.backgroundColor = color
      el.style.border = '2px solid white'
      el.style.boxShadow = '0 1px 3px rgba(0,0,0,0.2)'
      const m = new mapboxgl.Marker(el).setLngLat([pos.lng, pos.lat]).addTo(map)
      markersRef.current.push(m)
    }

    if (selectedDelivery && routePathFallback.length >= 2) {
      addMarker(routePathFallback[0], '#10B981', 10)
      addMarker(routePathFallback[1], '#C4B5FD', 10)

      if (animatedDriverPosition && assignedDriver?.is_online === true) {
        addMarker(animatedDriverPosition, '#C4B5FD', 14)
      }
    }

    onlineDrivers.forEach((driver) => {
      if (driver.is_online !== true || !driver.current_latitude || !driver.current_longitude) return
      const offsetData = driverOffsets.get(driver.userId)
      const pos = offsetData
        ? { lat: offsetData.lat, lng: offsetData.lng }
        : { lat: driver.current_latitude, lng: driver.current_longitude }
      addMarker(pos, '#C4B5FD', 8)
    })
  }, [selectedDelivery, routePathFallback, animatedDriverPosition, assignedDriver, onlineDrivers, driverOffsets])

  if (loadError) {
    return (
      <div style={mapPlaceholderStyle}>
        <p style={mapPlaceholderTextStyle}>Erreur de chargement de la carte</p>
        {loadError.message && (
          <p style={{ ...mapPlaceholderTextStyle, fontSize: '12px', marginTop: '8px' }}>
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

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={mapContainerRef} style={mapContainerStyle} />
      {/* Barre de recherche au-dessus des contrôles de navigation */}
      <div
        style={{
          position: 'absolute',
          top: '12px',
          right: '56px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: '8px',
          zIndex: 1000,
          pointerEvents: 'auto',
        }}
      >
        {searchExpanded ? (
          <div
            ref={searchDropdownRef}
            style={{
              display: 'flex',
              flexDirection: 'column',
              width: '280px',
              backgroundColor: themeColors.cardBg,
              borderRadius: '12px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
              border: `1px solid ${themeColors.cardBorder}`,
              overflow: 'hidden',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', padding: '8px' }}>
              <Search size={20} style={{ color: themeColors.textSecondary, flexShrink: 0, marginRight: '8px' }} />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={handleSearchInputChange}
                placeholder="Lieu, adresse, coordonnées (lat, lng)..."
                style={{
                  flex: 1,
                  border: 'none',
                  outline: 'none',
                  fontSize: '14px',
                  color: themeColors.textPrimary,
                  backgroundColor: 'transparent',
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setSearchExpanded(false)
                    setSearchSuggestions([])
                  }
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    const q = searchQuery.trim()
                    const coords = parseCoordinates(q)
                    if (coords && mapRef.current) {
                      mapRef.current.flyTo({ center: [coords.lng, coords.lat], zoom: 17, duration: 1200 })
                      setSearchExpanded(false)
                      setSearchSuggestions([])
                      return
                    }
                    if (searchSuggestions.length > 0) {
                      handleSelectSearchSuggestion(searchSuggestions[0])
                      return
                    }
                    if (q.length >= 2) geocodeAndFly(q)
                  }
                }}
              />
              <button
                type="button"
                onClick={() => {
                  setSearchExpanded(false)
                  setSearchQuery('')
                  setSearchSuggestions([])
                }}
                style={{
                  padding: '4px',
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  color: themeColors.textSecondary,
                }}
              >
                <X size={18} />
              </button>
            </div>
            {searchLoading && (
              <div style={{ padding: '12px', fontSize: '13px', color: themeColors.textSecondary }}>
                Recherche...
              </div>
            )}
            {!searchLoading && searchSuggestions.length > 0 && (
              <div
                style={{
                  maxHeight: '200px',
                  overflowY: 'auto',
                  borderTop: `1px solid ${themeColors.cardBorder}`,
                }}
              >
                {searchSuggestions.map((s, i) => (
                  <button
                    key={`${s.mapbox_id}-${i}`}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      handleSelectSearchSuggestion(s)
                    }}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      textAlign: 'left',
                      border: 'none',
                      backgroundColor: 'transparent',
                      fontSize: '14px',
                      cursor: 'pointer',
                      color: themeColors.textPrimary,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = themeColors.grayLight
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent'
                    }}
                  >
                    <div style={{ fontWeight: 500 }}>{s.name}</div>
                    {(s.place_formatted || s.feature_type === 'category') && (
                      <div style={{ fontSize: '12px', color: themeColors.textSecondary, marginTop: '2px' }}>
                        {s.feature_type === 'category' || s.place_formatted?.toLowerCase() === 'category'
                          ? `${s.name} à proximité`
                          : s.place_formatted}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <button
            data-map-search-btn
            type="button"
            onClick={() => setSearchExpanded(true)}
            style={{
              width: '40px',
              height: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: themeColors.cardBg,
              border: `1px solid ${themeColors.cardBorder}`,
              borderRadius: '10px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              cursor: 'pointer',
              color: themeColors.textPrimary,
            }}
            title="Rechercher un lieu"
          >
            <Search size={24} />
          </button>
        )}
      </div>
    </div>
  )
}
