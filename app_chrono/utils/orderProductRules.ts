export type OrderProductStatus =
  | "pending"
  | "accepted"
  | "enroute"
  | "in_progress"
  | "picked_up"
  | "delivering"
  | "completed"
  | "cancelled"
  | "declined";

export type OrderProductPhase = "search" | "pickup" | "at_pickup" | "dropoff" | "done" | "failed";

export type OrderStatusDefinition = {
  status: OrderProductStatus;
  phase: OrderProductPhase;
  clientLabel: string;
  driverLabel: string;
  recipientLabel: string;
  notify: "silent" | "operational" | "critical";
  etaMode: "none" | "pickup" | "dropoff";
  baseProgress: number;
};

export const ORDER_PRODUCT_STATUSES: OrderProductStatus[] = [
  "pending",
  "accepted",
  "enroute",
  "in_progress",
  "picked_up",
  "delivering",
  "completed",
  "cancelled",
  "declined",
];

const STATUS_DEFINITIONS: Record<OrderProductStatus, OrderStatusDefinition> = {
  pending: {
    status: "pending",
    phase: "search",
    clientLabel: "Recherche livreur",
    driverLabel: "Nouvelle demande",
    recipientLabel: "Recherche livreur",
    notify: "silent",
    etaMode: "none",
    baseProgress: 0.08,
  },
  accepted: {
    status: "accepted",
    phase: "pickup",
    clientLabel: "Prise en charge",
    driverLabel: "Aller au point de collecte",
    recipientLabel: "Prise en charge",
    notify: "operational",
    etaMode: "pickup",
    baseProgress: 0.2,
  },
  enroute: {
    status: "enroute",
    phase: "pickup",
    clientLabel: "Prise en charge",
    driverLabel: "Aller au point de collecte",
    recipientLabel: "Prise en charge",
    notify: "operational",
    etaMode: "pickup",
    baseProgress: 0.38,
  },
  in_progress: {
    status: "in_progress",
    phase: "at_pickup",
    clientLabel: "Livreur arrivé",
    driverLabel: "Récupérer le colis",
    recipientLabel: "Prise en charge imminente",
    notify: "silent",
    etaMode: "pickup",
    baseProgress: 0.52,
  },
  picked_up: {
    status: "picked_up",
    phase: "dropoff",
    clientLabel: "Colis récupéré",
    driverLabel: "Aller vers la destination",
    recipientLabel: "Colis récupéré",
    notify: "operational",
    etaMode: "dropoff",
    baseProgress: 0.7,
  },
  delivering: {
    status: "delivering",
    phase: "dropoff",
    clientLabel: "Livraison",
    driverLabel: "Livrer le colis",
    recipientLabel: "Livraison",
    notify: "operational",
    etaMode: "dropoff",
    baseProgress: 0.88,
  },
  completed: {
    status: "completed",
    phase: "done",
    clientLabel: "Livraison terminée",
    driverLabel: "Mission terminée",
    recipientLabel: "Livraison terminée",
    notify: "operational",
    etaMode: "none",
    baseProgress: 1,
  },
  cancelled: {
    status: "cancelled",
    phase: "failed",
    clientLabel: "Commande annulée",
    driverLabel: "Commande annulée",
    recipientLabel: "Commande annulée",
    notify: "critical",
    etaMode: "none",
    baseProgress: 0.12,
  },
  declined: {
    status: "declined",
    phase: "failed",
    clientLabel: "Commande refusée",
    driverLabel: "Commande refusée",
    recipientLabel: "Commande refusée",
    notify: "critical",
    etaMode: "none",
    baseProgress: 0.12,
  },
};

export function normalizeProductStatus(raw: unknown): OrderProductStatus | null {
  if (raw == null) return null;
  let value = String(raw).trim().toLowerCase().replace(/\s+/g, "_").replace(/-/g, "_");
  if (value === "inprogress") value = "in_progress";
  if (value === "pickedup") value = "picked_up";
  if (value === "canceled") value = "cancelled";
  return ORDER_PRODUCT_STATUSES.includes(value as OrderProductStatus) ? (value as OrderProductStatus) : null;
}

export function orderStatusDefinition(raw: unknown): OrderStatusDefinition {
  const status = normalizeProductStatus(raw) ?? "pending";
  return STATUS_DEFINITIONS[status];
}

export function normalizeEtaLabel(raw: unknown): string {
  const value = String(raw ?? "").trim();
  const lower = value.toLowerCase();
  if (!value || value === "—" || value === "-" || value === "–" || ["eta", "n/a", "null", "undefined"].includes(lower)) {
    return "";
  }
  const match = value.match(/^(\d+)\s*(?:min|mn|minutes?)?$/i);
  if (match) return `${match[1]} min`;
  return value;
}

