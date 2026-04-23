import type { OrderStatus } from "../store/useOrderStore";
import { ORDER_PRODUCT_STATUSES, normalizeProductStatus } from "./orderProductRules";

/** Statuts « livraison en cours » : aligné Live Activity + resync API + listes UI. */
export const DELIVERY_IN_PROGRESS_STATUSES: OrderStatus[] = [
  "pending",
  "accepted",
  "enroute",
  "in_progress",
  "picked_up",
  "delivering",
];

const ALL_KNOWN_STATUSES = ORDER_PRODUCT_STATUSES;

/**
 * Normalise les statuts API / socket (casse, espaces, tirets, alias) pour comparaison fiable.
 */
export function normalizeOrderStatus(raw: unknown): OrderStatus | null {
  const normalized = normalizeProductStatus(raw);
  return (ALL_KNOWN_STATUSES as string[]).includes(normalized ?? "") ? (normalized as OrderStatus) : null;
}

/** Livraison encore suivie côté client (store, resync, îlot). */
export function isDeliveryInProgressStatus(raw: unknown): boolean {
  const n = normalizeOrderStatus(raw);
  return n != null && DELIVERY_IN_PROGRESS_STATUSES.includes(n);
}
