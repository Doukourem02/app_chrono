import { create } from 'zustand';

export interface BatchStop {
  orderId: string;
  position: number;
  recipientName: string;
  phone: string;
  address: string;
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
  status?: 'pending' | 'in_progress' | 'completed';
  created_at?: string;
}

interface BatchState {
  activeBatch: ActiveBatch | null;
  isLoading: boolean;
  setActiveBatch: (batch: ActiveBatch) => void;
  updateStop: (
    orderId: string,
    status: 'completed' | 'cancelled',
    proof?: Pick<BatchStop, 'proofMethod' | 'proofValidatedAt'>
  ) => void;
  clearBatch: () => void;
  setLoading: (v: boolean) => void;
}

export const useBatchStore = create<BatchState>((set) => ({
  activeBatch: null,
  isLoading: false,

  setActiveBatch: (batch) => set({ activeBatch: batch }),

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

  clearBatch: () => set({ activeBatch: null }),

  setLoading: (v) => set({ isLoading: v }),
}));
