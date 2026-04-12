import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type SavedClientAddress = {
  id: string;
  label: string;
  addressLine: string;
  latitude: number;
  longitude: number;
  createdAt: number;
};

function genId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

interface SavedAddressesState {
  addresses: SavedClientAddress[];
  defaultAddressId: string | null;
  addAddress: (entry: {
    label: string;
    addressLine: string;
    latitude: number;
    longitude: number;
  }) => void;
  removeAddress: (id: string) => void;
  setDefaultAddress: (id: string | null) => void;
}

export const useSavedAddressesStore = create<SavedAddressesState>()(
  persist(
    (set) => ({
      addresses: [],
      defaultAddressId: null,
      addAddress: (entry) => {
        const row: SavedClientAddress = {
          ...entry,
          id: genId(),
          createdAt: Date.now(),
        };
        set((s) => ({ addresses: [...s.addresses, row] }));
      },
      removeAddress: (id) =>
        set((s) => ({
          addresses: s.addresses.filter((a) => a.id !== id),
          defaultAddressId: s.defaultAddressId === id ? null : s.defaultAddressId,
        })),
      setDefaultAddress: (id) => set({ defaultAddressId: id }),
    }),
    {
      name: 'krono-client-saved-addresses',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        addresses: s.addresses,
        defaultAddressId: s.defaultAddressId,
      }),
    }
  )
);
