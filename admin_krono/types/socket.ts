/**
 * Types et helpers pour Socket.IO
 * Évite les répétitions de typage dans les callbacks
 */

// Types pour les événements Socket.IO
export interface SocketEventData {
  'admin:connected': void
  'admin:initial-drivers': { drivers: Array<{
    userId: string
    is_online: boolean
    is_available: boolean
    current_latitude?: number
    current_longitude?: number
    updated_at?: string
  }> }
  'driver:online': {
    userId: string
    is_online: boolean
    is_available: boolean
    current_latitude?: number
    current_longitude?: number
    updated_at?: string
  }
  'driver:offline': { userId: string }
  'driver:position:update': {
    userId: string
    current_latitude?: number
    current_longitude?: number
    updated_at?: string
  }
  'order:status:update': {
    order: {
      id: string
      shipmentNumber?: string
      status: string
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
    location?: {
      latitude?: number
      longitude?: number
      lat?: number
      lng?: number
    }
  }
  'admin:error': { message: string }
  'admin:connection-failed': { message: string; url: string }
}

/**
 * Helper pour typer les callbacks Socket.IO de manière sûre
 */
export function createSocketHandler<T extends keyof SocketEventData>(
  event: T,
  handler: (data: SocketEventData[T]) => void
): (data: unknown) => void {
  return (data: unknown) => {
    handler(data as SocketEventData[T])
  }
}

