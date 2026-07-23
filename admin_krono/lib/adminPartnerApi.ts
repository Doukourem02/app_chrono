import { AdminFleetApi } from './adminFleetApi'
import type { ApiResponse, PartnerPaymentPayload } from './adminApiBase'
import { API_BASE_URL, isApiResponse } from './adminApiBase'
import { logger } from '@/utils/logger'

export class AdminPartnerApi extends AdminFleetApi {
  // ─── B2B / Partenaires ──────────────────────────────────────────────────────

  async getPartners(filters?: { status?: string; plan?: string }): Promise<ApiResponse<import('@/types').Partner[]>> {
    try {
      const params = new URLSearchParams()
      if (filters?.status) params.set('status', filters.status)
      if (filters?.plan) params.set('plan', filters.plan)
      const qs = params.toString()
      const url = `${API_BASE_URL}/api/partners${qs ? `?${qs}` : ''}`
      const response = await this.fetchWithAuth(url)
      if (!response.ok) return { success: false, data: [] }
      const result: unknown = await response.json()
      if (isApiResponse(result)) return { success: true, data: (result.data as import('@/types').Partner[]) || [] }
      return { success: false, data: [] }
    } catch (error) {
      logger.error('[adminApiService] getPartners:', error)
      return { success: false, data: [] }
    }
  }

  async createPartner(body: { name: string; email?: string; phone?: string; commission_rate?: number; notes?: string }): Promise<ApiResponse<import('@/types').Partner>> {
    try {
      const response = await this.fetchWithAuth(`${API_BASE_URL}/api/partners`, {
        method: 'POST',
        body: JSON.stringify(body),
      })
      const result: unknown = await response.json()
      if (isApiResponse(result)) return { success: result.success, data: result.data as import('@/types').Partner }
      return { success: false }
    } catch (error) {
      logger.error('[adminApiService] createPartner:', error)
      return { success: false }
    }
  }

  async getPartner(id: string): Promise<ApiResponse<import('@/types').PartnerDetail>> {
    try {
      const response = await this.fetchWithAuth(`${API_BASE_URL}/api/partners/${id}`)
      if (!response.ok) return { success: false }
      const result: unknown = await response.json()
      if (isApiResponse(result)) return { success: true, data: result.data as import('@/types').PartnerDetail }
      return { success: false }
    } catch (error) {
      logger.error('[adminApiService] getPartner:', error)
      return { success: false }
    }
  }

  async createPartnerSubscription(partnerId: string, body: { plan: string; starts_at?: string }): Promise<ApiResponse<import('@/types').PartnerSubscription>> {
    try {
      const response = await this.fetchWithAuth(`${API_BASE_URL}/api/partners/${partnerId}/subscriptions`, {
        method: 'POST',
        body: JSON.stringify(body),
      })
      const result: unknown = await response.json()
      if (isApiResponse(result)) return { success: result.success, data: result.data as import('@/types').PartnerSubscription }
      return { success: false }
    } catch (error) {
      logger.error('[adminApiService] createPartnerSubscription:', error)
      return { success: false }
    }
  }

  async updatePartnerStatus(partnerId: string, status: 'active' | 'inactive' | 'suspended' | 'pending'): Promise<ApiResponse<import('@/types').Partner>> {
    try {
      const response = await this.fetchWithAuth(
        `${API_BASE_URL}/api/partners/${partnerId}/status`,
        { method: 'PATCH', body: JSON.stringify({ status }) }
      )
      const result: unknown = await response.json()
      if (isApiResponse(result)) return { success: result.success, data: result.data as import('@/types').Partner }
      return { success: false }
    } catch (error) {
      logger.error('[adminApiService] updatePartnerStatus:', error)
      return { success: false }
    }
  }

  async activatePartner(partnerId: string): Promise<ApiResponse<import('@/types').Partner>> {
    try {
      const response = await this.fetchWithAuth(
        `${API_BASE_URL}/api/partners/${partnerId}/activate`,
        { method: 'PATCH' }
      )
      const result: unknown = await response.json()
      if (isApiResponse(result)) return { success: result.success, data: result.data as import('@/types').Partner }
      return { success: false }
    } catch (error) {
      logger.error('[adminApiService] activatePartner:', error)
      return { success: false }
    }
  }

