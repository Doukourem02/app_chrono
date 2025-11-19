import { create } from 'zustand';
import { logger } from '../utils/logger';

type DeliveryMethod = 'moto' | 'vehicule' | 'cargo';

interface ShipmentState {
  pickupLocation: string;
  deliveryLocation: string;
  selectedMethod: DeliveryMethod;
  
  userName: string;
  isLoggedIn: boolean;
  
  currentShipment: {
    id: string | null;
    status: 'pending' | 'confirmed' | 'in_progress' | 'delivered';
    estimatedTime: string | null;
  };
  
  setPickupLocation: (location: string) => void;
  setDeliveryLocation: (location: string) => void;
  setSelectedMethod: (method: DeliveryMethod) => void;
  setUserName: (name: string) => void;
  setLoginStatus: (status: boolean) => void;
  
  createShipment: () => void;
  updateShipmentStatus: (status: 'pending' | 'confirmed' | 'in_progress' | 'delivered') => void;
  resetShipment: () => void;
}

export const useShipmentStore = create<ShipmentState>((set, get) => ({
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
  
  setPickupLocation: (location) => set({ pickupLocation: location }),
  setDeliveryLocation: (location) => set({ deliveryLocation: location }),
  setSelectedMethod: (method) => set({ selectedMethod: method }),
  setUserName: (name) => set({ userName: name }),
  setLoginStatus: (status) => set({ isLoggedIn: status }),
  
  createShipment: () => {
    const state = get();
    if (state.pickupLocation && state.deliveryLocation) {
      const newShipment = {
        id: `shipment-${Date.now()}`, 
        status: 'confirmed' as const,
        estimatedTime: '15-30 min', 
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