import { supabase } from './supabase'
import config from './config'
import { logger } from '@/utils/logger'
import type { Driver } from '@/types'

const API_BASE_URL = config.apiUrl

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  if (typeof error === 'string') {
    return error
  }
  return 'Unknown error'
}

export function isError(error: unknown): error is Error {
  return error instanceof Error
}

export interface ApiResponse<T = unknown> {
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

export type LatLng = { latitude: number; longitude: number }

export type PartnerPaymentPayload = {
  payment_method_type: import('@/types').PartnerPaymentMethod
  payment_provider_account?: string
  payment_reference?: string
  payment_amount?: number
  paid_at?: string
  payment_notes?: string
}

// Types pour la gestion de flotte
export interface FleetVehicle {
  id: string
  vehicle_plate: string
  vehicle_type: string
  vehicle_brand: string | null
  vehicle_model: string | null
  vehicle_color: string | null
  fuel_type: string | null
  current_driver_id: string | null
  purchase_date: string | null
  purchase_price: number | null
  current_odometer: number
  last_odometer_update: string | null
  status: string
  created_at: string
  updated_at: string
  driver_first_name: string | null
  driver_last_name: string | null
  driver_email: string | null
  driver_phone: string | null
}

export interface VehicleFuelLog {
  id: string
  vehicle_plate: string
  driver_id: string | null
  fuel_type: string
  quantity: number
  unit_price: number
  total_cost: number
  odometer_before: number | null
  odometer_after: number | null
  distance_km: number | null
  consumption_per_100km: number | null
  station_location: string | null
  notes: string | null
  created_at: string
  driver_first_name: string | null
  driver_last_name: string | null
}

export interface VehicleMaintenance {
  id: string
  vehicle_plate: string
  maintenance_type: string
  description: string | null
  scheduled_date: string | null
  completed_date: string | null
  odometer_at_maintenance: number | null
  cost: number
  service_provider: string | null
  invoice_url: string | null
  documents: Record<string, unknown> | null
  status: string
  notes: string | null
  created_at: string
  updated_at: string
}

export interface VehicleMileageLog {
  id: string
  order_id: string | null
  vehicle_plate: string
  driver_id: string | null
  distance_km: number
  odometer_before: number | null
  odometer_after: number | null
  fuel_consumed: number | null
  battery_used_percent: number | null
  revenue_generated: number | null
  created_at: string
  order_id_full: string | null
  order_status: string | null
  order_created_at: string | null
}

export interface VehicleFinancialSummary {
  id: string
  vehicle_plate: string
  period_start: string
  period_end: string
  total_revenue: number
  total_fuel_cost: number
  total_maintenance_cost: number
  total_distance_km: number
  total_deliveries: number
  net_profit: number
  roi_percentage: number | null
  created_at: string
  updated_at: string
}

export interface VehicleDocument {
  id: string
  vehicle_plate: string
  document_type: string
  document_number: string | null
  issue_date: string | null
  expiry_date: string | null
  document_url: string | null
  is_valid: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

export interface ExpiringDocument extends VehicleDocument {
  vehicle_type: string
  vehicle_brand: string | null
  vehicle_model: string | null
}

export interface FleetVehicleDetails {
  vehicle: FleetVehicle
  financial: VehicleFinancialSummary[]
  documents: VehicleDocument[]
  maintenance: VehicleMaintenance[]
  fuelLogs: VehicleFuelLog[]
}

export function isApiResponse(obj: unknown): obj is ApiResponse {
  return typeof obj === 'object' && obj !== null && 'success' in obj
}

export function hasMessage(obj: unknown): obj is { message: string } {
  return typeof obj === 'object' && obj !== null && 'message' in obj && typeof (obj as { message: unknown }).message === 'string'
}

if (typeof window !== 'undefined') {
  logger.debug('[adminApiService] API_BASE_URL configured:', API_BASE_URL)
}

// Re-export Driver for use in sub-classes
export type { Driver }

export class AdminApiBase {
  /**
   * Récupère le token d'accès depuis Supabase
   */
  protected async getAccessToken(): Promise<string | null> {
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
  protected async fetchWithAuth(url: string, options?: RequestInit): Promise<Response> {
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
    logger.debug('[adminApiService] FETCH REQUEST', {
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
      logger.debug('[adminApiService] FETCH RESPONSE', {
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
}

// Make API_BASE_URL accessible to sub-classes via module scope
export { API_BASE_URL }
