import { create } from 'zustand';

export type OrderStatus = 'pending' | 'accepted' | 'enroute' | 'picked_up' | 'completed' | 'declined' | 'cancelled';

export interface OrderRequest {
  id: string;
  user: {
    id: string;
    name: string;
    avatar?: string;
    rating?: number;
    phone?: string;
  };
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
  proof?: {
    uploadedAt?: string | Date;
    url?: string;
    type?: 'photo' | 'signature' | string;
    meta?: Record<string, any>;
  };
  recipient?: {
    name?: string;
    phone: string;
    contactId?: string; 
  };
  packageImages?: string[]; 
  packageType?: 'standard' | 'fragile' | 'hot_sensitive'; 
}

interface OrderStore {
  activeOrders: OrderRequest[]; 
  selectedOrderId: string | null; 
  driverCoords: Map<string, { latitude: number; longitude: number }>; 
  
  addOrder: (order: OrderRequest) => void;
  updateOrder: (orderId: string, updates: Partial<OrderRequest>) => void;
  removeOrder: (orderId: string) => void;
  setSelectedOrder: (orderId: string | null) => void;
  setDriverCoordsForOrder: (orderId: string, coords: { latitude: number; longitude: number } | null) => void;
  updateOrderStatus: (orderId: string, status: OrderStatus) => void;
  updateFromSocket: (payload: { order?: Partial<OrderRequest> | null; location?: { latitude?: number; longitude?: number } | null; proof?: any }) => void;
  clear: () => void;
  
  getCurrentOrder: () => OrderRequest | null;
  getPendingOrder: () => OrderRequest | null;
  getActiveOrdersCount: () => number;
}

export const useOrderStore = create<OrderStore>((set, get) => ({
  activeOrders: [],
  selectedOrderId: null,
  driverCoords: new Map(),

  addOrder: (order) => set((state) => {
    const exists = state.activeOrders.some(o => o.id === order.id);
    if (exists) {
      return state;
    }
    const newOrders = [...state.activeOrders, order];
    return {
      activeOrders: newOrders,
      selectedOrderId: state.selectedOrderId || order.id,
    };
  }),

  updateOrder: (orderId, updates) => set((state) => {
    const updatedOrders = state.activeOrders.map(order =>
      order.id === orderId ? { ...order, ...updates } : order
    );
    return { activeOrders: updatedOrders };
  }),

  removeOrder: (orderId) => set((state) => {
    const orderToRemove = state.activeOrders.find(o => o.id === orderId);
    
    if (orderToRemove) {
      const isFinalStatus = orderToRemove.status === 'completed' || 
                          orderToRemove.status === 'cancelled' || 
                          orderToRemove.status === 'declined';
      
      if (!isFinalStatus) {
        console.warn('⚠️ Tentative de retirer une commande active - ignorée', { orderId, status: orderToRemove.status });
        return state;
      }
    }
    
    const filteredOrders = state.activeOrders.filter(order => order.id !== orderId);
    const newCoords = new Map(state.driverCoords);
    newCoords.delete(orderId);
    
    let newSelectedId = state.selectedOrderId;
    if (state.selectedOrderId === orderId) {
      newSelectedId = filteredOrders.length > 0 ? filteredOrders[0].id : null;
    }
    
    return {
      activeOrders: filteredOrders,
      selectedOrderId: newSelectedId,
      driverCoords: newCoords,
    };
  }),

  setSelectedOrder: (orderId) => set({ selectedOrderId: orderId }),

  setDriverCoordsForOrder: (orderId, coords) => set((state) => {
    const newCoords = new Map(state.driverCoords);
    if (coords) {
      newCoords.set(orderId, coords);
    } else {
      newCoords.delete(orderId);
    }
    return { driverCoords: newCoords };
  }),

  updateOrderStatus: (orderId, status) => set((state) => {
    const updatedOrders = state.activeOrders.map(order =>
      order.id === orderId ? { ...order, status } : order
    );
    
    const completedOrders = updatedOrders.filter(o => 
      o.id === orderId && (status === 'completed' || status === 'cancelled' || status === 'declined')
    );
    
    if (completedOrders.length > 0) {
      setTimeout(() => {
        get().removeOrder(orderId);
      }, 2000);
    }
    
    return { activeOrders: updatedOrders };
  }),

  updateFromSocket: (payload) => {
    try {
      const { order, location, proof } = payload || {};
      if (order && order.id) {
        const state = get();
        const existingOrder = state.activeOrders.find(o => o.id === order.id);
        const status: OrderStatus = (order.status as OrderStatus) || 'pending';
        
        if (existingOrder) {
          // Mettre à jour l'ordre avec le nouveau statut et toutes les autres propriétés
          // Utiliser set directement pour garantir que les subscriptions sont déclenchées
          set((currentState) => {
            const updatedOrders = currentState.activeOrders.map((o) =>
              o.id === order.id 
                ? { 
                    ...o, 
                    ...order,
                    status, // S'assurer que le statut est bien mis à jour
                    // Ajouter completed_at si la commande est complétée
                    ...(status === 'completed' && !o.completed_at 
                      ? { completed_at: new Date().toISOString() }
                      : {}),
                    // Ajouter cancelled_at si la commande est annulée
                    ...(status === 'cancelled' && !o.cancelled_at 
                      ? { cancelled_at: new Date().toISOString() }
                      : {}),
                  }
                : o
            );
            return { activeOrders: updatedOrders };
          });
        } else {
          // Ajouter la nouvelle commande
          get().addOrder({
            ...order as OrderRequest,
            status,
            // Ajouter completed_at si la commande est complétée
            ...(status === 'completed' 
              ? { completed_at: new Date().toISOString() }
              : {}),
            // Ajouter cancelled_at si la commande est annulée
            ...(status === 'cancelled' 
              ? { cancelled_at: new Date().toISOString() }
              : {}),
          });
        }
        
        // Si la commande est dans un état final, la retirer après 2 secondes
        if (status === 'completed' || status === 'cancelled' || status === 'declined') {
          const orderId = order.id;
          if (orderId) {
            setTimeout(() => {
              get().removeOrder(orderId);
            }, 2000);
          }
        }
      }

      if (location && location.latitude && location.longitude && order?.id) {
        get().setDriverCoordsForOrder(order.id, {
          latitude: location.latitude,
          longitude: location.longitude,
        });
      }

      if (proof && proof.uploadedAt && order?.id) {
        const state = get();
        const existingOrder = state.activeOrders.find(o => o.id === order.id);
        if (existingOrder) {
          get().updateOrder(order.id, {
            proof: { ...existingOrder.proof, ...proof },
          });
        }
      }
    } catch (err) {
      console.warn('useOrderStore.updateFromSocket error', err);
    }
  },

  clear: () => set({ 
    activeOrders: [],
    selectedOrderId: null,
    driverCoords: new Map(),
  }),

  getCurrentOrder: () => {
    const state = get();
    if (state.selectedOrderId) {
      return state.activeOrders.find(o => o.id === state.selectedOrderId) || null;
    }
    return state.activeOrders.find(o => o.status !== 'pending') || state.activeOrders[0] || null;
  },

  getPendingOrder: () => {
    const state = get();
    return state.activeOrders.find(o => o.status === 'pending') || null;
  },

  getActiveOrdersCount: () => {
    return get().activeOrders.length;
  },
}));
