import { AdminOrderApi } from './adminOrderApi'
import type {
  FleetVehicle,
  FleetVehicleDetails,
  ExpiringDocument,
  VehicleFuelLog,
  VehicleMaintenance,
  VehicleMileageLog,
  VehicleFinancialSummary,
} from './adminApiBase'
import { API_BASE_URL, isApiResponse } from './adminApiBase'
import { logger } from '@/utils/logger'

export class AdminFleetApi extends AdminOrderApi {
  /**
   * FLOTTE - Récupère tous les véhicules de la flotte
   */
  async getFleetVehicles(params?: {
    status?: 'active' | 'maintenance' | 'retired' | 'reserved'
    vehicleType?: 'moto' | 'vehicule' | 'cargo'
    search?: string
  }): Promise<{
    success: boolean
    data?: Array<{
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
    }>
  }> {
    try {
      const queryParams = new URLSearchParams()
      if (params?.status) queryParams.append('status', params.status)
      if (params?.vehicleType) queryParams.append('vehicleType', params.vehicleType)
      if (params?.search) queryParams.append('search', params.search)

      const url = `${API_BASE_URL}/api/fleet/vehicles${queryParams.toString() ? `?${queryParams.toString()}` : ''}`
      const response = await this.fetchWithAuth(url)

      if (!response.ok) {
        return { success: false, data: [] }
      }

      const result: unknown = await response.json()
      if (isApiResponse(result)) {
        return {
          success: result.success || false,
          data: (result.data as FleetVehicle[]) || [],
        }
      }
      return { success: false, data: [] }
    } catch (error: unknown) {
      logger.error('[adminApiService] Error in getFleetVehicles:', error)
      return { success: false, data: [] }
    }
  }

  /**
   * FLOTTE - Récupère les détails d'un véhicule
   */
  async getFleetVehicleDetails(vehiclePlate: string): Promise<{
    success: boolean
    data?: FleetVehicleDetails
  }> {
    try {
      const url = `${API_BASE_URL}/api/fleet/vehicles/${encodeURIComponent(vehiclePlate)}`
      const response = await this.fetchWithAuth(url)

      if (!response.ok) {
        return { success: false }
      }

      const result: unknown = await response.json()
      if (isApiResponse(result)) {
        return {
          success: result.success || false,
          data: result.data as FleetVehicleDetails,
        }
      }
      return { success: false }
    } catch (error: unknown) {
      logger.error('[adminApiService] Error in getFleetVehicleDetails:', error)
      return { success: false }
    }
  }

  /**
   * FLOTTE - Récupère les documents expirant bientôt
   */
  async getExpiringDocuments(days: number = 30): Promise<{
    success: boolean
    data?: ExpiringDocument[]
  }> {
    try {
      const url = `${API_BASE_URL}/api/fleet/documents/expiring?days=${days}`
      const response = await this.fetchWithAuth(url)

      if (!response.ok) {
        return { success: false, data: [] }
      }

      const result: unknown = await response.json()
      if (isApiResponse(result)) {
        return {
          success: result.success || false,
          data: (result.data as ExpiringDocument[]) || [],
        }
      }
      return { success: false, data: [] }
    } catch (error: unknown) {
      logger.error('[adminApiService] Error in getExpiringDocuments:', error)
      return { success: false, data: [] }
    }
  }

  /**
   * FLOTTE - Récupère l'historique des ravitaillements
   */
  async getVehicleFuelLogs(vehiclePlate: string, limit: number = 50): Promise<{
    success: boolean
    data?: Array<{
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
    }>
  }> {
    try {
      const url = `${API_BASE_URL}/api/fleet/vehicles/${encodeURIComponent(vehiclePlate)}/fuel?limit=${limit}`
      const response = await this.fetchWithAuth(url)

      if (!response.ok) {
        return { success: false, data: [] }
      }

      const result: unknown = await response.json()
      if (isApiResponse(result)) {
        return {
          success: result.success || false,
          data: (result.data as VehicleFuelLog[]) || [],
        }
      }
      return { success: false, data: [] }
    } catch (error: unknown) {
      logger.error('[adminApiService] Error in getVehicleFuelLogs:', error)
      return { success: false, data: [] }
    }
  }

