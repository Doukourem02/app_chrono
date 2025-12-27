import { supabase } from './supabase'
import { logger } from '@/utils/logger'
import type { Driver } from '@/types'


const API_BASE_URL = 
  process.env.NEXT_PUBLIC_API_URL || 
  process.env.EXPO_PUBLIC_API_URL ||
  'http://localhost:4000'

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  if (typeof error === 'string') {
    return error
  }
  return 'Unknown error'
}

function isError(error: unknown): error is Error {
  return error instanceof Error
}

interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  message?: string
  counts?: Record<string, number>
  pagination?: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

function isApiResponse(obj: unknown): obj is ApiResponse {
  return typeof obj === 'object' && obj !== null && 'success' in obj
}

function hasMessage(obj: unknown): obj is { message: string } {
  return typeof obj === 'object' && obj !== null && 'message' in obj && typeof (obj as { message: unknown }).message === 'string'
}

if (typeof window !== 'undefined') {
  logger.debug('[adminApiService] API_BASE_URL configured:', API_BASE_URL)
}

class AdminApiService {
  /**
   * Récupère le token d'accès depuis Supabase
   */
  private async getAccessToken(): Promise<string | null> {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      return session?.access_token || null
    } catch (error) {
      logger.error('[adminApiService] Error getting access token:', error)
      return null
    }
  }

  /**
   * Fait une requête HTTP au backend avec authentification
   */
  private async fetchWithAuth(url: string, options?: RequestInit): Promise<Response> {
    const token = await this.getAccessToken()
    if (!token) {
      logger.error('[adminApiService] No access token available')
      throw new Error('No access token available')
    }

    const headers: Record<string, string> = {
      ...(options?.headers as Record<string, string> | undefined),
      'Authorization': `Bearer ${token}`,
    }
    
    // Ajouter Content-Type seulement pour les méthodes qui envoient du JSON
    if (options?.method && ['POST', 'PUT', 'PATCH'].includes(options.method)) {
      headers['Content-Type'] = 'application/json'
    }

    // Logs de debug
    const timestamp = new Date().toISOString()
    const stackTrace = new Error().stack
    const stackLines = stackTrace ? stackTrace.split('\n').slice(2, 8) : [] // Lignes 2-7 de la stack (ignorer Error et fetchWithAuth)
    console.log('🌐 [adminApiService] ⚠️ FETCH REQUEST ⚠️', {
      url,
      timestamp,
      method: options?.method || 'GET',
      stack: stackLines.join('\n')
    })
    logger.debug('[adminApiService] Making request to:', url)
    logger.debug('[adminApiService] API_BASE_URL:', API_BASE_URL)
    logger.debug('[adminApiService] Has token:', !!token)

    try {
      logger.debug('[adminApiService] Attempting fetch to:', url)
      const response = await fetch(url, { ...options, headers })
      const responseTimestamp = new Date().toISOString()
      console.log('✅ [adminApiService] ⚠️ FETCH RESPONSE ⚠️', {
        url,
        status: response.status,
        statusText: response.statusText,
        timestamp: responseTimestamp,
        duration: new Date(responseTimestamp).getTime() - new Date(timestamp).getTime() + 'ms'
      })
      logger.debug('[adminApiService] Response status:', response.status, response.statusText)
      return response
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error)
      logger.error('[adminApiService] Fetch error:', errorMessage)
      logger.error('[adminApiService] Error type:', isError(error) ? error.name : typeof error)
      logger.error('[adminApiService] URL attempted:', url)
      logger.error('[adminApiService] API_BASE_URL:', API_BASE_URL)
      
      // Vérifier si c'est une erreur réseau
      if (isError(error) && (error.message.includes('Load failed') || error.message.includes('Failed to fetch') || error.name === 'TypeError')) {
        logger.error('[adminApiService] Network error - Backend may not be running or URL is incorrect')
        logger.error('[adminApiService] Please check:')
        logger.error('   1. Is the backend running? (cd chrono_backend && npm start)')
        logger.error('   2. Is NEXT_PUBLIC_API_URL correct in .env.local?')
        logger.error('   3. Current API_BASE_URL:', API_BASE_URL)
      }
      
      throw error
    }
  }

  /**
   * Récupère les statistiques globales du dashboard
   */
  async getDashboardStats(startDate?: string, endDate?: string): Promise<{
    success: boolean
    data?: {
      onDelivery: number
      onDeliveryChange: number
      successDeliveries: number
      successDeliveriesChange: number
      revenue: number
      revenueChange: number
      averageRating?: number
      totalRatings?: number
      averageDeliveryTime?: number
      cancellationRate?: number
      activeClients?: number
      activeDrivers?: number
    }
  }> {
    try {
      const params = new URLSearchParams()
      if (startDate) params.append('startDate', startDate)
      if (endDate) params.append('endDate', endDate)
      const queryString = params.toString()
      const url = `${API_BASE_URL}/api/admin/dashboard-stats${queryString ? `?${queryString}` : ''}`
      const response = await this.fetchWithAuth(url)
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Network error' }))
        logger.warn('Error fetching dashboard stats:', error.message)
        return {
          success: false,
          data: {
            onDelivery: 0,
            onDeliveryChange: 0,
            successDeliveries: 0,
            successDeliveriesChange: 0,
            revenue: 0,
            revenueChange: 0,
          }
        }
      }

      const result: unknown = await response.json()
      
      if (isApiResponse(result) && result.data && typeof result.data === 'object') {
        return {
          success: true,
          data: result.data as {
            onDelivery: number
            onDeliveryChange: number
            successDeliveries: number
            successDeliveriesChange: number
            revenue: number
            revenueChange: number
            averageRating?: number
            totalRatings?: number
            averageDeliveryTime?: number
            cancellationRate?: number
            activeClients?: number
            activeDrivers?: number
          }
        }
      }

      return {
        success: false,
        data: {
          onDelivery: 0,
          onDeliveryChange: 0,
          successDeliveries: 0,
          successDeliveriesChange: 0,
          revenue: 0,
          revenueChange: 0,
        }
      }
    } catch (error) {
      logger.warn('Error getDashboardStats:', error)
      return {
        success: false,
        data: {
          onDelivery: 0,
          onDeliveryChange: 0,
          successDeliveries: 0,
          successDeliveriesChange: 0,
          revenue: 0,
          revenueChange: 0,
        }
      }
    }
  }

  /**
   * Récupère les données d'analytics pour les graphiques
   */
  async getDeliveryAnalytics(startDate?: string, endDate?: string): Promise<{
    success: boolean
    data?: {
      month: string
      packageDelivered: number
      reported: number
    }[]
  }> {
    try {
      const params = new URLSearchParams()
      if (startDate) params.append('startDate', startDate)
      if (endDate) params.append('endDate', endDate)
      const queryString = params.toString()
      const url = `${API_BASE_URL}/api/admin/delivery-analytics${queryString ? `?${queryString}` : ''}`
      const response = await this.fetchWithAuth(url)
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Network error' }))
        logger.warn('Error fetching delivery analytics:', error.message)
        return {
          success: false,
          data: []
        }
      }

      const result = await response.json()
      
      if (result.success && result.data) {
        return {
          success: true,
          data: result.data
        }
      }

      return {
        success: false,
        data: []
      }
    } catch (error) {
      logger.warn('Error getDeliveryAnalytics:', error)
      return {
        success: false,
        data: []
      }
    }
  }

  /**
   * Récupère les activités récentes
   */
  async getRecentActivities(limit: number = 10, startDate?: string, endDate?: string): Promise<{
    success: boolean
    data?: unknown[]
  }> {
    try {
      const params = new URLSearchParams()
      params.append('limit', limit.toString())
      if (startDate) params.append('startDate', startDate)
      if (endDate) params.append('endDate', endDate)
      const url = `${API_BASE_URL}/api/admin/recent-activities?${params.toString()}`
      logger.debug('[adminApiService] Fetching recent activities from:', url)
      
      let response: Response
      try {
        response = await this.fetchWithAuth(url)
      } catch (authError: unknown) {
        logger.warn('[adminApiService] Authentication error:', getErrorMessage(authError))
        return {
          success: false,
          data: []
        }
      }
      
      logger.debug('[adminApiService] Response status:', response.status, response.statusText)
      
      if (!response.ok) {
        let errorMessage = 'Network error'
        try {
          const error = await response.json()
          errorMessage = hasMessage(error) ? error.message : errorMessage
        } catch {
          // Si on ne peut pas parser l'erreur, utiliser le message par défaut
        }
        logger.warn('[adminApiService] Error fetching recent activities:', errorMessage)
        return {
          success: false,
          data: []
        }
      }

      let result: unknown
      try {
        result = await response.json()
      } catch (parseError) {
        logger.error('[adminApiService] Error parsing JSON response:', parseError)
        return {
          success: false,
          data: []
        }
      }
      
      logger.debug('[adminApiService] Response data:', result)
      
      if (isApiResponse(result) && result.data && Array.isArray(result.data)) {
        logger.debug(`[adminApiService] Received ${result.data.length} activities`)
        return {
          success: true,
          data: result.data
        }
      }

      logger.warn('[adminApiService] API returned no data or success=false')
      return {
        success: false,
        data: []
      }
    } catch (error: unknown) {
      logger.error('[adminApiService] Unexpected error in getRecentActivities:', getErrorMessage(error))
      return {
        success: false,
        data: []
      }
    }
  }

  /**
   * Récupère les livraisons en cours
   */
  async getOngoingDeliveries(): Promise<{
    success: boolean
    data?: unknown[]
  }> {
    try {
      const url = `${API_BASE_URL}/api/admin/ongoing-deliveries`
      logger.debug('[adminApiService] Fetching ongoing deliveries from:', url)
      
      let response: Response
      try {
        response = await this.fetchWithAuth(url)
      } catch (authError: unknown) {
        logger.warn('[adminApiService] Authentication error:', getErrorMessage(authError))
        return {
          success: false,
          data: []
        }
      }
      
      logger.debug('[adminApiService] Response status:', response.status, response.statusText)
      
      if (!response.ok) {
        let errorMessage = 'Network error'
        try {
          const error = await response.json()
          errorMessage = hasMessage(error) ? error.message : errorMessage
        } catch {
          // Si on ne peut pas parser l'erreur, utiliser le message par défaut
        }
        logger.warn('[adminApiService] Error fetching ongoing deliveries:', errorMessage)
        return {
          success: false,
          data: []
        }
      }

      let result: unknown
      try {
        result = await response.json()
      } catch (parseError) {
        logger.error('[adminApiService] Error parsing JSON response:', parseError)
        return {
          success: false,
          data: []
        }
      }
      
      logger.debug('[adminApiService] Response data:', result)
      
      if (isApiResponse(result) && result.data && Array.isArray(result.data)) {
        logger.debug(`[adminApiService] Received ${result.data.length} ongoing deliveries`)
        return {
          success: true,
          data: result.data
        }
      }

      logger.warn('[adminApiService] API returned no data or success=false')
      return {
        success: false,
        data: []
      }
    } catch (error: unknown) {
      logger.error('[adminApiService] Unexpected error in getOngoingDeliveries:', getErrorMessage(error))
      return {
        success: false,
        data: []
      }
    }
  }

  /**
   * Récupère les commandes filtrées par statut
   */
  async getOrdersByStatus(status?: string): Promise<{
    success: boolean
    data?: unknown[]
    counts?: {
      all: number
      onProgress: number
      successful: number
      onHold: number
      canceled: number
      changes?: {
        all: number
        onProgress: number
        successful: number
        onHold: number
        canceled: number
      }
    }
  }> {
    try {
      const url = `${API_BASE_URL}/api/admin/orders${status ? `?status=${status}` : ''}`
      logger.debug('[adminApiService] Fetching orders from:', url)
      logger.debug('[adminApiService] Status filter:', status)
      
      let response: Response
      try {
        response = await this.fetchWithAuth(url)
      } catch (authError: unknown) {
        logger.warn('[adminApiService] Authentication error:', getErrorMessage(authError))
        return {
          success: false,
          data: [],
          counts: {
            all: 0,
            onProgress: 0,
            successful: 0,
            onHold: 0,
            canceled: 0,
            changes: {
              all: 0,
              onProgress: 0,
              successful: 0,
              onHold: 0,
              canceled: 0,
            },
          },
        }
      }
      
      logger.debug('[adminApiService] Response status:', response.status, response.statusText)
      
      if (!response.ok) {
        let errorMessage = 'Network error'
        let errorData: unknown = null
        try {
          errorData = await response.json()
          errorMessage = hasMessage(errorData) ? errorData.message : errorMessage
        } catch {
          // Si on ne peut pas parser l'erreur, utiliser le message par défaut
          const errorText = await response.text().catch(() => 'Unknown error')
          errorMessage = errorText || errorMessage
        }
        logger.error('[adminApiService] Error fetching orders:', errorMessage)
        logger.error('[adminApiService] Error data:', errorData)
        logger.error('[adminApiService] Response status:', response.status)
        return {
          success: false,
          data: [],
          counts: {
            all: 0,
            onProgress: 0,
            successful: 0,
            onHold: 0,
            canceled: 0,
            changes: {
              all: 0,
              onProgress: 0,
              successful: 0,
              onHold: 0,
              canceled: 0,
            },
          },
        }
      }

      let result: unknown
      try {
        result = await response.json()
      } catch (parseError) {
        logger.error('[adminApiService] Error parsing JSON response:', parseError)
        return {
          success: false,
          data: [],
          counts: {
            all: 0,
            onProgress: 0,
            successful: 0,
            onHold: 0,
            canceled: 0,
            changes: {
              all: 0,
              onProgress: 0,
              successful: 0,
              onHold: 0,
              canceled: 0,
            },
          },
        }
      }
      
      logger.debug('[adminApiService] Response data:', result)
      
      if (isApiResponse(result) && result.data && Array.isArray(result.data)) {
        logger.debug(`[adminApiService] Received ${result.data.length} orders`)
        return {
          success: true,
          data: result.data,
          counts: (isApiResponse(result) && result.counts && typeof result.counts === 'object') ? {
            all: (result.counts as Record<string, number>).all || 0,
            onProgress: (result.counts as Record<string, number>).onProgress || 0,
            successful: (result.counts as Record<string, number>).successful || 0,
            onHold: (result.counts as Record<string, number>).onHold || 0,
            canceled: (result.counts as Record<string, number>).canceled || 0,
          } : {
            all: 0,
            onProgress: 0,
            successful: 0,
            onHold: 0,
            canceled: 0,
          },
        }
      }

      logger.warn('[adminApiService] API returned no data or success=false')
      return {
        success: false,
        data: [],
        counts: {
          all: 0,
          onProgress: 0,
          successful: 0,
          onHold: 0,
          canceled: 0,
        },
      }
    } catch (error: unknown) {
      logger.error('[adminApiService] Unexpected error in getOrdersByStatus:', getErrorMessage(error))
      return {
        success: false,
        data: [],
        counts: {
          all: 0,
          onProgress: 0,
          successful: 0,
          onHold: 0,
          canceled: 0,
        },
      }
    }
  }

  /**
   * Récupère tous les utilisateurs
   */
  async getUsers(): Promise<{
    success: boolean
    data?: unknown[]
    counts?: {
      client: number
      driver: number
      admin: number
      total: number
    }
  }> {
    try {
      const url = `${API_BASE_URL}/api/admin/users`
      logger.debug('[adminApiService] Fetching users from:', url)
      
      let response: Response
      try {
        response = await this.fetchWithAuth(url)
      } catch (authError: unknown) {
        logger.warn('[adminApiService] Authentication error:', getErrorMessage(authError))
        return {
          success: false,
          data: [],
          counts: {
            client: 0,
            driver: 0,
            admin: 0,
            total: 0,
          },
        }
      }
      
      logger.debug('[adminApiService] Response status:', response.status, response.statusText)
      
      if (!response.ok) {
        let errorMessage = 'Network error'
        try {
          const error = await response.json()
          errorMessage = hasMessage(error) ? error.message : errorMessage
        } catch {
          // Si on ne peut pas parser l'erreur, utiliser le message par défaut
        }
        logger.warn('[adminApiService] Error fetching users:', errorMessage)
        return {
          success: false,
          data: [],
          counts: {
            client: 0,
            driver: 0,
            admin: 0,
            total: 0,
          },
        }
      }

      let result: unknown
      try {
        result = await response.json()
      } catch (parseError) {
        logger.error('[adminApiService] Error parsing JSON response:', parseError)
        return {
          success: false,
          data: [],
          counts: {
            client: 0,
            driver: 0,
            admin: 0,
            total: 0,
          },
        }
      }
      
      logger.debug('[adminApiService] Response data:', result)
      
      if (isApiResponse(result) && result.data && Array.isArray(result.data)) {
        logger.debug(`[adminApiService] Received ${result.data.length} users`)
        return {
          success: true,
          data: result.data,
          counts: (isApiResponse(result) && result.counts && typeof result.counts === 'object') ? {
            client: (result.counts as Record<string, number>).client || 0,
            driver: (result.counts as Record<string, number>).driver || 0,
            admin: (result.counts as Record<string, number>).admin || 0,
            total: (result.counts as Record<string, number>).total || 0,
          } : {
            client: 0,
            driver: 0,
            admin: 0,
            total: 0,
          },
        }
      }

      logger.warn('[adminApiService] API returned no data or success=false')
      return {
        success: false,
        data: [],
        counts: {
          client: 0,
          driver: 0,
          admin: 0,
          total: 0,
        },
      }
    } catch (error: unknown) {
      logger.error('[adminApiService] Unexpected error in getUsers:', getErrorMessage(error))
      return {
        success: false,
        data: [],
        counts: {
          client: 0,
          driver: 0,
          admin: 0,
          total: 0,
        },
      }
    }
  }

  /**
   * Recherche globale
   */
  async globalSearch(query: string): Promise<{
    success: boolean
    data?: {
      orders: unknown[]
      users: unknown[]
    }
  }> {
    try {
      const url = `${API_BASE_URL}/api/admin/search?q=${encodeURIComponent(query)}`
      logger.debug('[adminApiService] Global search:', url)
      
      let response: Response
      try {
        response = await this.fetchWithAuth(url)
      } catch (authError: unknown) {
        logger.warn('[adminApiService] Authentication error:', getErrorMessage(authError))
        return {
          success: false,
          data: {
            orders: [],
            users: [],
          },
        }
      }
      
      if (!response.ok) {
        return {
          success: false,
          data: {
            orders: [],
            users: [],
          },
        }
      }

      const result: unknown = await response.json()
      
      if (isApiResponse(result) && result.data && typeof result.data === 'object') {
        return {
          success: true,
          data: result.data as {
            orders: unknown[]
            users: unknown[]
          },
        }
      }

      return {
        success: false,
        data: {
          orders: [],
          users: [],
        },
      }
    } catch (error: unknown) {
      logger.error('[adminApiService] Error in globalSearch:', error)
      return {
        success: false,
        data: {
          orders: [],
          users: [],
        },
      }
    }
  }

  /**
   * Récupère les statistiques financières
   */
  async getFinancialStats(): Promise<{
    success: boolean
    data?: {
      totalRevenue: { today: number; week: number; month: number; year: number }
      transactionsByMethod: Record<string, number>
      paymentStatus: Record<string, number>
      conversionRate: number
      revenueByDriver: Array<{ driverId: string; deliveries: number; revenue: number }>
      revenueByDeliveryType: Record<string, number>
    }
  }> {
    try {
      const response = await this.fetchWithAuth(`${API_BASE_URL}/api/admin/financial-stats`)
      
      if (!response.ok) {
        return {
          success: false,
          data: {
            totalRevenue: { today: 0, week: 0, month: 0, year: 0 },
            transactionsByMethod: { orange_money: 0, wave: 0, cash: 0, deferred: 0 },
            paymentStatus: { pending: 0, paid: 0, refused: 0, delayed: 0 },
            conversionRate: 0,
            revenueByDriver: [],
            revenueByDeliveryType: { moto: 0, vehicule: 0, cargo: 0 },
          },
        }
      }

      const result: unknown = await response.json()
      if (isApiResponse(result) && result.data && typeof result.data === 'object') {
        return {
          success: result.success || false,
          data: result.data as {
            totalRevenue: { today: number; week: number; month: number; year: number }
            transactionsByMethod: Record<string, number>
            paymentStatus: Record<string, number>
            conversionRate: number
            revenueByDriver: Array<{ driverId: string; deliveries: number; revenue: number }>
            revenueByDeliveryType: Record<string, number>
          },
        }
      }
      return {
        success: false,
        data: {
          totalRevenue: { today: 0, week: 0, month: 0, year: 0 },
          transactionsByMethod: { orange_money: 0, wave: 0, cash: 0, deferred: 0 },
          paymentStatus: { pending: 0, paid: 0, refused: 0, delayed: 0 },
          conversionRate: 0,
          revenueByDriver: [],
          revenueByDeliveryType: { moto: 0, vehicule: 0, cargo: 0 },
        },
      }
    } catch (error: unknown) {
      logger.error('[adminApiService] Error in getFinancialStats:', error)
      return {
        success: false,
        data: {
          totalRevenue: { today: 0, week: 0, month: 0, year: 0 },
          transactionsByMethod: { orange_money: 0, wave: 0, cash: 0, deferred: 0 },
          paymentStatus: { pending: 0, paid: 0, refused: 0, delayed: 0 },
          conversionRate: 0,
          revenueByDriver: [],
          revenueByDeliveryType: { moto: 0, vehicule: 0, cargo: 0 },
        },
      }
    }
  }

  /**
   * Récupère toutes les transactions
   */
  async getTransactions(params?: {
    page?: number
    limit?: number
    status?: string
    method?: string
    startDate?: string
    endDate?: string
    search?: string
  }): Promise<{
    success: boolean
    data?: unknown[]
    pagination?: { page: number; limit: number; total: number; totalPages: number }
  }> {
    try {
      const queryParams = new URLSearchParams()
      if (params?.page) queryParams.append('page', params.page.toString())
      if (params?.limit) queryParams.append('limit', params.limit.toString())
      if (params?.status) queryParams.append('status', params.status)
      if (params?.method) queryParams.append('method', params.method)
      if (params?.startDate) queryParams.append('startDate', params.startDate)
      if (params?.endDate) queryParams.append('endDate', params.endDate)
      if (params?.search) queryParams.append('search', params.search)

      const url = `${API_BASE_URL}/api/admin/transactions${queryParams.toString() ? `?${queryParams.toString()}` : ''}`
      const response = await this.fetchWithAuth(url)
      
      if (!response.ok) {
        return { success: false, data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } }
      }

      const result: unknown = await response.json()
      if (isApiResponse(result)) {
        return {
          success: result.success || false,
          data: (Array.isArray(result.data) ? result.data : []) as unknown[],
          pagination: result.pagination,
        }
      }
      return {
        success: false,
        data: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      }
    } catch (error: unknown) {
      logger.error('[adminApiService] Error in getTransactions:', error)
      return { success: false, data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } }
    }
  }

  /**
   * Génère un rapport des livraisons
   */
  async getReportDeliveries(params?: {
    startDate?: string
    endDate?: string
    status?: string
    driverId?: string
  }): Promise<{ success: boolean; data?: unknown[] }> {
    try {
      const queryParams = new URLSearchParams()
      if (params?.startDate) queryParams.append('startDate', params.startDate)
      if (params?.endDate) queryParams.append('endDate', params.endDate)
      if (params?.status) queryParams.append('status', params.status)
      if (params?.driverId) queryParams.append('driverId', params.driverId)

      const url = `${API_BASE_URL}/api/admin/reports/deliveries${queryParams.toString() ? `?${queryParams.toString()}` : ''}`
      const response = await this.fetchWithAuth(url)
      
      if (!response.ok) return { success: false, data: [] }
      const result: unknown = await response.json()
      if (isApiResponse(result)) {
        return { success: result.success || false, data: (Array.isArray(result.data) ? result.data : []) as unknown[] }
      }
      return { success: false, data: [] }
    } catch (error: unknown) {
      logger.error('[adminApiService] Error in getReportDeliveries:', error)
      return { success: false, data: [] }
    }
  }

  /**
   * Génère un rapport des revenus
   */
  async getReportRevenues(params?: {
    startDate?: string
    endDate?: string
    driverId?: string
    deliveryType?: string
  }): Promise<{ success: boolean; data?: unknown[] }> {
    try {
      const queryParams = new URLSearchParams()
      if (params?.startDate) queryParams.append('startDate', params.startDate)
      if (params?.endDate) queryParams.append('endDate', params.endDate)
      if (params?.driverId) queryParams.append('driverId', params.driverId)
      if (params?.deliveryType) queryParams.append('deliveryType', params.deliveryType)

      const url = `${API_BASE_URL}/api/admin/reports/revenues${queryParams.toString() ? `?${queryParams.toString()}` : ''}`
      const response = await this.fetchWithAuth(url)
      
      if (!response.ok) return { success: false, data: [] }
      const result: unknown = await response.json()
      if (isApiResponse(result)) {
        return { success: result.success || false, data: (Array.isArray(result.data) ? result.data : []) as unknown[] }
      }
      return { success: false, data: [] }
    } catch (error: unknown) {
      logger.error('[adminApiService] Error in getReportRevenues:', error)
      return { success: false, data: [] }
    }
  }

  /**
   * Génère un rapport des clients
   */
  async getReportClients(params?: {
    startDate?: string
    endDate?: string
  }): Promise<{ success: boolean; data?: unknown[] }> {
    try {
      const queryParams = new URLSearchParams()
      if (params?.startDate) queryParams.append('startDate', params.startDate)
      if (params?.endDate) queryParams.append('endDate', params.endDate)

      const url = `${API_BASE_URL}/api/admin/reports/clients${queryParams.toString() ? `?${queryParams.toString()}` : ''}`
      const response = await this.fetchWithAuth(url)
      
      if (!response.ok) return { success: false, data: [] }
      const result: unknown = await response.json()
      if (isApiResponse(result)) {
        return { success: result.success || false, data: (Array.isArray(result.data) ? result.data : []) as unknown[] }
      }
      return { success: false, data: [] }
    } catch (error: unknown) {
      logger.error('[adminApiService] Error in getReportClients:', error)
      return { success: false, data: [] }
    }
  }

  /**
   * Génère un rapport des drivers
   */
  async getReportDrivers(params?: {
    startDate?: string
    endDate?: string
  }): Promise<{ success: boolean; data?: unknown[] }> {
    try {
      const queryParams = new URLSearchParams()
      if (params?.startDate) queryParams.append('startDate', params.startDate)
      if (params?.endDate) queryParams.append('endDate', params.endDate)

      const url = `${API_BASE_URL}/api/admin/reports/drivers${queryParams.toString() ? `?${queryParams.toString()}` : ''}`
      const response = await this.fetchWithAuth(url)
      
      if (!response.ok) return { success: false, data: [] }
      const result: unknown = await response.json()
      if (isApiResponse(result)) {
        return { success: result.success || false, data: (Array.isArray(result.data) ? result.data : []) as unknown[] }
      }
      return { success: false, data: [] }
    } catch (error: unknown) {
      logger.error('[adminApiService] Error in getReportDrivers:', error)
      return { success: false, data: [] }
    }
  }

  /**
   * Génère un rapport des paiements
   */
  async getReportPayments(params?: {
    startDate?: string
    endDate?: string
  }): Promise<{ success: boolean; data?: unknown[] }> {
    try {
      const queryParams = new URLSearchParams()
      if (params?.startDate) queryParams.append('startDate', params.startDate)
      if (params?.endDate) queryParams.append('endDate', params.endDate)

      const url = `${API_BASE_URL}/api/admin/reports/payments${queryParams.toString() ? `?${queryParams.toString()}` : ''}`
      const response = await this.fetchWithAuth(url)
      
      if (!response.ok) return { success: false, data: [] }
      const result: unknown = await response.json()
      if (isApiResponse(result)) {
        return { success: result.success || false, data: (Array.isArray(result.data) ? result.data : []) as unknown[] }
      }
      return { success: false, data: [] }
    } catch (error: unknown) {
      logger.error('[adminApiService] Error in getReportPayments:', error)
      return { success: false, data: [] }
    }
  }

  /**
   * Récupère les détails d'un driver
   */
  async getDriverDetails(driverId: string): Promise<{
    success: boolean
    data?: unknown
  }> {
    try {
      const response = await this.fetchWithAuth(`${API_BASE_URL}/api/admin/drivers/${driverId}/details`)
      if (!response.ok) return { success: false }
      const result: unknown = await response.json()
      if (isApiResponse(result)) {
        return { success: result.success || false, data: result.data }
      }
      return { success: false, data: undefined }
    } catch (error: unknown) {
      logger.error('[adminApiService] Error in getDriverDetails:', error)
      return { success: false }
    }
  }

  /**
   * Récupère les détails d'un admin
   */
  async getAdminDetails(adminId: string): Promise<{
    success: boolean
    data?: unknown
  }> {
    try {
      const response = await this.fetchWithAuth(`${API_BASE_URL}/api/admin/admins/${adminId}/details`)
      if (!response.ok) return { success: false }
      const result: unknown = await response.json()
      if (isApiResponse(result)) {
        return { success: result.success || false, data: result.data }
      }
      return { success: false, data: undefined }
    } catch (error: unknown) {
      logger.error('[adminApiService] Error in getAdminDetails:', error)
      return { success: false }
    }
  }

  /**
   * Met à jour le statut d'un driver
   */
  async updateDriverStatus(driverId: string, isActive: boolean): Promise<{
    success: boolean
    message?: string
  }> {
    try {
      const response = await this.fetchWithAuth(`${API_BASE_URL}/api/admin/drivers/${driverId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ isActive }),
      })
      if (!response.ok) return { success: false }
      const result: unknown = await response.json()
      if (isApiResponse(result)) {
        return { success: result.success || false, message: result.message }
      }
      return { success: false, message: undefined }
    } catch (error: unknown) {
      logger.error('[adminApiService] Error in updateDriverStatus:', error)
      return { success: false }
    }
  }

  /**
   * Récupère les détails d'un client
   */
  async getClientDetails(clientId: string): Promise<{
    success: boolean
    data?: unknown
  }> {
    try {
      const response = await this.fetchWithAuth(`${API_BASE_URL}/api/admin/clients/${clientId}/details`)
      if (!response.ok) return { success: false }
      const result: unknown = await response.json()
      if (isApiResponse(result)) {
        return { success: result.success || false, data: result.data }
      }
      return { success: false, data: undefined }
    } catch (error: unknown) {
      logger.error('[adminApiService] Error in getClientDetails:', error)
      return { success: false }
    }
  }

  /**
   * Récupère les statistiques d'un client
   */
  async getClientStatistics(clientId: string): Promise<{
    success: boolean
    data?: unknown
  }> {
    try {
      const response = await this.fetchWithAuth(`${API_BASE_URL}/api/admin/clients/${clientId}/statistics`)
      if (!response.ok) return { success: false }
      const result: unknown = await response.json()
      if (isApiResponse(result)) {
        return { success: result.success || false, data: result.data }
      }
      return { success: false, data: undefined }
    } catch (error: unknown) {
      logger.error('[adminApiService] Error in getClientStatistics:', error)
      return { success: false }
    }
  }

  /**
   * Récupère toutes les évaluations
   */
  async getRatings(params?: {
    page?: number
    limit?: number
    driverId?: string
    clientId?: string
    minRating?: number
    startDate?: string
    endDate?: string
  }): Promise<{
    success: boolean
    data?: unknown[]
    pagination?: { page: number; limit: number; total: number; totalPages: number }
  }> {
    try {
      const queryParams = new URLSearchParams()
      if (params?.page) queryParams.append('page', params.page.toString())
      if (params?.limit) queryParams.append('limit', params.limit.toString())
      if (params?.driverId) queryParams.append('driverId', params.driverId)
      if (params?.clientId) queryParams.append('clientId', params.clientId)
      if (params?.minRating) queryParams.append('minRating', params.minRating.toString())
      if (params?.startDate) queryParams.append('startDate', params.startDate)
      if (params?.endDate) queryParams.append('endDate', params.endDate)

      const url = `${API_BASE_URL}/api/admin/ratings${queryParams.toString() ? `?${queryParams.toString()}` : ''}`
      const response = await this.fetchWithAuth(url)
      if (!response.ok) return { success: false, data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } }
      const result: unknown = await response.json()
      if (isApiResponse(result)) {
        return { success: result.success || false, data: (Array.isArray(result.data) ? result.data : []) as unknown[], pagination: result.pagination }
      }
      return { success: false, data: [], pagination: undefined }
    } catch (error: unknown) {
      logger.error('[adminApiService] Error in getRatings:', error)
      return { success: false, data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } }
    }
  }

  /**
   * Supprime une évaluation
   */
  async deleteRating(ratingId: string): Promise<{
    success: boolean
    message?: string
  }> {
    try {
      const response = await this.fetchWithAuth(`${API_BASE_URL}/api/admin/ratings/${ratingId}`, {
        method: 'DELETE',
      })
      if (!response.ok) return { success: false }
      const result: unknown = await response.json()
      if (isApiResponse(result)) {
        return { success: result.success || false, message: result.message }
      }
      return { success: false, message: undefined }
    } catch (error: unknown) {
      logger.error('[adminApiService] Error in deleteRating:', error)
      return { success: false }
    }
  }

  /**
   * Récupère tous les codes promo
   */
  async getPromoCodes(): Promise<{
    success: boolean
    data?: unknown[]
  }> {
    try {
      const response = await this.fetchWithAuth(`${API_BASE_URL}/api/admin/promo-codes`)
      if (!response.ok) return { success: false, data: [] }
      const result: unknown = await response.json()
      if (isApiResponse(result)) {
        return { success: result.success || false, data: (Array.isArray(result.data) ? result.data : []) as unknown[] }
      }
      return { success: false, data: [] }
    } catch (error: unknown) {
      logger.error('[adminApiService] Error in getPromoCodes:', error)
      return { success: false, data: [] }
    }
  }

  /**
   * Crée un nouveau code promo
   */
  async createPromoCode(data: {
    code: string
    discountType: 'percentage' | 'fixed'
    discountValue: number
    maxUses?: number
    validFrom?: string
    validUntil?: string
    isActive?: boolean
  }): Promise<{
    success: boolean
    data?: unknown
  }> {
    try {
      const response = await this.fetchWithAuth(`${API_BASE_URL}/api/admin/promo-codes`, {
        method: 'POST',
        body: JSON.stringify(data),
      })
      if (!response.ok) return { success: false }
      const result: unknown = await response.json()
      if (isApiResponse(result)) {
        return { success: result.success || false, data: result.data }
      }
      return { success: false, data: undefined }
    } catch (error: unknown) {
      logger.error('[adminApiService] Error in createPromoCode:', error)
      return { success: false }
    }
  }

  /**
   * Récupère toutes les disputes
   */
  async getDisputes(params?: {
    page?: number
    limit?: number
    status?: string
  }): Promise<{
    success: boolean
    data?: unknown[]
    pagination?: { page: number; limit: number; total: number; totalPages: number }
  }> {
    try {
      const queryParams = new URLSearchParams()
      if (params?.page) queryParams.append('page', params.page.toString())
      if (params?.limit) queryParams.append('limit', params.limit.toString())
      if (params?.status) queryParams.append('status', params.status)

      const url = `${API_BASE_URL}/api/admin/disputes${queryParams.toString() ? `?${queryParams.toString()}` : ''}`
      const response = await this.fetchWithAuth(url)
      if (!response.ok) return { success: false, data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } }
      const result: unknown = await response.json()
      if (isApiResponse(result)) {
        return { success: result.success || false, data: (Array.isArray(result.data) ? result.data : []) as unknown[], pagination: result.pagination }
      }
      return { success: false, data: [], pagination: undefined }
    } catch (error: unknown) {
      logger.error('[adminApiService] Error in getDisputes:', error)
      return { success: false, data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } }
    }
  }

  /**
   * Met à jour une dispute
   */
  async updateDispute(disputeId: string, data: {
    status?: string
    adminNotes?: string
  }): Promise<{
    success: boolean
    data?: unknown
  }> {
    try {
      const response = await this.fetchWithAuth(`${API_BASE_URL}/api/admin/disputes/${disputeId}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      })
      if (!response.ok) return { success: false }
      const result: unknown = await response.json()
      if (isApiResponse(result)) {
        return { success: result.success || false, data: result.data }
      }
      return { success: false, data: undefined }
    } catch (error: unknown) {
      logger.error('[adminApiService] Error in updateDispute:', error)
      return { success: false }
    }
  }

  /**
   * Récupère les drivers en ligne
   */
  async getOnlineDrivers(): Promise<{
    success: boolean
    data?: Array<{
      user_id: string
      first_name: string
      last_name: string
      vehicle_type: string
      current_latitude: number
      current_longitude: number
      is_online: boolean
      is_available: boolean
      rating: number
      total_deliveries: number
    }>
    message?: string
  }> {
    try {
      const token = await this.getAccessToken()
      if (!token) {
        return { success: false, message: 'No access token' }
      }

      const timestamp = new Date().toISOString()
      console.log('🌐 [adminApiService] ⚠️ FETCH REQUEST (getOnlineDrivers) ⚠️', {
        url: `${API_BASE_URL}/api/drivers/online`,
        timestamp,
        method: 'GET',
        stack: new Error().stack?.split('\n').slice(2, 8).join('\n')
      })
      const response = await fetch(`${API_BASE_URL}/api/drivers/online`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })
      console.log('✅ [adminApiService] ⚠️ FETCH RESPONSE (getOnlineDrivers) ⚠️', {
        url: `${API_BASE_URL}/api/drivers/online`,
        status: response.status,
        timestamp: new Date().toISOString()
      })

      if (!response.ok) {
        return { success: false, message: `HTTP ${response.status}` }
      }

      const result = await response.json()
      return {
        success: result.success || false,
        data: result.data || [],
        message: result.message,
      }
    } catch (error: unknown) {
      if (process.env.NODE_ENV === 'development') {
        logger.error('[adminApiService] Error in getOnlineDrivers:', error)
      }
      return { success: false, message: getErrorMessage(error) }
    }
  }

  /**
   * Récupère la clé API Google Maps depuis le serveur
   */
  async getGoogleMapsConfig(): Promise<{
    apiKey?: string
  }> {
    try {
      const token = await this.getAccessToken()
      if (!token) {
        return {}
      }

      const response = await fetch('/api/google-maps-config', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        return {}
      }

      const result = await response.json()
      return { apiKey: result.apiKey }
    } catch (error: unknown) {
      if (process.env.NODE_ENV === 'development') {
        logger.error('[adminApiService] Error in getGoogleMapsConfig:', error)
      }
      return {}
    }
  }

  /**
   * Crée une nouvelle commande (admin uniquement)
   */
  async createOrder(orderData: {
    userId: string
    pickup: {
      address: string
      coordinates?: { latitude: number; longitude: number }
    }
    dropoff: {
      address: string
      coordinates?: { latitude: number; longitude: number }
      details?: { phone?: string }
    }
    deliveryMethod: 'moto' | 'vehicule' | 'cargo'
    paymentMethodType?: 'orange_money' | 'wave' | 'cash' | 'deferred'
    distance: number
    price: number
    notes?: string
    isPhoneOrder?: boolean
    isB2BOrder?: boolean
    driverNotes?: string
  }): Promise<{
    success: boolean
    data?: { id: string }
    message?: string
  }> {
    try {
      const url = `${API_BASE_URL}/api/admin/orders`
      logger.debug('[adminApiService] Creating order:', url)

      const response = await this.fetchWithAuth(url, {
        method: 'POST',
        body: JSON.stringify(orderData),
      })

      if (!response.ok) {
        let errorMessage = 'Network error'
        try {
          const errorData = await response.json()
          errorMessage = hasMessage(errorData) ? errorData.message : errorMessage
        } catch {
          const errorText = await response.text().catch(() => 'Unknown error')
          errorMessage = errorText || errorMessage
        }
        logger.error('[adminApiService] Error creating order:', errorMessage)
        return {
          success: false,
          message: errorMessage,
        }
      }

      const result = await response.json()
      if (isApiResponse(result) && result.data) {
        return {
          success: true,
          data: result.data as { id: string },
        }
      }

      return {
        success: false,
        message: result.message || 'Erreur lors de la création de la commande',
      }
    } catch (error: unknown) {
      logger.error('[adminApiService] Unexpected error in createOrder:', getErrorMessage(error))
      return {
        success: false,
        message: 'Erreur lors de la création de la commande',
      }
    }
  }

  /**
   * Annule une commande depuis l'admin
   */
  async cancelOrder(orderId: string, reason?: string): Promise<{
    success: boolean
    message?: string
    order?: unknown
  }> {
    try {
      const url = `${API_BASE_URL}/api/admin/orders/${orderId}/cancel`
      logger.debug('[adminApiService] Cancelling order:', url)

      const response = await this.fetchWithAuth(url, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      })

      if (!response.ok) {
        let errorMessage = 'Network error'
        try {
          const errorData = await response.json()
          errorMessage = hasMessage(errorData) ? errorData.message : errorMessage
        } catch {
          const errorText = await response.text().catch(() => 'Unknown error')
          errorMessage = errorText || errorMessage
        }
        logger.error('[adminApiService] Error cancelling order:', errorMessage)
        return {
          success: false,
          message: errorMessage,
        }
      }

      const result = await response.json()
      if (isApiResponse(result)) {
        return {
          success: true,
          message: result.message || 'Commande annulée avec succès',
          order: result.data,
        }
      }

      return {
        success: false,
        message: result.message || 'Erreur lors de l\'annulation de la commande',
      }
    } catch (error: unknown) {
      logger.error('[adminApiService] Unexpected error in cancelOrder:', getErrorMessage(error))
      return {
        success: false,
        message: 'Erreur lors de l\'annulation de la commande',
      }
    }
  }

  /**
   * Récupère tous les livreurs avec distinction partenaire/interne et commission
   */
  async getDrivers(params?: {
    type?: 'all' | 'partner' | 'internal'
    status?: 'all' | 'active' | 'suspended' | 'low_balance'
    search?: string
  }): Promise<{
    success: boolean
    data?: Driver[]
    counts?: {
      total: number
      partners: number
      internals: number
      active: number
      suspended: number
    }
  }> {
    try {
      const queryParams = new URLSearchParams()
      if (params?.type) queryParams.append('type', params.type)
      if (params?.status) queryParams.append('status', params.status)
      if (params?.search) queryParams.append('search', params.search)

      const url = `${API_BASE_URL}/api/admin/drivers${queryParams.toString() ? `?${queryParams.toString()}` : ''}`
      const response = await this.fetchWithAuth(url)
      
      if (!response.ok) {
        return { success: false, data: [] }
      }

      const result: unknown = await response.json()
      if (isApiResponse(result)) {
        return {
          success: result.success || false,
          data: (result.data as Driver[]) || [],
          counts: result.counts as {
            total: number
            partners: number
            internals: number
            active: number
            suspended: number
          } | undefined,
        }
      }
      return { success: false, data: [] }
    } catch (error: unknown) {
      logger.error('[adminApiService] Error in getDrivers:', error)
      return { success: false, data: [] }
    }
  }

  /**
   * Récupère les détails complets d'un livreur (avec commission si partenaire)
   */
  async getDriverFullDetails(driverId: string): Promise<{
    success: boolean
    data?: Driver & {
      commission_account?: {
        balance: number
        commission_rate: number
        is_suspended: boolean
        last_updated: string
      }
      transactions?: Array<{
        id: string
        type: 'recharge' | 'deduction' | 'refund'
        amount: number
        balance_before: number
        balance_after: number
        order_id?: string
        created_at: string
      }>
    }
  }> {
    try {
      const response = await this.fetchWithAuth(`${API_BASE_URL}/api/admin/drivers/${driverId}`)
      if (!response.ok) return { success: false }
      const result: unknown = await response.json()
      if (isApiResponse(result)) {
        return { 
          success: result.success || false, 
          data: result.data as Driver & {
            commission_account?: {
              balance: number
              commission_rate: number
              is_suspended: boolean
              last_updated: string
            }
            transactions?: Array<{
              id: string
              type: 'recharge' | 'deduction' | 'refund'
              amount: number
              balance_before: number
              balance_after: number
              order_id?: string
              created_at: string
            }>
          }
        }
      }
      return { success: false }
    } catch (error: unknown) {
      logger.error('[adminApiService] Error in getDriverFullDetails:', error)
      return { success: false }
    }
  }

  /**
   * Recharge manuellement le compte commission d'un livreur partenaire
   */
  async rechargeDriverCommission(
    driverId: string,
    amount: number,
    method: 'admin_manual' | 'mobile_money' = 'admin_manual',
    notes?: string
  ): Promise<{
    success: boolean
    message?: string
    data?: { transactionId: string }
  }> {
    try {
      const response = await this.fetchWithAuth(
        `${API_BASE_URL}/api/admin/drivers/${driverId}/commission/recharge`,
        {
          method: 'POST',
          body: JSON.stringify({ amount, method, notes }),
        }
      )
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Erreur lors de la recharge' }))
        return { success: false, message: error.message || 'Erreur lors de la recharge' }
      }
      const result: unknown = await response.json()
      if (isApiResponse(result)) {
        return {
          success: result.success || false,
          message: result.message,
          data: result.data as { transactionId: string } | undefined,
        }
      }
      return { success: false, message: 'Erreur lors de la recharge' }
    } catch (error: unknown) {
      logger.error('[adminApiService] Error in rechargeDriverCommission:', error)
      return { success: false, message: 'Erreur lors de la recharge' }
    }
  }

  /**
   * Suspend ou réactive le compte commission d'un livreur partenaire
   */
  async suspendDriverCommission(
    driverId: string,
    isSuspended: boolean,
    reason?: string
  ): Promise<{
    success: boolean
    message?: string
  }> {
    try {
      const response = await this.fetchWithAuth(
        `${API_BASE_URL}/api/admin/drivers/${driverId}/commission/suspend`,
        {
          method: 'PUT',
          body: JSON.stringify({ is_suspended: isSuspended, reason }),
        }
      )
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Erreur lors de la mise à jour' }))
        return { success: false, message: error.message || 'Erreur lors de la mise à jour' }
      }
      const result: unknown = await response.json()
      if (isApiResponse(result)) {
        return {
          success: result.success || false,
          message: result.message,
        }
      }
      return { success: false, message: 'Erreur lors de la mise à jour' }
    } catch (error: unknown) {
      logger.error('[adminApiService] Error in suspendDriverCommission:', error)
      return { success: false, message: 'Erreur lors de la mise à jour' }
    }
  }

  /**
   * Modifie le taux de commission d'un livreur partenaire
   */
  async updateDriverCommissionRate(
    driverId: string,
    commissionRate: 10 | 20
  ): Promise<{
    success: boolean
    message?: string
  }> {
    try {
      const response = await this.fetchWithAuth(
        `${API_BASE_URL}/api/admin/drivers/${driverId}/commission/rate`,
        {
          method: 'PUT',
          body: JSON.stringify({ commission_rate: commissionRate }),
        }
      )
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Erreur lors de la mise à jour' }))
        return { success: false, message: error.message || 'Erreur lors de la mise à jour' }
      }
      const result: unknown = await response.json()
      if (isApiResponse(result)) {
        return {
          success: result.success || false,
          message: result.message,
        }
      }
      return { success: false, message: 'Erreur lors de la mise à jour' }
    } catch (error: unknown) {
      logger.error('[adminApiService] Error in updateDriverCommissionRate:', error)
      return { success: false, message: 'Erreur lors de la mise à jour' }
    }
  }

  /**
   * Récupère l'historique des transactions commission d'un livreur
   */
  async getDriverCommissionTransactions(
    driverId: string,
    params?: {
      limit?: number
      offset?: number
      type?: 'all' | 'recharge' | 'deduction' | 'refund'
      startDate?: string
      endDate?: string
    }
  ): Promise<{
    success: boolean
    data?: Array<{
      id: string
      type: 'recharge' | 'deduction' | 'refund'
      amount: number
      balance_before: number
      balance_after: number
      order_id?: string
      payment_method?: string
      created_at: string
    }>
  }> {
    try {
      const queryParams = new URLSearchParams()
      if (params?.limit) queryParams.append('limit', params.limit.toString())
      if (params?.offset) queryParams.append('offset', params.offset.toString())
      if (params?.type) queryParams.append('type', params.type)
      if (params?.startDate) queryParams.append('startDate', params.startDate)
      if (params?.endDate) queryParams.append('endDate', params.endDate)

      const url = `${API_BASE_URL}/api/admin/drivers/${driverId}/commission/transactions${queryParams.toString() ? `?${queryParams.toString()}` : ''}`
      const response = await this.fetchWithAuth(url)
      
      if (!response.ok) {
        return { success: false, data: [] }
      }

      const result: unknown = await response.json()
      if (isApiResponse(result)) {
        return {
          success: result.success || false,
          data: (result.data as Array<{
            id: string
            type: 'recharge' | 'deduction' | 'refund'
            amount: number
            balance_before: number
            balance_after: number
            order_id?: string
            payment_method?: string
            created_at: string
          }>) || [],
        }
      }
      return { success: false, data: [] }
    } catch (error: unknown) {
      logger.error('[adminApiService] Error in getDriverCommissionTransactions:', error)
      return { success: false, data: [] }
    }
  }
}

// Export singleton
export const adminApiService = new AdminApiService()
export default adminApiService
