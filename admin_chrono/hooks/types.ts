/**
 * Types partagés pour les hooks de suivi en temps réel
 */

export interface OnlineDriver {
  userId: string
  is_online: boolean
  is_available: boolean
  current_latitude?: number
  current_longitude?: number
  updated_at?: string
}

export interface Delivery {
  id: string
  shipmentNumber: string
  type: string
  status: string
  pickup: {
    name: string
    address: string
    coordinates?: { lat: number; lng: number } | null
  }
  dropoff: {
    name: string
    address: string
    coordinates?: { lat: number; lng: number } | null
  }
  driverId?: string
  userId?: string
  client?: {
    id: string
    email: string
    full_name?: string
    phone?: string
    avatar_url?: string
  } | null
  driver?: {
    id: string
    email: string
    full_name?: string
    phone?: string
    avatar_url?: string
  } | null
}

