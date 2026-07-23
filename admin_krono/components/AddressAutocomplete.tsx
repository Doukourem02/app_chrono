'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useMapbox } from '@/contexts/MapboxContext'
import { searchOverpassPoi, type OverpassPoiResult } from '@/utils/overpassPoiSearch'
import { searchCuratedPoi } from '@/utils/poiAbidjan'
import {
  compactAddressForLocalDisplay,
  formatAutocompleteSelectedAddress,
} from '@/utils/sanitizeGeocodeDisplay'

const MAPBOX_SUGGEST_URL = 'https://api.mapbox.com/search/searchbox/v1/suggest'
const MAPBOX_RETRIEVE_URL = 'https://api.mapbox.com/search/searchbox/v1/retrieve'
const MAPBOX_GEOCODE_URL = 'https://api.mapbox.com/search/geocode/v6/forward'
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search'

const PROXIMITY = '-4.0083,5.36'

const NOMINATIM_HEADERS: HeadersInit = {
  'User-Agent': 'KronoLivraison/1.0 (admin-address-autocomplete)',
}

interface MapboxSuggestion {
  name: string
  mapbox_id: string
  feature_type: string
  address?: string
  full_address?: string
  place_formatted: string
  coordinates?: { lat: number; lng: number }
  source?: 'searchbox' | 'geocode' | 'nominatim' | 'overpass'
}

