import { useEffect, useMemo } from "react";
import { AppState, Platform } from "react-native";
import { shouldSyncLiveActivityForOrder, syncOrderLiveActivity } from "../services/orderLiveActivity";
import type { OrderRequest } from "../store/useOrderStore";
import { useOrderStore } from "../store/useOrderStore";
import { useTrackingEtaStore } from "../store/useTrackingEtaStore";

function pickTrackedOrder(
  orders: OrderRequest[],
  selectedOrderId: string | null
): OrderRequest | null {
  if (selectedOrderId) {
    const o = orders.find((x) => x.id === selectedOrderId && shouldSyncLiveActivityForOrder(x));
    if (o) return o;
  }
  return orders.find((o) => shouldSyncLiveActivityForOrder(o)) ?? null;
}

/**
 * Met à jour la Live Activity (Dynamic Island) quand une commande est en cours de livraison.
 * iOS uniquement ; coût nul sur Android.
 */
export function useOrderLiveActivitySync() {
  const activeOrders = useOrderStore((s) => s.activeOrders);
  const selectedOrderId = useOrderStore((s) => s.selectedOrderId);
  const etaByOrder = useTrackingEtaStore((s) => s.etaByOrder);
  const trackedDriverCoords = useOrderStore((s) => {
    const order = pickTrackedOrder(s.activeOrders, s.selectedOrderId);
    return order ? s.driverCoords.get(order.id) ?? null : null;
  });
  // Alimenté par driver:connection:status (backend) — même signal que DriverConnectionBanner
  // sur la carte in-app, répercuté ici pour que le Dynamic Island ne reste pas silencieusement
  // obsolète si le livreur perd sa connexion (cf. audit carte/géoloc 2026-07-29).
  const trackedConnectionDegraded = useOrderStore((s) => {
    const order = pickTrackedOrder(s.activeOrders, s.selectedOrderId);
    return order ? s.driverConnection.get(order.id)?.connected === false : false;
  });
  const trackedOrder = useMemo(
    () => pickTrackedOrder(activeOrders, selectedOrderId),
    [activeOrders, selectedOrderId]
  );
  const trackedActiveTrackingEta = trackedOrder ? etaByOrder[trackedOrder.id] ?? null : null;

  useEffect(() => {
    if (Platform.OS !== "ios") return;
    void syncOrderLiveActivity(trackedOrder, {
      driverCoords: trackedDriverCoords,
      connectionDegraded: trackedConnectionDegraded,
    });
  }, [
    trackedOrder,
    trackedDriverCoords,
    trackedConnectionDegraded,
    trackedActiveTrackingEta?.phase,
    trackedActiveTrackingEta?.etaLabel,
    trackedActiveTrackingEta?.computedAt,
  ]);

  /** Au retour premier plan : une tentative ratée ou une activité fermée peut être relancée. */
  useEffect(() => {
    if (Platform.OS !== "ios") return;
    const sub = AppState.addEventListener("change", (next) => {
      if (next !== "active") return;
      const { activeOrders: list, selectedOrderId: sel, driverCoords, driverConnection } = useOrderStore.getState();
      const order = pickTrackedOrder(list, sel);
      void syncOrderLiveActivity(order, {
        driverCoords: order ? driverCoords.get(order.id) ?? null : null,
        connectionDegraded: order ? driverConnection.get(order.id)?.connected === false : false,
      });
    });
    return () => sub.remove();
  }, []);
}
