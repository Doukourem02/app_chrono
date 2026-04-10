import { Stack } from "expo-router";
import { getNetworkStateAsync, useNetworkState } from "expo-network";
import { useEffect, useRef } from "react";
import { AppState, AppStateStatus, LogBox, View } from "react-native";
import { useDriverStore } from "../store/useDriverStore";
import { useOrderStore } from "../store/useOrderStore";
import {
  startDriverBackgroundLocation,
  stopDriverBackgroundLocation,
} from "../services/driverBackgroundLocation"; // side-effect: enregistre TaskManager.defineTask
import { initSentry } from "../utils/sentry";
import { ErrorBoundary } from "../components/error/ErrorBoundary";
import { ErrorModalsProvider } from "../components/error/ErrorModalsProvider";
import { OfflineBanner } from "../components/OfflineBanner";
import { RealtimeDegradedBanner } from "../components/RealtimeDegradedBanner";
import { soundService } from "../services/soundService";
import { apiService } from "../services/apiService";
import { orderSocketService } from "../services/orderSocketService";
import { driverMessageSocketService } from "../services/driverMessageSocketService";
import { runDriverAppResync } from "../services/driverAppResync";
import "../config/envCheck";
import "../mapboxInit";
import { isNetworkOffline } from "../utils/isNetworkOffline";
import { logger } from "../utils/logger";

//  SENTRY: Initialiser le monitoring d'erreurs
initSentry();

export default function RootLayout() {
  const { isAuthenticated, user, hydrateTokens } = useDriverStore();
  const network = useNetworkState();
  const prevNetworkOfflineRef = useRef<boolean | null>(null);

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

  useEffect(() => {
    if (!isAuthenticated || !user?.id) {
      prevNetworkOfflineRef.current = null;
      return;
    }
    const offline = isNetworkOffline(network);
    if (prevNetworkOfflineRef.current === null) {
      prevNetworkOfflineRef.current = offline;
      return;
    }
    if (prevNetworkOfflineRef.current && !offline) {
      void runDriverAppResync(user.id);
    }
    prevNetworkOfflineRef.current = offline;
  }, [network, isAuthenticated, user?.id]);

  // Rafraîchir la session + resync profil / commandes quand l'app revient au premier plan
  useEffect(() => {
    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      if (nextAppState === "background") {
        const uid = useDriverStore.getState().user?.id;
        if (!uid || !isAuthenticated) return;
        const online = useDriverStore.getState().isOnline;
        const hasActiveDelivery = useOrderStore.getState().activeOrders.some((o) => {
          const s = String(o.status || "").toLowerCase();
          return s !== "completed" && s !== "cancelled" && s !== "declined";
        });
        if (online || hasActiveDelivery) {
          void startDriverBackgroundLocation(uid);
        }
        return;
      }

      if (nextAppState === "active") {
        void stopDriverBackgroundLocation();
      }

      if (nextAppState !== "active" || !isAuthenticated || !user?.id) return;
      try {
        const net = await getNetworkStateAsync();
        if (isNetworkOffline(net)) return;
        await runDriverAppResync(user.id);
      } catch (error) {
        logger.warn("[RootLayout] Resync au retour premier plan:", undefined, error);
      }
    };

    const subscription = AppState.addEventListener("change", handleAppStateChange);
    return () => subscription.remove();
  }, [isAuthenticated, user?.id]);

  useEffect(() => {
    if (!isAuthenticated) {
      void stopDriverBackgroundLocation();
    }
  }, [isAuthenticated]);

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
          <RealtimeDegradedBanner />
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
