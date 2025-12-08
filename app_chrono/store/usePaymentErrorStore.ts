import { create } from 'zustand';

interface PaymentErrorState {
  visible: boolean;
  title: string | null;
  message: string | null;
  errorCode: string | null;

  showError: (title: string, message: string, errorCode?: string) => void;
  hideError: () => void;
}

export const usePaymentErrorStore = create<PaymentErrorState>((set) => ({
  visible: false,
  title: null,
  message: null,
  errorCode: null,

  showError: (title, message, errorCode) =>
    set({
      visible: true,
      title,
      message,
      errorCode: errorCode || null,
    }),

  hideError: () =>
    set({
      visible: false,
      title: null,
      message: null,
      errorCode: null,
    }),
}));

