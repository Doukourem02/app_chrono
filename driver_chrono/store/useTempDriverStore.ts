import { create } from 'zustand';

interface TempDriverData {
  email: string;
  phoneNumber: string;
  otpMethod: 'email' | 'sms';
  role: 'driver';
  isNewUser: boolean;
  setTempData: (email: string, phoneNumber: string, otpMethod?: 'email' | 'sms') => void;
  setIsNewUser: (isNewUser: boolean) => void;
  clearTempData: () => void;
}

export const useTempDriverStore = create<TempDriverData>((set) => ({
  email: '',
  phoneNumber: '',
  otpMethod: 'email',
  role: 'driver', // Toujours driver pour cette app
  isNewUser: true, // Par défaut nouveau
  setTempData: (email, phoneNumber, otpMethod = 'email') => 
    set({ email, phoneNumber, otpMethod }),
  setIsNewUser: (isNewUser) => set({ isNewUser }),
  clearTempData: () => 
    set({ email: '', phoneNumber: '', otpMethod: 'email', isNewUser: true }),
}));