  async deletePartner(partnerId: string): Promise<ApiResponse<void>> {
    try {
      const response = await this.fetchWithAuth(`${API_BASE_URL}/api/partners/${partnerId}`, { method: 'DELETE' })
      const result: unknown = await response.json().catch(() => ({}))
      if (response.ok && isApiResponse(result) && result.success) return { success: true }
      const msg = isApiResponse(result) && result.message ? result.message : 'Suppression impossible'
      return { success: false, message: msg }
    } catch (error) {
      logger.error('[adminApiService] deletePartner:', error)
      return { success: false, message: 'Erreur réseau' }
    }
  }

  async activatePartnerSubscription(partnerId: string, subId: string, payment?: PartnerPaymentPayload): Promise<ApiResponse<import('@/types').PartnerSubscription>> {
    try {
      const response = await this.fetchWithAuth(
        `${API_BASE_URL}/api/partners/${partnerId}/subscriptions/${subId}/activate`,
        { method: 'PATCH', body: JSON.stringify(payment ?? {}) }
      )
      const result: unknown = await response.json()
      if (isApiResponse(result)) return { success: result.success, data: result.data as import('@/types').PartnerSubscription }
      return { success: false }
    } catch (error) {
      logger.error('[adminApiService] activatePartnerSubscription:', error)
      return { success: false }
    }
  }

  async markPartnerInvoicePaid(partnerId: string, invoiceId: string, payment: PartnerPaymentPayload): Promise<ApiResponse<import('@/types').PartnerInvoice>> {
    try {
      const response = await this.fetchWithAuth(
        `${API_BASE_URL}/api/partners/${partnerId}/invoices/${invoiceId}/pay`,
        { method: 'PATCH', body: JSON.stringify(payment) }
      )
      const result: unknown = await response.json()
      if (isApiResponse(result)) return { success: result.success, data: result.data as import('@/types').PartnerInvoice, message: result.message }
      return { success: false }
    } catch (error) {
      logger.error('[adminApiService] markPartnerInvoicePaid:', error)
      return { success: false }
    }
  }

  async getPartnerUsage(id: string): Promise<ApiResponse<import('@/types').PartnerUsage>> {
    try {
      const response = await this.fetchWithAuth(`${API_BASE_URL}/api/partners/${id}/usage`)
      if (!response.ok) return { success: false }
      const result: unknown = await response.json()
      if (isApiResponse(result)) return { success: true, data: result.data as import('@/types').PartnerUsage }
      return { success: false }
    } catch (error) {
      logger.error('[adminApiService] getPartnerUsage:', error)
      return { success: false }
    }
  }

  async getPartnerInvoices(id: string): Promise<ApiResponse<import('@/types').PartnerInvoice[]>> {
    try {
      const response = await this.fetchWithAuth(`${API_BASE_URL}/api/partners/${id}/invoices`)
      if (!response.ok) return { success: false, data: [] }
      const result: unknown = await response.json()
      if (isApiResponse(result)) return { success: true, data: (result.data as import('@/types').PartnerInvoice[]) || [] }
      return { success: false, data: [] }
    } catch (error) {
      logger.error('[adminApiService] getPartnerInvoices:', error)
      return { success: false, data: [] }
    }
  }

  async invitePartnerUser(partnerId: string, body: { email: string; role?: 'owner' | 'manager' }): Promise<ApiResponse<unknown>> {
    try {
      const response = await this.fetchWithAuth(`${API_BASE_URL}/api/partners/${partnerId}/invite`, {
        method: 'POST',
        body: JSON.stringify(body),
      })
      const result: unknown = await response.json()
      if (isApiResponse(result)) return { success: result.success, message: result.message }
      return { success: false }
    } catch (error) {
      logger.error('[adminApiService] invitePartnerUser:', error)
      return { success: false }
    }
  }

