/**
 * Types pour les événements Socket.IO du backend
 * Utilisés pour typer les événements émis et reçus via Socket.IO
 */

export interface NewDeliveryData {
  id: string;
  userId: string;
  pickup: {
    address: string;
    coordinates?: {
      latitude: number;
      longitude: number;
    };
  };
  dropoff: {
    address: string;
    coordinates?: {
      latitude: number;
      longitude: number;
    };
  };
  status: string;
  price: number;
  distance?: number;
  estimatedDuration?: string;
  createdAt: Date | string;
  [key: string]: unknown;
}

export interface DeliveryAcceptedData {
  deliveryId: string;
  driverId: string;
  orderId?: string;
  status: string;
  acceptedAt: Date | string;
  [key: string]: unknown;
}

export interface DriverPositionPayload {
  driverId: string;
  latitude: number;
  longitude: number;
  orderId?: string;
  timestamp?: Date | string;
  [key: string]: unknown;
}

/**
 * Types pour les callbacks Socket.IO
 */
export interface SocketAckResponse {
  success: boolean;
  message?: string;
  order?: unknown;
  data?: unknown;
  error?: string;
  [key: string]: unknown;
}

export type SocketAckCallback = (response: SocketAckResponse) => void;

/**
 * Types pour les événements de création de commande
 */
export interface CreateOrderData {
  userId: string;
  pickup: {
    address: string;
    coordinates?: {
      latitude: number;
      longitude: number;
    };
  };
  dropoff: {
    address: string;
    coordinates?: {
      latitude: number;
      longitude: number;
    };
  };
  deliveryMethod: 'moto' | 'vehicule' | 'cargo';
  isUrgent?: boolean;
  price?: number;
  distance?: number;
  estimatedDuration?: string;
  [key: string]: unknown;
}

/**
 * Types pour les événements de mise à jour de statut
 */
export interface UpdateDeliveryStatusData {
  orderId: string;
  status: 'pending' | 'accepted' | 'enroute' | 'picked_up' | 'completed' | 'cancelled';
  location?: {
    latitude: number;
    longitude: number;
    address?: string;
  };
}

/**
 * Types pour les événements de preuve de livraison
 */
export interface SendProofData {
  orderId: string;
  proofBase64: string;
  proofType?: 'image' | 'photo' | 'video';
}

