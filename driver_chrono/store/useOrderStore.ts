import { create } from 'zustand';

export type OrderStatus = 'pending' | 'accepted' | 'declined' | 'in_progress' | 'enroute' | 'picked_up' | 'delivering' | 'completed' | 'cancelled';

export interface OrderRequest {
  id: string;
  user: {
    id: string;
    name: string;
    avatar?: string;
    rating: number;
    phone?: string;
  };
  pickup: {
    address: string;
    coordinates?: { latitude: number; longitude: number };
    details?: {
      entrance?: string;
      apartment?: string;
      floor?: string;
      intercom?: string;
      photos?: string[];
    };
  };
  dropoff: {
    address: string;
    coordinates?: { latitude: number; longitude: number };
    details?: {
      phone?: string;
      entrance?: string;
      apartment?: string;
      floor?: string;
      intercom?: string;
      photos?: string[];
    };
  };
  recipient?: {
    phone?: string;
    contactId?: string;
  };
  packageImages?: string[];
  price: number;
  deliveryMethod: 'moto' | 'vehicule' | 'cargo';
  distance: number;
  estimatedDuration: string;
  status: OrderStatus;
  driverId?: string;
  createdAt: Date;
  acceptedAt?: Date;
  completedAt?: Date;
  notes?: string;
  isPhoneOrder?: boolean;
  driverNotes?: string;
}

interface OrderStore {
  activeOrders: OrderRequest[];
  pendingOrders: OrderRequest[];
  selectedOrderId: string | null;
  orderHistory: OrderRequest[];
  isReceivingOrders: boolean;

  addOrder: (order: OrderRequest) => void;
  addPendingOrder: (order: OrderRequest) => void;
  updateOrder: (orderId: string, updates: Partial<OrderRequest>) => void;
  removeOrder: (orderId: string) => void;
  setSelectedOrder: (orderId: string | null) => void;
  addToHistory: (order: OrderRequest) => void;
  updateOrderStatus: (orderId: string, status: OrderStatus) => void;
  acceptOrder: (orderId: string, driverId: string) => void;
  declineOrder: (orderId: string) => void;
  completeOrder: (orderId: string) => void;
  cancelOrder: (orderId: string) => void;
  setReceivingOrders: (receiving: boolean) => void;
  clearAllOrders: () => void;

  getOrderById: (orderId: string) => OrderRequest | undefined;
  getActiveOrder: () => OrderRequest | null;
  getActiveOrdersCount: () => number;
  getPendingOrdersCount: () => number;
  getTodayOrders: () => OrderRequest[];
  getTotalEarnings: (date?: Date) => number;

  setCurrentOrder: (order: OrderRequest | null) => void;
  setPendingOrder: (order: OrderRequest | null) => void;
}

