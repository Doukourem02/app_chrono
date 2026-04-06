import { Stack } from "expo-router";
import { useEffect } from "react";
import { AppState, AppStateStatus, LogBox, Platform, View } from "react-native";
import Constants from "expo-constants";
import { useDriverStore } from "../store/useDriverStore";
import { initSentry } from "../utils/sentry";
import { ErrorBoundary } from "../components/error/ErrorBoundary";
import { ErrorModalsProvider } from "../components/error/ErrorModalsProvider";
import { OfflineBanner } from "../components/OfflineBanner";
import { soundService } from "../services/soundService";
import { apiService } from "../services/apiService";
import { orderSocketService } from "../services/orderSocketService";
import { driverMessageSocketService } from "../services/driverMessageSocketService";
import "../config/envCheck";
import { logger } from "../utils/logger";

// Mapbox : initialiser le token au démarrage (iOS/Android uniquement, pas web)
if (Platform.OS !== "web") {
  import("@rnmapbox/maps")
    .then(({ default: Mapbox }) => {
      const token =
        process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN ??
        Constants.expoConfig?.extra?.mapboxAccessToken ??
        process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
      if (token) Mapbox.setAccessToken(token);
    })
    .catch(() => {
      // @rnmapbox/maps non disponible (ex: Expo Go)
    });
}

//  SENTRY: Initialiser le monitoring d'erreurs
initSentry();

export default function RootLayout() {
  const { isAuthenticated, user, logout, hydrateTokens } = useDriverStore();

  useEffect(() => {
    if (__DEV__) {
      LogBox.ignoreLogs([
        "[ErrorFormatter]",
        "Erreur technique",
        "[driver_chrono] Erreur lors de la vérification",
      ]);
    }
  }, []);

  // Charger le refresh token depuis SecureStore avant tout check de session (comme app_chrono)
  useEffect(() => {
    hydrateTokens().catch(() => {});
  }, [hydrateTokens]);

  // Rafraîchir la session quand l'app revient au premier plan
  useEffect(() => {
    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active' && isAuthenticated && user) {
        try {
          const tokenResult = await apiService.ensureAccessToken();
          if (!tokenResult.token) {
            logger.warn('[RootLayout] Impossible de rafraîchir le token (réseau?) - on garde la session');
          } else {
            const online = useDriverStore.getState().isOnline;
            orderSocketService.syncAfterAccessTokenRefresh(user.id, online);
            driverMessageSocketService.syncAfterAccessTokenRefresh(user.id);
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
  useEffect(() => {
    if (!isAuthenticated || !user) return;

    const REFRESH_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
    const intervalId = setInterval(async () => {
      if (AppState.currentState !== 'active') return;
      try {
        const tokenResult = await apiService.ensureAccessToken();
        if (tokenResult.token && user?.id) {
          const online = useDriverStore.getState().isOnline;
          orderSocketService.syncAfterAccessTokenRefresh(user.id, online);
          driverMessageSocketService.syncAfterAccessTokenRefresh(user.id);
        }
      } catch {
        // Silencieux - la prochaine action déclenchera un refresh
      }
    }, REFRESH_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [isAuthenticated, user]);

  useEffect(() => {
    // Initialiser le service de son au démarrage
    soundService.initialize().catch((err) => {
      logger.warn('[RootLayout] Erreur initialisation service son:', undefined, err);
    });
  }, []);

  return (
    <ErrorBoundary>
      <ErrorModalsProvider>
        <View style={{ flex: 1 }}>
          <OfflineBanner />
          <View style={{ flex: 1 }}>
            <Stack
              screenOptions={{
                headerShown: false,
              }}
            />
          </View>
        </View>
      </ErrorModalsProvider>
    </ErrorBoundary>
  );
}
