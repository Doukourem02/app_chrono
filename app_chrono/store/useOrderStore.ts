import { create } from 'zustand';
import { soundService } from '../services/soundService';
import { logger } from '../utils/logger';

export type OrderStatus = 'pending' | 'accepted' | 'enroute' | 'in_progress' | 'picked_up' | 'delivering' | 'completed' | 'declined' | 'cancelled';

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
    first_name?: string;
    last_name?: string;
    phone?: string;
    avatar?: string;
    avatar_url?: string;
    profile_image_url?: string;
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
  completed_at?: string;
  cancelled_at?: string;
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
  /** Quand true, afficher le formulaire de création au lieu du suivi (ex: retour depuis Détails de la course) */
  preferCreationForm: boolean;
  
  addOrder: (order: OrderRequest) => void;
  updateOrder: (orderId: string, updates: Partial<OrderRequest>) => void;
  removeOrder: (orderId: string) => void;
  setSelectedOrder: (orderId: string | null) => void;
  setDriverCoordsForOrder: (orderId: string, coords: { latitude: number; longitude: number } | null) => void;
  updateOrderStatus: (orderId: string, status: OrderStatus) => void;
  updateFromSocket: (payload: { order?: Partial<OrderRequest> | null; location?: { latitude?: number; longitude?: number } | null; proof?: any }) => void;
  clear: () => void;
  setPreferCreationForm: (value: boolean) => void;
  
  getCurrentOrder: () => OrderRequest | null;
  getPendingOrder: () => OrderRequest | null;
  getAllPendingOrders: () => OrderRequest[];
  getActiveOrdersCount: () => number;
}