export const useOrderStore = create<OrderStore>((set, get) => ({
  activeOrders: [],
  pendingOrders: [],
  selectedOrderId: null,
  orderHistory: [],
  isReceivingOrders: true,

  addOrder: (order) => set((state) => {
    const exists = state.activeOrders.some(o => o.id === order.id);
    
    // Mapper les champs du backend (snake_case) vers le format frontend (camelCase)
    const mappedOrder: OrderRequest = {
      ...order,
      isPhoneOrder: (order as any).is_phone_order ?? (order as any).isPhoneOrder ?? false,
      driverNotes: (order as any).driver_notes ?? (order as any).driverNotes ?? undefined,
    };
    
    if (exists) {
      // Si la commande existe déjà, la mettre à jour plutôt que de la dupliquer
      const updatedActive = state.activeOrders.map(o =>
        o.id === order.id ? { ...o, ...mappedOrder } : o
      );
      return {
        activeOrders: updatedActive,
      };
    }
    
    const newOrders = [...state.activeOrders, mappedOrder];
    
    // Si aucune commande n'est sélectionnée, ou si la nouvelle commande a un statut actif prioritaire,
    // la sélectionner automatiquement pour qu'elle s'affiche immédiatement
    const shouldSelectNewOrder = !state.selectedOrderId || 
      mappedOrder.status === 'picked_up' || 
      mappedOrder.status === 'delivering' || 
      mappedOrder.status === 'enroute' || 
      mappedOrder.status === 'in_progress';
    
    return {
      activeOrders: newOrders,
      selectedOrderId: shouldSelectNewOrder ? mappedOrder.id : state.selectedOrderId,
    };
  }),

  addPendingOrder: (order) => set((state) => {
    const exists = state.pendingOrders.some(o => o.id === order.id);
    if (exists) return state;
    
    // Mapper les champs du backend (snake_case) vers le format frontend (camelCase)
    const mappedOrder: OrderRequest = {
      ...order,
      isPhoneOrder: (order as any).is_phone_order ?? (order as any).isPhoneOrder ?? false,
      driverNotes: (order as any).driver_notes ?? (order as any).driverNotes ?? undefined,
    };
    
    return {
      pendingOrders: [...state.pendingOrders, mappedOrder],
    };
  }),

  updateOrder: (orderId, updates) => set((state) => {
    const updatedActive = state.activeOrders.map(order =>
      order.id === orderId ? { ...order, ...updates } : order
    );
    const updatedPending = state.pendingOrders.map(order =>
      order.id === orderId ? { ...order, ...updates } : order
    );
    return {
      activeOrders: updatedActive,
      pendingOrders: updatedPending,
    };
  }),

  removeOrder: (orderId) => set((state) => {
    const filteredActive = state.activeOrders.filter(order => order.id !== orderId);
    const filteredPending = state.pendingOrders.filter(order => order.id !== orderId);

    let newSelectedId = state.selectedOrderId;
    if (state.selectedOrderId === orderId) {
      newSelectedId = filteredActive.length > 0 ? filteredActive[0].id : null;
    }

    return {
      activeOrders: filteredActive,
      pendingOrders: filteredPending,
      selectedOrderId: newSelectedId,
    };
  }),

  setSelectedOrder: (orderId) => set({ selectedOrderId: orderId }),

  addToHistory: (order) => set((state) => ({
    orderHistory: [order, ...state.orderHistory].slice(0, 100)
  })),

  updateOrderStatus: (orderId, status) => set((state) => {
    const updatedHistory = state.orderHistory.map(order =>
      order.id === orderId ? { ...order, status } : order
    );

    const updatedActive = state.activeOrders.map(order =>
      order.id === orderId ? { ...order, status } : order
    );

    const updatedPending = state.pendingOrders.map(order =>
      order.id === orderId ? { ...order, status } : order
    );

    // Ne retirer de activeOrders que si la commande est complétée
    // Les commandes acceptées restent visibles même si elles sont annulées par le client
    const filteredActive = updatedActive.filter(o => {
      if (o.id !== orderId) return true; // Garder les autres commandes
      // Retirer uniquement si complétée
      // Les commandes annulées restent visibles si elles étaient acceptées
      return status !== 'completed';
    });

    const filteredPending = updatedPending.filter(o =>
      o.id !== orderId || (status !== 'pending')
    );

    return {
      orderHistory: updatedHistory,
      activeOrders: filteredActive,
      pendingOrders: filteredPending,
    };
  }),

  acceptOrder: (orderId, driverId) => set((state) => {
    const now = new Date();

    const pendingOrder = state.pendingOrders.find(o => o.id === orderId);
    if (pendingOrder) {
      const acceptedOrder = {
        ...pendingOrder,
        status: 'accepted' as OrderStatus,
        driverId,
        acceptedAt: now,
      };

      // Toujours sélectionner la nouvelle commande acceptée pour qu'elle s'affiche immédiatement
      // C'est important pour que le tracking order apparaisse automatiquement
      return {
        activeOrders: [...state.activeOrders, acceptedOrder],
        pendingOrders: state.pendingOrders.filter(o => o.id !== orderId),
        selectedOrderId: acceptedOrder.id, // Sélectionner automatiquement la nouvelle commande
        orderHistory: [acceptedOrder, ...state.orderHistory],
      };
    }

    // Si la commande n'est pas dans pendingOrders, elle pourrait venir directement du serveur
    // Vérifier si elle existe déjà dans activeOrders
    const existingOrder = state.activeOrders.find(o => o.id === orderId);
    if (!existingOrder) {
      // Si elle n'existe pas, l'ajouter directement (cas où le serveur envoie directement une commande acceptée)
      const newAcceptedOrder = {
        id: orderId,
        status: 'accepted' as OrderStatus,
        driverId,
        acceptedAt: now,
        createdAt: now,
      } as OrderRequest;
      
      return {
        activeOrders: [...state.activeOrders, newAcceptedOrder],
        selectedOrderId: newAcceptedOrder.id, // Sélectionner automatiquement
      };
    }

    return state;
  }),

  declineOrder: (orderId) => set((state) => {
    const declinedOrder = state.pendingOrders.find(o => o.id === orderId);
    if (declinedOrder) {
      const updatedOrder = {
        ...declinedOrder,
        status: 'declined' as OrderStatus,
      };

      return {
        pendingOrders: state.pendingOrders.filter(o => o.id !== orderId),
        orderHistory: [updatedOrder, ...state.orderHistory],
      };
    }
    return state;
  }),

  completeOrder: (orderId) => set((state) => {
    const now = new Date();
    const activeOrder = state.activeOrders.find(o => o.id === orderId);

    if (activeOrder) {
      const completedOrder = {
        ...activeOrder,
        status: 'completed' as OrderStatus,
        completedAt: now,
      };

      const remainingActiveOrders = state.activeOrders.filter(o => o.id !== orderId);

      let newSelectedId = state.selectedOrderId;
      if (state.selectedOrderId === orderId) {
        const nextOrder = remainingActiveOrders.find(o =>
          o.status === 'picked_up' || o.status === 'delivering' || o.status === 'enroute' || o.status === 'in_progress'
        ) || remainingActiveOrders[0] || null;
        newSelectedId = nextOrder?.id || null;
      }

      const updatedHistory = state.orderHistory.map(order =>
        order.id === orderId ? completedOrder : order
      );

      return {
        activeOrders: remainingActiveOrders,
        selectedOrderId: newSelectedId,
        orderHistory: updatedHistory.length > 0 ? updatedHistory : [completedOrder, ...state.orderHistory],
      };
    }

    return state;
  }),

  cancelOrder: (orderId) => set((state) => {
    // Trouver la commande pour vérifier si elle était acceptée
    const activeOrder = state.activeOrders.find(o => o.id === orderId);

    const wasAccepted = activeOrder && (
      activeOrder.status === 'accepted' ||
      activeOrder.status === 'enroute' ||
      activeOrder.status === 'picked_up' ||
      activeOrder.status === 'delivering' ||
      activeOrder.status === 'in_progress'
    );

    const updatedHistory = state.orderHistory.map(order =>
      order.id === orderId ? { ...order, status: 'cancelled' as OrderStatus } : order
    );

    // Si la commande était acceptée, la garder dans activeOrders avec le statut 'cancelled'
    // pour que le livreur puisse toujours la voir
    // Sinon, la retirer normalement
    if (wasAccepted) {
      const updatedActive = state.activeOrders.map(order =>
        order.id === orderId ? { ...order, status: 'cancelled' as OrderStatus } : order
      );

      return {
        activeOrders: updatedActive,
        pendingOrders: state.pendingOrders.filter(o => o.id !== orderId),
        orderHistory: updatedHistory,
      };
    }

    // Si c'était une commande pending, la retirer normalement
    return {
      activeOrders: state.activeOrders.filter(o => o.id !== orderId),
      pendingOrders: state.pendingOrders.filter(o => o.id !== orderId),
      orderHistory: updatedHistory,
    };
  }),

  setReceivingOrders: (receiving) => set({ isReceivingOrders: receiving }),

  clearAllOrders: () => set({
    activeOrders: [],
    pendingOrders: [],
    selectedOrderId: null,
    orderHistory: [],
  }),

  // Getters
  getOrderById: (orderId) => {
    const state = get();
    return state.orderHistory.find(order => order.id === orderId) ||
      state.activeOrders.find(order => order.id === orderId) ||
      state.pendingOrders.find(order => order.id === orderId);
  },

  getActiveOrder: () => {
    const state = get();
    if (state.selectedOrderId) {
      return state.activeOrders.find(o => o.id === state.selectedOrderId) || null;
    }
    return state.activeOrders.find(o => o.status === 'in_progress') || state.activeOrders[0] || null;
  },

  getActiveOrdersCount: () => {
    return get().activeOrders.length;
  },

  getPendingOrdersCount: () => {
    return get().pendingOrders.length;
  },

  getPendingOrder: () => {
    const state = get();
    return state.pendingOrders.length > 0 ? state.pendingOrders[0] : null;
  },

  // Compatibilité avec l'ancien code
  setCurrentOrder: (order) => {
    if (order) {
      get().addOrder(order);
      get().setSelectedOrder(order.id);
    } else {
      get().setSelectedOrder(null);
    }
  },

  setPendingOrder: (order) => {
    if (order) {
      get().addPendingOrder(order);
    }
  },

  getTodayOrders: () => {
    const state = get();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return state.orderHistory.filter(order => {
      const orderDate = new Date(order.createdAt);
      orderDate.setHours(0, 0, 0, 0);
      return orderDate.getTime() === today.getTime();
    });
  },

  getTotalEarnings: (date) => {
    const state = get();
    const targetDate = date || new Date();
    targetDate.setHours(0, 0, 0, 0);

    return state.orderHistory
      .filter(order => {
        if (order.status !== 'completed') return false;
        const orderDate = new Date(order.createdAt);
        orderDate.setHours(0, 0, 0, 0);
        return orderDate.getTime() === targetDate.getTime();
      })
      .reduce((total, order) => total + order.price, 0);
  },
}));