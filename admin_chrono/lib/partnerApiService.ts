import { supabase } from './supabase'
import config from './config'
import { logger } from '@/utils/logger'
import type { PartnerDetail, PartnerUsage, PartnerInvoice, PartnerUser } from '@/types'

const API_BASE_URL = config.apiUrl

interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  message?: string
}

class PartnerApiService {
  private async getToken(): Promise<string | null> {
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token ?? null
  }

  private async fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
    const token = await this.getToken()
    return fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers as Record<string, string> ?? {}),
      },
    })
  }

  async getDetails(partnerId: string): Promise<ApiResponse<PartnerDetail>> {
    try {
      const res = await this.fetchWithAuth(`${API_BASE_URL}/api/partner/${partnerId}/details`)
      if (!res.ok) return { success: false }
      return res.json()
    } catch (err) {
      logger.error('[partnerApiService] getDetails:', err)
      return { success: false }
    }
  }

  async getUsage(partnerId: string): Promise<ApiResponse<PartnerUsage>> {
    try {
      const res = await this.fetchWithAuth(`${API_BASE_URL}/api/partner/${partnerId}/usage`)
      if (!res.ok) return { success: false }
      return res.json()
    } catch (err) {
      logger.error('[partnerApiService] getUsage:', err)
      return { success: false }
    }
  }

  async getInvoices(partnerId: string): Promise<ApiResponse<PartnerInvoice[]>> {
    try {
      const res = await this.fetchWithAuth(`${API_BASE_URL}/api/partner/${partnerId}/invoices`)
      if (!res.ok) return { success: false, data: [] }
      return res.json()
    } catch (err) {
      logger.error('[partnerApiService] getInvoices:', err)
      return { success: false, data: [] }
    }
  }

  // Orders des partenaires (filtrés par partner_id)
  async getOrders(partnerId: string, params?: { status?: string; page?: number }): Promise<ApiResponse<unknown[]>> {
    try {
      const qs = new URLSearchParams({ partner_id: partnerId })
      if (params?.status) qs.set('status', params.status)
      if (params?.page) qs.set('page', String(params.page))
      const res = await this.fetchWithAuth(`${API_BASE_URL}/api/orders?${qs}`)
      if (!res.ok) return { success: false, data: [] }
      return res.json()
    } catch (err) {
      logger.error('[partnerApiService] getOrders:', err)
      return { success: false, data: [] }
    }
  }

  async createOrder(partnerId: string, body: Record<string, unknown>): Promise<ApiResponse<unknown>> {
    try {
      const res = await this.fetchWithAuth(`${API_BASE_URL}/api/orders`, {
        method: 'POST',
        body: JSON.stringify({ ...body, partner_id: partnerId }),
      })
      return res.json()
    } catch (err) {
      logger.error('[partnerApiService] createOrder:', err)
      return { success: false }
    }
  }

  // Membres de l'équipe
  async getTeam(partnerId: string): Promise<ApiResponse<PartnerUser[]>> {
    try {
      const res = await this.fetchWithAuth(`${API_BASE_URL}/api/partner/${partnerId}/users`)
      if (!res.ok) return { success: false, data: [] }
      return res.json()
    } catch (err) {
      logger.error('[partnerApiService] getTeam:', err)
      return { success: false, data: [] }
    }
  }

  async inviteTeamMember(partnerId: string, body: { email: string }): Promise<ApiResponse<unknown>> {
    try {
      const res = await this.fetchWithAuth(`${API_BASE_URL}/api/partner/${partnerId}/users/invite`, {
        method: 'POST',
        body: JSON.stringify(body),
      })
      return res.json()
    } catch (err) {
      logger.error('[partnerApiService] inviteTeamMember:', err)
      return { success: false }
    }
  }

  // Vérifie que l'utilisateur courant appartient bien à ce partenaire (owner uniquement)
  // Retourne aussi le plan pour décider si le portail est accessible (pro/business uniquement)
  async verifyAccess(partnerId: string): Promise<{ allowed: boolean; role: 'owner' | null; plan: string | null }> {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return { allowed: false, role: null, plan: null }

      const [puRes, partnerRes] = await Promise.all([
        supabase.from('partner_users').select('role').eq('partner_id', partnerId).eq('user_id', user.id).maybeSingle(),
        supabase.from('partners').select('plan').eq('id', partnerId).maybeSingle(),
      ])

      if (puRes.error || !puRes.data || puRes.data.role !== 'owner') return { allowed: false, role: null, plan: null }
      return { allowed: true, role: 'owner', plan: partnerRes.data?.plan ?? null }
    } catch {
      return { allowed: false, role: null, plan: null }
    }
  }
}

export const partnerApiService = new PartnerApiService()
export default partnerApiService
