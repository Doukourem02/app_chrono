import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearSecureTokens, getRefreshToken, setRefreshToken } from '../utils/secureTokenStorage';

interface User {
  id: string;
  email: string;
  phone: string;
  isVerified: boolean;
  first_name?: string | null;
  last_name?: string | null;
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
  setTokensAndWait: (tokens: { accessToken: string | null; refreshToken: string | null }) => Promise<void>;
  hydrateTokens: () => Promise<void>;
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
        clearSecureTokens().catch(() => {});
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
        // Stocker le refresh token de façon chiffrée (Keychain/Keystore)
        setRefreshToken(refreshToken ?? null).catch(() => {});
        set({
          accessToken: accessToken ?? null,
          refreshToken: refreshToken ?? null,
        });
      },

      /** Sauvegarde les tokens et attend que le refreshToken soit bien écrit en SecureStore avant de continuer */
      setTokensAndWait: async ({ accessToken, refreshToken }) => {
        await setRefreshToken(refreshToken ?? null);
        set({
          accessToken: accessToken ?? null,
          refreshToken: refreshToken ?? null,
        });
      },

      hydrateTokens: async () => {
        // Charger le refresh token depuis SecureStore (évite AsyncStorage non chiffré)
        const rt = await getRefreshToken();
        if (rt) {
          set({ refreshToken: rt });
        } else {
          // ne rien faire: on reste en état "non authentifié" si aucune session valide
        }
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
      // Persister l'identité + refreshToken pour survivre au hot reload (SecureStore peut être vide)
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        refreshToken: state.refreshToken,
      }),
    }
  )
);