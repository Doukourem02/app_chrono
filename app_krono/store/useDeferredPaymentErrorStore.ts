import { create } from 'zustand';
import { DeferredPaymentErrorData } from '../components/error/DeferredPaymentErrorModal';

interface DeferredPaymentErrorState {
  visible: boolean;
  error: DeferredPaymentErrorData | null;
  showError: (error: DeferredPaymentErrorData) => void;
  hideError: () => void;
}

export const useDeferredPaymentErrorStore = create<DeferredPaymentErrorState>((set) => ({
  visible: false,
  error: null,
  showError: (error) => set({ visible: true, error }),
  hideError: () => set({ visible: false, error: null }),
}));

