import { useEffect } from 'react';
import { router } from 'expo-router';
import { View, ActivityIndicator, Text } from 'react-native';
import { useAuthStore } from '../store/useAuthStore';
import { userApiService } from '../services/userApiService';
import { logger } from '../utils/logger';

export default function RootIndex() {
  const { validateUser, logout, hydrateTokens } = useAuthStore();

  useEffect(() => {
    let cancelled = false;

    const checkSession = async () => {
      await hydrateTokens();
      const state = useAuthStore.getState();
      const { isAuthenticated: auth, user: u } = state;

      if (auth && u) {
        let token: string | null = null;
        try {
          token = await userApiService.ensureAccessToken();
        } catch {
          logger.warn('Erreur lors de la vérification du token:', undefined);
        }

        if (cancelled) return;

        // Session incomplète (user en persist mais pas de token) → déconnecter et aller à l'auth
        if (!token) {
          logout();
          router.replace('/(auth)/register' as any);
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

  return (
    <View style={{ 
      flex: 1, 
      backgroundColor: '#FFFFFF',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    }}>
      <ActivityIndicator size="large" color="#8B7CF6" />
      <Text style={{ marginTop: 20, color: '#6B7280', textAlign: 'center' }}>
        Chargement...
      </Text>
    </View>
  );
}
