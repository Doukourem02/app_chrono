
export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface Address {
  address: string;
  coordinates?: Coordinates;
  placeId?: string;
}

export type DeliveryMethod = 'moto' | 'vehicule' | 'cargo';

export type ShipmentStatus = 'pending' | 'confirmed' | 'in_progress' | 'delivered' | 'cancelled';

export interface Shipment {
  id: string;
  status: ShipmentStatus;
  estimatedTime: string | null;
  pickupLocation: string;
  deliveryLocation: string;
  method: DeliveryMethod;
  createdAt: Date;
  updatedAt: Date;
}

export interface Driver {
  id: string;
  name: string;
  rating: number;
  vehicle: DeliveryMethod;
  location: Coordinates;
  isAvailable: boolean;
}

// Validation helpers
export const isValidCoordinates = (coords: any): coords is Coordinates => {
  return (
    coords &&
    typeof coords.latitude === 'number' &&
    typeof coords.longitude === 'number' &&
    coords.latitude >= -90 &&
    coords.latitude <= 90 &&
    coords.longitude >= -180 &&
    coords.longitude <= 180
  );
};

export const isValidDeliveryMethod = (method: any): method is DeliveryMethod => {
  return ['moto', 'vehicule', 'cargo'].includes(method);
};

export const isValidShipmentStatus = (status: any): status is ShipmentStatus => {
  return ['pending', 'confirmed', 'in_progress', 'delivered', 'cancelled'].includes(status);
};

export const validateAddress = (address: string): boolean => {
  return typeof address === 'string' && address.trim().length >= 5;
};

export const validatePhoneNumber = (phone: string): boolean => {
  // Simple validation pour numéros ivoiriens
  const phoneRegex = /^(\+225|225)?[\s]?[0-9]{8,10}$/;
  return phoneRegex.test(phone.replace(/\s/g, ''));
};

export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Constants
export const DELIVERY_METHODS: { [key in DeliveryMethod]: { name: string; icon: string; speed: number } } = {
  moto: { name: 'Livraison par moto', icon: 'motorcycle', speed: 1.2 },
  vehicule: { name: 'Livraison par véhicule', icon: 'car', speed: 1.0 },
  cargo: { name: 'Livraison par cargo', icon: 'truck', speed: 0.8 },
};

export const SHIPMENT_STATUS_LABELS: { [key in ShipmentStatus]: string } = {
  pending: 'En attente',
  confirmed: 'Confirmée',
  in_progress: 'En cours',
  delivered: 'Livrée',
  cancelled: 'Annulée',
};