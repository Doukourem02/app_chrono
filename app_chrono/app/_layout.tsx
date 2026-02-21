import { Stack } from "expo-router";
import { useEffect } from "react";
import { AppState, AppStateStatus, Platform } from "react-native";
import { initSentry } from "../utils/sentry";
import Constants from "expo-constants";
import { ErrorBoundary } from "../components/error/ErrorBoundary";
import { ErrorModalsProvider } from "../components/error/ErrorModalsProvider";
import { soundService } from "../services/soundService";
import { useAuthStore } from "../store/useAuthStore";
import { userApiService } from "../services/userApiService";
import { logger } from "../utils/logger";
import "../config/envCheck";

// Mapbox : initialiser le token au démarrage (iOS/Android uniquement, pas web)
if (Platform.OS !== "web") {
  import("@rnmapbox/maps")
    .then(({ default: Mapbox }) => {
      const token = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN ?? Constants.expoConfig?.extra?.mapboxAccessToken;
      if (token) Mapbox.setAccessToken(token);
    })
    .catch(() => {
      // @rnmapbox/maps non disponible (ex: Expo Go)
    });
}

initSentry();

export default function RootLayout() {
  const { isAuthenticated, user, logout, hydrateTokens } = useAuthStore();

  useEffect(() => {
    // Initialiser le service de son au démarrage
    soundService.initialize().catch((err) => {
      logger.warn('[RootLayout] Erreur initialisation service son:', err);
    });
  }, []);

  useEffect(() => {
    // Charger le refresh token depuis SecureStore avant tout check de session
    hydrateTokens().catch(() => {});
  }, [hydrateTokens]);

  // Vérifier et rafraîchir la session quand l'app revient en arrière-plan
  // Cela évite les problèmes de session expirée après une longue période d'inactivité
  useEffect(() => {
    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active' && isAuthenticated && user) {
        // L'app revient au premier plan, vérifier et rafraîchir le token si nécessaire
        try {
          const token = await userApiService.ensureAccessToken();
          if (!token) {
            // Ne pas déconnecter : null peut être une erreur réseau temporaire.
            // Si la session est vraiment expirée, l'utilisateur aura une erreur à la prochaine action.
            logger.warn('[RootLayout] Impossible de rafraîchir le token (réseau?) - on garde la session');
          }
        } catch (error) {
          logger.warn('[RootLayout] Erreur lors de la vérification du token au retour:', undefined, error);
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, [isAuthenticated, user, logout]);

  return (
    <ErrorBoundary>
      <ErrorModalsProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="summary" />
        </Stack>
      </ErrorModalsProvider>
    </ErrorBoundary>
  );
}
