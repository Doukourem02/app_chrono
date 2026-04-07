import { useEffect } from 'react';
import { router } from 'expo-router';
import { View } from 'react-native';
import { useAuthStore } from '../store/useAuthStore';
import { userApiService } from '../services/userApiService';
import { logger } from '../utils/logger';
import { tryRestoreAuthSessionFromRefresh } from '../utils/restoreAuthSession';

export default function RootIndex() {
  const { validateUser, logout, hydrateTokens } = useAuthStore();

  useEffect(() => {
    let cancelled = false;

    const checkSession = async () => {
      await hydrateTokens();
      let state = useAuthStore.getState();
      let { isAuthenticated: auth, user: u } = state;

      // Refresh en SecureStore mais user pas encore/chargé depuis AsyncStorage → restaurer via API
      if ((!auth || !u) && state.refreshToken) {
        await tryRestoreAuthSessionFromRefresh();
        state = useAuthStore.getState();
        auth = state.isAuthenticated;
        u = state.user;
      }

      if (auth && u) {
        let token: string | null = null;
        try {
          token = await userApiService.ensureAccessToken();
        } catch {
          logger.warn('Erreur lors de la vérification du token:', undefined);
        }

        if (cancelled) return;

        // Pas d'access token : ne pas déconnecter si un refresh existe encore (réseau lent / API
        // temporairement injoignable — ensureAccessToken évite déjà le logout dans ce cas).
        if (!token) {
          const { refreshToken: rt } = useAuthStore.getState();
          if (rt) {
            router.replace('/(tabs)' as any);
            return;
          }
          logout();
          router.replace('/(auth)' as any);
          return;
        }

        const validationResult = await validateUser();

        if (cancelled) return;

        if (validationResult === true || validationResult === null || validationResult === 'not_found') {
          router.replace('/(tabs)' as any);
        } else {
          logout();
          router.replace('/(tabs)' as any);
        }
      } else {
        router.replace('/(tabs)' as any);
      }
    };

    const runCheck = () => {
      if (cancelled) return;
      checkSession().catch(() => {
        if (!cancelled) router.replace('/(tabs)' as any);
      });
    };

    // Attendre que le persist Zustand ait rechargé user/isAuthenticated
    const unsub = useAuthStore.persist.onFinishHydration(runCheck);
    if (useAuthStore.persist.hasHydrated()) {
      runCheck();
    }
    const fallback = setTimeout(runCheck, 2500);

    return () => {
      cancelled = true;
      unsub?.();
      clearTimeout(fallback);
    };
  }, [validateUser, logout, hydrateTokens]);

  // Pas d’écran « Chargement » : fond neutre le temps que la session soit résolue puis router.replace
  return <View style={{ flex: 1, backgroundColor: '#FFFFFF' }} />;
}
