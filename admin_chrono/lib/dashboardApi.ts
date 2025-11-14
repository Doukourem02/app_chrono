// Service API pour le dashboard admin - utilise adminApiService (comme les autres apps)
import { adminApiService } from './adminApiService'

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

const MOCK_ACTIVITIES_DATA: ActivityData[] = [
  {
    id: '1',
    deliveryId: 'CA-12321-ID',
    date: '12/11/2024',
    departure: 'California, US',
    destination: 'Jakarta, ID',
    status: 'enroute',
  },
  {
    id: '2',
    deliveryId: 'NY-12321-SF',
    date: '14/11/2024',
    departure: 'New York, US',
    destination: 'San Francisco, US',
    status: 'enroute',
  },
  {
    id: '3',
    deliveryId: 'CGK-12321-NY',
    date: '14/11/2024',
    departure: 'Jakarta, ID',
    destination: 'New York, US',
    status: 'pending',
  },
  {
    id: '4',
    deliveryId: 'UK-12321-MLG',
    date: '18/11/2024',
    departure: 'London, UK',
    destination: 'Malang, ID',
    status: 'completed',
  },
]

/**
 * Récupère les statistiques principales du dashboard
 */
export async function getDashboardStats(): Promise<DashboardStats> {
  try {
    const result = await adminApiService.getDashboardStats()
    if (result.success && result.data) {
      return result.data
    }
    return MOCK_DASHBOARD_STATS
  } catch (error) {
    console.warn('⚠️ Error fetching dashboard stats. Using mock data.')
    return MOCK_DASHBOARD_STATS
  }
}

/**
 * Récupère les données d'analytics pour les graphiques
 */
export async function getDeliveryAnalytics(): Promise<DeliveryAnalyticsData[]> {
  try {
    const result = await adminApiService.getDeliveryAnalytics()
    if (result.success && result.data) {
      return result.data
    }
    return MOCK_ANALYTICS_DATA
  } catch (error) {
    console.warn('⚠️ Error fetching delivery analytics. Using mock data.')
    return MOCK_ANALYTICS_DATA
  }
}

/**
 * Récupère les activités récentes
 */
export async function getRecentActivities(limit: number = 5): Promise<ActivityData[]> {
  try {
    console.debug('🔍 [dashboardApi] getRecentActivities called with limit:', limit)
    const result = await adminApiService.getRecentActivities(limit)
    console.debug('🔍 [dashboardApi] getRecentActivities result:', result)
    
    // Si l'API retourne des données (même vides), on les utilise
    if (result.success && result.data !== undefined && Array.isArray(result.data)) {
      console.debug(`✅ [dashboardApi] Returning ${result.data.length} activities`)
      return result.data as ActivityData[]
    }
    // Si l'API échoue, on retourne un tableau vide pour montrer qu'il n'y a pas de données
    console.warn('⚠️ [dashboardApi] API returned no data for recent activities. Result:', result)
    return []
  } catch (error: any) {
    // En cas d'erreur réseau, on retourne un tableau vide
    console.error('❌ [dashboardApi] Error fetching recent activities:', error?.message || error)
    return []
  }
}