  /**
   * FLOTTE - Récupère l'historique des maintenances
   */
  async getVehicleMaintenance(vehiclePlate: string, status?: string): Promise<{
    success: boolean
    data?: Array<{
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
    }>
  }> {
    try {
      const queryParams = new URLSearchParams()
      if (status) queryParams.append('status', status)

      const url = `${API_BASE_URL}/api/fleet/vehicles/${encodeURIComponent(vehiclePlate)}/maintenance${queryParams.toString() ? `?${queryParams.toString()}` : ''}`
      const response = await this.fetchWithAuth(url)

      if (!response.ok) {
        return { success: false, data: [] }
      }

      const result: unknown = await response.json()
      if (isApiResponse(result)) {
        return {
          success: result.success || false,
          data: (result.data as VehicleMaintenance[]) || [],
        }
      }
      return { success: false, data: [] }
    } catch (error: unknown) {
      logger.error('[adminApiService] Error in getVehicleMaintenance:', error)
      return { success: false, data: [] }
    }
  }

  /**
   * FLOTTE - Récupère l'historique du kilométrage
   */
  async getVehicleMileage(vehiclePlate: string, limit: number = 100): Promise<{
    success: boolean
    data?: Array<{
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
    }>
  }> {
    try {
      const url = `${API_BASE_URL}/api/fleet/vehicles/${encodeURIComponent(vehiclePlate)}/mileage?limit=${limit}`
      const response = await this.fetchWithAuth(url)

      if (!response.ok) {
        return { success: false, data: [] }
      }

      const result: unknown = await response.json()
      if (isApiResponse(result)) {
        return {
          success: result.success || false,
          data: (result.data as VehicleMileageLog[]) || [],
        }
      }
      return { success: false, data: [] }
    } catch (error: unknown) {
      logger.error('[adminApiService] Error in getVehicleMileage:', error)
      return { success: false, data: [] }
    }
  }

  /**
   * FLOTTE - Récupère le résumé financier
   */
  async getVehicleFinancialSummary(
    vehiclePlate: string,
    periodStart?: string,
    periodEnd?: string
  ): Promise<{
    success: boolean
    data?: Array<{
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
    }>
  }> {
    try {
      const queryParams = new URLSearchParams()
      if (periodStart) queryParams.append('periodStart', periodStart)
      if (periodEnd) queryParams.append('periodEnd', periodEnd)

      const url = `${API_BASE_URL}/api/fleet/vehicles/${encodeURIComponent(vehiclePlate)}/financial-summary${queryParams.toString() ? `?${queryParams.toString()}` : ''}`
      const response = await this.fetchWithAuth(url)

      if (!response.ok) {
        return { success: false, data: [] }
      }

      const result: unknown = await response.json()
      if (isApiResponse(result)) {
        return {
          success: result.success || false,
          data: (result.data as VehicleFinancialSummary[]) || [],
        }
      }
      return { success: false, data: [] }
    } catch (error: unknown) {
      logger.error('[adminApiService] Error in getVehicleFinancialSummary:', error)
      return { success: false, data: [] }
    }
  }

  /**
   * FLOTTE - Calcule le résumé financier pour une période
   */
  async calculateVehicleFinancialSummary(
    vehiclePlate: string,
    periodStart: string,
    periodEnd: string
  ): Promise<{
    success: boolean
    data?: VehicleFinancialSummary
  }> {
    try {
      const url = `${API_BASE_URL}/api/fleet/vehicles/${encodeURIComponent(vehiclePlate)}/calculate-financial-summary`
      const response = await this.fetchWithAuth(url, {
        method: 'POST',
        body: JSON.stringify({ periodStart, periodEnd }),
      })

      if (!response.ok) {
        return { success: false }
      }

      const result: unknown = await response.json()
      if (isApiResponse(result)) {
        return {
          success: result.success || false,
          data: result.data as VehicleFinancialSummary | undefined,
        }
      }
      return { success: false }
    } catch (error: unknown) {
      logger.error('[adminApiService] Error in calculateVehicleFinancialSummary:', error)
      return { success: false }
    }
  }
}