  async getPartnerDrivers(partnerId: string): Promise<ApiResponse<import('@/types').PartnerDriver[]>> {
    try {
      const response = await this.fetchWithAuth(`${API_BASE_URL}/api/partners/${partnerId}/drivers`)
      if (!response.ok) return { success: false, data: [] }
      const result: unknown = await response.json()
      if (isApiResponse(result)) return { success: result.success, data: (result.data as import('@/types').PartnerDriver[]) || [] }
      return { success: false, data: [] }
    } catch (error) {
      logger.error('[adminApiService] getPartnerDrivers:', error)
      return { success: false, data: [] }
    }
  }

  async addPartnerDriver(partnerId: string, body: { driver_user_id: string; is_default?: boolean }): Promise<ApiResponse<import('@/types').PartnerDriver>> {
    try {
      const response = await this.fetchWithAuth(`${API_BASE_URL}/api/partners/${partnerId}/drivers`, {
        method: 'POST',
        body: JSON.stringify(body),
      })
      const result: unknown = await response.json()
      if (isApiResponse(result)) return { success: result.success, data: result.data as import('@/types').PartnerDriver, message: result.message }
      return { success: false }
    } catch (error) {
      logger.error('[adminApiService] addPartnerDriver:', error)
      return { success: false }
    }
  }

  async removePartnerDriver(partnerId: string, driverUserId: string): Promise<ApiResponse<void>> {
    try {
      const response = await this.fetchWithAuth(`${API_BASE_URL}/api/partners/${partnerId}/drivers/${driverUserId}`, {
        method: 'DELETE',
      })
      const result: unknown = await response.json().catch(() => ({}))
      if (response.ok && isApiResponse(result)) return { success: result.success }
      return { success: false, message: isApiResponse(result) ? result.message : undefined }
    } catch (error) {
      logger.error('[adminApiService] removePartnerDriver:', error)
      return { success: false }
    }
  }

  async setDefaultPartnerDriver(partnerId: string, driverUserId: string): Promise<ApiResponse<import('@/types').PartnerDriver>> {
    try {
      const response = await this.fetchWithAuth(`${API_BASE_URL}/api/partners/${partnerId}/drivers/${driverUserId}/default`, {
        method: 'PATCH',
      })
      const result: unknown = await response.json()
      if (isApiResponse(result)) return { success: result.success, data: result.data as import('@/types').PartnerDriver, message: result.message }
      return { success: false }
    } catch (error) {
      logger.error('[adminApiService] setDefaultPartnerDriver:', error)
      return { success: false }
    }
  }

  async getPartnerDriverRequests(partnerId: string): Promise<ApiResponse<import('@/types').PartnerDriverRequest[]>> {
    try {
      const response = await this.fetchWithAuth(`${API_BASE_URL}/api/partners/${partnerId}/driver-requests`)
      if (!response.ok) return { success: false, data: [] }
      const result: unknown = await response.json()
      if (isApiResponse(result)) return { success: result.success, data: (result.data as import('@/types').PartnerDriverRequest[]) || [] }
      return { success: false, data: [] }
    } catch (error) {
      logger.error('[adminApiService] getPartnerDriverRequests:', error)
      return { success: false, data: [] }
    }
  }

  async reviewPartnerDriverRequest(
    partnerId: string,
    requestId: string,
    body: { action: 'approve' | 'reject'; driver_user_id?: string; is_default?: boolean; review_note?: string }
  ): Promise<ApiResponse<import('@/types').PartnerDriverRequest>> {
    try {
      const response = await this.fetchWithAuth(`${API_BASE_URL}/api/partners/${partnerId}/driver-requests/${requestId}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      })
      const result: unknown = await response.json()
      if (isApiResponse(result)) return { success: result.success, data: result.data as import('@/types').PartnerDriverRequest, message: result.message }
      return { success: false }
    } catch (error) {
      logger.error('[adminApiService] reviewPartnerDriverRequest:', error)
      return { success: false }
    }
  }
}
