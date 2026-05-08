import { create } from 'zustand';

export interface BatchStop {
  orderId: string;
  position: number;
  recipientName: string;
  phone: string;
  address: string;
  coordinates?: { latitude: number; longitude: number };
  notes?: string;
  status: 'pending' | 'completed' | 'cancelled';
  proofMethod?: 'qr_scan' | 'manual_code' | 'photo_signature' | 'batch_driver_confirmation' | null;
  proofValidatedAt?: string | null;
}

export interface ActiveBatch {
  id: string;
  ordersCount: number;
  stops: BatchStop[];
  partner_id?: string;
  partner_name?: string;
  status?: 'pending' | 'in_progress' | 'completed' | 'partial';
  created_at?: string;
}

export interface BatchOffer {
  batchId: string;
  ordersCount: number;
  partner_id?: string;
  partner_name?: string;
}

interface BatchState {
  activeBatch: ActiveBatch | null;
  pendingOffer: BatchOffer | null;
  offerError: { batchId?: string; message: string } | null;
  isLoading: boolean;
  navigationStopOrderId: string | null;
  setActiveBatch: (batch: ActiveBatch) => void;
  setPendingOffer: (offer: BatchOffer) => void;
  clearPendingOffer: (batchId?: string) => void;
  setOfferError: (error: { batchId?: string; message: string }) => void;
  clearOfferError: () => void;
  updateStop: (
    orderId: string,
    status: 'completed' | 'cancelled',
    proof?: Pick<BatchStop, 'proofMethod' | 'proofValidatedAt'>
  ) => void;
  setNavigationStopOrderId: (orderId: string | null) => void;
  clearBatch: () => void;
  setLoading: (v: boolean) => void;
}

export const useBatchStore = create<BatchState>((set) => ({
  activeBatch: null,
  pendingOffer: null,
  offerError: null,
  isLoading: false,
  navigationStopOrderId: null,

  setActiveBatch: (batch) => set({ activeBatch: batch }),

  setPendingOffer: (offer) => set({ pendingOffer: offer, offerError: null }),

  clearPendingOffer: (batchId) =>
    set((state) => {
      if (batchId && state.pendingOffer?.batchId !== batchId) return state;
      return { pendingOffer: null };
    }),

  setOfferError: (error) => set({ offerError: error, pendingOffer: null }),

  clearOfferError: () => set({ offerError: null }),

  updateStop: (orderId, status, proof) =>
    set((state) => {
      if (!state.activeBatch) return state;
      return {
        activeBatch: {
          ...state.activeBatch,
          stops: state.activeBatch.stops.map((s) =>
            s.orderId === orderId ? { ...s, status, ...(proof ?? {}) } : s
          ),
        },
      };
    }),

  setNavigationStopOrderId: (orderId) => set({ navigationStopOrderId: orderId }),

  clearBatch: () => set({ activeBatch: null, pendingOffer: null, offerError: null, navigationStopOrderId: null }),

  setLoading: (v) => set({ isLoading: v }),
}));
