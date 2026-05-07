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

type LatLng = { latitude: number; longitude: number }

export interface PartnerDriver {
  id: string
  partner_id: string
  driver_user_id: string
  is_default: boolean
  created_at: string
  driver: {
    id: string
    first_name?: string | null
    last_name?: string | null
    phone?: string | null
    avatar_url?: string | null
  }
  profile: {
    is_online: boolean
    is_available: boolean
    accepts_b2b_orders: boolean
    vehicle_type: 'moto' | 'vehicule' | 'cargo'
    completed_deliveries: number
    rating?: number | null
  }
}

export interface PartnerOrderTracking {
  id: string
  status: string
  phase?: string
  statusLabel?: string
  etaLabel?: string
  progress?: number
  pickup: {
    name?: string
    address: string
    coordinates: LatLng | null
  }
  dropoff: {
    name?: string
    address: string
    coordinates: LatLng | null
  }
  recipient: {
    name?: string | null
    phone?: string | null
  }
  driver: {
    id: string
    name: string | null
    phone?: string | null
    avatarUrl?: string | null
    vehiclePlate?: string | null
    vehicleType?: string | null
    latitude: number | null
    longitude: number | null
    heading?: number | null
  } | null
  price: number | null
  deliveryMethod: string | null
  distance: number | null
  createdAt: string
  updatedAt?: string | null
  proof?: {
    method?: string | null
    validatedAt?: string | null
  }
}

export interface PartnerOrderQRCode {
  orderId: string
  orderNumber?: string
  status?: string
  showQRCode: boolean
  proofAlreadyValidated?: boolean
  qrCodeImage: string | null
  verificationCode?: string | null
  expiresAt?: string | null
  message?: string
}