interface MapboxRetrieveFeature {
  type: string
  geometry: { coordinates: [number, number]; type: string }
  properties: {
    name: string
    full_address?: string
    coordinates?: { latitude: number; longitude: number }
  }
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

function generateSessionToken(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

function isNumericQuery(q: string): boolean {
  return /^\d[\d\s]*$/.test(q.trim())
}

function isStreetLikeQuery(q: string): boolean {
  const t = q.trim().toLowerCase()
  return (
    /^(rue|avenue|av\.?|boulevard|bd|bd\.?|route|impasse|allée)\s+/i.test(t) ||
    /^r\d+|^l\d+|^rue\s*l?\d+/i.test(t) ||
    (t.length >= 2 && /^[a-z]?\d+/.test(t))
  )
}

function suggestionMatchesQueryTokens(s: MapboxSuggestion, query: string): boolean {
  const raw = query.trim().toLowerCase()
  if (raw.length < 2) return true
  if (isNumericQuery(query)) return true
  if (isStreetLikeQuery(query)) return true

  const haystack = `${s.name || ''} ${s.full_address || ''} ${s.place_formatted || ''}`.toLowerCase()
  const tokens = raw.split(/\s+/).filter((t) => t.length >= 2)
  if (tokens.length === 0) return true
  return tokens.every((t) => haystack.includes(t))
}

function shouldExcludeSuggestion(s: MapboxSuggestion, query: string): boolean {
  const name = (s.name || '').toLowerCase()
  const desc = (s.place_formatted || s.full_address || '').toLowerCase()
  const combined = `${name} ${desc}`

  if (/woro\s*woro\s*[:\s→]|woro\s*woro\s*$/i.test(combined)) return true
  if (/^woro\s*woro\s/i.test(name)) return true

  if (/(gbaka|abaka)\s*[:\s→]/i.test(combined)) return true
  if (/^gbaka\s|^abaka\s/i.test(name)) return true
  if (/[→↔].*[→↔]|liberté\s*→|azur\s*→|dokui\s*azur/i.test(combined)) return true
  if (/^\s*\w+\s*:\s*\w+\s*→\s*\w+/i.test(name)) return true
  if (/:\s*[^:]+(→|->)\s*\w+/i.test(combined)) return true

  const q = query.trim().toLowerCase()
  if (q.includes('zoo')) {
    const isNonZooWithZooInName =
      (name.includes('pharmac') ||
        name.includes('pharmacy') ||
        name.includes('station') ||
        name.includes('oil') ||
        name.includes('gas') ||
        name.includes('veterinary')) &&
      name.includes('zoo')
    if (isNonZooWithZooInName) return true
    if (name.includes('zoo') && desc.includes('williamsville')) return true
  }

  return false
}

function getRelevanceScore(s: MapboxSuggestion, query: string): number {
  const name = (s.name || '').toLowerCase()
  const desc = (s.place_formatted || s.full_address || '').toLowerCase()
  const q = query.trim().toLowerCase()

  if (q.includes('zoo')) {
    if (name.includes("zoo d'abidjan") && !name.includes('pharmacy')) return 100
    if (name.includes('zoo national')) return 95
    if (name.includes('zoo') && (desc.includes('route du zoo') || desc.includes('cocody'))) return 80
    if (name.includes('zoo') && desc.includes('williamsville')) return -50
    if (name.includes('pharmacy') || name.includes('station') || name.includes('oil')) return -100
  }

  return 0
}

function formatSuggestionSecondaryLine(s: MapboxSuggestion): string {
  if (s.feature_type === 'category' || s.place_formatted?.toLowerCase() === 'category') {
    return `${s.name} à proximité`
  }
  const raw = s.place_formatted || s.full_address || ''
  return compactAddressForLocalDisplay(raw)
}

function formatSuggestionTitle(s: MapboxSuggestion): string {
  const raw = (s.name || '').trim()
  if (!raw) return compactAddressForLocalDisplay(s.full_address || s.place_formatted || '')
  return compactAddressForLocalDisplay(raw) || raw
}

interface AddressAutocompleteProps {
  value: string
  onChange: (address: string, coordinates?: { latitude: number; longitude: number }) => void
  placeholder?: string
  label?: React.ReactNode
}

export default function AddressAutocomplete({
  value,
  onChange,
  placeholder = 'Ex: Cocody, Abidjan',
  label,
}: AddressAutocompleteProps) {
  const [query, setQuery] = useState(value)
  const [suggestions, setSuggestions] = useState<MapboxSuggestion[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [sessionToken] = useState(() => generateSessionToken())
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { accessToken, isLoaded } = useMapbox()

  useEffect(() => {
    setQuery(value)
  }, [value])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const parseGeocodeFeature = useCallback((f: GeocodeFeature): MapboxSuggestion | null => {
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
      source: 'geocode',
    }
  }, [])

  const fetchSuggestions = useCallback(
    async (searchText: string) => {
      const trimmed = searchText.trim()
      if (!trimmed || !accessToken) {
        setSuggestions([])
        setIsOpen(false)
        return
      }
      const minLen = isNumericQuery(trimmed) ? 1 : 2
      if (trimmed.length < minLen) {
        setSuggestions([])
        setIsOpen(false)
        return
      }

      setIsLoading(true)
      try {
        const baseParams = { country: 'ci', language: 'fr', proximity: PROXIMITY }
        const extraTypes = isNumericQuery(trimmed) ? 'postcode,address' : undefined
        const streetLike = isStreetLikeQuery(trimmed)
        const streetTypes = extraTypes || 'street,address'

        const geocodeQ = streetLike ? `${trimmed}, Abidjan` : trimmed

        const [proxLng, proxLat] = PROXIMITY.split(',').map((x) => parseFloat(x.trim()))
        const overpassPromise = !streetLike
          ? searchOverpassPoi(
              trimmed,
              Number.isFinite(proxLat) && Number.isFinite(proxLng) ? { lat: proxLat, lng: proxLng } : undefined
            ).catch(() => [] as OverpassPoiResult[])
          : Promise.resolve([] as OverpassPoiResult[])

        const nominatimQ = trimmed.toLowerCase().includes('abidjan') ? trimmed : `${trimmed}, Abidjan`
        const nominatimPromise = fetch(
          `${NOMINATIM_URL}?${new URLSearchParams({
            q: nominatimQ,
            format: 'json',
            limit: '10',
            countrycodes: 'ci',
            bounded: '0',
            viewbox: '-4.15,5.2,-3.85,5.45',
          })}`,
          { headers: NOMINATIM_HEADERS }
        )
          .then((r) => (r.ok ? r.json() : []))
          .catch(() => [])

        const suggestFetch = !streetLike
          ? fetch(
              `${MAPBOX_SUGGEST_URL}?${new URLSearchParams({
                q: trimmed,
                access_token: accessToken,
                session_token: sessionToken,
                ...baseParams,
                limit: '6',
                types: streetTypes,
              })}`
            )
          : Promise.resolve(null as Response | null)

        const geocodeFetch = fetch(
          `${MAPBOX_GEOCODE_URL}?${new URLSearchParams({
            q: geocodeQ,
            access_token: accessToken,
            ...baseParams,
            limit: streetLike ? '15' : '6',
            autocomplete: 'true',
            types: streetTypes,
          })}`
        )

        const geocodeStreetFetch = !streetLike
          ? fetch(
              `${MAPBOX_GEOCODE_URL}?${new URLSearchParams({
                q: `${trimmed}, Abidjan`,
                access_token: accessToken,
                ...baseParams,
                limit: '6',
                autocomplete: 'true',
                types: streetTypes,
              })}`
            )
          : Promise.resolve(null as Response | null)

        const [suggestRes, geocodeRes, geocodeStreetRes, overpassData, nominatimDataUnknown] = await Promise.all([
          suggestFetch,
          geocodeFetch,
          geocodeStreetFetch,
          overpassPromise,
          nominatimPromise,
        ])
        const nominatimData = nominatimDataUnknown as NominatimResult[]

        const suggestData = suggestRes ? await suggestRes.json() : { suggestions: [] }
        const fromSearchBox: MapboxSuggestion[] = (suggestData?.suggestions || []).map(
          (s: Record<string, unknown>) => ({ ...s, source: 'searchbox' as const })
        ) as MapboxSuggestion[]

        const geocodeData = geocodeRes ? await geocodeRes.json() : { features: [] }
        const geocodeStreetData = geocodeStreetRes ? await geocodeStreetRes.json() : { features: [] }

        const fromGeocode = (geocodeData?.features || []).map(parseGeocodeFeature).filter(Boolean) as MapboxSuggestion[]
        const fromGeocodeStreet = (geocodeStreetData?.features || [])
          .map(parseGeocodeFeature)
          .filter(Boolean) as MapboxSuggestion[]

        const fromNominatim: MapboxSuggestion[] = (nominatimData || [])
          .filter((r: NominatimResult) => r.lat && r.lon && r.display_name)
          .map((r: NominatimResult) => ({
            name: r.display_name.split(',')[0]?.trim() || r.display_name,
            mapbox_id: `nominatim-${r.place_id}`,
            feature_type: r.type || r.class || 'place',
            full_address: r.display_name,
            place_formatted: r.display_name,
            coordinates: { lat: parseFloat(r.lat), lng: parseFloat(r.lon) },
            source: 'nominatim',
          }))

        const fromOverpass: MapboxSuggestion[] = (overpassData || []).map((o) => ({
          name: o.name,
          mapbox_id: o.mapbox_id,
          feature_type: o.feature_type,
          full_address: o.full_address,
          place_formatted: o.place_formatted,
          coordinates: o.coordinates,
          source: 'overpass',
        }))

        const curatedData = searchCuratedPoi(trimmed)
        const fromCurated: MapboxSuggestion[] = curatedData.map((p, i) => ({
          name: p.name,
          mapbox_id: `curated-${p.name.toLowerCase().replace(/\s/g, '-')}-${i}`,
          feature_type: p.category,
          full_address: p.full_address,
          place_formatted: p.place_formatted + (p.hours ? ` · ${p.hours}` : '') + (p.phone ? ` · ${p.phone}` : ''),
          coordinates: p.coordinates,
          source: 'searchbox',
        }))

        const seen = new Set<string>()
        const merged: MapboxSuggestion[] = []
        const sourcesToMerge = streetLike
          ? [...fromGeocodeStreet, ...fromGeocode, ...fromNominatim, ...fromCurated, ...fromSearchBox, ...fromOverpass]
          : [...fromCurated, ...fromSearchBox, ...fromOverpass, ...fromGeocode, ...fromGeocodeStreet, ...fromNominatim]

        for (const s of sourcesToMerge) {
          if (shouldExcludeSuggestion(s, trimmed)) continue
          if (!suggestionMatchesQueryTokens(s, trimmed)) continue
          const key = `${(s.name || '').toLowerCase()}|${(s.place_formatted || '').toLowerCase()}`
          if (key && !seen.has(key) && s.name) {
            seen.add(key)
            merged.push(s)
          }
        }

        merged.sort((a, b) => getRelevanceScore(b, trimmed) - getRelevanceScore(a, trimmed))

        const list = merged.slice(0, 15)
        setSuggestions(list)
        setIsOpen(list.length > 0)
      } catch (err) {
        console.error('[AddressAutocomplete] Suggest error:', err)
        setSuggestions([])
        setIsOpen(false)
      } finally {
        setIsLoading(false)
      }
    },
    [accessToken, sessionToken, parseGeocodeFeature]
  )

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setQuery(newValue)
    onChange(newValue)
    setSuggestions([])

    if (debounceRef.current) clearTimeout(debounceRef.current)
    const minLen = isNumericQuery(newValue.trim()) ? 1 : 2
    if (newValue.trim().length < minLen) {
      setIsOpen(false)
      return
    }
    debounceRef.current = setTimeout(() => fetchSuggestions(newValue), 300)
  }

  const handleSelectSuggestion = useCallback(
    async (suggestion: MapboxSuggestion) => {
      const raw = suggestion.full_address || suggestion.address || suggestion.name
      const address = formatAutocompleteSelectedAddress(raw, query)
      setQuery(address)
      setIsOpen(false)
      setSuggestions([])

      if (suggestion.coordinates) {
        onChange(address, {
          latitude: suggestion.coordinates.lat,
          longitude: suggestion.coordinates.lng,
        })
        return
      }

      if (!accessToken) {
        onChange(address)
        return
      }

      try {
        const params = new URLSearchParams({
          access_token: accessToken,
          session_token: sessionToken,
        })
        const res = await fetch(
          `${MAPBOX_RETRIEVE_URL}/${encodeURIComponent(suggestion.mapbox_id)}?${params}`
        )
        const data = await res.json()

        const feature = data?.features?.[0] as MapboxRetrieveFeature | undefined
        let coordinates: { latitude: number; longitude: number } | undefined

        if (feature?.geometry?.coordinates) {
          const [lng, lat] = feature.geometry.coordinates
          coordinates = { latitude: lat, longitude: lng }
        } else if (feature?.properties?.coordinates) {
          coordinates = {
            latitude: feature.properties.coordinates.latitude,
            longitude: feature.properties.coordinates.longitude,
          }
        }

        onChange(address, coordinates)
      } catch (err) {
        console.error('[AddressAutocomplete] Retrieve error:', err)
        onChange(address)
      }
    },
    [accessToken, sessionToken, onChange, query]
  )

  if (!isLoaded || !accessToken) {
    return (
      <div style={{ position: 'relative', width: '100%' }}>
        {label && (
          <label
            style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: 600,
              color: '#111827',
              marginBottom: '8px',
            }}
          >
            {label}
          </label>
        )}
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          placeholder={placeholder}
          disabled
          style={{
            width: '100%',
            padding: '10px 16px',
            borderRadius: '8px',
            border: '1px solid #E5E7EB',
            fontSize: '14px',
            outline: 'none',
            marginTop: label ? '0' : '8px',
            backgroundColor: '#F9FAFB',
            color: '#6B7280',
          }}
        />
        <div
          style={{
            position: 'absolute',
            right: '12px',
            top: label ? '32px' : '8px',
            fontSize: '12px',
            color: '#9CA3AF',
          }}
        >
          Chargement...
        </div>
      </div>
    )
  }

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      {label && (
        <label
          style={{
            display: 'block',
            fontSize: '14px',
            fontWeight: 600,
            color: '#111827',
            marginBottom: '8px',
          }}
        >
          {label}
        </label>
      )}
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={handleInputChange}
        onFocus={() => setIsOpen(true)}
        placeholder={placeholder}
        style={{
          width: '100%',
          padding: '10px 16px',
          borderRadius: '8px',
          border: '1px solid #E5E7EB',
          fontSize: '14px',
          outline: 'none',
          marginTop: label ? '0' : '8px',
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setIsOpen(false)
            inputRef.current?.blur()
          }
        }}
      />
      {isOpen && suggestions.length > 0 && (
        <div
          ref={dropdownRef}
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            marginTop: '4px',
            backgroundColor: '#fff',
            border: '1px solid #E5E7EB',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            zIndex: 10050,
            maxHeight: '240px',
            overflowY: 'auto',
          }}
        >
          {suggestions.map((s, i) => {
            const title = formatSuggestionTitle(s)
            const sub = formatSuggestionSecondaryLine(s)
            return (
              <button
                key={`${s.mapbox_id}-${i}`}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelectSuggestion(s)}
                style={{
                  width: '100%',
                  padding: '10px 16px',
                  textAlign: 'left',
                  border: 'none',
                  backgroundColor: 'transparent',
                  fontSize: '14px',
                  cursor: 'pointer',
                  color: '#111827',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#F3F4F6'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent'
                }}
              >
                <div style={{ fontWeight: 500 }}>{title}</div>
                {sub && sub !== title && (
                  <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '2px' }}>{sub}</div>
                )}
              </button>
            )
          })}
        </div>
      )}
      {isLoading && (
        <div
          style={{
            position: 'absolute',
            right: '12px',
            top: label ? '32px' : '8px',
            fontSize: '12px',
            color: '#9CA3AF',
          }}
        >
          Recherche...
        </div>
      )}
    </div>
  )
}
