import type { OrderStatus } from "../store/useOrderStore";

/** Statuts « livraison en cours » : aligné Live Activity + resync API + listes UI. */
export const DELIVERY_IN_PROGRESS_STATUSES: OrderStatus[] = [
  "pending",
  "accepted",
  "enroute",
  "in_progress",
  "picked_up",
  "delivering",
];

const ALL_KNOWN_STATUSES: OrderStatus[] = [
  ...DELIVERY_IN_PROGRESS_STATUSES,
  "completed",
  "declined",
  "cancelled",
];

/**
 * Normalise les statuts API / socket (casse, espaces, tirets, alias) pour comparaison fiable.
 */
export function normalizeOrderStatus(raw: unknown): OrderStatus | null {
  if (raw == null) return null;
  let s = String(raw).trim().toLowerCase().replace(/\s+/g, "_").replace(/-/g, "_");
  if (s === "inprogress") s = "in_progress";
  if (s === "pickedup") s = "picked_up";
  return (ALL_KNOWN_STATUSES as string[]).includes(s) ? (s as OrderStatus) : null;
}

/** Livraison encore suivie côté client (store, resync, îlot). */
export function isDeliveryInProgressStatus(raw: unknown): boolean {
  const n = normalizeOrderStatus(raw);
  return n != null && DELIVERY_IN_PROGRESS_STATUSES.includes(n);
}
