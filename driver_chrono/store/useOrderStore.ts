import { create } from 'zustand';
import { mapAdminOrderFlags } from '../utils/mapAdminOrderFlags';

/** Notes opérateur : racine API (`driver_notes`) ou champ persisté dans `dropoff.details` après resync DB. */
function resolveDriverNotes(order: Record<string, unknown> | null | undefined): string | undefined {
  if (!order || typeof order !== 'object') return undefined;
  const root = order.driver_notes ?? order.driverNotes;
  if (typeof root === 'string' && root.trim()) return root.trim();
  const drop = order.dropoff as Record<string, unknown> | undefined;
  const details = drop?.details as Record<string, unknown> | undefined;
  const fromDetails = details?.driver_notes;
  if (typeof fromDetails === 'string' && fromDetails.trim()) return fromDetails.trim();
  return undefined;
}

/** Client : express | standard | scheduled — racine ou `dropoff.details.speed_option_id`. */
function resolveSpeedOptionId(order: Record<string, unknown> | null | undefined): string | undefined {
  if (!order || typeof order !== 'object') return undefined;
  const root = order.speedOptionId ?? order.speed_option_id;
  if (typeof root === 'string' && root.trim()) return root.trim();
  const drop = order.dropoff as Record<string, unknown> | undefined;
  const details = drop?.details as Record<string, unknown> | undefined;
  const sid = details?.speed_option_id ?? details?.speedOptionId;
  if (typeof sid === 'string' && sid.trim()) return sid.trim();
  return undefined;
}

/** Formulaire admin « Notes (optionnel) » — racine ou `dropoff.details.operator_course_notes` (persisté DB). */
function resolveOperatorCourseNotes(order: Record<string, unknown> | null | undefined): string | undefined {
  if (!order || typeof order !== 'object') return undefined;
  const root = order.notes;
  if (typeof root === 'string' && root.trim()) return root.trim();
  const drop = order.dropoff as Record<string, unknown> | undefined;
  const details = drop?.details as Record<string, unknown> | undefined;
  const fromDetails = details?.operator_course_notes;
  if (typeof fromDetails === 'string' && fromDetails.trim()) return fromDetails.trim();
  return undefined;
}

const upsertOrderById = (orders: OrderRequest[], order: OrderRequest): OrderRequest[] => {
  const existingIndex = orders.findIndex((o) => o.id === order.id);
  if (existingIndex === -1) {
    return [...orders, order];
  }

  const nextOrders = [...orders];
  nextOrders[existingIndex] = { ...nextOrders[existingIndex], ...order };
  return nextOrders;
};

export type OrderStatus = 'pending' | 'accepted' | 'declined' | 'in_progress' | 'enroute' | 'picked_up' | 'delivering' | 'completed' | 'cancelled';

