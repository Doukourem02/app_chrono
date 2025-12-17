'use client'

import React, { createContext, useContext, ReactNode, useMemo, useState, useEffect } from 'react'
import { useLoadScript } from '@react-google-maps/api'
import type { Library } from '@googlemaps/js-api-loader'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

interface GoogleMapsContextType {
  isLoaded: boolean
  loadError: Error | undefined
  billingError?: boolean
  deletedProjectError?: boolean
}

const GoogleMapsContext = createContext<GoogleMapsContextType | undefined>(undefined)

const GOOGLE_MAPS_LIBRARIES: Library[] = ['places']

// Fonction pour détecter si une erreur est une erreur de facturation
function isBillingError(error: Error | string | unknown): boolean {
  const errorMessage = typeof error === 'string' 
    ? error 
    : error instanceof Error 
      ? (error.message || '').toLowerCase() 
      : JSON.stringify(error).toLowerCase()
  
  const errorName = error instanceof Error ? (error.name || '').toLowerCase() : ''
  const errorString = JSON.stringify(error).toLowerCase()
  
  const billingKeywords = [
    'billingnotenabled',
    'billing-not-enabled',
    'billingnotenabledmaperror',
    'billing not enabled',
    'enable billing',
    'billing account',
    'billing is not enabled',
  ]
  
  return billingKeywords.some(keyword => 
    errorMessage.includes(keyword) || 
    errorName.includes(keyword) ||
    errorString.includes(keyword)
  )
}

// Fonction pour détecter si une erreur indique un projet supprimé
function isDeletedProjectError(error: Error | string | unknown): boolean {
  const errorMessage = typeof error === 'string' 
    ? error 
    : error instanceof Error 
      ? (error.message || '').toLowerCase() 
      : JSON.stringify(error).toLowerCase()
  
  const errorName = error instanceof Error ? (error.name || '').toLowerCase() : ''
  const errorString = JSON.stringify(error).toLowerCase()
  
  const deletedProjectKeywords = [
    'deletedapiprojectmaperror',
    'deleted-api-project-map-error',
    'deleted api project',
    'project deleted',
    'project has been deleted',
    'project was deleted',
    'api project deleted',
  ]
  
  return deletedProjectKeywords.some(keyword => 
    errorMessage.includes(keyword) || 
    errorName.includes(keyword) ||
    errorString.includes(keyword)
  )
}

export function GoogleMapsProvider({ children }: { children: ReactNode }) {
  const directApiKey = process.env.NEXT_PUBLIC_GOOGLE_API_KEY || ''
  const [runtimeError, setRuntimeError] = useState<Error | undefined>(undefined)
  
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

  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: googleMapsApiKey || 'dummy-key-to-avoid-error',
    libraries: GOOGLE_MAPS_LIBRARIES, 
    id: 'google-maps-script-global', 
    onError: (error) => {
      // Capturer les erreurs de chargement
      if (isBillingError(error) || isDeletedProjectError(error)) {
        setRuntimeError(error instanceof Error ? error : new Error(String(error)))
      }
    },
  })

  // Écouter les erreurs Google Maps globales après le chargement
  useEffect(() => {
    // Intercepter les erreurs même avant le chargement complet
    const handleError = (event: ErrorEvent) => {
      const errorMessage = event.message || event.error?.message || String(event.error || '')
      if (errorMessage && (isBillingError(errorMessage) || isDeletedProjectError(errorMessage))) {
        setRuntimeError(new Error(errorMessage))
      }
    }

    // Écouter aussi les erreurs non capturées de Google Maps
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason?.message || String(event.reason || '')
      if (reason && (isBillingError(reason) || isDeletedProjectError(reason))) {
        setRuntimeError(new Error(reason))
      }
    }

    // Intercepter aussi les erreurs de console.error pour capturer les erreurs Google Maps
    const originalConsoleError = console.error
    const interceptConsoleError = (...args: unknown[]) => {
      const errorString = args.map(arg => {
        if (arg instanceof Error) return arg.message || arg.name || String(arg)
        if (typeof arg === 'string') return arg
        return JSON.stringify(arg)
      }).join(' ').toLowerCase()
      
      if (isBillingError(errorString) || isDeletedProjectError(errorString)) {
        setRuntimeError(new Error(errorString))
      }
      
      // Appeler la fonction originale
      originalConsoleError.apply(console, args)
    }

    window.addEventListener('error', handleError)
    window.addEventListener('unhandledrejection', handleUnhandledRejection)
    console.error = interceptConsoleError

    return () => {
      window.removeEventListener('error', handleError)
      window.removeEventListener('unhandledrejection', handleUnhandledRejection)
      console.error = originalConsoleError
    }
  }, [])

  // Combiner les erreurs de chargement et les erreurs runtime
  const combinedError = loadError || runtimeError

  // Détecter l'erreur de facturation spécifiquement
  const billingError = useMemo(() => {
    if (!combinedError) return false
    return isBillingError(combinedError)
  }, [combinedError])

  // Détecter l'erreur de projet supprimé
  const deletedProjectError = useMemo(() => {
    if (!combinedError) return false
    return isDeletedProjectError(combinedError)
  }, [combinedError])

  // Log pour le débogage en développement
  useEffect(() => {
    if (combinedError && process.env.NODE_ENV === 'development') {
      if (billingError) {
        console.warn('[GoogleMaps] Billing error detected:', {
          message: combinedError.message,
          name: combinedError.name,
          error: combinedError,
          source: loadError ? 'loadError' : 'runtimeError',
        })
      }
      if (deletedProjectError) {
        console.warn('[GoogleMaps] Deleted project error detected:', {
          message: combinedError.message,
          name: combinedError.name,
          error: combinedError,
          source: loadError ? 'loadError' : 'runtimeError',
        })
      }
    }
  }, [combinedError, billingError, deletedProjectError, loadError])

  const contextValue = useMemo(() => ({
    isLoaded: isLoaded && !billingError && !deletedProjectError, // Ne pas considérer comme chargé si erreur
    loadError: combinedError,
    billingError,
    deletedProjectError
  }), [isLoaded, combinedError, billingError, deletedProjectError])

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

