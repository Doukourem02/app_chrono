import { Platform } from "react-native";
import type { LiveActivity, LiveActivityFactory } from "expo-widgets";
import type { OrderRequest, OrderStatus } from "../store/useOrderStore";
import { logger } from "../utils/logger";
import type { OrderTrackingLiveProps } from "../widgets/orderTrackingLiveActivity";

/** Inclut `pending` pour que l’utilisateur voie l’activité dès la commande créée (avant acceptation chauffeur). */
const TRACKING_STATUSES: OrderStatus[] = [
  "pending",
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

function propsFromOrder(order: OrderRequest): OrderTrackingLiveProps {
  if (order.status === "pending") {
    const eta =
      typeof order.estimatedDuration === "string" && order.estimatedDuration.trim()
        ? order.estimatedDuration.trim()
        : "—";
    return {
      etaLabel: eta,
      vehicleLabel: "Recherche d'un chauffeur",
      plateLabel: order.dropoff?.address?.slice(0, 24) || "Krono",
    };
  }

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
    etaLabel: eta,
    vehicleLabel: name || detail || "Krono",
    plateLabel: plate || "KRONO",
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
        etaLabel: "—",
        vehicleLabel: "Course terminee",
        plateLabel: "",
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