export const useOrderStore = create<OrderStore>((set, get) => ({
  activeOrders: [],
  selectedOrderId: null,
  driverCoords: new Map(),
  preferCreationForm: false,

  addOrder: (order) => set((state) => {
    // Ne pas ajouter les commandes complétées, annulées ou déclinées
    if (order.status === 'completed' || order.status === 'cancelled' || order.status === 'declined') {
      // Si la commande existe déjà et est complétée, la retirer
      const exists = state.activeOrders.some(o => o.id === order.id);
      if (exists) {
        return {
          activeOrders: state.activeOrders.filter(o => o.id !== order.id),
          selectedOrderId: state.selectedOrderId === order.id ? null : state.selectedOrderId,
        };
      }
      return state;
    }

    const exists = state.activeOrders.some(o => o.id === order.id);
    if (exists) {
      return state;
    }
    const newOrders = [...state.activeOrders, order];
    const sel = state.selectedOrderId
      ? state.activeOrders.find((o) => o.id === state.selectedOrderId)
      : null;
    const selFinal =
      sel &&
      (sel.status === 'completed' ||
        sel.status === 'cancelled' ||
        sel.status === 'declined');
    const newSelectedId =
      order.status === 'pending' && (!sel || selFinal)
        ? order.id
        : state.selectedOrderId || order.id;
    return {
      activeOrders: newOrders,
      selectedOrderId: newSelectedId,
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
        logger.warn('⚠️ Tentative de retirer une commande active - ignorée', undefined, { orderId, status: orderToRemove.status });
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
  setPreferCreationForm: (value) => set({ preferCreationForm: value }),

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
    
    // Garder les commandes completed dans le store (notation / suivi) jusqu’à removeOrder / clear.
    if (status === 'cancelled' || status === 'declined') {
      const filteredOrders = updatedOrders.filter((o) => o.id !== orderId);
      let newSelectedId = state.selectedOrderId;
      if (state.selectedOrderId === orderId) {
        newSelectedId = filteredOrders.length > 0 ? filteredOrders[0].id : null;
      }
      return {
        activeOrders: filteredOrders,
        selectedOrderId: newSelectedId,
      };
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
        
        // Log détaillé pour debug
        if (__DEV__) {
          logger.debug('🔄 updateFromSocket appelé', undefined, {
            orderId: order.id,
            newStatus: status,
            existingStatus: existingOrder?.status,
            hasExistingOrder: !!existingOrder,
            orderKeys: Object.keys(order),
          });
        }
        
        if (existingOrder) {
          // Vérifier si le statut a vraiment changé
          if (existingOrder.status === status) {
            // Si le statut n'a pas changé, mettre à jour quand même les autres propriétés
            // MAIS créer un nouvel objet pour forcer le re-render
            set((currentState) => {
              const updatedOrders = currentState.activeOrders.map((o) =>
                o.id === order.id 
                  ? { 
                      ...o, 
                      ...order,
                      status, // Garder le statut actuel
                    }
                  : o
              );
              // Créer un nouveau tableau pour forcer le re-render même si le statut n'a pas changé
              return { activeOrders: [...updatedOrders] };
            });
          } else {
            // Le statut a changé, mettre à jour avec le nouveau statut
            if (__DEV__) {
              logger.debug(`✅ updateFromSocket - Changement de statut détecté: ${existingOrder.status} → ${status}`);
            }
            
            // Jouer le son si la commande est complétée
            if (status === 'completed' && existingOrder.status !== 'completed') {
              soundService.initialize().then(() => {
                soundService.playOrderCompleted();
              }).catch((err) => {
                logger.warn('[useOrderStore] Erreur lecture son:', err);
              });
            }
            
            set((currentState) => {
              const updatedOrders = currentState.activeOrders.map((o) =>
                o.id === order.id 
                  ? { 
                      ...o, 
                      ...order,
                      status, // Nouveau statut - FORCER le statut
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
              
              if (__DEV__) {
                const updatedOrder = updatedOrders.find(o => o.id === order.id);
                logger.debug('✅ updateFromSocket - Commande mise à jour dans le store', undefined, {
                  orderId: order.id,
                  oldStatus: existingOrder?.status,
                  newStatus: status,
                  actualStatusInStore: updatedOrder?.status,
                  willBeRemoved: status === 'completed' || status === 'cancelled' || status === 'declined',
                });
              }
              
              // completed : reste en liste pour UI client (QR, notation) jusqu’à nettoyage explicite.
              if (status === 'cancelled' || status === 'declined') {
                const filteredOrders = updatedOrders.filter((o) => o.id !== order.id);
                let newSelectedId = currentState.selectedOrderId;
                if (currentState.selectedOrderId === order.id) {
                  newSelectedId = filteredOrders.length > 0 ? filteredOrders[0].id : null;
                }
                return {
                  activeOrders: filteredOrders,
                  selectedOrderId: newSelectedId,
                };
              }

              return { activeOrders: [...updatedOrders] };
            });
          }
        } else {
          // Ajouter la nouvelle commande
          // Jouer le son si la commande est complétée
          if (status === 'completed') {
            soundService.initialize().then(() => {
              soundService.playOrderCompleted();
            }).catch((err) => {
              logger.warn('[useOrderStore] Erreur lecture son:', err);
            });
          }
          
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
        
        // Si la commande est dans un état final, elle a déjà été retirée dans le set() ci-dessus
        // Pas besoin de la retirer à nouveau ici
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
      logger.warn('useOrderStore.updateFromSocket error', undefined, err);
    }
  },

  clear: () => set({
    activeOrders: [],
    selectedOrderId: null,
    driverCoords: new Map(),
    preferCreationForm: false,
  }),

  getCurrentOrder: () => {
    const state = get();
    if (state.selectedOrderId) {
      const found = state.activeOrders.find((o) => o.id === state.selectedOrderId);
      if (found) return found;
    }
    const priority: OrderStatus[] = [
      'delivering',
      'picked_up',
      'enroute',
      'accepted',
      'in_progress',
      'pending',
      'completed',
    ];
    for (const st of priority) {
      const o = state.activeOrders.find((x) => x.status === st);
      if (o) return o;
    }
    return state.activeOrders[0] || null;
  },

  getPendingOrder: () => {
    const state = get();
    // Retourner la commande en attente la plus récente
    const pendingOrders = state.activeOrders.filter(o => o.status === 'pending');
    if (pendingOrders.length === 0) return null;
    // Trier par date de création (la plus récente en premier)
    pendingOrders.sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    });
    return pendingOrders[0];
  },

  getAllPendingOrders: () => {
    const state = get();
    return state.activeOrders.filter(o => o.status === 'pending');
  },

  getActiveOrdersCount: () => {
    return get().activeOrders.length;
  },
}));
