export interface Order {
  id: string
  orderId: string
  status: 'pending' | 'assigned' | 'in_progress' | 'delivered' | 'canceled' | 'on_hold'
  pickup_address: string
  dropoff_address: string
  pickup_coords: { lat: number; lng: number }
  dropoff_coords: { lat: number; lng: number }
  client_id: string
  driver_id?: string
  price: number
  created_at: string
  updated_at: string
  client?: User
  driver?: Driver
}

export interface User {
  id: string
  email: string
  full_name: string
  first_name?: string | null
  last_name?: string | null
  phone?: string
  role: 'client' | 'driver' | 'admin' | 'super_admin' | 'partner'
  avatar_url?: string
  created_at: string
}

export interface Driver extends User {
  vehicle_type?: string
  vehicle_number?: string
  zone?: string
  average_rating?: number
  total_deliveries?: number
  is_online?: boolean
  driver_type?: 'internal' | 'partner'
  commission_balance?: number
  commission_rate?: number
  is_suspended?: boolean
  completed_deliveries?: number
  total_revenue?: number
  totalRatings?: number
}

export interface DashboardStats {
  onDelivery: number
  onDeliveryChange: number
  successDeliveries: number
  successDeliveriesChange: number
  revenue: number
  revenueChange: number
}

export interface DeliveryAnalytics {
  month: string
  packageDelivered: number
  reported: number
}

export interface ActivityData {
  deliveryId: string
  date: string
  departure: string
  destination: string
  status: string
}

export interface QuickMessage {
  id: string
  name: string
  avatar: string
  status: 'online' | 'offline'
  lastSeen: string
  unreadCount?: number
}

