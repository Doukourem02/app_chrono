// Service API pour le dashboard admin - utilise le backend API comme les autres apps
import { supabase } from './supabase'

// Utiliser EXPO_PUBLIC_API_URL si disponible (comme dans les autres apps), sinon NEXT_PUBLIC_API_URL
const API_BASE_URL = 
  process.env.NEXT_PUBLIC_API_URL || 
  process.env.EXPO_PUBLIC_API_URL ||
  'http://localhost:4000'

// Log de la configuration au démarrage (uniquement côté client et en développement)
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  console.log('🔧 [adminApiService] API_BASE_URL configured:', API_BASE_URL)
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
      // Ne pas logger le token en production
      if (process.env.NODE_ENV === 'development') {
        console.error('❌ [adminApiService] Error getting access token:', error)
      }
      return null
    }
  }

  /**
   * Fait une requête HTTP au backend avec authentification
   */
  private async fetchWithAuth(url: string, options?: RequestInit): Promise<Response> {
    const token = await this.getAccessToken()
    if (!token) {
      if (process.env.NODE_ENV === 'development') {
        console.error('❌ [adminApiService] No access token available')
      }
      throw new Error('No access token available')
    }

    const headers: HeadersInit = {
      ...options?.headers,
      'Authorization': `Bearer ${token}`,
    }
    
    // Ajouter Content-Type seulement pour les méthodes qui envoient du JSON
    if (options?.method && ['POST', 'PUT', 'PATCH'].includes(options.method)) {
      headers['Content-Type'] = 'application/json'
    }

    // Logs uniquement en développement
    if (process.env.NODE_ENV === 'development') {
      console.log('🔍 [adminApiService] Making request to:', url)
      console.log('🔍 [adminApiService] API_BASE_URL:', API_BASE_URL)
      console.log('🔍 [adminApiService] Has token:', !!token)
    }

    try {
      if (process.env.NODE_ENV === 'development') {
        console.log('🔍 [adminApiService] Attempting fetch to:', url)
      }
      const response = await fetch(url, { ...options, headers })
      if (process.env.NODE_ENV === 'development') {
        console.log('🔍 [adminApiService] Response status:', response.status, response.statusText)
      }
      return response
    } catch (error: any) {
      // Logs d'erreur conditionnels
      if (process.env.NODE_ENV === 'development') {
        console.error('❌ [adminApiService] Fetch error:', error?.message || error)
        console.error('❌ [adminApiService] Error type:', error?.name)
        console.error('❌ [adminApiService] URL attempted:', url)
        console.error('❌ [adminApiService] API_BASE_URL:', API_BASE_URL)
        
        // Vérifier si c'est une erreur réseau
        if (error?.message?.includes('Load failed') || error?.message?.includes('Failed to fetch') || error?.name === 'TypeError') {
          console.error('❌ [adminApiService] Network error - Backend may not be running or URL is incorrect')
          console.error('❌ [adminApiService] Please check:')
          console.error('   1. Is the backend running? (cd chrono_backend && npm start)')
          console.error('   2. Is NEXT_PUBLIC_API_URL correct in .env.local?')
          console.error('   3. Current API_BASE_URL:', API_BASE_URL)
        }
      } else {
        // En production, logger uniquement les erreurs critiques sans détails sensibles
        console.error('❌ [adminApiService] API request failed')
      }
      
      throw error
    }
  }

  /**
   * Récupère les statistiques globales du dashboard
   */
  async getDashboardStats(): Promise<{
    success: boolean
    data?: {
      onDelivery: number
      onDeliveryChange: number
      successDeliveries: number
      successDeliveriesChange: number
      revenue: number
      revenueChange: number
    }
  }> {
    try {
      const response = await this.fetchWithAuth(`${API_BASE_URL}/api/admin/dashboard-stats`)
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Network error' }))
        console.warn('⚠️ Error fetching dashboard stats:', error.message)
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

      const result = await response.json()
      
      if (result.success && result.data) {
        return {
          success: true,
          data: result.data
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
      console.warn('⚠️ Error getDashboardStats:', error)
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
  async getDeliveryAnalytics(): Promise<{
    success: boolean
    data?: {
      month: string
      packageDelivered: number
      reported: number
    }[]
  }> {
    try {
      const response = await this.fetchWithAuth(`${API_BASE_URL}/api/admin/delivery-analytics`)
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Network error' }))
        console.warn('⚠️ Error fetching delivery analytics:', error.message)
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
      console.warn('⚠️ Error getDeliveryAnalytics:', error)
      return {
        success: false,
        data: []
      }
    }
  }

  /**
   * Récupère les activités récentes
   */
  async getRecentActivities(limit: number = 10): Promise<{
    success: boolean
    data?: any[]
  }> {
    try {
      const url = `${API_BASE_URL}/api/admin/recent-activities?limit=${limit}`
      console.log('🔍 [adminApiService] Fetching recent activities from:', url)
      
      let response: Response
      try {
        response = await this.fetchWithAuth(url)
      } catch (authError: any) {
        console.warn('⚠️ [adminApiService] Authentication error:', authError?.message || authError)
        return {
          success: false,
          data: []
        }
      }
      
      console.debug('🔍 [adminApiService] Response status:', response.status, response.statusText)
      
      if (!response.ok) {
        let errorMessage = 'Network error'
        try {
          const error = await response.json()
          errorMessage = error.message || errorMessage
        } catch {
          // Si on ne peut pas parser l'erreur, utiliser le message par défaut
        }
        console.warn('⚠️ [adminApiService] Error fetching recent activities:', errorMessage)
        return {
          success: false,
          data: []
        }
      }

      let result: any
      try {
        result = await response.json()
      } catch (parseError) {
        console.error('❌ [adminApiService] Error parsing JSON response:', parseError)
        return {
          success: false,
          data: []
        }
      }
      
      console.debug('🔍 [adminApiService] Response data:', result)
      
      if (result.success && result.data && Array.isArray(result.data)) {
        console.debug(`✅ [adminApiService] Received ${result.data.length} activities`)
        return {
          success: true,
          data: result.data
        }
      }

      console.warn('⚠️ [adminApiService] API returned no data or success=false')
      return {
        success: false,
        data: []
      }
    } catch (error: any) {
      console.error('❌ [adminApiService] Unexpected error in getRecentActivities:', error?.message || error)
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
    data?: any[]
  }> {
    try {
      const url = `${API_BASE_URL}/api/admin/ongoing-deliveries`
      console.debug('🔍 [adminApiService] Fetching ongoing deliveries from:', url)
      
      let response: Response
      try {
        response = await this.fetchWithAuth(url)
      } catch (authError: any) {
        console.warn('⚠️ [adminApiService] Authentication error:', authError?.message || authError)
        return {
          success: false,
          data: []
        }
      }
      
      console.debug('🔍 [adminApiService] Response status:', response.status, response.statusText)
      
      if (!response.ok) {
        let errorMessage = 'Network error'
        try {
          const error = await response.json()
          errorMessage = error.message || errorMessage
        } catch {
          // Si on ne peut pas parser l'erreur, utiliser le message par défaut
        }
        console.warn('⚠️ [adminApiService] Error fetching ongoing deliveries:', errorMessage)
        return {
          success: false,
          data: []
        }
      }

      let result: any
      try {
        result = await response.json()
      } catch (parseError) {
        console.error('❌ [adminApiService] Error parsing JSON response:', parseError)
        return {
          success: false,
          data: []
        }
      }
      
      console.debug('🔍 [adminApiService] Response data:', result)
      
      if (result.success && result.data && Array.isArray(result.data)) {
        console.debug(`✅ [adminApiService] Received ${result.data.length} ongoing deliveries`)
        return {
          success: true,
          data: result.data
        }
      }

      console.warn('⚠️ [adminApiService] API returned no data or success=false')
      return {
        success: false,
        data: []
      }
    } catch (error: any) {
      console.error('❌ [adminApiService] Unexpected error in getOngoingDeliveries:', error?.message || error)
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
    data?: any[]
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
      console.log('🔍 [adminApiService] Fetching orders from:', url)
      console.log('🔍 [adminApiService] Status filter:', status)
      
      let response: Response
      try {
        response = await this.fetchWithAuth(url)
      } catch (authError: any) {
        console.warn('⚠️ [adminApiService] Authentication error:', authError?.message || authError)
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
      
      console.debug('🔍 [adminApiService] Response status:', response.status, response.statusText)
      
      if (!response.ok) {
        let errorMessage = 'Network error'
        let errorData: any = null
        try {
          errorData = await response.json()
          errorMessage = errorData.message || errorMessage
        } catch {
          // Si on ne peut pas parser l'erreur, utiliser le message par défaut
          const errorText = await response.text().catch(() => 'Unknown error')
          errorMessage = errorText || errorMessage
        }
        console.error('❌ [adminApiService] Error fetching orders:', errorMessage)
        console.error('❌ [adminApiService] Error data:', errorData)
        console.error('❌ [adminApiService] Response status:', response.status)
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

      let result: any
      try {
        result = await response.json()
      } catch (parseError) {
        console.error('❌ [adminApiService] Error parsing JSON response:', parseError)
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
      
      console.log('🔍 [adminApiService] Response data:', result)
      
      if (result.success && result.data && Array.isArray(result.data)) {
        console.log(`✅ [adminApiService] Received ${result.data.length} orders`)
        return {
          success: true,
          data: result.data,
          counts: result.counts || {
            all: 0,
            onProgress: 0,
            successful: 0,
            onHold: 0,
            canceled: 0,
          },
        }
      }

      console.warn('⚠️ [adminApiService] API returned no data or success=false')
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
    } catch (error: any) {
      console.error('❌ [adminApiService] Unexpected error in getOrdersByStatus:', error?.message || error)
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
    data?: any[]
    counts?: {
      client: number
      driver: number
      admin: number
      total: number
    }
  }> {
    try {
      const url = `${API_BASE_URL}/api/admin/users`
      console.log('🔍 [adminApiService] Fetching users from:', url)
      
      let response: Response
      try {
        response = await this.fetchWithAuth(url)
      } catch (authError: any) {
        console.warn('⚠️ [adminApiService] Authentication error:', authError?.message || authError)
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
      
      console.debug('🔍 [adminApiService] Response status:', response.status, response.statusText)
      
      if (!response.ok) {
        let errorMessage = 'Network error'
        try {
          const error = await response.json()
          errorMessage = error.message || errorMessage
        } catch {
          // Si on ne peut pas parser l'erreur, utiliser le message par défaut
        }
        console.warn('⚠️ [adminApiService] Error fetching users:', errorMessage)
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

      let result: any
      try {
        result = await response.json()
      } catch (parseError) {
        console.error('❌ [adminApiService] Error parsing JSON response:', parseError)
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
      
      console.debug('🔍 [adminApiService] Response data:', result)
      
      if (result.success && result.data && Array.isArray(result.data)) {
        console.debug(`✅ [adminApiService] Received ${result.data.length} users`)
        return {
          success: true,
          data: result.data,
          counts: result.counts || {
            client: 0,
            driver: 0,
            admin: 0,
            total: 0,
          },
        }
      }

      console.warn('⚠️ [adminApiService] API returned no data or success=false')
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
    } catch (error: any) {
      console.error('❌ [adminApiService] Unexpected error in getUsers:', error?.message || error)
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
      orders: any[]
      users: any[]
    }
  }> {
    try {
      const url = `${API_BASE_URL}/api/admin/search?q=${encodeURIComponent(query)}`
      console.debug('🔍 [adminApiService] Global search:', url)
      
      let response: Response
      try {
        response = await this.fetchWithAuth(url)
      } catch (authError: any) {
        console.warn('⚠️ [adminApiService] Authentication error:', authError?.message || authError)
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

      const result = await response.json()
      
      if (result.success && result.data) {
        return {
          success: true,
          data: result.data,
        }
      }

      return {
        success: false,
        data: {
          orders: [],
          users: [],
        },
      }
    } catch (error: any) {
      console.error('❌ [adminApiService] Error in globalSearch:', error)
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

      const result = await response.json()
      return {
        success: result.success || false,
        data: result.data,
      }
    } catch (error: any) {
      console.error('❌ [adminApiService] Error in getFinancialStats:', error)
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
    data?: any[]
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

      const result = await response.json()
      return {
        success: result.success || false,
        data: result.data || [],
        pagination: result.pagination,
      }
    } catch (error: any) {
      console.error('❌ [adminApiService] Error in getTransactions:', error)
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
  }): Promise<{ success: boolean; data?: any[] }> {
    try {
      const queryParams = new URLSearchParams()
      if (params?.startDate) queryParams.append('startDate', params.startDate)
      if (params?.endDate) queryParams.append('endDate', params.endDate)
      if (params?.status) queryParams.append('status', params.status)
      if (params?.driverId) queryParams.append('driverId', params.driverId)

      const url = `${API_BASE_URL}/api/admin/reports/deliveries${queryParams.toString() ? `?${queryParams.toString()}` : ''}`
      const response = await this.fetchWithAuth(url)
      
      if (!response.ok) return { success: false, data: [] }
      const result = await response.json()
      return { success: result.success || false, data: result.data || [] }
    } catch (error: any) {
      console.error('❌ [adminApiService] Error in getReportDeliveries:', error)
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
  }): Promise<{ success: boolean; data?: any[] }> {
    try {
      const queryParams = new URLSearchParams()
      if (params?.startDate) queryParams.append('startDate', params.startDate)
      if (params?.endDate) queryParams.append('endDate', params.endDate)
      if (params?.driverId) queryParams.append('driverId', params.driverId)
      if (params?.deliveryType) queryParams.append('deliveryType', params.deliveryType)

      const url = `${API_BASE_URL}/api/admin/reports/revenues${queryParams.toString() ? `?${queryParams.toString()}` : ''}`
      const response = await this.fetchWithAuth(url)
      
      if (!response.ok) return { success: false, data: [] }
      const result = await response.json()
      return { success: result.success || false, data: result.data || [] }
    } catch (error: any) {
      console.error('❌ [adminApiService] Error in getReportRevenues:', error)
      return { success: false, data: [] }
    }
  }

  /**
   * Génère un rapport des clients
   */
  async getReportClients(params?: {
    startDate?: string
    endDate?: string
  }): Promise<{ success: boolean; data?: any[] }> {
    try {
      const queryParams = new URLSearchParams()
      if (params?.startDate) queryParams.append('startDate', params.startDate)
      if (params?.endDate) queryParams.append('endDate', params.endDate)

      const url = `${API_BASE_URL}/api/admin/reports/clients${queryParams.toString() ? `?${queryParams.toString()}` : ''}`
      const response = await this.fetchWithAuth(url)
      
      if (!response.ok) return { success: false, data: [] }
      const result = await response.json()
      return { success: result.success || false, data: result.data || [] }
    } catch (error: any) {
      console.error('❌ [adminApiService] Error in getReportClients:', error)
      return { success: false, data: [] }
    }
  }

  /**
   * Génère un rapport des drivers
   */
  async getReportDrivers(params?: {
    startDate?: string
    endDate?: string
  }): Promise<{ success: boolean; data?: any[] }> {
    try {
      const queryParams = new URLSearchParams()
      if (params?.startDate) queryParams.append('startDate', params.startDate)
      if (params?.endDate) queryParams.append('endDate', params.endDate)

      const url = `${API_BASE_URL}/api/admin/reports/drivers${queryParams.toString() ? `?${queryParams.toString()}` : ''}`
      const response = await this.fetchWithAuth(url)
      
      if (!response.ok) return { success: false, data: [] }
      const result = await response.json()
      return { success: result.success || false, data: result.data || [] }
    } catch (error: any) {
      console.error('❌ [adminApiService] Error in getReportDrivers:', error)
      return { success: false, data: [] }
    }
  }

  /**
   * Génère un rapport des paiements
   */
  async getReportPayments(params?: {
    startDate?: string
    endDate?: string
  }): Promise<{ success: boolean; data?: any[] }> {
    try {
      const queryParams = new URLSearchParams()
      if (params?.startDate) queryParams.append('startDate', params.startDate)
      if (params?.endDate) queryParams.append('endDate', params.endDate)

      const url = `${API_BASE_URL}/api/admin/reports/payments${queryParams.toString() ? `?${queryParams.toString()}` : ''}`
      const response = await this.fetchWithAuth(url)
      
      if (!response.ok) return { success: false, data: [] }
      const result = await response.json()
      return { success: result.success || false, data: result.data || [] }
    } catch (error: any) {
      console.error('❌ [adminApiService] Error in getReportPayments:', error)
      return { success: false, data: [] }
    }
  }

  /**
   * Récupère les détails d'un driver
   */
  async getDriverDetails(driverId: string): Promise<{
    success: boolean
    data?: any
  }> {
    try {
      const response = await this.fetchWithAuth(`${API_BASE_URL}/api/admin/drivers/${driverId}/details`)
      if (!response.ok) return { success: false }
      const result = await response.json()
      return { success: result.success || false, data: result.data }
    } catch (error: any) {
      console.error('❌ [adminApiService] Error in getDriverDetails:', error)
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
      const result = await response.json()
      return { success: result.success || false, message: result.message }
    } catch (error: any) {
      console.error('❌ [adminApiService] Error in updateDriverStatus:', error)
      return { success: false }
    }
  }

  /**
   * Récupère les détails d'un client
   */
  async getClientDetails(clientId: string): Promise<{
    success: boolean
    data?: any
  }> {
    try {
      const response = await this.fetchWithAuth(`${API_BASE_URL}/api/admin/clients/${clientId}/details`)
      if (!response.ok) return { success: false }
      const result = await response.json()
      return { success: result.success || false, data: result.data }
    } catch (error: any) {
      console.error('❌ [adminApiService] Error in getClientDetails:', error)
      return { success: false }
    }
  }

  /**
   * Récupère les statistiques d'un client
   */
  async getClientStatistics(clientId: string): Promise<{
    success: boolean
    data?: any
  }> {
    try {
      const response = await this.fetchWithAuth(`${API_BASE_URL}/api/admin/clients/${clientId}/statistics`)
      if (!response.ok) return { success: false }
      const result = await response.json()
      return { success: result.success || false, data: result.data }
    } catch (error: any) {
      console.error('❌ [adminApiService] Error in getClientStatistics:', error)
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
    data?: any[]
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
      const result = await response.json()
      return { success: result.success || false, data: result.data || [], pagination: result.pagination }
    } catch (error: any) {
      console.error('❌ [adminApiService] Error in getRatings:', error)
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
      const result = await response.json()
      return { success: result.success || false, message: result.message }
    } catch (error: any) {
      console.error('❌ [adminApiService] Error in deleteRating:', error)
      return { success: false }
    }
  }

  /**
   * Récupère tous les codes promo
   */
  async getPromoCodes(): Promise<{
    success: boolean
    data?: any[]
  }> {
    try {
      const response = await this.fetchWithAuth(`${API_BASE_URL}/api/admin/promo-codes`)
      if (!response.ok) return { success: false, data: [] }
      const result = await response.json()
      return { success: result.success || false, data: result.data || [] }
    } catch (error: any) {
      console.error('❌ [adminApiService] Error in getPromoCodes:', error)
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
    data?: any
  }> {
    try {
      const response = await this.fetchWithAuth(`${API_BASE_URL}/api/admin/promo-codes`, {
        method: 'POST',
        body: JSON.stringify(data),
      })
      if (!response.ok) return { success: false }
      const result = await response.json()
      return { success: result.success || false, data: result.data }
    } catch (error: any) {
      console.error('❌ [adminApiService] Error in createPromoCode:', error)
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
    data?: any[]
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
      const result = await response.json()
      return { success: result.success || false, data: result.data || [], pagination: result.pagination }
    } catch (error: any) {
      console.error('❌ [adminApiService] Error in getDisputes:', error)
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
    data?: any
  }> {
    try {
      const response = await this.fetchWithAuth(`${API_BASE_URL}/api/admin/disputes/${disputeId}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      })
      if (!response.ok) return { success: false }
      const result = await response.json()
      return { success: result.success || false, data: result.data }
    } catch (error: any) {
      console.error('❌ [adminApiService] Error in updateDispute:', error)
      return { success: false }
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
    } catch (error: any) {
      if (process.env.NODE_ENV === 'development') {
        console.error('❌ [adminApiService] Error in getGoogleMapsConfig:', error)
      }
      return {}
    }
  }
}

// Export singleton
export const adminApiService = new AdminApiService()
export default adminApiService
