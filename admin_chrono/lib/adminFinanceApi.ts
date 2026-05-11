import { AdminDashboardApi } from './adminDashboardApi'
import { API_BASE_URL, isApiResponse } from './adminApiBase'
import { logger } from '@/utils/logger'

export class AdminFinanceApi extends AdminDashboardApi {
  /**
   * Récupère les statistiques financières
   */
  async getFinancialStats(params?: { startDate?: string; endDate?: string }): Promise<{
    success: boolean
    data?: {
      totalRevenue: { today: number; week: number; month: number; year: number; custom?: number }
      transactionsByMethod: Record<string, number>
      paymentStatus: Record<string, number>
      qrScanned: Record<string, { scanned: number; total: number; cancelled: number }>
      cancelledStats: Record<string, { count: number; totalValue: number; deferredAmount: number }>
      diagnostics?: { hasWarnings: boolean; warnings: string[] }
      conversionRate: number
      revenueByDriver: Array<{ driverId: string; deliveries: number; revenue: number }>
      revenueByDeliveryType: Record<string, number>
    }
  }> {
    const emptyPeriods = { today: { scanned: 0, total: 0, cancelled: 0 }, week: { scanned: 0, total: 0, cancelled: 0 }, month: { scanned: 0, total: 0, cancelled: 0 }, year: { scanned: 0, total: 0, cancelled: 0 } }
    const emptyCancelled = { today: { count: 0, totalValue: 0, deferredAmount: 0 }, week: { count: 0, totalValue: 0, deferredAmount: 0 }, month: { count: 0, totalValue: 0, deferredAmount: 0 }, year: { count: 0, totalValue: 0, deferredAmount: 0 } }
    try {
      const queryParams = new URLSearchParams()
      if (params?.startDate) queryParams.append('startDate', params.startDate)
      if (params?.endDate) queryParams.append('endDate', params.endDate)
      const url = `${API_BASE_URL}/api/admin/financial-stats${queryParams.toString() ? `?${queryParams.toString()}` : ''}`
      const response = await this.fetchWithAuth(url)

      if (!response.ok) {
        return {
          success: false,
          data: {
            totalRevenue: { today: 0, week: 0, month: 0, year: 0 },
            transactionsByMethod: { orange_money: 0, wave: 0, cash: 0, deferred: 0 },
            paymentStatus: { pending: 0, paid: 0, refused: 0, delayed: 0 },
            qrScanned: emptyPeriods,
            cancelledStats: emptyCancelled,
            diagnostics: { hasWarnings: true, warnings: ['financialStatsRequest'] },
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
            totalRevenue: { today: number; week: number; month: number; year: number; custom?: number }
            transactionsByMethod: Record<string, number>
            paymentStatus: Record<string, number>
            qrScanned: Record<string, { scanned: number; total: number; cancelled: number }>
            cancelledStats: Record<string, { count: number; totalValue: number; deferredAmount: number }>
            diagnostics?: { hasWarnings: boolean; warnings: string[] }
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
          qrScanned: emptyPeriods,
          cancelledStats: emptyCancelled,
          diagnostics: { hasWarnings: true, warnings: ['financialStatsPayload'] },
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
          qrScanned: emptyPeriods,
          cancelledStats: emptyCancelled,
          diagnostics: { hasWarnings: true, warnings: ['financialStatsNetwork'] },
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
    view?: 'active' | 'cancelled'
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
      if (params?.view) queryParams.append('view', params.view)

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
}
