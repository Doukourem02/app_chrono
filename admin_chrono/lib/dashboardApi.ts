// Service API pour le dashboard admin - utilise adminApiService (comme les autres apps)
import { adminApiService } from './adminApiService'
import { logger } from '@/utils/logger'

export interface DashboardStats {
  onDelivery: number
  onDeliveryChange: number
  successDeliveries: number
  successDeliveriesChange: number
  revenue: number
  revenueChange: number
  // Nouvelles métriques
  averageRating?: number
  totalRatings?: number
  averageDeliveryTime?: number
  cancellationRate?: number
  activeClients?: number
  activeDrivers?: number
}

export interface DeliveryAnalyticsData {
  month: string
  packageDelivered: number
  reported: number
}

export interface ActivityData {
  id: string
  deliveryId: string
  date: string
  departure: string
  destination: string
  status: 'pending' | 'accepted' | 'enroute' | 'picked_up' | 'completed' | 'declined' | 'cancelled'
  clientName?: string
  driverName?: string
}

// Données mockées par défaut (correspondant à l'image du dashboard)
const MOCK_DASHBOARD_STATS: DashboardStats = {
  onDelivery: 1354,
  onDeliveryChange: 16.5,
  successDeliveries: 40523,
  successDeliveriesChange: -0.5,
  revenue: 140854,
  revenueChange: 5.2,
}

const MOCK_ANALYTICS_DATA: DeliveryAnalyticsData[] = [
  { month: 'août', packageDelivered: 9200, reported: 52 },
  { month: 'sept.', packageDelivered: 10123, reported: 56 },
  { month: 'oct.', packageDelivered: 11200, reported: 48 },
  { month: 'nov.', packageDelivered: 12500, reported: 62 },
]


/**
 * Récupère les statistiques principales du dashboard
 */
export async function getDashboardStats(startDate?: string, endDate?: string): Promise<DashboardStats> {
  logger.debug('📞 [dashboardApi] getDashboardStats CALLED', { startDate, endDate, timestamp: new Date().toISOString(), stack: new Error().stack })
  try {
    const result = await adminApiService.getDashboardStats(startDate, endDate)
    logger.debug('✅ [dashboardApi] getDashboardStats SUCCESS', { hasData: !!result.data, timestamp: new Date().toISOString() })
    if (result.success && result.data) {
      return result.data
    }
    return MOCK_DASHBOARD_STATS
  } catch (error) {
    logger.error('❌ [dashboardApi] getDashboardStats ERROR', { error, timestamp: new Date().toISOString() })
    logger.warn('⚠️ Error fetching dashboard stats. Using mock data.')
    return MOCK_DASHBOARD_STATS
  }
}

/**
 * Récupère les données d'analytics pour les graphiques
 */
export async function getDeliveryAnalytics(startDate?: string, endDate?: string): Promise<DeliveryAnalyticsData[]> {
  logger.debug('📞 [dashboardApi] getDeliveryAnalytics CALLED', { startDate, endDate, timestamp: new Date().toISOString(), stack: new Error().stack })
  try {
    const result = await adminApiService.getDeliveryAnalytics(startDate, endDate)
    logger.debug('✅ [dashboardApi] getDeliveryAnalytics SUCCESS', { hasData: !!result.data, dataLength: result.data?.length, timestamp: new Date().toISOString() })
    if (result.success && result.data) {
      return result.data
    }
    return MOCK_ANALYTICS_DATA
  } catch (error) {
    logger.error('❌ [dashboardApi] getDeliveryAnalytics ERROR', { error, timestamp: new Date().toISOString() })
    logger.warn('⚠️ Error fetching delivery analytics. Using mock data.')
    return MOCK_ANALYTICS_DATA
  }
}

/**
 * Récupère les activités récentes
 */
export async function getRecentActivities(limit: number = 5, startDate?: string, endDate?: string): Promise<ActivityData[]> {
  logger.debug('📞 [dashboardApi] getRecentActivities CALLED', { limit, startDate, endDate, timestamp: new Date().toISOString(), stack: new Error().stack })
  try {
    const result = await adminApiService.getRecentActivities(limit, startDate, endDate)
    logger.debug('✅ [dashboardApi] getRecentActivities SUCCESS', { hasData: !!result.data, dataLength: result.data?.length, timestamp: new Date().toISOString() })
    
    // Si l'API retourne des données (même vides), on les utilise
    if (result.success && result.data !== undefined && Array.isArray(result.data)) {
      return result.data as ActivityData[]
    }
    // Si l'API échoue, on retourne un tableau vide pour montrer qu'il n'y a pas de données
    logger.warn('⚠️ [dashboardApi] API returned no data for recent activities. Result:', result)
    return []
  } catch (error: unknown) {
    // En cas d'erreur réseau, on retourne un tableau vide
    const errorMessage = error instanceof Error ? error.message : String(error)
    logger.error('❌ [dashboardApi] getRecentActivities ERROR', { error: errorMessage, timestamp: new Date().toISOString() })
    return []
  }
}
