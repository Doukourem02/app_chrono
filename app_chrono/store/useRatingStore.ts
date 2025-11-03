import { create } from 'zustand';

interface RatingStore {
  showRatingModal: boolean;
  orderId: string | null;
  driverId: string | null;
  driverName: string | null;
  setRatingModal: (show: boolean, orderId?: string | null, driverId?: string | null, driverName?: string | null) => void;
  resetRatingModal: () => void;
}

export const useRatingStore = create<RatingStore>((set) => ({
  showRatingModal: false,
  orderId: null,
  driverId: null,
  driverName: null,
  setRatingModal: (show, orderId = null, driverId = null, driverName = null) => {
    set({
      showRatingModal: show,
      orderId,
      driverId,
      driverName,
    });
  },
  resetRatingModal: () => {
    set({
      showRatingModal: false,
      orderId: null,
      driverId: null,
      driverName: null,
    });
  },
}));

