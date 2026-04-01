import { create } from 'zustand';

interface TempDriverData {
  email: string;
  phoneNumber: string;
  otpMethod: 'sms' | 'whatsapp';
  role: 'driver';
  isNewUser: boolean;
  driverType?: 'partner' | 'internal';
  setTempData: (email: string, phoneNumber: string, otpMethod?: 'sms' | 'whatsapp') => void;
  setIsNewUser: (isNewUser: boolean) => void;
  setDriverType: (driverType: 'partner' | 'internal') => void;
  clearTempData: () => void;
}

export const useTempDriverStore = create<TempDriverData>((set) => ({
  email: '',
  phoneNumber: '',
  otpMethod: 'sms',
  role: 'driver',
  isNewUser: true,
  driverType: undefined,
  setTempData: (email, phoneNumber, otpMethod = 'sms') =>
    set({ email, phoneNumber, otpMethod }),
  setIsNewUser: (isNewUser) => set({ isNewUser }),
  setDriverType: (driverType) => set({ driverType }),
  clearTempData: () =>
    set({
      email: '',
      phoneNumber: '',
      otpMethod: 'sms',
      isNewUser: true,
      driverType: undefined,
    }),
}));
