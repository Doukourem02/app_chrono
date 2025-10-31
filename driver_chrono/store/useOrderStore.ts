import { create } from 'zustand';

export type OrderStatus = 'pending' | 'accepted' | 'declined' | 'in_progress' | 'completed' | 'cancelled';

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
  };
  dropoff: {
    address: string;
    coordinates: { latitude: number; longitude: number };
  };
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
  // États
  currentOrder: OrderRequest | null;
  pendingOrder: OrderRequest | null; // Commande en attente de réponse du driver
  orderHistory: OrderRequest[];
  isReceivingOrders: boolean;
  
  // Actions
  setCurrentOrder: (order: OrderRequest | null) => void;
  setPendingOrder: (order: OrderRequest | null) => void;
  addToHistory: (order: OrderRequest) => void;
  updateOrderStatus: (orderId: string, status: OrderStatus) => void;
  acceptOrder: (orderId: string, driverId: string) => void;
  declineOrder: (orderId: string) => void;
  completeOrder: (orderId: string) => void;
  cancelOrder: (orderId: string) => void;
  setReceivingOrders: (receiving: boolean) => void;
  clearAllOrders: () => void;
  
  // Getters
  getOrderById: (orderId: string) => OrderRequest | undefined;
  getActiveOrder: () => OrderRequest | null;
  getTodayOrders: () => OrderRequest[];
  getTotalEarnings: (date?: Date) => number;
}

export const useOrderStore = create<OrderStore>((set, get) => ({
  // États initiaux
  currentOrder: null,
  pendingOrder: null,
  orderHistory: [],
  isReceivingOrders: true,
  
  // Actions
  setCurrentOrder: (order) => set({ currentOrder: order }),
  
  setPendingOrder: (order) => set({ pendingOrder: order }),
  
  addToHistory: (order) => set((state) => ({
    orderHistory: [order, ...state.orderHistory].slice(0, 100) // Garder max 100 commandes
  })),
  
  updateOrderStatus: (orderId, status) => set((state) => {
    const updatedHistory = state.orderHistory.map(order => 
      order.id === orderId ? { ...order, status } : order
    );
    
    let updatedCurrent = state.currentOrder;
    if (state.currentOrder?.id === orderId) {
      updatedCurrent = { ...state.currentOrder, status };
    }
    
    let updatedPending = state.pendingOrder;
    if (state.pendingOrder?.id === orderId) {
      updatedPending = { ...state.pendingOrder, status };
    }
    
    return {
      orderHistory: updatedHistory,
      currentOrder: updatedCurrent,
      pendingOrder: updatedPending,
    };
  }),
  
  acceptOrder: (orderId, driverId) => set((state) => {
    const now = new Date();
    
    // Mettre à jour la commande en attente
    let updatedOrder = state.pendingOrder;
    if (updatedOrder && updatedOrder.id === orderId) {
      updatedOrder = {
        ...updatedOrder,
        status: 'accepted' as OrderStatus,
        driverId,
        acceptedAt: now,
      };
    }
    
    return {
      currentOrder: updatedOrder,
      pendingOrder: null, // Plus de commande en attente
      orderHistory: updatedOrder ? [updatedOrder, ...state.orderHistory] : state.orderHistory,
    };
  }),
  
  declineOrder: (orderId) => set((state) => {
    const declinedOrder = state.pendingOrder;
    if (declinedOrder && declinedOrder.id === orderId) {
      const updatedOrder = {
        ...declinedOrder,
        status: 'declined' as OrderStatus,
      };
      
      return {
        pendingOrder: null,
        orderHistory: [updatedOrder, ...state.orderHistory],
      };
    }
    return state;
  }),
  
  completeOrder: (orderId) => set((state) => {
    const now = new Date();
    let updatedCurrent = state.currentOrder;
    
    if (updatedCurrent && updatedCurrent.id === orderId) {
      updatedCurrent = {
        ...updatedCurrent,
        status: 'completed' as OrderStatus,
        completedAt: now,
      };
      
      const updatedHistory = state.orderHistory.map(order => 
        order.id === orderId ? updatedCurrent! : order
      );
      
      return {
        currentOrder: null, // Plus de commande active
        orderHistory: updatedHistory.length > 0 ? updatedHistory : [updatedCurrent, ...state.orderHistory],
      };
    }
    
    return state;
  }),
  
  cancelOrder: (orderId) => set((state) => {
    const updatedHistory = state.orderHistory.map(order => 
      order.id === orderId ? { ...order, status: 'cancelled' as OrderStatus } : order
    );
    
    let updatedCurrent = state.currentOrder;
    if (state.currentOrder?.id === orderId) {
      updatedCurrent = null; // Annuler la commande active
    }
    
    return {
      orderHistory: updatedHistory,
      currentOrder: updatedCurrent,
    };
  }),
  
  setReceivingOrders: (receiving) => set({ isReceivingOrders: receiving }),
  
  clearAllOrders: () => set({
    currentOrder: null,
    pendingOrder: null,
    orderHistory: [],
  }),
  
  // Getters
  getOrderById: (orderId) => {
    const state = get();
    return state.orderHistory.find(order => order.id === orderId) || 
           (state.currentOrder?.id === orderId ? state.currentOrder : undefined) ||
           (state.pendingOrder?.id === orderId ? state.pendingOrder : undefined);
  },
  
  getActiveOrder: () => {
    const state = get();
    return state.currentOrder?.status === 'in_progress' ? state.currentOrder : null;
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