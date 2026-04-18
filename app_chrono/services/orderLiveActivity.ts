import { AppState, Platform } from "react-native";
import type { LiveActivity, LiveActivityFactory } from "expo-widgets";
import type { OrderRequest, OrderStatus } from "../store/useOrderStore";
import { logger } from "../utils/logger";
import { reportLiveActivityIssue } from "../utils/sentry";
import { DELIVERY_IN_PROGRESS_STATUSES, normalizeOrderStatus } from "../utils/orderStatusNormalize";
import type { OrderTrackingLiveProps } from "../widgets/orderTrackingLiveActivity";

const END_PROPS: OrderTrackingLiveProps = {
  etaLabel: "—",
  vehicleLabel: "Course terminée",
  plateLabel: "",
  isPending: false,
};

/** Inclut `pending` pour que l’utilisateur voie l’activité dès la commande créée (avant acceptation chauffeur). */
const TRACKING_STATUSES = DELIVERY_IN_PROGRESS_STATUSES;

/** Même logique que le hook de sync : statut API parfois mal câblé (casse, tirets). */
export function shouldSyncLiveActivityForOrder(order: OrderRequest): boolean {
  const n = normalizeOrderStatus(order.status);
  return n != null && TRACKING_STATUSES.includes(n);
}

let factory: LiveActivityFactory<OrderTrackingLiveProps> | null = null;

let active: {
  orderId: string;
  live: LiveActivity<OrderTrackingLiveProps>;
} | null = null;

/**
 * Une seule file d’attente : évite deux `start()` en parallèle (effets React / Strict Mode),
 * ce qui créait deux Live Activities noires sur l’écran de verrouillage.
 */
let syncChain: Promise<void> = Promise.resolve();

/** Évite de fermer l’îlot au cold start tant que `activeOrders` n’est pas encore repeuplé par l’API / socket. */
let endDebounceTimer: ReturnType<typeof setTimeout> | null = null;
const END_DEBOUNCE_MS = 1600;

function clearScheduledEnd(): void {
  if (endDebounceTimer != null) {
    clearTimeout(endDebounceTimer);
    endDebounceTimer = null;
  }
}

function scheduleDebouncedEnd(): void {
  if (endDebounceTimer != null) {
    clearTimeout(endDebounceTimer);
  }
  endDebounceTimer = setTimeout(() => {
    endDebounceTimer = null;
    void endAllLiveActivities();
  }, END_DEBOUNCE_MS);
}

function supportsLiveActivitiesIOS(): boolean {
  if (Platform.OS !== "ios") return false;
  const version = Platform.Version;
  if (typeof version !== "number") return true;
  return version >= 16.2;
}

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
  const status = normalizeOrderStatus(order.status) ?? (order.status as OrderStatus);
  if (status === "pending") {
    const eta =
      typeof order.estimatedDuration === "string" && order.estimatedDuration.trim()
        ? order.estimatedDuration.trim()
        : "";
    return {
      etaLabel: "Recherche chauffeur",
      vehicleLabel: eta ? `≈ ${eta}` : "En attente d’un livreur",
      plateLabel: order.dropoff?.address?.slice(0, 28) || "Krono",
      isPending: true,
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
    isPending: false,
  };
}

/** iOS a déjà retiré l’activité (utilisateur, système, fin) alors que le bridge garde encore l’objet `update`. */
function isStaleLiveActivityNativeError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("can't find live activity") ||
    m.includes("cannot find live activity") ||
    m.includes("find live activity with id")
  );
}

/**
 * ActivityKit refuse `start()` tant que l’app n’est pas au premier plan (ExpoWidgets / Swift).
 * On diffère le `start` au retour `active` (voir `useOrderLiveActivitySync`).
 */
function isActivityKitNotForegroundError(message: string): boolean {
  const m = message.toLowerCase();
  return m.includes("not foreground") || m.includes("target is not foreground");
}

function appIsActiveForLiveActivity(): boolean {
  return AppState.currentState === "active";
}

