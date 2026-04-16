import { Platform } from "react-native";
import type { LiveActivity, LiveActivityFactory } from "expo-widgets";
import type { OrderRequest, OrderStatus } from "../store/useOrderStore";
import { logger } from "../utils/logger";
import type { OrderTrackingLiveProps } from "../widgets/orderTrackingLiveActivity";

const TRACKING_STATUSES: OrderStatus[] = [
  "accepted",
  "enroute",
  "in_progress",
  "picked_up",
  "delivering",
];

let factory: LiveActivityFactory<OrderTrackingLiveProps> | null = null;

let active: {
  orderId: string;
  live: LiveActivity<OrderTrackingLiveProps>;
} | null = null;

function getFactory(): LiveActivityFactory<OrderTrackingLiveProps> {
  if (factory) return factory;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require("../widgets/orderTrackingLiveActivity") as {
    default: LiveActivityFactory<OrderTrackingLiveProps>;
  };
  factory = mod.default;
  return factory;
}

function statusLabelFr(status: OrderStatus): string {
  switch (status) {
    case "accepted":
      return "Livreur assigné";
    case "enroute":
      return "En route";
    case "picked_up":
      return "Colis récupéré";
    case "delivering":
      return "En livraison";
    case "in_progress":
      return "Course en cours";
    default:
      return "Suivi Krono";
  }
}

function propsFromOrder(order: OrderRequest): OrderTrackingLiveProps {
  const driver = order.driver;
  const plate = driver?.vehicle_plate?.trim();
  const name =
    driver?.name?.trim() ||
    [driver?.first_name, driver?.last_name].filter(Boolean).join(" ").trim();
  const detail =
    plate || name
      ? [plate, name].filter(Boolean).join(" · ")
      : order.dropoff?.address?.slice(0, 42) || "Krono";

  const eta =
    typeof order.estimatedDuration === "string" && order.estimatedDuration.trim()
      ? order.estimatedDuration.trim()
      : "—";

  return {
    statusLabel: statusLabelFr(order.status),
    etaLabel: eta,
    detailLine: detail,
  };
}

async function endActive(): Promise<void> {
  if (!active) return;
  const { live } = active;
  active = null;
  try {
    await live.end(
      "immediate",
      {
        statusLabel: "Terminé",
        etaLabel: "—",
        detailLine: "",
      },
      new Date()
    );
  } catch {
    /* ignore */
  }
}

/**
 * Synchronise la Live Activity iOS (îlot / verrouillage) avec la commande suivie.
 * Android : no-op.
 */
export async function syncOrderLiveActivity(order: OrderRequest | null): Promise<void> {
  if (Platform.OS !== "ios") return;

  const shouldTrack = order && TRACKING_STATUSES.includes(order.status);

  if (!shouldTrack) {
    await endActive();
    return;
  }

  try {
    const f = getFactory();
    const props = propsFromOrder(order!);
    const url = `appchrono://order-tracking/${encodeURIComponent(order!.id)}`;

    if (active?.orderId === order!.id) {
      await active.live.update(props);
      return;
    }

    await endActive();
    const live = f.start(props, url);
    active = { orderId: order!.id, live };
  } catch (e) {
    logger.warn("[orderLiveActivity] sync échouée", "orderLiveActivity", e);
  }
}