export function etaMinutesFromLabel(raw: unknown): number | null {
  const value = normalizeEtaLabel(raw);
  if (!value) return null;
  const match = value.match(/(\d+(?:[.,]\d+)?)/);
  if (!match) return null;
  const minutes = Number(match[1].replace(",", "."));
  return Number.isFinite(minutes) && minutes > 0 ? minutes : null;
}

export function orderEtaMode(raw: unknown): OrderStatusDefinition["etaMode"] {
  return orderStatusDefinition(raw).etaMode;
}

export function orderPhase(raw: unknown): OrderProductPhase {
  return orderStatusDefinition(raw).phase;
}

export function statusBaseProgress(raw: unknown): number {
  return orderStatusDefinition(raw).baseProgress;
}

export function progressRangeForPhase(phase: OrderProductPhase): { start: number; end: number } | null {
  if (phase === "pickup" || phase === "at_pickup") return { start: 0.14, end: 0.54 };
  if (phase === "dropoff") return { start: 0.58, end: 0.96 };
  if (phase === "done") return { start: 1, end: 1 };
  return null;
}

export function progressFloorForStatus(raw: unknown): number {
  const status = normalizeProductStatus(raw) ?? "pending";
  switch (status) {
    case "accepted":
      return 0.14;
    case "enroute":
      return 0.24;
    case "in_progress":
      return 0.34;
    case "picked_up":
      return 0.58;
    case "delivering":
      return 0.64;
    default:
      return statusBaseProgress(status);
  }
}

export function clampOrderProgress(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

export function progressCapForEta(rawStatus: unknown, etaRaw: unknown): number | null {
  const minutes = etaMinutesFromLabel(etaRaw);
  if (minutes == null) return null;

  let cap = 0.96;
  if (minutes >= 10) cap = 0.58;
  else if (minutes >= 7) cap = 0.66;
  else if (minutes >= 5) cap = 0.74;
  else if (minutes >= 3) cap = 0.82;
  else if (minutes >= 2) cap = 0.9;

  const range = progressRangeForPhase(orderPhase(rawStatus));
  return range ? Math.min(cap, range.end) : cap;
}

export function progressWithEtaCap(rawStatus: unknown, progress: unknown, etaRaw: unknown): number {
  if (normalizeProductStatus(rawStatus) === "completed") return 1;
  const normalized = clampOrderProgress(progress);
  const cap = progressCapForEta(rawStatus, etaRaw);
  return cap == null ? normalized : clampOrderProgress(Math.min(normalized, cap));
}

export function isDropoffEtaStatus(raw: unknown): boolean {
  return orderEtaMode(raw) === "dropoff";
}

export function isPickupEtaStatus(raw: unknown): boolean {
  return orderEtaMode(raw) === "pickup";
}

export function clientStatusLabel(raw: unknown): string {
  return orderStatusDefinition(raw).clientLabel;
}

export function clientHeadline(raw: unknown, etaRaw?: unknown): string {
  const status = normalizeProductStatus(raw) ?? "pending";
  const eta = normalizeEtaLabel(etaRaw);
  switch (status) {
    case "pending":
      return "Recherche livreur";
    case "accepted":
    case "enroute":
      return `Prise en charge dans ${eta || "1 min"}`;
    case "in_progress":
      return eta ? `Prise en charge dans ${eta}` : "Livreur arrivé";
    case "picked_up":
    case "delivering":
      return `Livraison dans ${eta || "1 min"}`;
    case "completed":
      return "Livraison terminée";
    case "cancelled":
      return "Commande annulée";
    case "declined":
      return "Commande refusée";
    default:
      return "Suivi Krono";
  }
}

export function compactStatusLabel(raw: unknown, etaRaw?: unknown, isPending?: boolean): string {
  if (isPending) return "Recherche";
  const status = normalizeProductStatus(raw) ?? "pending";
  const eta = normalizeEtaLabel(etaRaw);
  if (eta && status !== "pending") return eta;
  if (status === "pending") return "Recherche";
  if (status === "completed") return "Terminé";
  if (status === "cancelled") return "Annulé";
  if (status === "declined") return "Refusé";
  return "1 min";
}

export function minimalStatusLabel(raw: unknown, etaRaw?: unknown, isPending?: boolean): string {
  if (isPending) return "Recherche";
  const status = normalizeProductStatus(raw) ?? "pending";
  const eta = normalizeEtaLabel(etaRaw);
  if (eta && status !== "pending") return eta;
  if (status === "completed") return "OK";
  if (status === "cancelled") return "Annulé";
  if (status === "declined") return "Refusé";
  return status === "pending" ? "Recherche" : "1 min";
}

export function shouldShowArrivedVisual(rawStatus: unknown, rawLabel?: unknown): boolean {
  const status = normalizeProductStatus(rawStatus);
  if (status === "in_progress") return true;
  const label = String(rawLabel ?? "").trim().toLowerCase();
  return label.includes("arriv");
}
