'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { ErrorBoundary } from '@/components/ErrorBoundary'

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () => {
      const client = new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: Infinity, // Les données ne deviennent jamais "stale" - pas de refetch automatique
            gcTime: 30 * 60 * 1000, // Garder en cache pendant 30 minutes
            refetchOnWindowFocus: false, // Ne pas rafraîchir quand on revient sur l'onglet
            refetchOnMount: false, // Ne pas rafraîchir au montage du composant
            refetchOnReconnect: false, // Ne pas rafraîchir lors de la reconnexion réseau
            refetchInterval: false, // Pas de refresh automatique par défaut
            retry: false, // Ne pas réessayer en cas d'erreur (évite les requêtes supplémentaires)
            networkMode: 'online', // Ne faire des requêtes que si en ligne
          },
        },
      })

      // Intercepter les invalidations de queries pour les logger
      if (process.env.NODE_ENV === 'development') {
        const originalInvalidateQueries = client.invalidateQueries.bind(client)
        client.invalidateQueries = function(...args) {
          console.warn('⚠️ [QueryClient] invalidateQueries called:', {
            filters: args[0],
            options: args[1],
            stack: new Error().stack?.split('\n').slice(2, 10).join('\n')
          })
          return originalInvalidateQueries(...args)
        }

        const originalRefetchQueries = client.refetchQueries.bind(client)
        client.refetchQueries = function(...args) {
          console.warn('⚠️ [QueryClient] refetchQueries called:', {
            filters: args[0],
            options: args[1],
            stack: new Error().stack?.split('\n').slice(2, 10).join('\n')
          })
          return originalRefetchQueries(...args)
        }
      }

      return client
    }
  )

  // Intercepteur global pour toutes les requêtes fetch (uniquement en développement)
  useEffect(() => {
    if (typeof window === 'undefined' || process.env.NODE_ENV !== 'development') return

    const originalFetch = window.fetch
    let requestCount = 0
    const requestTimestamps: Map<number, number> = new Map()
    let lastRequestTime: number | null = null
    const requestHistory: Array<{ url: string; timestamp: number; timeSinceLast: number | null }> = []

    window.fetch = async function(...args) {
      const requestId = ++requestCount
      let url: string
      if (typeof args[0] === 'string') {
        url = args[0]
      } else if (args[0] instanceof URL) {
        url = args[0].href
      } else if (args[0] instanceof Request) {
        url = args[0].url
      } else {
        url = 'unknown'
      }
      const timestamp = Date.now()
      const timeSinceLast = lastRequestTime ? timestamp - lastRequestTime : null
      requestTimestamps.set(requestId, timestamp)

      // Log uniquement les requêtes vers localhost:4000 (notre API)
      if (url.includes('localhost:4000') || url.includes('/api/')) {
        // Garder l'historique des 10 dernières requêtes
        requestHistory.push({ url, timestamp, timeSinceLast })
        if (requestHistory.length > 10) {
          requestHistory.shift()
        }

        // Détecter les patterns de requêtes périodiques (5 minutes = 300000ms)
        const isPeriodic = timeSinceLast !== null && timeSinceLast > 300000 && timeSinceLast < 310000 // Entre 5 minutes et 5 minutes 10 secondes
        
        console.log('🔍 [Global Fetch Interceptor] REQUEST', {
          id: requestId,
          url,
          timestamp: new Date(timestamp).toISOString(),
          method: args[1]?.method || 'GET',
          timeSinceLast: timeSinceLast ? `${(timeSinceLast / 1000).toFixed(1)}s` : 'N/A',
          isPeriodic: isPeriodic ? '⚠️ PERIODIC REQUEST DETECTED ⚠️' : false,
          stack: new Error().stack?.split('\n').slice(2, 10).join('\n')
        })

        if (isPeriodic) {
          console.warn('⚠️⚠️⚠️ PERIODIC REQUEST DETECTED ⚠️⚠️⚠️', {
            url,
            interval: `${(timeSinceLast / 1000).toFixed(1)}s`,
            requestHistory: requestHistory.slice(-5)
          })
        }

        lastRequestTime = timestamp
      }

      try {
        const response = await originalFetch.apply(this, args)
        const responseTimestamp = Date.now()
        const duration = responseTimestamp - timestamp

        if (url.includes('localhost:4000') || url.includes('/api/')) {
          console.log('✅ [Global Fetch Interceptor] RESPONSE', {
            id: requestId,
            url,
            status: response.status,
            statusText: response.statusText,
            timestamp: new Date(responseTimestamp).toISOString(),
            duration: `${duration}ms`
          })
        }

        requestTimestamps.delete(requestId)
        return response
      } catch (error) {
        requestTimestamps.delete(requestId)
        throw error
      }
    }

    return () => {
      window.fetch = originalFetch
    }
  }, [])

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </ErrorBoundary>
  )
}

