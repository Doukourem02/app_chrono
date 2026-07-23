import type { Server as SocketIOServer } from 'socket.io';

// Re-export so other modules can import from here if needed
export type { SocketIOServer };

export interface OrderCoordinates {
  latitude: number; longitude: number;
}

export interface OrderLocation {
  address: string;
  coordinates?: OrderCoordinates; // Optionnel pour les commandes téléphoniques
  details?: {
    entrance?: string;
    apartment?: string;
    floor?: string;
    intercom?: string;
    phone?: string;
    photos?: string[];
  };
}

export interface OrderUser {
  id: string;
  name?: string;
  first_name?: string | null;
  last_name?: string | null;
  avatar?: string;
  rating?: number;
  phone?: string;
}

export interface OrderRecipient {
  phone?: string;
}

export interface Order {
  id: string;
  user: OrderUser;
  pickup: OrderLocation;
  dropoff: OrderLocation;
  recipient?: OrderRecipient | null;
  packageImages?: string[];
  price: number;
  deliveryMethod: string;
  distance: number;
  estimatedDuration: string;
  status: string;
  createdAt: Date;
  assignedAt?: Date;
  acceptedAt?: Date;
  completedAt?: Date;
  cancelledAt?: Date;
  driverId?: string;
  proof?: {
    uploadedAt: string;
    driverId: string;
    type: string;
    hasProof: boolean;
  };
}

export interface CreateOrderData {
  pickup: OrderLocation;
  dropoff: OrderLocation;
  deliveryMethod: string;
  userId: string;
  userInfo?: OrderUser;
  orderId?: string;
  price?: number;
  distance?: number;
  estimatedDuration?: string;
  recipient?: OrderRecipient;
  packageImages?: string[];
  // Informations de paiement
  paymentMethodType?: 'orange_money' | 'wave' | 'cash' | 'deferred';
  paymentMethodId?: string | null; // ID de la méthode de paiement depuis payment_methods
  paymentPayerType?: 'client' | 'recipient';
  isPartialPayment?: boolean;
  partialAmount?: number;
  recipientUserId?: string;
  recipientIsRegistered?: boolean;
  /** Option vitesse / service (express, pickup_service, …) — aligné app client */
  speedOptionId?: string;
  /** Durée route (trafic), secondes — tarif dynamique */
  routeDurationSeconds?: number;
  /** Durée typique Mapbox, secondes — facteur trafic */
  routeDurationTypicalSeconds?: number;
}

export interface NearbyDriver {
  driverId: string;
  distance: number;
  [key: string]: any;
}

export type BatchSocketPayload = {
  batchId: string;
  ordersCount: number;
  partner_id?: string;
  partner_name?: string;
  status?: string;
};
