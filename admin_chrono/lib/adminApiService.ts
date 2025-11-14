// Service API pour le dashboard admin - utilise le backend API comme les autres apps
import { supabase } from './supabase'

// Utiliser EXPO_PUBLIC_API_URL si disponible (comme dans les autres apps), sinon NEXT_PUBLIC_API_URL
const API_BASE_URL = 
  process.env.NEXT_PUBLIC_API_URL || 
  process.env.EXPO_PUBLIC_API_URL ||
  'http://localhost:4000'

// Log de la configuration au démarrage (uniquement côté client)
if (typeof window !== 'undefined') {
  console.log('🔧 [adminApiService] API_BASE_URL configured:', API_BASE_URL)
  console.log('🔧 [adminApiService] NEXT_PUBLIC_API_URL:', process.env.NEXT_PUBLIC_API_URL)
  console.log('🔧 [adminApiService] EXPO_PUBLIC_API_URL:', process.env.EXPO_PUBLIC_API_URL)
}

class AdminApiService {
  /**
   * Récupère le token d'accès depuis Supabase
   */
  private async getAccessToken(): Promise<string | null> {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      return session?.access_token || null
    } catch {
      return null
    }
  }

  /**
   * Fait une requête HTTP au backend avec authentification
   */
  private async fetchWithAuth(url: string, options?: RequestInit): Promise<Response> {
    const token = await this.getAccessToken()
    if (!token) {
      console.error('❌ [adminApiService] No access token available')
      throw new Error('No access token available')
    }

    const headers = {
      ...options?.headers,
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    }

    console.log('🔍 [adminApiService] Making request to:', url)
    console.log('🔍 [adminApiService] API_BASE_URL:', API_BASE_URL)
    console.log('🔍 [adminApiService] Has token:', !!token)

    try {
      console.log('🔍 [adminApiService] Attempting fetch to:', url)
      const response = await fetch(url, { ...options, headers })
      console.log('🔍 [adminApiService] Response status:', response.status, response.statusText)
      return response
    } catch (error: any) {
      console.error('❌ [adminApiService] Fetch error:', error?.message || error)
      console.error('❌ [adminApiService] Error type:', error?.name)
      console.error('❌ [adminApiService] Full error:', error)
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
}

// Export singleton
export const adminApiService = new AdminApiService()
export default adminApiService
