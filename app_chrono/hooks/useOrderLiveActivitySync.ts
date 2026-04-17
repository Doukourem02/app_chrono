import { useEffect } from "react";
import { AppState, Platform } from "react-native";
import { shouldSyncLiveActivityForOrder, syncOrderLiveActivity } from "../services/orderLiveActivity";
import type { OrderRequest } from "../store/useOrderStore";
import { useOrderStore } from "../store/useOrderStore";

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

  useEffect(() => {
    if (Platform.OS !== "ios") return;
    const order = pickTrackedOrder(activeOrders, selectedOrderId);
    void syncOrderLiveActivity(order);
  }, [activeOrders, selectedOrderId]);

  /** Au retour premier plan : une tentative ratée ou une activité fermée peut être relancée. */
  useEffect(() => {
    if (Platform.OS !== "ios") return;
    const sub = AppState.addEventListener("change", (next) => {
      if (next !== "active") return;
      const { activeOrders: list, selectedOrderId: sel } = useOrderStore.getState();
      const order = pickTrackedOrder(list, sel);
      void syncOrderLiveActivity(order);
    });
    return () => sub.remove();
  }, []);
}
