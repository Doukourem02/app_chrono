import { create } from 'zustand';

export interface BatchRecipient {
  id: string;
  name: string;
  phone: string;
  address: string;
  notes?: string;
}

interface BusinessState {
  // Mode actuel : 'client' ou 'business'
  mode: 'client' | 'business';

  // Données de la tournée en cours de création
  batchPickupAddress: string;
  batchPickupCoords: { lat: number; lng: number } | null;
  batchRecipients: BatchRecipient[];
  batchDriverId: string | null;
  // Ordre optimisé (indices des destinataires) retourné par le backend
  batchOptimizedOrder: number[] | null;

  // Actions
  setMode: (mode: 'client' | 'business') => void;
  setBatchPickup: (address: string, coords?: { lat: number; lng: number }) => void;
  addRecipient: (r: Omit<BatchRecipient, 'id'>) => void;
  updateRecipient: (id: string, data: Partial<Omit<BatchRecipient, 'id'>>) => void;
  removeRecipient: (id: string) => void;
  setBatchDriver: (driverId: string | null) => void;
  setOptimizedOrder: (order: number[]) => void;
  resetBatch: () => void;
}

export const useBusinessStore = create<BusinessState>((set) => ({
  mode: 'client',
  batchPickupAddress: '',
  batchPickupCoords: null,
  batchRecipients: [],
  batchDriverId: null,
  batchOptimizedOrder: null,

  setMode: (mode) => set({ mode }),

  setBatchPickup: (address, coords) =>
    set({ batchPickupAddress: address, batchPickupCoords: coords ?? null }),

  addRecipient: (r) =>
    set((state) => ({
      batchRecipients: [
        ...state.batchRecipients,
        { ...r, id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}` },
      ],
    })),

  updateRecipient: (id, data) =>
    set((state) => ({
      batchRecipients: state.batchRecipients.map((r) =>
        r.id === id ? { ...r, ...data } : r
      ),
    })),

  removeRecipient: (id) =>
    set((state) => ({
      batchRecipients: state.batchRecipients.filter((r) => r.id !== id),
    })),

  setBatchDriver: (driverId) => set({ batchDriverId: driverId }),

  setOptimizedOrder: (order) => set({ batchOptimizedOrder: order }),

  resetBatch: () =>
    set({
      batchPickupAddress: '',
      batchPickupCoords: null,
      batchRecipients: [],
      batchDriverId: null,
      batchOptimizedOrder: null,
    }),
}));
