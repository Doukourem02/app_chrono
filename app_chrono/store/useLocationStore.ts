import { create } from 'zustand';
import { persist } from './persist';

export interface Location {
  latitude: number;
  longitude: number;
  address?: string;
}

export interface LocationState {
  currentLocation: Location | null;
  locationPermission: 'granted' | 'denied' | 'pending';
  
  recentPickupLocations: string[];
  recentDeliveryLocations: string[];
  favoriteLocations: {
    id: string;
    name: string;
    address: string;
    coordinates: Location;
  }[];
  
  setCurrentLocation: (location: Location) => void;
  setLocationPermission: (permission: 'granted' | 'denied' | 'pending') => void;
  addRecentPickup: (address: string) => void;
  addRecentDelivery: (address: string) => void;
  addFavoriteLocation: (location: { name: string; address: string; coordinates: Location }) => void;
  removeFavoriteLocation: (id: string) => void;
  clearRecentLocations: () => void;
}

export const useLocationStore = create<LocationState>()(
  persist(
    (set, get) => ({
      currentLocation: null,
      locationPermission: 'pending',
      recentPickupLocations: [],
      recentDeliveryLocations: [],
      favoriteLocations: [],
      
      setCurrentLocation: (location) => set({ currentLocation: location }),
      
      setLocationPermission: (permission) => set({ locationPermission: permission }),
      
      addRecentPickup: (address) => set((state) => ({
        recentPickupLocations: [
          address,
          ...state.recentPickupLocations.filter(addr => addr !== address)
        ].slice(0, 10) 
      })),
      
      addRecentDelivery: (address) => set((state) => ({
        recentDeliveryLocations: [
          address,
          ...state.recentDeliveryLocations.filter(addr => addr !== address)
        ].slice(0, 10) 
      })),
      
      addFavoriteLocation: (location) => set((state) => ({
        favoriteLocations: [
          ...state.favoriteLocations,
          {
            ...location,
            id: Date.now().toString(),
          }
        ]
      })),
      
      removeFavoriteLocation: (id) => set((state) => ({
        favoriteLocations: state.favoriteLocations.filter(loc => loc.id !== id)
      })),
      
      clearRecentLocations: () => set({
        recentPickupLocations: [],
        recentDeliveryLocations: [],
      }),
    }),
    {
      name: 'location-storage',
      version: 1,
      partialize: (state) => ({
        recentPickupLocations: state.recentPickupLocations,
        recentDeliveryLocations: state.recentDeliveryLocations,
        favoriteLocations: state.favoriteLocations,
        locationPermission: state.locationPermission,
      }),
    }
  )
);