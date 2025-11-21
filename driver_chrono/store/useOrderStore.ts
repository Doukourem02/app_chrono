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
    coordinates: { latitude: number; longitude: number };
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
    coordinates: { latitude: number; longitude: number };
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
    if (exists) return state;
    const newOrders = [...state.activeOrders, order];
    return {
      activeOrders: newOrders,
      selectedOrderId: state.selectedOrderId || order.id,
    };
  }),

  addPendingOrder: (order) => set((state) => {
    const exists = state.pendingOrders.some(o => o.id === order.id);
    if (exists) return state;
    return {
      pendingOrders: [...state.pendingOrders, order],
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
    
    const filteredActive = updatedActive.filter(o => 
      o.id !== orderId || (status !== 'completed' && status !== 'cancelled' && status !== 'declined')
    );
    
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
      
      return {
        activeOrders: [...state.activeOrders, acceptedOrder],
        pendingOrders: state.pendingOrders.filter(o => o.id !== orderId),
        selectedOrderId: state.selectedOrderId || acceptedOrder.id,
        orderHistory: [acceptedOrder, ...state.orderHistory],
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
    const updatedHistory = state.orderHistory.map(order => 
      order.id === orderId ? { ...order, status: 'cancelled' as OrderStatus } : order
    );
    
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