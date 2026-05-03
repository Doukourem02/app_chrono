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
  is_inactive?: boolean
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

// ─── B2B / Partenaires ────────────────────────────────────────────────────────

export interface Partner {
  id: string
  name: string
  email?: string | null
  phone?: string | null
  status: 'active' | 'inactive' | 'suspended' | 'pending'
  plan?: string | null
  commission_rate: number
  notes?: string | null
  created_at: string
  /** `users.is_business` (toggle app), utilisateur owner ou premier lien — liste admin. */
  is_business?: boolean | null
}

export interface PartnerSubscription {
  id: string
  partner_id: string
  plan: string
  monthly_price: number
  included_orders: number | null
  excess_commission_rate: number
  starts_at: string
  payment_status: 'pending_payment' | 'active' | 'cancelled'
  is_active: boolean
  created_at: string
}

export interface PartnerUsage {
  month: string
  deliveries_count: number
  quota: number | null
  remaining: number | null
  over_quota: boolean
  plan: string | null
}

export interface PartnerInvoice {
  id: string
  partner_id: string
  amount: number
  status: 'pending' | 'paid' | 'overdue'
  period_start: string
  period_end: string
  created_at: string
}

export interface PartnerDetail extends Partner {
  active_subscription: PartnerSubscription | null
  current_usage: { deliveries_count: number; month: string } | null
}

export interface PartnerUser {
  id: string
  partner_id: string
  user_id: string
  role: 'owner'
  created_at: string
  user?: { email?: string; first_name?: string | null; last_name?: string | null }
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

