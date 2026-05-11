import { AdminApiBase, API_BASE_URL, getErrorMessage, isApiResponse, hasMessage } from './adminApiBase'
import { logger } from '@/utils/logger'

export class AdminDashboardApi extends AdminApiBase {
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
      drivers: unknown[]
      clients: unknown[]
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
            drivers: [],
            clients: [],
          },
        }
      }

      if (!response.ok) {
        return {
          success: false,
          data: {
            orders: [],
            drivers: [],
            clients: [],
          },
        }
      }

      const result: unknown = await response.json()

      if (isApiResponse(result) && result.data && typeof result.data === 'object') {
        return {
          success: true,
          data: result.data as {
            orders: unknown[]
            drivers: unknown[]
            clients: unknown[]
          },
        }
      }

      return {
        success: false,
        data: {
          orders: [],
          drivers: [],
          clients: [],
        },
      }
    } catch (error: unknown) {
      logger.error('[adminApiService] Error in globalSearch:', error)
      return {
        success: false,
        data: {
          orders: [],
          drivers: [],
          clients: [],
        },
      }
    }
  }
}
