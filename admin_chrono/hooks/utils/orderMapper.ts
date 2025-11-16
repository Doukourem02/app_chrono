import type { Delivery } from '../types'
import { formatDeliveryId } from '@/utils/formatDeliveryId'

export interface OrderFromAPI {
  id: string
  shipmentNumber?: string
  status: string
  createdAt?: string
  created_at?: string
  driverId?: string
  driver_id?: string
  userId?: string
  user_id?: string
  user?: {
    id: string
    email?: string
    name?: string
    full_name?: string
    phone?: string
    avatar?: string
    avatar_url?: string
  }
  pickup?: {
    name?: string
    address?: string
    formatted_address?: string
    coordinates?: {
      latitude?: number
      lat?: number
      longitude?: number
      lng?: number
    }
  }
  dropoff?: {
    name?: string
    address?: string
    formatted_address?: string
    coordinates?: {
      latitude?: number
      lat?: number
      longitude?: number
      lng?: number
    }
  }
  client?: Delivery['client']
  driver?: {
    id: string
    email?: string
    name?: string
    full_name?: string
    phone?: string
    avatar?: string
    avatar_url?: string
  }
}

/**
 * Extrait les coordonnées d'un objet coordinates (gère les variations de format)
 */
function extractCoordinates(
  coordinates?: {
    latitude?: number
    lat?: number
    longitude?: number
    lng?: number
  }
): { lat: number; lng: number } | null {
  if (!coordinates) return null

  const lat = coordinates.latitude ?? coordinates.lat
  const lng = coordinates.longitude ?? coordinates.lng

  if (lat === undefined || lng === undefined) {
    return null
  }

  return { lat, lng }
}

/**
 * Convertit un Order de l'API en Delivery
 */
export function mapOrderToDelivery(order: OrderFromAPI): Delivery {
  return {
    id: order.id,
    shipmentNumber: formatDeliveryId(order.id, order.createdAt || order.created_at),
    type: 'Orders',
    status: order.status,
    createdAt: order.createdAt || order.created_at,
    pickup: {
      name: order.pickup?.name || order.pickup?.address || 'Adresse inconnue',
      address: order.pickup?.address || order.pickup?.formatted_address || 'Adresse inconnue',
      coordinates: extractCoordinates(order.pickup?.coordinates),
    },
    dropoff: {
      name: order.dropoff?.name || order.dropoff?.address || 'Adresse inconnue',
      address: order.dropoff?.address || order.dropoff?.formatted_address || 'Adresse inconnue',
      coordinates: extractCoordinates(order.dropoff?.coordinates),
    },
    driverId: order.driverId || order.driver_id,
    userId: order.userId || order.user_id,
    client: order.client || (order.user
      ? {
          id: order.user.id,
          email: order.user.email || '',
          full_name: order.user.name || order.user.full_name,
          phone: order.user.phone,
          avatar_url: order.user.avatar || order.user.avatar_url,
        }
      : null),
    driver: order.driver
      ? {
          id: order.driver.id,
          email: order.driver.email || '',
          full_name: order.driver.full_name ?? order.driver.name,
          phone: order.driver.phone,
          avatar_url: order.driver.avatar_url ?? order.driver.avatar,
        }
      : null,
  }
}

