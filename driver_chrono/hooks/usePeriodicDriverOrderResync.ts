import { useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { useDriverStore } from "../store/useDriverStore";
import { orderSocketService } from "../services/orderSocketService";

const INTERVAL_MS = 5000;

/** Demande régulièrement l’état des commandes au serveur (évite de rester bloqué sans 2e course). */
export function usePeriodicDriverOrderResync() {
  const userId = useDriverStore((s) => s.user?.id);
  const isOnline = useDriverStore((s) => s.isOnline);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      appStateRef.current = next;
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!userId || !isOnline) return;

    const tick = () => {
      if (appStateRef.current !== "active") return;
      orderSocketService.requestServerOrdersResync(userId);
    };

    tick();
    const id = setInterval(tick, INTERVAL_MS);
    return () => clearInterval(id);
  }, [userId, isOnline]);
}
