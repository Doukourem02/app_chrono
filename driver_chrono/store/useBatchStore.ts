import { create } from 'zustand';

export interface BatchStop {
  orderId: string;
  position: number;
  recipientName: string;
  phone: string;
  address: string;
  notes?: string;
  status: 'pending' | 'completed' | 'cancelled';
}

export interface ActiveBatch {
  id: string;
  ordersCount: number;
  stops: BatchStop[];
}

interface BatchState {
  activeBatch: ActiveBatch | null;
  isLoading: boolean;
  setActiveBatch: (batch: ActiveBatch) => void;
  updateStop: (orderId: string, status: 'completed' | 'cancelled') => void;
  clearBatch: () => void;
  setLoading: (v: boolean) => void;
}

export const useBatchStore = create<BatchState>((set) => ({
  activeBatch: null,
  isLoading: false,

  setActiveBatch: (batch) => set({ activeBatch: batch }),

  updateStop: (orderId, status) =>
    set((state) => {
      if (!state.activeBatch) return state;
      return {
        activeBatch: {
          ...state.activeBatch,
          stops: state.activeBatch.stops.map((s) =>
            s.orderId === orderId ? { ...s, status } : s
          ),
        },
      };
    }),

  clearBatch: () => set({ activeBatch: null }),

  setLoading: (v) => set({ isLoading: v }),
}));
