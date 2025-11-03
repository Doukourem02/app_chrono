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
}

interface OrderStore {
  currentOrder: OrderRequest | null;
  pendingOrder: OrderRequest | null;
  driverCoords: { latitude: number; longitude: number } | null;
  deliveryStage: 'idle' | 'searching' | 'accepted' | 'enroute' | 'picked_up' | 'completed' | 'cancelled';

  setCurrentOrder: (order: OrderRequest | null) => void;
  setPendingOrder: (order: OrderRequest | null) => void;
  setDriverCoords: (coords: { latitude: number; longitude: number } | null) => void;
  updateOrderStatus: (orderId: string, status: OrderStatus) => void;
  setDeliveryStage: (stage: OrderStore['deliveryStage']) => void;
  updateFromSocket: (payload: { order?: Partial<OrderRequest> | null; location?: { latitude?: number; longitude?: number } | null; proof?: any }) => void;
  clear: () => void;
}

export const useOrderStore = create<OrderStore>((set, get) => ({
  currentOrder: null,
  pendingOrder: null,
  driverCoords: null,
  deliveryStage: 'idle',

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
  setDeliveryStage: (stage) => set({ deliveryStage: stage }),

  // Update store from a socket payload (canonical handler for order:status:update and proof uploads)
  updateFromSocket: (payload) => {
    try {
      const { order, location, proof } = payload || {};
      if (order) {
        // Merge incoming order state into existing state by id
        set((state) => {
          const merge = (existing: OrderRequest | null): OrderRequest | null => {
            if (!existing) return (order as OrderRequest) ?? null;
            if (order?.id && existing.id !== order.id) return existing; // different order, ignore
            return { ...existing, ...order } as OrderRequest;
          };

          const nextPending = order.status === 'pending' ? merge(state.pendingOrder) : (state.pendingOrder && state.pendingOrder.id === order.id ? null : state.pendingOrder);
          const nextCurrent = order.status && order.status !== 'pending' ? merge(state.currentOrder) : state.currentOrder;

          return { currentOrder: nextCurrent, pendingOrder: nextPending } as any;
        });

        // Map status to deliveryStage
        const status: OrderStatus = (order.status as OrderStatus) || 'pending';
        const mapping: Record<OrderStatus, OrderStore['deliveryStage']> = {
          pending: 'searching',
          accepted: 'accepted',
          enroute: 'enroute',
          picked_up: 'picked_up',
          completed: 'idle', // Completed -> revenir à idle immédiatement
          declined: 'idle', // Declined -> revenir à idle immédiatement
          cancelled: 'idle' // Cancelled -> revenir à idle immédiatement
        };

        const stage = mapping[status] || 'idle';
        set({ deliveryStage: stage });
        
        // Si la commande est annulée/refusée, nettoyer immédiatement
        // Pour 'completed', on ne nettoie PAS automatiquement - on attend que le RatingBottomSheet soit fermé
        // Le nettoyage sera géré par map.tsx après soumission/fermeture du RatingBottomSheet
        if (status === 'cancelled' || status === 'declined') {
          // Nettoyer les commandes annulées/refusées après un court délai pour permettre l'affichage du tracking
          setTimeout(() => {
            const currentState = get();
            // Vérifier que c'est toujours la même commande avant de nettoyer
            if ((currentState.currentOrder?.id === order.id && currentState.currentOrder?.status === status) ||
                (currentState.pendingOrder?.id === order.id && currentState.pendingOrder?.status === status)) {
              set({ 
                currentOrder: null, 
                pendingOrder: null, 
                driverCoords: null,
                deliveryStage: 'idle' 
              });
            }
          }, 2000); // 2 secondes de délai pour permettre l'affichage du message de confirmation
        }
        // Pour 'completed', on ne nettoie PAS ici - on conserve currentOrder jusqu'à ce que le RatingBottomSheet soit fermé
      }

      if (location && location.latitude && location.longitude) {
        set({ driverCoords: { latitude: location.latitude, longitude: location.longitude } });
      }

      if (proof && proof.uploadedAt) {
        // attach proof meta to currentOrder if present
        set((state) => {
          if (!state.currentOrder) return {} as any;
          return { currentOrder: { ...state.currentOrder, proof: { ...state.currentOrder.proof, ...proof } } } as any;
        });
      }
    } catch (err) {
      // swallow errors in sync handler
      console.warn('useOrderStore.updateFromSocket error', err);
    }
  },
  clear: () => set({ 
    currentOrder: null, 
    pendingOrder: null, 
    driverCoords: null,
    deliveryStage: 'idle' // Toujours remettre à idle lors du clear
  }),
}));
