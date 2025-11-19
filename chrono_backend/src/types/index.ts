
export interface User {
  id: string;
  email: string;
  phone?: string;
  role: 'client' | 'driver' | 'admin'; created_at?: Date; updated_at?: Date;
} export interface UserProfile {
  id: string;
  user_id: string;
  first_name?: string;
  last_name?: string;
  avatar?: string;
  rating?: number;
  created_at?: Date;
  updated_at?: Date;
}
 
// Driver Profile
// Types pour les chauffeurs
export interface DriverProfile {
  id: string;
  user_id: string;
  first_name?: string;
  last_name?: string;
  email: string;
  phone?: string;
 vehicle_type: 'moto' | 'vehicule' | 'cargo'; license_number?: string; is_online: boolean; is_available: boolean;
  current_latitude?: number;
  current_longitude?: number;
  last_location_update?: Date;
  rating: number;
  total_deliveries: number;
  created_at?: Date;
  updated_at?: Date;
} 

// Order Status
export type OrderStatus = 'pending' | 'accepted' | 'enroute' | 'picked_up' | 'completed' | 'declined' | 'cancelled'; export type DeliveryMethod = 'moto' | 'vehicule' | 'cargo'; export interface Coordinates { latitude: number; longitude: number;
}

// Address
export interface Address {
  address: string;
  coordinates: Coordinates;
  details?: {
    entrance?: string;
    apartment?: string;
    floor?: string;
    intercom?: string;
    photos?: string[];
  };
}

export interface Order {
  id: string;
  user_id: string;
  driver_id?: string;
  pickup: Address;
  dropoff: Address;
  method: DeliveryMethod;
  price: number;
  distance: number;
  status: OrderStatus;
  recipient?: {
    name?: string;
    phone: string;
    contactId?: string;
  };
  package_images?: string[];
 package_type?: 'standard' | 'fragile' | 'hot_sensitive'; proof?: { uploaded_at?: Date; url?: string;
   type?: 'photo' | 'signature' | string; meta?: Record<string, any>; }; created_at?: Date;
  updated_at?: Date;
  assigned_at?: Date;
}

// Types pour les notes
export interface Rating {
  id: string;
  order_id: string;
  user_id: string;
  driver_id: string;
  rating: number;
  comment?: string;
  created_at?: Date;
} // Types pour l'authentification
export interface JWTPayload {
  id: string;
  role: 'client' | 'driver' | 'admin'; type: 'access' | 'refresh'; iat?: number; exp?: number;
} export interface OTPCode {
  email: string;
  phone: string;
  role: string;
  code: string;
  expires_at: Date;
  verified: boolean;
  created_at: Date;
}

// Types pour les réponses API
export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
} // Types pour les requêtes Express
import { Request, Response, NextFunction } from 'express'; export interface AuthenticatedRequest extends Request { user?: JWTPayload;
} export type RequestHandler = (req: Request | AuthenticatedRequest, res: Response, next: NextFunction) => void | Promise<void>; // Types pour Socket.IO
import { Socket } from 'socket.io'; export interface SocketWithUser extends Socket { userId?: string; userRole?: 'client' | 'driver' | 'admin';
}

// Types pour les erreurs
export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

