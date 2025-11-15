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
  // Preuve de livraison (ex: signature/photo) envoyée par le chauffeur
  proof?: {
    uploadedAt?: string | Date;
    url?: string;
    type?: 'photo' | 'signature' | string;
    meta?: Record<string, any>;
  };
  // Informations sur le destinataire et le colis
  recipient?: {
    name?: string;
    phone: string;
    contactId?: string; // ID du contact sauvegardé si sélectionné depuis les contacts
  };
  packageImages?: string[]; // URLs ou URIs des images du colis
  packageType?: 'standard' | 'fragile' | 'hot_sensitive'; // Type de colis
}

interface OrderStore {
  // Support pour plusieurs commandes actives
  activeOrders: OrderRequest[]; // Toutes les commandes actives (pending, accepted, enroute, picked_up)
  selectedOrderId: string | null; // ID de la commande actuellement sélectionnée/affichée
  driverCoords: Map<string, { latitude: number; longitude: number }>; // Coordonnées par orderId
  
  // Méthodes pour gérer plusieurs commandes
  addOrder: (order: OrderRequest) => void;
  updateOrder: (orderId: string, updates: Partial<OrderRequest>) => void;
  removeOrder: (orderId: string) => void;
  setSelectedOrder: (orderId: string | null) => void;
  setDriverCoordsForOrder: (orderId: string, coords: { latitude: number; longitude: number } | null) => void;
  updateOrderStatus: (orderId: string, status: OrderStatus) => void;
  updateFromSocket: (payload: { order?: Partial<OrderRequest> | null; location?: { latitude?: number; longitude?: number } | null; proof?: any }) => void;
  clear: () => void;
  
  // Getters pour compatibilité avec l'ancien code
  getCurrentOrder: () => OrderRequest | null;
  getPendingOrder: () => OrderRequest | null;
  getActiveOrdersCount: () => number;
}

export const useOrderStore = create<OrderStore>((set, get) => ({
  activeOrders: [],
  selectedOrderId: null,
  driverCoords: new Map(),

  addOrder: (order) => set((state) => {
    // Vérifier si la commande existe déjà
    const exists = state.activeOrders.some(o => o.id === order.id);
    if (exists) {
      return state;
    }
    // Ajouter la commande et la sélectionner si c'est la première
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
    const filteredOrders = state.activeOrders.filter(order => order.id !== orderId);
    const newCoords = new Map(state.driverCoords);
    newCoords.delete(orderId);
    
    // Si la commande supprimée était sélectionnée, sélectionner une autre ou null
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
    
    // Retirer les commandes terminées/annulées après un délai
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

  // Update store from a socket payload (canonical handler for order:status:update and proof uploads)
  updateFromSocket: (payload) => {
    try {
      const { order, location, proof } = payload || {};
      if (order && order.id) {
        const state = get();
        const existingOrder = state.activeOrders.find(o => o.id === order.id);
        
        if (existingOrder) {
          // Mettre à jour la commande existante
          get().updateOrder(order.id, order as Partial<OrderRequest>);
        } else {
          // Ajouter une nouvelle commande si elle n'existe pas
          get().addOrder(order as OrderRequest);
        }
        
        // Retirer les commandes terminées/annulées après un délai
        const status: OrderStatus = (order.status as OrderStatus) || 'pending';
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

  // Getters pour compatibilité avec l'ancien code
  getCurrentOrder: () => {
    const state = get();
    if (state.selectedOrderId) {
      return state.activeOrders.find(o => o.id === state.selectedOrderId) || null;
    }
    // Retourner la première commande active (non pending) ou la première en général
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
