import { create } from 'zustand';
import { persist } from './persist';

export interface UserState {
  // Données utilisateur
  id: string | null;
  name: string;
  email: string;
  phone: string;
  isLoggedIn: boolean;
  
  // Préférences
  preferredLanguage: 'fr' | 'en';
  notifications: boolean;
  
  // Actions
  setUser: (user: Partial<UserState>) => void;
  setLoginStatus: (status: boolean) => void;
  updatePreferences: (preferences: Partial<Pick<UserState, 'preferredLanguage' | 'notifications'>>) => void;
  logout: () => void;
}

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      // État initial
      id: null,
      name: '',
      email: '',
      phone: '',
      isLoggedIn: false,
      preferredLanguage: 'fr',
      notifications: true,
      
      // Actions
      setUser: (user) => set((state) => ({ ...state, ...user })),
      
      setLoginStatus: (status) => set({ isLoggedIn: status }),
      
      updatePreferences: (preferences) => set((state) => ({
        ...state,
        ...preferences
      })),
      
      logout: () => set({
        id: null,
        name: '',
        email: '',
        phone: '',
        isLoggedIn: false,
      }),
    }),
    {
      name: 'user-storage',
      version: 1,
      partialize: (state) => ({
        id: state.id,
        name: state.name,
        email: state.email,
        phone: state.phone,
        isLoggedIn: state.isLoggedIn,
        preferredLanguage: state.preferredLanguage,
        notifications: state.notifications,
      }),
    }
  )
);