import { create } from 'zustand';
import { ErrorModalData } from '../components/error/ErrorModal';

interface ErrorModalState {
  visible: boolean;
  error: ErrorModalData | null;
  showError: (error: ErrorModalData) => void;
  hideError: () => void;
}

export const useErrorModalStore = create<ErrorModalState>((set) => ({
  visible: false,
  error: null,
  showError: (error) => set({ visible: true, error }),
  hideError: () => set({ visible: false, error: null }),
}));

