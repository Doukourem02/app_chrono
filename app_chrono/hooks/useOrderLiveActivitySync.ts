import { useEffect } from "react";
import { Platform } from "react-native";
import { syncOrderLiveActivity } from "../services/orderLiveActivity";
import type { OrderRequest } from "../store/useOrderStore";
import { useOrderStore } from "../store/useOrderStore";

const TRACKING = new Set<OrderRequest["status"]>([
  "pending",
  "accepted",
  "enroute",
  "in_progress",
  "picked_up",
  "delivering",
]);

function pickTrackedOrder(
  orders: OrderRequest[],
  selectedOrderId: string | null
): OrderRequest | null {
  if (selectedOrderId) {
    const o = orders.find((x) => x.id === selectedOrderId && TRACKING.has(x.status));
    if (o) return o;
  }
  return orders.find((o) => TRACKING.has(o.status)) ?? null;
}

/**
 * Met à jour la Live Activity (Dynamic Island) quand une commande est en cours de livraison.
 * iOS uniquement ; coût nul sur Android.
 */
export function useOrderLiveActivitySync() {
  const activeOrders = useOrderStore((s) => s.activeOrders);
  const selectedOrderId = useOrderStore((s) => s.selectedOrderId);

  useEffect(() => {
    if (Platform.OS !== "ios") return;
    const order = pickTrackedOrder(activeOrders, selectedOrderId);
    void syncOrderLiveActivity(order);
  }, [activeOrders, selectedOrderId]);
}
