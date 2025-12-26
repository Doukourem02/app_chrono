import { create } from 'zustand';

interface TempDriverData {
  email: string;
  phoneNumber: string;
  otpMethod: 'email' | 'sms';
  role: 'driver';
  isNewUser: boolean;
  driverType?: 'partner' | 'internal'; // Type de livreur choisi
  setTempData: (email: string, phoneNumber: string, otpMethod?: 'email' | 'sms') => void;
  setIsNewUser: (isNewUser: boolean) => void;
  setDriverType: (driverType: 'partner' | 'internal') => void;
  clearTempData: () => void;
}

export const useTempDriverStore = create<TempDriverData>((set) => ({
  email: '',
  phoneNumber: '',
  otpMethod: 'email',
  role: 'driver', // Toujours driver pour cette app
  isNewUser: true, // Par défaut nouveau
  driverType: undefined,
  setTempData: (email, phoneNumber, otpMethod = 'email') => 
    set({ email, phoneNumber, otpMethod }),
  setIsNewUser: (isNewUser) => set({ isNewUser }),
  setDriverType: (driverType) => set({ driverType }),
  clearTempData: () => 
    set({ email: '', phoneNumber: '', otpMethod: 'email', isNewUser: true, driverType: undefined }),
}));