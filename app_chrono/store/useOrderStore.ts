import { create } from 'zustand';

export type OrderStatus = 'pending' | 'accepted' | 'in_progress' | 'completed' | 'declined' | 'cancelled';

export interface OrderRequest {
  id: string;
  user: {
    id: string;
    name: string;
    avatar?: string;
    rating?: number;
    phone?: string;
  };
  // Infos du chauffeur (optionnel) fournies après acceptation
  driver?: {
    id?: string;
    name?: string;
    phone?: string;
    avatar?: string;
    rating?: number;
  };
  pickup: {
    address: string;
    coordinates: { latitude: number; longitude: number };
  };
  dropoff: {
    address: string;
    coordinates: { latitude: number; longitude: number };
  };
  price?: number;
  deliveryMethod?: 'moto' | 'vehicule' | 'cargo';
  distance?: number;
  estimatedDuration?: string;
  status: OrderStatus;
  driverId?: string;
  createdAt?: string | Date;
}

interface OrderStore {
  currentOrder: OrderRequest | null;
  pendingOrder: OrderRequest | null;
  driverCoords: { latitude: number; longitude: number } | null;

  setCurrentOrder: (order: OrderRequest | null) => void;
  setPendingOrder: (order: OrderRequest | null) => void;
  setDriverCoords: (coords: { latitude: number; longitude: number } | null) => void;
  updateOrderStatus: (orderId: string, status: OrderStatus) => void;
  clear: () => void;
}

export const useOrderStore = create<OrderStore>((set, get) => ({
  currentOrder: null,
  pendingOrder: null,
  driverCoords: null,

  setCurrentOrder: (order) => set({ currentOrder: order }),
  setPendingOrder: (order) => set({ pendingOrder: order }),
  setDriverCoords: (coords) => set({ driverCoords: coords }),
  updateOrderStatus: (orderId, status) => set((state) => {
    if (state.currentOrder && state.currentOrder.id === orderId) {
      return { currentOrder: { ...state.currentOrder, status } };
    }
    if (state.pendingOrder && state.pendingOrder.id === orderId) {
      return { pendingOrder: { ...state.pendingOrder, status } };
    }
    return {} as any;
  }),
  clear: () => set({ currentOrder: null, pendingOrder: null, driverCoords: null }),
}));
