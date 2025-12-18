'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Autocomplete } from '@react-google-maps/api'
import { useGoogleMaps } from '@/contexts/GoogleMapsContext'

interface AddressAutocompleteProps {
  value: string
  onChange: (address: string, coordinates?: { latitude: number; longitude: number }) => void
  placeholder?: string
  label?: string
}

export default function AddressAutocomplete({
  value,
  onChange,
  placeholder = "Ex: Cocody, Abidjan",
  label,
}: AddressAutocompleteProps) {
  const [query, setQuery] = useState(value)
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const { isLoaded } = useGoogleMaps()

  // Synchroniser la valeur externe avec l'état local
  useEffect(() => {
    setQuery(value)
  }, [value])

  const onLoad = useCallback((autocomplete: google.maps.places.Autocomplete) => {
    autocompleteRef.current = autocomplete
    
    // Restreindre les résultats à la Côte d'Ivoire
    autocomplete.setComponentRestrictions({ country: 'ci' })
    
    // Ne pas définir de types spécifiques - laisser Google Maps gérer automatiquement
    // L'option 'types' dans les options du composant Autocomplete sera utilisée à la place
  }, [])

  const onPlaceChanged = useCallback(() => {
    if (autocompleteRef.current) {
      const place = autocompleteRef.current.getPlace()
      
      if (place && place.formatted_address) {
        const address = place.formatted_address
        setQuery(address)
        
        // Récupérer les coordonnées si disponibles
        let coordinates: { latitude: number; longitude: number } | undefined = undefined
        if (place.geometry && place.geometry.location) {
          coordinates = {
            latitude: place.geometry.location.lat(),
            longitude: place.geometry.location.lng(),
          }
        }
        
        onChange(address, coordinates)
      }
    }
  }, [onChange])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setQuery(newValue)
    // Mettre à jour la valeur parente même si ce n'est pas une suggestion sélectionnée
    onChange(newValue)
  }

  if (!isLoaded) {
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
      <Autocomplete
        onLoad={onLoad}
        onPlaceChanged={onPlaceChanged}
        options={{
          componentRestrictions: { country: 'ci' },
          types: ['geocode'], // Utiliser 'geocode' qui inclut les adresses et établissements
          fields: ['formatted_address', 'geometry', 'place_id'],
        }}
      >
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
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
              inputRef.current?.blur()
            }
          }}
        />
      </Autocomplete>
    </div>
  )
}