/** Termine toutes les Live Activities de ce type. */
async function endAllLiveActivities(): Promise<void> {
  active = null;
  try {
    const f = getFactory();
    for (const live of f.getInstances()) {
      try {
        await live.end("immediate", END_PROPS, new Date());
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* ignore */
  }
}

export type SyncOrderLiveActivityOptions = {
  /** Déconnexion / arrêt explicite : fermer tout de suite sans attendre le debounce cold start. */
  immediateEnd?: boolean;
};

async function syncOrderLiveActivityImpl(
  order: OrderRequest | null,
  options: SyncOrderLiveActivityOptions
): Promise<void> {
  if (!supportsLiveActivitiesIOS()) return;

  const shouldTrack = order && shouldSyncLiveActivityForOrder(order);

  if (!shouldTrack) {
    if (options.immediateEnd) {
      clearScheduledEnd();
      await endAllLiveActivities();
      return;
    }
    scheduleDebouncedEnd();
    return;
  }

  clearScheduledEnd();

  try {
    const f = getFactory();
    const props = propsFromOrder(order!);
    const url = `appchrono://order-tracking/${encodeURIComponent(order!.id)}`;

    if (active?.orderId === order!.id) {
      try {
        await active.live.update(props);
        return;
      } catch (e) {
        const updateMsg = e instanceof Error ? e.message : String(e);
        if (!isStaleLiveActivityNativeError(updateMsg)) {
          logger.warn(
            "[orderLiveActivity] update ActivityKit a échoué",
            "orderLiveActivity",
            { orderId: order!.id, status: order!.status, errorMessage: updateMsg, error: e }
          );
          reportLiveActivityIssue("activitykit_start_or_update_failed", {
            orderId: order!.id,
            status: order!.status,
            errorMessage: updateMsg,
          });
          return;
        }
        if (__DEV__) {
          logger.info(
            "[orderLiveActivity] Référence Live Activity obsolète côté iOS — recréation",
            "orderLiveActivity",
            { orderId: order!.id }
          );
        }
        active = null;
        // enchaîner sur end + start ci-dessous
      }
    }

    /**
     * Changement de commande ou première ouverture : on ferme **toutes** les instances
     * (y compris orphelines / doublons), puis une seule `start()`.
     * On ne réutilise plus `getInstances()[0]` : avec plusieurs activités, ça en laissait une vivante.
     *
     * Pas de `start` en arrière-plan : iOS lève « Target is not foreground » et Sentry se remplit.
     * Le hook relance la sync au retour au premier plan.
     */
    if (!appIsActiveForLiveActivity()) {
      if (__DEV__) {
        logger.debug(
          "[orderLiveActivity] start différé — app pas au premier plan (ActivityKit)",
          "orderLiveActivity",
          { orderId: order!.id }
        );
      }
      return;
    }

    await endAllLiveActivities();
    const live = f.start(props, url);
    active = { orderId: order!.id, live };
    if (__DEV__) {
      logger.info("[orderLiveActivity] Live Activity démarrée", "orderLiveActivity", {
        orderId: order!.id,
        status: order!.status,
      });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (isActivityKitNotForegroundError(msg)) {
      if (__DEV__) {
        logger.debug("[orderLiveActivity] start ignoré (hors premier plan)", "orderLiveActivity", {
          orderId: order?.id,
        });
      }
      return;
    }
    /** ActivityKit refuse `start` si Live Activities désactivées pour Krono (Réglages) ou mode basse conso. */
    logger.warn(
      "[orderLiveActivity] start/update ActivityKit a échoué (réglages peuvent être OK) — build iOS avec extension ExpoWidgets, iOS 16.2+, ou limite ActivityKit.",
      "orderLiveActivity",
      { orderId: order?.id, status: order?.status, errorMessage: msg, error: e }
    );
    reportLiveActivityIssue("activitykit_start_or_update_failed", {
      orderId: order?.id ?? null,
      status: order?.status ?? null,
      errorMessage: msg,
    });
  }
}

/**
 * Synchronise la Live Activity iOS (îlot / verrouillage) avec la commande suivie.
 * Android : no-op.
 */
export function syncOrderLiveActivity(
  order: OrderRequest | null,
  options?: SyncOrderLiveActivityOptions
): Promise<void> {
  const opts = options ?? {};
  syncChain = syncChain
    .then(() => syncOrderLiveActivityImpl(order, opts))
    .catch((e) => {
      const errorMessage = e instanceof Error ? e.message : String(e);
      if (isActivityKitNotForegroundError(errorMessage)) {
        return;
      }
      logger.warn("[orderLiveActivity] syncChain", "orderLiveActivity", {
        errorMessage,
      });
      reportLiveActivityIssue("activitykit_sync_chain_failed", { errorMessage });
    });
  return syncChain;
}
