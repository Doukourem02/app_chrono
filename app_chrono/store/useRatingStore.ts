import { create } from 'zustand';

interface RatingStore {
  showRatingBottomSheet: boolean;
  orderId: string | null;
  driverId: string | null;
  driverName: string | null;
  setRatingBottomSheet: (show: boolean, orderId?: string | null, driverId?: string | null, driverName?: string | null) => void;
  resetRatingBottomSheet: () => void;
}

export const useRatingStore = create<RatingStore>((set) => ({
  showRatingBottomSheet: false,
  orderId: null,
  driverId: null,
  driverName: null,
  setRatingBottomSheet: (show, orderId = null, driverId = null, driverName = null) => {
    set({
      showRatingBottomSheet: show,
      orderId,
      driverId,
      driverName,
    });
  },
  resetRatingBottomSheet: () => {
    set({
      showRatingBottomSheet: false,
      orderId: null,
      driverId: null,
      driverName: null,
    });
  },
}));

