import { AdminDriverApi } from './adminDriverApi'
import { API_BASE_URL, isApiResponse, hasMessage, getErrorMessage } from './adminApiBase'
import type { ApiResponse, LatLng } from './adminApiBase'
import { logger } from '@/utils/logger'

export class AdminOrderApi extends AdminDriverApi {
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
      logger.debug('[adminApiService] FETCH REQUEST (getOnlineDrivers)', {
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
      logger.debug('[adminApiService] FETCH RESPONSE (getOnlineDrivers)', {
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
    distance?: number
    price?: number
    notes?: string
    isPhoneOrder?: boolean
    isB2BOrder?: boolean
    driverNotes?: string
    /** Commune / zone du retrait si commande téléphonique sans GPS (centroïde côté serveur pour matching livreurs) */
    approximatePickupZone?: string
  }): Promise<{
    success: boolean
    data?: {
      id: string
      deliveryVerificationCode?: string | null
      recipientDeliveryCode?: string | null
      deliveryCodeSms?: {
        status: 'not_attempted' | 'sent' | 'failed'
        reason?: string
        messageId?: string
        error?: string
      }
      trackingToken?: string | null
    }
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
          data: result.data as {
            id: string
            deliveryVerificationCode?: string | null
            recipientDeliveryCode?: string | null
            deliveryCodeSms?: {
              status: 'not_attempted' | 'sent' | 'failed'
              reason?: string
              messageId?: string
              error?: string
            }
            trackingToken?: string | null
          },
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

  async calculateOrderEstimate(params: {
    pickupCoordinates: LatLng
    dropoffCoordinates: LatLng
    deliveryMethod: 'moto' | 'vehicule' | 'cargo'
    isB2BPriority?: boolean
  }): Promise<ApiResponse<{ price: number; distance: number; estimatedDuration?: string }>> {
    try {
      const response = await this.fetchWithAuth(`${API_BASE_URL}/api/payments/calculate-price`, {
        method: 'POST',
        body: JSON.stringify({
          deliveryMethod: params.deliveryMethod,
          pickup: { coordinates: params.pickupCoordinates },
          dropoff: { coordinates: params.dropoffCoordinates },
          ...(params.isB2BPriority ? { isB2BPriority: true } : {}),
        }),
      })

      const body = await response.json().catch(() => ({})) as {
        success?: boolean
        price?: number
        distance?: number
        estimatedDuration?: string
        message?: string
      }

      if (!response.ok || !body.success || typeof body.price !== 'number' || typeof body.distance !== 'number') {
        return { success: false, message: body.message || 'Impossible de calculer le prix' }
      }

      return {
        success: true,
        data: {
          price: body.price,
          distance: body.distance,
          estimatedDuration: body.estimatedDuration,
        },
      }
    } catch (error: unknown) {
      logger.error('[adminApiService] Error calculateOrderEstimate:', getErrorMessage(error))
      return { success: false, message: 'Erreur lors du calcul du prix' }
    }
  }

  /**
   * Récupère le détail d'une commande (avec preuve QR livraison)
   */
  async getOrderById(orderId: string): Promise<{
    success: boolean
    data?: {
      id: string
      deliveryId: string
      status: string
      createdAt: string
      completedAt?: string
      departure: string
      destination: string
      price?: number
      deliveryMethod?: string
      distance?: number
      delivery_qr_scanned_at?: string | null
      delivery_proof_method?: string | null
      delivery_proof_location?: unknown
      delivery_proof_metadata?: unknown
      delivery_qr_scanned_by?: { id: string; name: string } | null
      driver?: { id: string; name: string; phone?: string; email?: string } | null
      client?: { id: string; name: string; phone?: string; email?: string } | null
    }
    message?: string
  }> {
    try {
      const url = `${API_BASE_URL}/api/admin/orders/${orderId}`
      const response = await this.fetchWithAuth(url)
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        return {
          success: false,
          message: errorData.message || 'Commande introuvable',
        }
      }
      const result = await response.json()
      return {
        success: true,
        data: result.data,
      }
    } catch (error: unknown) {
      logger.error('[adminApiService] Error getOrderById:', getErrorMessage(error))
      return { success: false, message: 'Erreur lors du chargement' }
    }
  }

  /**
   * Récupère l'historique des scans QR d'une commande
   */
  async getOrderQRScans(orderId: string): Promise<{
    success: boolean
    data?: Array<{
      id: string
      orderId: string
      qrCodeType: string
      scannedBy: { id: string; name: string }
      scannedAt: string
      location?: unknown
      deviceInfo?: unknown
      isValid: boolean
      validationError?: string
    }>
    message?: string
  }> {
    try {
      const url = `${API_BASE_URL}/api/admin/orders/${orderId}/qr-scans`
      const response = await this.fetchWithAuth(url)
      if (!response.ok) {
        return { success: false, message: 'Historique introuvable' }
      }
      const result = await response.json()
      return { success: true, data: result.data || [] }
    } catch (error: unknown) {
      logger.error('[adminApiService] Error getOrderQRScans:', getErrorMessage(error))
      return { success: false, message: 'Erreur lors du chargement' }
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
}
