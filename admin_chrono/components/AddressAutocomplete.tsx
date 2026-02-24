'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useMapbox } from '@/contexts/MapboxContext'
import { searchOverpassPoi, type OverpassPoiResult } from '@/utils/overpassPoiSearch'

const MAPBOX_SUGGEST_URL = 'https://api.mapbox.com/search/searchbox/v1/suggest'
const MAPBOX_RETRIEVE_URL = 'https://api.mapbox.com/search/searchbox/v1/retrieve'
const MAPBOX_GEOCODE_URL = 'https://api.mapbox.com/search/geocode/v6/forward'
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search'

const NOMINATIM_HEADERS: HeadersInit = {
  'User-Agent': 'ChronoLivraison/1.0 (admin-address-autocomplete)',
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

function generateSessionToken(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
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

  const fetchSuggestions = useCallback(
    async (searchText: string) => {
      const trimmed = searchText.trim()
      if (!trimmed || trimmed.length < 2 || !accessToken) {
        setSuggestions([])
        return
      }

      setIsLoading(true)
      try {
        const baseParams = { country: 'ci', language: 'fr', proximity: '-4.0083,5.36' }

        const [suggestRes, geocodeRes, overpassData, nominatimData] = await Promise.all([
          fetch(
            `${MAPBOX_SUGGEST_URL}?${new URLSearchParams({
              q: trimmed,
              access_token: accessToken,
              session_token: sessionToken,
              ...baseParams,
              limit: '8',
            })}`
          ),
          fetch(
            `${MAPBOX_GEOCODE_URL}?${new URLSearchParams({
              q: trimmed,
              access_token: accessToken,
              ...baseParams,
              limit: '8',
              autocomplete: 'true',
            })}`
          ),
          searchOverpassPoi(trimmed, { lat: 5.36, lng: -4.0083 }).catch(() => [] as OverpassPoiResult[]),
          fetch(
            `${NOMINATIM_URL}?${new URLSearchParams({
              q: trimmed.toLowerCase().includes('abidjan') ? trimmed : `${trimmed}, Abidjan`,
              format: 'json',
              limit: '8',
              countrycodes: 'ci',
              viewbox: '-4.15,5.2,-3.85,5.45',
            })}`,
            { headers: NOMINATIM_HEADERS }
          )
            .then((r) => (r.ok ? r.json() : []))
            .catch(() => []),
        ])

        const suggestData = await suggestRes.json()
        const geocodeData = await geocodeRes.json()

        interface GeocodeFeature {
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
              place?: { name?: string }
              locality?: { name?: string }
              district?: { name?: string }
              neighborhood?: { name?: string }
            }
          }
        }

        const parseGeocode = (f: GeocodeFeature): MapboxSuggestion | null => {
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
          return {
            name,
            mapbox_id: props.mapbox_id || '',
            feature_type: props.feature_type || 'address',
            full_address: props.full_address,
            place_formatted: props.place_formatted || placeParts.join(', ') || '',
            coordinates: { lat, lng },
            source: 'geocode',
          }
        }

        const fromSearchBox: MapboxSuggestion[] = (suggestData?.suggestions || []).map(
          (s: Record<string, unknown>) => ({ ...s, source: 'searchbox' as const })
        )
        const fromGeocode = (geocodeData?.features || []).map(parseGeocode).filter(Boolean) as MapboxSuggestion[]
        const fromOverpass: MapboxSuggestion[] = (overpassData || []).map((o) => ({
          name: o.name,
          mapbox_id: o.mapbox_id,
          feature_type: o.feature_type,
          full_address: o.full_address,
          place_formatted: o.place_formatted,
          coordinates: o.coordinates,
          source: 'overpass',
        }))
        const fromNominatim: MapboxSuggestion[] = (nominatimData || [])
          .filter((r: { lat?: string; lon?: string }) => r.lat && r.lon)
          .map((r: { place_id: string; lat: string; lon: string; display_name: string }) => ({
          name: r.display_name.split(',')[0]?.trim() || r.display_name,
          mapbox_id: `nominatim-${r.place_id}`,
          feature_type: 'place',
          full_address: r.display_name,
          place_formatted: r.display_name,
          coordinates: { lat: parseFloat(r.lat), lng: parseFloat(r.lon) },
          source: 'nominatim',
        }))

        const seen = new Set<string>()
        const merged: MapboxSuggestion[] = []
        for (const s of [...fromSearchBox, ...fromOverpass, ...fromGeocode, ...fromNominatim]) {
          const key = `${(s.name || '').toLowerCase()}|${(s.place_formatted || '').toLowerCase()}`
          if (key && !seen.has(key) && s.name) {
            seen.add(key)
            merged.push(s)
          }
        }

        setSuggestions(merged.slice(0, 15))
        setIsOpen(true)
      } catch (err) {
        console.error('[AddressAutocomplete] Suggest error:', err)
        setSuggestions([])
      } finally {
        setIsLoading(false)
      }
    },
    [accessToken, sessionToken]
  )

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setQuery(newValue)
    onChange(newValue)
    setSuggestions([])
    setIsOpen(false)

    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (newValue.length >= 2) {
      debounceRef.current = setTimeout(() => fetchSuggestions(newValue), 300)
    }
  }

  const handleSelectSuggestion = useCallback(
    async (suggestion: MapboxSuggestion) => {
      const address = suggestion.full_address || suggestion.name
      setQuery(address)
      setIsOpen(false)
      setSuggestions([])

      // Coordonnées directes (Overpass, Geocode, Nominatim) : pas d'appel retrieve
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
    [accessToken, sessionToken, onChange]
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
        onFocus={() => suggestions.length > 0 && setIsOpen(true)}
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
            zIndex: 1000,
            maxHeight: '240px',
            overflowY: 'auto',
          }}
        >
          {suggestions.map((s, i) => (
            <button
              key={`${s.mapbox_id}-${i}`}
              type="button"
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
              <div style={{ fontWeight: 500 }}>{s.name}</div>
              {s.place_formatted && (
                <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '2px' }}>
                  {s.place_formatted}
                </div>
              )}
            </button>
          ))}
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
