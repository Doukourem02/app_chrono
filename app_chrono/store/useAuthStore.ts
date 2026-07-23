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
  // Champs B2B
  is_business?: boolean;
  partner_id?: string | null;
  company_name?: string | null;
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
  validateUser: () => Promise<boolean | null>;
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
        void (async () => {
          try {
            const { syncOrderLiveActivity } = await import("../services/orderLiveActivity");
            await syncOrderLiveActivity(null, { immediateEnd: true });
          } catch {
            /* non bloquant */
          }
          try {
            const m = await import('../services/clientPushService');
            await m.unregisterClientPushNotifications();
          } catch {
            /* non bloquant */
          }
          try {
            await clearSecureTokens();
          } catch {
            /* ignore */
          }
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            accessToken: null,
            refreshToken: null,
          });
        })();
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
        const { user, accessToken } = get();
        if (!user?.id && !user?.email?.trim()) {
          return null;
        }

        const base = process.env.EXPO_PUBLIC_API_URL;
        const url = user?.id
          ? `${base}/api/auth-simple/check-by-id/${encodeURIComponent(user.id)}`
          : `${base}/api/auth-simple/check/${encodeURIComponent(user.email!.trim())}`;

        try {
          const response = await fetch(url, {
            headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
          });
          const data = await response.json();

          if (!response.ok) {
            // Token invalide/expiré ou erreur serveur : on ne peut pas conclure, on garde la session.
            return null;
          }

          if (data?.success && data?.user) {
            // Sync les champs B2B depuis la base (évite le re-login après que l'admin ait lié un partenaire)
            const remote = data.user as { partner_id?: string | null; is_business?: boolean; company_name?: string | null };
            const current = get().user;
            if (current && (
              remote.partner_id !== current.partner_id ||
              remote.is_business !== current.is_business ||
              remote.company_name !== current.company_name
            )) {
              set({ user: { ...current, partner_id: remote.partner_id ?? null, is_business: remote.is_business ?? current.is_business, company_name: remote.company_name ?? current.company_name } });
            }
            return true;
          }

          // Réponse OK mais utilisateur introuvable en base : compte supprimé côté backend.
          return false;
        } catch {
          // Ignorer les erreurs de validation
          return null;
        }
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => AsyncStorage),
      // Persister uniquement l'identité — le refreshToken vit exclusivement en SecureStore
      // (Keychain/Keystore chiffré), rechargé au démarrage via hydrateTokens(). Ne jamais
      // dupliquer un credential longue durée en clair dans AsyncStorage.
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);