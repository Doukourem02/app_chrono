'use client'

import React, { createContext, useContext, ReactNode, useMemo } from 'react'
import { useLoadScript } from '@react-google-maps/api'
import type { Library } from '@googlemaps/js-api-loader'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

interface GoogleMapsContextType {
  isLoaded: boolean
  loadError: Error | undefined
}

const GoogleMapsContext = createContext<GoogleMapsContextType | undefined>(undefined)

// Définir les libraries comme constante en dehors du composant pour éviter les re-renders
const GOOGLE_MAPS_LIBRARIES: Library[] = ['places']

export function GoogleMapsProvider({ children }: { children: ReactNode }) {
  const directApiKey = process.env.NEXT_PUBLIC_GOOGLE_API_KEY || ''
  
  const { data: googleConfig } = useQuery({
    queryKey: ['googleMapsConfig'],
    queryFn: async () => {
      if (directApiKey) {
        return { apiKey: directApiKey }
      }
      
      try {
        const token = await supabase.auth.getSession().then(({ data: { session } }) => session?.access_token)
        if (!token) return { apiKey: '' }
        const response = await fetch('/api/google-maps-config', {
          headers: { 'Authorization': `Bearer ${token}` },
        })
        if (!response.ok) return { apiKey: '' }
        const result = await response.json()
        return { apiKey: result.apiKey || '' }
      } catch {
        return { apiKey: '' }
      }
    },
    enabled: !directApiKey,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchInterval: false,
  })
  
  const googleMapsApiKey = useMemo(() => directApiKey || googleConfig?.apiKey || '', [directApiKey, googleConfig?.apiKey])

  // Charger Google Maps une seule fois avec un ID unique global
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: googleMapsApiKey || 'dummy-key-to-avoid-error',
    libraries: GOOGLE_MAPS_LIBRARIES, // Utiliser la constante pour éviter les re-renders
    id: 'google-maps-script-global', // ID unique global pour toute l'application
  })

  // Mémoriser la valeur du contexte pour éviter les re-renders inutiles
  const contextValue = useMemo(() => ({
    isLoaded,
    loadError
  }), [isLoaded, loadError])

  return (
    <GoogleMapsContext.Provider value={contextValue}>
      {children}
    </GoogleMapsContext.Provider>
  )
}

export function useGoogleMaps() {
  const context = useContext(GoogleMapsContext)
  if (context === undefined) {
    throw new Error('useGoogleMaps must be used within a GoogleMapsProvider')
  }
  return context
}

