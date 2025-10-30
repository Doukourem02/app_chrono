import { create } from 'zustand';

interface TempAuthData {
  email: string;
  phoneNumber: string;
  otpMethod: 'email' | 'sms';
  role: 'client' | 'driver' | 'partner';
  setTempData: (email: string, phoneNumber: string, otpMethod?: 'email' | 'sms', role?: 'client' | 'driver' | 'partner') => void;
  clearTempData: () => void;
}

export const useTempAuthStore = create<TempAuthData>((set) => ({
  email: '',
  phoneNumber: '',
  otpMethod: 'email',
  role: 'client',
  setTempData: (email, phoneNumber, otpMethod = 'email', role = 'client') => set({ email, phoneNumber, otpMethod, role }),
  clearTempData: () => set({ email: '', phoneNumber: '', otpMethod: 'email', role: 'client' }),
}));