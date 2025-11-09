import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface User {
  id: string;
  email: string;
  phone: string;
  isVerified: boolean;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  accessToken: string | null;
  refreshToken: string | null;
  
  // Actions
  setUser: (user: User) => void;
  logout: () => void;
  setLoading: (loading: boolean) => void;
  setTokens: (tokens: { accessToken: string | null; refreshToken: string | null }) => void;
  validateUser: () => Promise<boolean | 'not_found' | null>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      accessToken: null,
      refreshToken: null,
      
      setUser: (user) => {
        set({ 
          user, 
          isAuthenticated: true,
          isLoading: false 
        });
      },
      
      logout: () => {
        set({ 
          user: null, 
          isAuthenticated: false,
          isLoading: false,
          accessToken: null,
          refreshToken: null,
        });
      },
      
      setLoading: (loading) => set({ isLoading: loading }),

      setTokens: ({ accessToken, refreshToken }) => {
        set({
          accessToken: accessToken ?? null,
          refreshToken: refreshToken ?? null,
        });
      },

      validateUser: async () => {
        const { user } = get();
        if (!user?.email) {
          return false;
        }

        try {
          const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/auth-simple/check/${encodeURIComponent(user.email)}`);
          const data = await response.json();

          if (!response.ok) {
            return null;
          }

          if (data?.success && data?.user) {
            return true;
          }

          return 'not_found';
        } catch {
          // Ignorer les erreurs de validation
          return null;
        }
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);