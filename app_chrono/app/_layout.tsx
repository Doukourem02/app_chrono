import { Stack } from "expo-router";
import { getNetworkStateAsync, useNetworkState } from "expo-network";
import { useEffect, useRef } from "react";
import { AppState, AppStateStatus, View } from "react-native";
import { initSentry } from "../utils/sentry";
import { ErrorBoundary } from "../components/error/ErrorBoundary";
import { ErrorModalsProvider } from "../components/error/ErrorModalsProvider";
import { OfflineBanner } from "../components/OfflineBanner";
import { RealtimeDegradedBanner } from "../components/RealtimeDegradedBanner";
import { soundService } from "../services/soundService";
import { useAuthStore } from "../store/useAuthStore";
import { useOrderStore } from "../store/useOrderStore";
import { userApiService } from "../services/userApiService";
import { userOrderSocketService } from "../services/userOrderSocketService";
import { runUserAppResync } from "../services/userAppResync";
import {
  startClientBackgroundAlignment,
  stopClientBackgroundAlignment,
} from "../services/clientBackgroundLocation";
import {
  initializeClientPushNotifications,
  processClientPushColdStartNavigation,
  setupClientPushListeners,
} from "../services/clientPushService";
import { isNetworkOffline } from "../utils/isNetworkOffline";
import { logger } from "../utils/logger";
import { locationService } from "../services/locationService";
import "../config/envCheck";
import "../mapboxInit";

initSentry();

export default function RootLayout() {
  const { isAuthenticated, user, hydrateTokens } = useAuthStore();
  const network = useNetworkState();
  const prevNetworkOfflineRef = useRef<boolean | null>(null);

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

  // Re-sync (commandes, liste, profil, socket) au retour réseau hors ligne → en ligne
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
      void runUserAppResync(user.id);
    }
    prevNetworkOfflineRef.current = offline;
  }, [network, isAuthenticated, user?.id]);

  // Push : token Expo → API + resync quand une notification arrive
  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;
    void initializeClientPushNotifications(user.id);
    const remove = setupClientPushListeners(() => {
      void runUserAppResync(user.id);
    });
    const coldStartTimer = setTimeout(() => {
      processClientPushColdStartNavigation();
    }, 500);
    return () => {
      remove();
      clearTimeout(coldStartTimer);
    };
  }, [isAuthenticated, user?.id]);

  // Localisation en arrière-plan : uniquement si une commande est en cours (hors terminée / annulée)
  useEffect(() => {
    if (!isAuthenticated) {
      void stopClientBackgroundAlignment();
    }
  }, [isAuthenticated]);

  // Rafraîchir la session + resync ciblé quand l'app revient au premier plan ; arrêt tâche AR plan au retour
  useEffect(() => {
    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      if (nextAppState === "background") {
        const uid = useAuthStore.getState().user?.id;
        if (!uid || !isAuthenticated) return;
        const hasInFlight = useOrderStore.getState().activeOrders.some((o) => {
          const s = String(o.status || "").toLowerCase();
          return s !== "completed" && s !== "cancelled" && s !== "declined";
        });
        if (hasInFlight) {
          void startClientBackgroundAlignment(uid);
        }
        return;
      }

      if (nextAppState === "active") {
        void stopClientBackgroundAlignment();
        void locationService.refreshOnForeground();
      }

      if (nextAppState !== "active" || !isAuthenticated || !user?.id) return;
      try {
        const net = await getNetworkStateAsync();
        if (isNetworkOffline(net)) return;
        await runUserAppResync(user.id);
      } catch (error) {
        logger.warn("[RootLayout] Resync au retour premier plan:", undefined, error);
      }
    };

    const subscription = AppState.addEventListener("change", handleAppStateChange);
    return () => subscription.remove();
  }, [isAuthenticated, user?.id]);

  // Rafraîchissement proactif du token toutes les 10 min quand l'app est active
  // Évite les déconnexions après inactivité prolongée (écran allumé sans interaction)
  useEffect(() => {
    if (!isAuthenticated || !user) return;

    const REFRESH_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
    const intervalId = setInterval(async () => {
      const appState = AppState.currentState;
      if (appState !== 'active') return; // Ne pas rafraîchir en arrière-plan
      try {
        const token = await userApiService.ensureAccessToken();
        if (token && user?.id) {
          userOrderSocketService.syncAfterAccessTokenRefresh(user.id);
        }
      } catch {
        // Silencieux - la prochaine action déclenchera un refresh
      }
    }, REFRESH_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [isAuthenticated, user]);

  return (
    <ErrorBoundary>
      <ErrorModalsProvider>
        <View style={{ flex: 1 }}>
          <OfflineBanner />
          <RealtimeDegradedBanner />
          <View style={{ flex: 1 }}>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="(auth)" options={{ headerShown: false }} />
              <Stack.Screen name="summary" />
            </Stack>
          </View>
        </View>
      </ErrorModalsProvider>
    </ErrorBoundary>
  );
}
