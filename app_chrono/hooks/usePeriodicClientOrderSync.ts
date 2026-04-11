import { useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { useAuthStore } from "../store/useAuthStore";
import { syncClientOrdersFromApi } from "../services/userAppResync";
import { userOrderSocketService } from "../services/userOrderSocketService";
import { logger } from "../utils/logger";

const INTERVAL_MS = 5000;

/**
 * Rafraîchit périodiquement les commandes (API + demande resync socket) pour enchaîner
 * plusieurs courses sans redémarrer l’app si un événement a été manqué.
 */
export function usePeriodicClientOrderSync() {
  const userId = useAuthStore((s) => s.user?.id);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      appStateRef.current = next;
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!userId) return;

    const tick = () => {
      if (appStateRef.current !== "active") return;
      syncClientOrdersFromApi(userId).catch((e) =>
        logger.warn("[usePeriodicClientOrderSync] sync API", "usePeriodicClientOrderSync", e)
      );
      userOrderSocketService.requestServerOrdersResync(userId);
    };

    tick();
    const id = setInterval(tick, INTERVAL_MS);
    return () => clearInterval(id);
  }, [userId]);
}
