'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useMapbox } from '@/contexts/MapboxContext'

const MAPBOX_SUGGEST_URL = 'https://api.mapbox.com/search/searchbox/v1/suggest'
const MAPBOX_RETRIEVE_URL = 'https://api.mapbox.com/search/searchbox/v1/retrieve'

interface MapboxSuggestion {
  name: string
  mapbox_id: string
  feature_type: string
  address?: string
  full_address?: string
  place_formatted: string
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
      if (!searchText.trim() || searchText.length < 2 || !accessToken) {
        setSuggestions([])
        return
      }

      setIsLoading(true)
      try {
        const params = new URLSearchParams({
          q: searchText,
          access_token: accessToken,
          session_token: sessionToken,
          country: 'ci',
          language: 'fr',
          limit: '10',
          proximity: '-4.0083,5.36',
        })
        const res = await fetch(`${MAPBOX_SUGGEST_URL}?${params}`)
        const data = await res.json()

        if (data.suggestions && Array.isArray(data.suggestions)) {
          setSuggestions(data.suggestions)
          setIsOpen(true)
        } else {
          setSuggestions([])
        }
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
      setQuery(suggestion.full_address || suggestion.name)
      setIsOpen(false)
      setSuggestions([])

      if (!accessToken) {
        onChange(suggestion.full_address || suggestion.name)
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
        const address = suggestion.full_address || suggestion.name
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
        onChange(suggestion.full_address || suggestion.name)
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
