import { AdminFinanceApi } from './adminFinanceApi'
import { API_BASE_URL, isApiResponse } from './adminApiBase'
import { logger } from '@/utils/logger'
import type { Driver } from '@/types'

export class AdminDriverApi extends AdminFinanceApi {
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
