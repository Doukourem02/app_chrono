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

  // Rafraîchir la session quand l'app revient au premier plan
  useEffect(() => {
    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active' && isAuthenticated && user) {
        try {
          const token = await userApiService.ensureAccessToken();
          if (!token) {
            logger.warn('[RootLayout] Impossible de rafraîchir le token (réseau?) - on garde la session');
          }
        } catch (error) {
          logger.warn('[RootLayout] Erreur lors de la vérification du token au retour:', undefined, error);
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [isAuthenticated, user, logout]);

  // Rafraîchissement proactif du token toutes les 10 min quand l'app est active
  // Évite les déconnexions après inactivité prolongée (écran allumé sans interaction)
  useEffect(() => {
    if (!isAuthenticated || !user) return;

    const REFRESH_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
    const intervalId = setInterval(async () => {
      const appState = AppState.currentState;
      if (appState !== 'active') return; // Ne pas rafraîchir en arrière-plan
      try {
        await userApiService.ensureAccessToken();
      } catch {
        // Silencieux - la prochaine action déclenchera un refresh
      }
    }, REFRESH_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [isAuthenticated, user]);

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
