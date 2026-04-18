import type { OrderRequest } from "../store/useOrderStore";
import { useOrderStore } from "../store/useOrderStore";
import { isDeliveryInProgressStatus, normalizeOrderStatus } from "../utils/orderStatusNormalize";

/**
 * Quand l’API liste une livraison en cours absente du store (cold start, socket en retard),
 * injecte la commande pour que l’îlot / sockets / map utilisent la même source de vérité.
 */
export function mergeInProgressOrdersIntoStore(orders: OrderRequest[]): void {
  const { activeOrders, updateFromSocket } = useOrderStore.getState();
  const ids = new Set(activeOrders.map((o) => o.id));
  for (const o of orders) {
    if (!isDeliveryInProgressStatus(o.status)) continue;
    const status = normalizeOrderStatus(o.status);
    if (!status) continue;
    if (ids.has(o.id)) continue;
    updateFromSocket({
      order: { ...o, status } as OrderRequest,
    });
    ids.add(o.id);
  }
}
