import { create } from 'zustand';
import { logger } from '../utils/logger';

type DeliveryMethod = 'moto' | 'vehicule' | 'cargo';

interface ShipmentState {
  // Données de livraison
  pickupLocation: string;
  deliveryLocation: string;
  selectedMethod: DeliveryMethod;
  
  // Données utilisateur
  userName: string;
  isLoggedIn: boolean;
  
  // Livraison courante
  currentShipment: {
    id: string | null;
    status: 'pending' | 'confirmed' | 'in_progress' | 'delivered';
    estimatedTime: string | null;
  };
  
  // Actions pour modifier les données
  setPickupLocation: (location: string) => void;
  setDeliveryLocation: (location: string) => void;
  setSelectedMethod: (method: DeliveryMethod) => void;
  setUserName: (name: string) => void;
  setLoginStatus: (status: boolean) => void;
  
  // Actions pour la livraison
  createShipment: () => void;
  updateShipmentStatus: (status: 'pending' | 'confirmed' | 'in_progress' | 'delivered') => void;
  resetShipment: () => void;
}

export const useShipmentStore = create<ShipmentState>((set, get) => ({
  // État initial
  pickupLocation: '',
  deliveryLocation: '',
  selectedMethod: 'moto',
  userName: '',
  isLoggedIn: false,
  currentShipment: {
    id: null,
    status: 'pending',
    estimatedTime: null,
  },
  
  // Actions
  setPickupLocation: (location) => set({ pickupLocation: location }),
  setDeliveryLocation: (location) => set({ deliveryLocation: location }),
  setSelectedMethod: (method) => set({ selectedMethod: method }),
  setUserName: (name) => set({ userName: name }),
  setLoginStatus: (status) => set({ isLoggedIn: status }),
  
  // Gestion des livraisons
  createShipment: () => {
    const state = get();
    if (state.pickupLocation && state.deliveryLocation) {
      const newShipment = {
        id: `shipment-${Date.now()}`, // ID unique basé sur le timestamp
        status: 'confirmed' as const,
        estimatedTime: '15-30 min', // Temps estimé basique
      };
      
      logger.info('Shipment created', 'ShipmentStore', {
        shipmentId: newShipment.id,
        pickup: state.pickupLocation,
        delivery: state.deliveryLocation,
        method: state.selectedMethod
      });
      
      set({
        currentShipment: newShipment
      });
    }
  },
  
  updateShipmentStatus: (status) => {
    logger.info('Shipment status updated', 'ShipmentStore', { status });
    set((state) => ({
      currentShipment: {
        ...state.currentShipment,
        status,
      }
    }));
  },
  
  resetShipment: () => set({
    pickupLocation: '',
    deliveryLocation: '',
    selectedMethod: 'moto',
    currentShipment: {
      id: null,
      status: 'pending',
      estimatedTime: null,
    }
  }),
}));