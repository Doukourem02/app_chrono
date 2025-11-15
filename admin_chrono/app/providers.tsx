'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { ErrorBoundary } from '@/components/ErrorBoundary'

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => {
    const client = new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: Infinity,
          gcTime: 30 * 60 * 1000,
          refetchOnWindowFocus: false,
          refetchOnMount: false,
          refetchOnReconnect: false,
          refetchInterval: false,
          refetchIntervalInBackground: false,
          retry: false,
          networkMode: 'online',
        },
      },
    })

    // --- DEV LOGS POUR REACT QUERY ---
    if (process.env.NODE_ENV === 'development') {
      // Log des invalidations
      const originalInvalidate = client.invalidateQueries.bind(client)
      client.invalidateQueries = (...args) => {
        console.warn('⚠️ [ReactQuery] invalidateQueries', {
          args,
          stack: new Error().stack?.split('\n').slice(2, 10).join('\n'),
        })
        return originalInvalidate(...args)
      }

      // Log des refetch
      const originalRefetch = client.refetchQueries.bind(client)
      client.refetchQueries = (...args) => {
        console.warn('⚠️ [ReactQuery] refetchQueries', {
          args,
          stack: new Error().stack?.split('\n').slice(2, 10).join('\n'),
        })
        return originalRefetch(...args)
      }

      // Log des fetchQuery
      const originalFetchQuery = client.fetchQuery.bind(client)
      client.fetchQuery = (...args) => {
        console.warn('⚠️ [ReactQuery] fetchQuery', {
          queryKey: args[0]?.queryKey ?? args[0],
          stack: new Error().stack?.split('\n').slice(2, 10).join('\n'),
        })
        return originalFetchQuery(...args)
      }
    }

    return client
  })

  // --- INTERCEPTEUR GLOBAL FETCH ---
  useEffect(() => {
    if (typeof window === 'undefined' || process.env.NODE_ENV !== 'development') return

    const originalFetch = window.fetch
    let lastRequestTime: number | null = null

    window.fetch = async (...args) => {
      // Détection URL
      let url = 'unknown'
      const req = args[0]
      if (typeof req === 'string') url = req
      else if (req instanceof URL) url = req.href
      else if (req instanceof Request) url = req.url

      const isApi = url.includes('localhost:4000') || url.startsWith('/api/')
      const now = Date.now()

      // Calcul intervalle
      const interval = lastRequestTime ? now - lastRequestTime : null
      const isPeriodic =
        interval !== null &&
        interval > 295000 &&
        interval < 305000 // ~5 minutes

      if (isApi) {
        console.log('🔍 [Fetch] REQUEST', {
          url,
          timestamp: new Date(now).toISOString(),
          method: args[1]?.method ?? 'GET',
          interval: interval ? `${interval}ms` : 'N/A',
          periodic: isPeriodic ? '⚠️ YES (5min)' : false,
        })

        if (isPeriodic) {
          console.warn('⚠️⚠️⚠️ PERIODIC API REQUEST DETECTED (5min) ⚠️⚠️⚠️', {
            url,
            interval: `${interval}ms`,
            stack: new Error().stack?.split('\n').slice(2, 10).join('\n'),
          })
        }

        lastRequestTime = now
      }

      // Exécuter la requête
      const response = await originalFetch(...args)
      const end = Date.now()

      if (isApi) {
        console.log('✅ [Fetch] RESPONSE', {
          url,
          status: response.status,
          duration: `${end - now}ms`,
        })
      }

      return response
    }

    return () => {
      window.fetch = originalFetch
    }
  }, [])

  // --- RENDER ---
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </ErrorBoundary>
  )
}
