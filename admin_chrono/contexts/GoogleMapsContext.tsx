'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useLoadScript } from '@react-google-maps/api'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

interface GoogleMapsContextType {
  isLoaded: boolean
  loadError: Error | undefined
}

const GoogleMapsContext = createContext<GoogleMapsContextType | undefined>(undefined)

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
  })
  
  const googleMapsApiKey = directApiKey || googleConfig?.apiKey || ''

  // Charger Google Maps une seule fois avec un ID unique global
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: googleMapsApiKey || 'dummy-key-to-avoid-error',
    libraries: ['places'],
    id: 'google-maps-script-global', // ID unique global pour toute l'application
  })

  return (
    <GoogleMapsContext.Provider value={{ isLoaded, loadError }}>
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