export interface OrderRequest {
  id: string;
  user: {
    id: string;
    name: string;
    first_name?: string | null;
    last_name?: string | null;
    avatar?: string;
    rating: number;
    phone?: string;
  };
  pickup: {
    address: string;
    coordinates?: { latitude: number; longitude: number };
    /** Saisie admin : zone commune pour matching sans GPS précis */
    approximate_pickup_zone?: string;
    approximate_pickup_zone_label?: string;
    pickup_coordinates_are_approximate?: boolean;
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
      /** Options client (ex. livraison programmée) — même schéma que la commande en base */
      thermal_bag?: boolean;
      courier_note?: string;
      /** Saisie admin — notes pour le livreur (persistées dans le JSON dropoff). */
      driver_notes?: string;
      /** Saisie admin — champ « Notes (optionnel) » sur la course. */
      operator_course_notes?: string;
      /** Créneau livraison programmée (texte libre client). */
      scheduled_window_note?: string;
      recipient_message?: string;
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
  /** Cible de l’offre en cours (socket) avant acceptation — resync / popup */
  offeredDriverId?: string;
  createdAt: Date;
  acceptedAt?: Date;
  completedAt?: Date;
  notes?: string;
  /** Option tarifaire client (express | standard | scheduled | …). */
  speedOptionId?: string;
  /** Notes générales saisies par l’opérateur (formulaire « Notes (optionnel) ») — affichées au livreur. */
  operatorCourseNotes?: string;
  /** Case admin « téléphone / hors-ligne » (coords souvent approximatives) — pas toutes les commandes admin */
  isPhoneOrder?: boolean;
  /** Toute commande créée via l’admin — badge informatif ; navigation = identique au client si GPS OK */
  placedByAdmin?: boolean;
  isB2BOrder?: boolean;
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
    // Une commande ne peut pas être à la fois en attente et active (sinon doublon dans « Mes commandes »).
    const pendingWithoutThis = state.pendingOrders.filter((o) => o.id !== order.id);

    // Normaliser le statut pour la comparaison (insensible à la casse)
    const normalizedStatus = String(order.status || '').toLowerCase();
    
    // Ne pas ajouter les commandes complétées, annulées ou déclinées
    if (normalizedStatus === 'completed' || normalizedStatus === 'cancelled' || normalizedStatus === 'declined') {
      // Si la commande existe déjà et est complétée, la retirer immédiatement
      const exists = state.activeOrders.some(o => o.id === order.id);
      if (exists) {
        // Logger seulement en mode dev pour éviter les logs en production
        if (__DEV__) {
          console.log(`[useOrderStore] Commande ${order.id.slice(0, 8)}... complétée/annulée retirée de activeOrders`, { status: order.status });
        }
        return {
          activeOrders: state.activeOrders.filter(o => o.id !== order.id),
          pendingOrders: pendingWithoutThis,
          selectedOrderId: state.selectedOrderId === order.id ? null : state.selectedOrderId,
        };
      }
      // Si elle n'existe pas, ne rien faire (ne pas l'ajouter)
      // Logger seulement en mode dev pour éviter les logs en production
      if (__DEV__) {
        console.log(`[useOrderStore] Tentative d'ajout d'une commande complétée/annulée ignorée`, { orderId: order.id, status: order.status });
      }
      return { ...state, pendingOrders: pendingWithoutThis };
    }

    const exists = state.activeOrders.some(o => o.id === order.id);

    const raw = order as unknown as Record<string, unknown>;
    const flags = mapAdminOrderFlags(raw);
    const mappedOrder: OrderRequest = {
      ...order,
      ...flags,
      driverNotes: resolveDriverNotes(raw),
      operatorCourseNotes: resolveOperatorCourseNotes(raw),
      speedOptionId: resolveSpeedOptionId(raw),
    };

    if (exists) {
      // Si la commande existe déjà, la mettre à jour plutôt que de la dupliquer
      const updatedActive = state.activeOrders.map(o =>
        o.id === order.id ? { ...o, ...mappedOrder } : o
      );
      return {
        activeOrders: updatedActive,
        pendingOrders: pendingWithoutThis,
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
      pendingOrders: pendingWithoutThis,
      selectedOrderId: shouldSelectNewOrder ? mappedOrder.id : state.selectedOrderId,
    };
  }),

  addPendingOrder: (order) => set((state) => {
    if (state.activeOrders.some((o) => o.id === order.id)) {
      return state;
    }
    const exists = state.pendingOrders.some(o => o.id === order.id);
    if (exists) return state;
    
    const raw = order as unknown as Record<string, unknown>;
    const flags = mapAdminOrderFlags(raw);
    const mappedOrder: OrderRequest = {
      ...order,
      ...flags,
      driverNotes: resolveDriverNotes(raw),
      operatorCourseNotes: resolveOperatorCourseNotes(raw),
      speedOptionId: resolveSpeedOptionId(raw),
    };

    return {
      pendingOrders: [...state.pendingOrders, mappedOrder],
    };
  }),

  updateOrder: (orderId, updates) => set((state) => {
    const applyPatch = (o: OrderRequest): OrderRequest => {
      const merged = { ...o, ...updates } as OrderRequest;
      const flags = mapAdminOrderFlags(merged as unknown as Record<string, unknown>);
      const raw = merged as unknown as Record<string, unknown>;
      const dn = resolveDriverNotes(raw);
      const oc = resolveOperatorCourseNotes(raw);
      const sp = resolveSpeedOptionId(raw);
      return {
        ...merged,
        ...flags,
        ...(dn !== undefined ? { driverNotes: dn } : {}),
        ...(oc !== undefined ? { operatorCourseNotes: oc } : {}),
        ...(sp !== undefined ? { speedOptionId: sp } : {}),
      };
    };
    const updatedActive = state.activeOrders.map((order) =>
      order.id === orderId ? applyPatch(order) : order
    );
    const updatedPending = state.pendingOrders.map((order) =>
      order.id === orderId ? applyPatch(order) : order
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
        activeOrders: upsertOrderById(state.activeOrders, acceptedOrder),
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
        activeOrders: upsertOrderById(state.activeOrders, newAcceptedOrder),
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
    const updatedHistory = state.orderHistory.map(order =>
      order.id === orderId ? { ...order, status: 'cancelled' as OrderStatus } : order
    );

    // Retirer la commande annulée de partout - ne plus l'afficher au livreur
    return {
      activeOrders: state.activeOrders.filter(o => o.id !== orderId),
      pendingOrders: state.pendingOrders.filter(o => o.id !== orderId),
      selectedOrderId: state.selectedOrderId === orderId ? null : state.selectedOrderId,
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