export type PartnerDriverRequestType = 'known_driver' | 'previous_krono_driver' | 'general_request'

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

  async getDrivers(partnerId: string): Promise<ApiResponse<PartnerDriver[]>> {
    try {
      const res = await this.fetchWithAuth(`${API_BASE_URL}/api/partner/${partnerId}/drivers`)
      if (!res.ok) return { success: false, data: [] }
      return res.json()
    } catch (err) {
      logger.error('[partnerApiService] getDrivers:', err)
      return { success: false, data: [] }
    }
  }

  async updatePreferences(partnerId: string, body: { use_preferred_drivers: boolean }): Promise<ApiResponse<PartnerDetail>> {
    try {
      const res = await this.fetchWithAuth(`${API_BASE_URL}/api/partner/${partnerId}/preferences`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      })
      if (!res.ok) return { success: false }
      return res.json()
    } catch (err) {
      logger.error('[partnerApiService] updatePreferences:', err)
      return { success: false }
    }
  }

  async createDriverRequest(partnerId: string, body: {
    request_type: PartnerDriverRequestType
    driver_name?: string
    driver_phone?: string
    source_order_id?: string
    comment?: string
  }): Promise<ApiResponse<unknown>> {
    try {
      const res = await this.fetchWithAuth(`${API_BASE_URL}/api/partner/${partnerId}/driver-requests`, {
        method: 'POST',
        body: JSON.stringify(body),
      })
      return res.json()
    } catch (err) {
      logger.error('[partnerApiService] createDriverRequest:', err)
      return { success: false }
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

  async getOrderTracking(partnerId: string, orderId: string): Promise<ApiResponse<PartnerOrderTracking>> {
    try {
      const res = await this.fetchWithAuth(`${API_BASE_URL}/api/partner/${partnerId}/orders/${orderId}/tracking`)
      if (!res.ok) return { success: false }
      return res.json()
    } catch (err) {
      logger.error('[partnerApiService] getOrderTracking:', err)
      return { success: false }
    }
  }

  async getOrderQRCode(partnerId: string, orderId: string): Promise<ApiResponse<PartnerOrderQRCode>> {
    try {
      const res = await this.fetchWithAuth(`${API_BASE_URL}/api/partner/${partnerId}/orders/${orderId}/qr-code`)
      if (!res.ok) {
        const body = await res.json().catch(() => null) as { message?: string } | null
        return { success: false, message: body?.message }
      }
      return res.json()
    } catch (err) {
      logger.error('[partnerApiService] getOrderQRCode:', err)
      return { success: false }
    }
  }

  async calculateOrderEstimate(params: {
    pickupCoordinates?: LatLng
    dropoffCoordinates?: LatLng
    deliveryMethod: 'moto' | 'vehicule' | 'cargo'
    speedOptionId?: string
  }): Promise<ApiResponse<{ price: number; distance: number; estimatedDuration?: string }>> {
    try {
      const body: Record<string, unknown> = {
        deliveryMethod: params.deliveryMethod,
        ...(params.speedOptionId ? { speedOptionId: params.speedOptionId } : {}),
        isB2BPriority: true,
      }

      if (params.pickupCoordinates) {
        body.pickup = { coordinates: params.pickupCoordinates }
      }
      if (params.dropoffCoordinates) {
        body.dropoff = { coordinates: params.dropoffCoordinates }
      }

      const res = await this.fetchWithAuth(`${API_BASE_URL}/api/payments/calculate-price`, {
        method: 'POST',
        body: JSON.stringify(body),
      })
      if (!res.ok) return { success: false }

      const json = await res.json() as { success?: boolean; price?: number; distance?: number; estimatedDuration?: string }
      if (!json.success || typeof json.price !== 'number' || typeof json.distance !== 'number') {
        return { success: false }
      }
      return { success: true, data: { price: json.price, distance: json.distance, estimatedDuration: json.estimatedDuration } }
    } catch (err) {
      logger.error('[partnerApiService] calculateOrderEstimate:', err)
      return { success: false }
    }
  }

  async createOrder(partnerId: string, body: Record<string, unknown>): Promise<ApiResponse<unknown>> {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user?.id) {
        return { success: false, message: 'Utilisateur non authentifié' }
      }

      const pickupAddress = String(body.pickup_address ?? '').trim()
      const dropoffAddress = String(body.dropoff_address ?? '').trim()
      const recipientFromBody = (body.recipient && typeof body.recipient === 'object')
        ? (body.recipient as { name?: unknown; phone?: unknown })
        : undefined
      const recipientName = String(recipientFromBody?.name ?? body.recipient_name ?? '').trim()
      const recipientPhone = String(recipientFromBody?.phone ?? body.recipient_phone ?? '').trim()
      const notes = String(body.notes ?? '').trim()
      const courseType = String(body.course_type ?? 'express').trim().toLowerCase()
      const pickupCoordinates = body.pickup_coordinates as LatLng | undefined
      const dropoffCoordinates = body.dropoff_coordinates as LatLng | undefined

      const method = 'moto' as const

      const distanceKmRaw = Number(body.distance_km)
      const distanceKm = Number.isFinite(distanceKmRaw) && distanceKmRaw > 0 ? distanceKmRaw : undefined
      const priceCfaRaw = Number(body.price_cfa)
      const priceCfa = Number.isFinite(priceCfaRaw) && priceCfaRaw > 0 ? priceCfaRaw : undefined

      const payload = {
        userId: user.id,
        partner_id: partnerId,
        pickup: {
          address: pickupAddress,
          ...(pickupCoordinates ? { coordinates: pickupCoordinates } : {}),
        },
        dropoff: {
          address: dropoffAddress,
          ...(dropoffCoordinates ? { coordinates: dropoffCoordinates } : {}),
        },
        recipient: { name: recipientName, phone: recipientPhone },
        method,
        speedOptionId: ['express', 'standard', 'scheduled'].includes(courseType)
          ? courseType
          : 'express',
        notes: notes || undefined,
        ...(typeof body.preferred_driver_id === 'string' && body.preferred_driver_id
          ? { preferred_driver_id: body.preferred_driver_id }
          : {}),
        ...(distanceKm !== undefined ? { distanceKm } : {}),
        ...(priceCfa !== undefined ? { priceCfa } : {}),
        notifyDrivers: true,
      }

      const res = await this.fetchWithAuth(`${API_BASE_URL}/api/orders/record`, {
        method: 'POST',
        body: JSON.stringify(payload),
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

  async removeTeamMember(partnerId: string, memberId: string): Promise<ApiResponse<unknown>> {
    try {
      const res = await this.fetchWithAuth(`${API_BASE_URL}/api/partner/${partnerId}/users/${memberId}`, {
        method: 'DELETE',
      })
      return res.json()
    } catch (err) {
      logger.error('[partnerApiService] removeTeamMember:', err)
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
