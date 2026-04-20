import { AppState, InteractionManager, Platform } from "react-native";
import { Asset } from "expo-asset";
import type { LiveActivity, LiveActivityFactory } from "expo-widgets";
import type { OrderRequest, OrderStatus } from "../store/useOrderStore";
import { logger } from "../utils/logger";
import { reportLiveActivityIssue } from "../utils/sentry";
import { DELIVERY_IN_PROGRESS_STATUSES, normalizeOrderStatus } from "../utils/orderStatusNormalize";
import type { OrderTrackingLiveProps } from "../widgets/orderTrackingLiveActivity";

/** Préfixe unique pour Console / Xcode : filtrer sur `ExpoWidgets`, `LiveActivity`, `OrderTrackingLive`, `orderLiveActivity`. */
const LA_LOG_PREFIX =
  "[ExpoWidgets][LiveActivity][OrderTrackingLive][orderLiveActivity]";

/**
 * Court délai après `end` + runAfterInteractions pour limiter la course entre
 * l’écriture App Group / runtime widget et `Activity.request` (logs iOS : Archive was nil).
 */
const LIVE_ACTIVITY_PRE_START_YIELD_MS = 72;

const END_PROPS: OrderTrackingLiveProps = {
  etaLabel: "—",
  vehicleLabel: "Course terminée",
  plateLabel: "",
  isPending: false,
  statusCode: "completed",
  statusLabel: "Terminee",
  progress: 1,
  driverAvatarUrl: "",
  driverPhone: "",
  bannerClockLabel: "",
  vehicleMarkerUrl: "",
};

const BIKER_MARKER_ASSET = Asset.fromModule(require("../assets/images/biker.png"));

function bikerMarkerUri(): string {
  return BIKER_MARKER_ASSET.localUri || BIKER_MARKER_ASSET.uri || "";
}

/** Chiffres pour `tel:` / `sms:` (Live Activity). */
function digitsForTel(phone: string | undefined): string {
  if (!phone?.trim()) return "";
  return phone.replace(/[^\d+]/g, "");
}

function formatBannerClock(order: OrderRequest): string {
  const raw = order.createdAt;
  if (raw == null) return "—";
  const d =
    typeof raw === "string" || typeof raw === "number"
      ? new Date(raw)
      : raw instanceof Date
        ? raw
        : new Date(String(raw));
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" }).format(d);
}

/** Inclut `pending` pour que l’utilisateur voie l’activité dès la commande créée (avant acceptation chauffeur). */
const TRACKING_STATUSES = DELIVERY_IN_PROGRESS_STATUSES;

function clampProgress(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function progressFromStatus(status: OrderStatus): number {
  switch (status) {
    case "pending":
      return 0.08;
    case "accepted":
      return 0.2;
    case "enroute":
      return 0.38;
    case "in_progress":
      return 0.52;
    case "picked_up":
      return 0.7;
    case "delivering":
      return 0.88;
    case "completed":
      return 1;
    default:
      return 0.12;
  }
}

function liveStatusLabel(status: OrderStatus): string {
  switch (status) {
    case "pending":
      return "Recherche chauffeur";
    case "accepted":
      return "Livreur assigne";
    case "enroute":
      return "Vers le point de retrait";
    case "in_progress":
      return "Course en preparation";
    case "picked_up":
      return "Colis recupere";
    case "delivering":
      return "En livraison";
    case "completed":
      return "Livraison terminee";
    case "cancelled":
      return "Commande annulee";
    case "declined":
      return "Commande refusee";
    default:
      return "Suivi Krono";
  }
}

function vehicleTypeLabel(value: string | undefined): string {
  const v = (value ?? "").trim().toLowerCase();
  if (v === "moto") return "Moto";
  if (v === "cargo") return "Cargo";
  if (v === "vehicule" || v === "vehicle" || v === "car") return "Voiture";
  return value?.trim() || "Voiture";
}

function readDriverString(
  driver: OrderRequest["driver"] | undefined,
  keys: string[],
): string {
  const record = driver as Record<string, unknown> | undefined;
  if (!record) return "";
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
}

function driverVehiclePlate(driver: OrderRequest["driver"] | undefined): string {
  return readDriverString(driver, ["vehicle_plate", "vehiclePlate"]);
}

function vehicleInfoLabel(order: OrderRequest): string {
  const driver = order.driver;
  const vehicleType = vehicleTypeLabel(
    readDriverString(driver, ["vehicle_type", "vehicleType"]) || order.deliveryMethod,
  );
  const brand = readDriverString(driver, ["vehicle_brand", "vehicleBrand"]);
  const modelName = readDriverString(driver, ["vehicle_model", "vehicleModel"]);
  const model = [brand, modelName].filter(Boolean).join(" ").trim();
  const color = readDriverString(driver, ["vehicle_color", "vehicleColor"]);
  const plate = driverVehiclePlate(driver);
  return [plate, color, model || vehicleType].filter(Boolean).join(" · ") || vehicleType;
}

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

function laTrace(stage: string, extra?: Record<string, unknown>): void {
  if (!__DEV__) return;
  if (extra && Object.keys(extra).length > 0) {
    console.log(`${LA_LOG_PREFIX} ${stage}`, extra);
  } else {
    console.log(`${LA_LOG_PREFIX} ${stage}`);
  }
  logger.debug(`${LA_LOG_PREFIX} ${stage}`, "orderLiveActivity", extra);
}

/**
 * Laisse le bridge natif et le thread UI finir après une série d’opérations widget,
 * puis un tick court avant `LiveActivityFactory.start` (warm-up anti îlot vide).
 */
function yieldBeforeLiveActivityStart(): Promise<void> {
  return new Promise((resolve) => {
    InteractionManager.runAfterInteractions(() => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setTimeout(resolve, LIVE_ACTIVITY_PRE_START_YIELD_MS);
        });
      });
    });
  });
}

function getFactory(): LiveActivityFactory<OrderTrackingLiveProps> {
  if (factory) return factory;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require("../widgets/orderTrackingLiveActivity") as {
    default: LiveActivityFactory<OrderTrackingLiveProps>;
  };
  factory = mod.default;
  laTrace("factory résolu (createLiveActivity / layout enregistré côté natif)");
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
      etaLabel: eta || "—",
      vehicleLabel: "Recherche livreur",
      vehicleInfoLabel: vehicleInfoLabel(order),
      plateLabel: order.dropoff?.address?.slice(0, 28) || "Krono",
      isPending: true,
      statusCode: status,
      statusLabel: liveStatusLabel(status),
      progress: progressFromStatus(status),
      driverAvatarUrl: "",
      driverPhone: "",
      bannerClockLabel: formatBannerClock(order),
      vehicleMarkerUrl: bikerMarkerUri(),
    };
  }

  const driver = order.driver;
  const avatarRaw =
    driver?.avatar_url?.trim() ||
    driver?.profile_image_url?.trim() ||
    driver?.avatar?.trim() ||
    "";
  const plate = driverVehiclePlate(driver);
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
      : "";

  return {
    etaLabel: eta,
    vehicleLabel: name || detail || "Krono",
    vehicleInfoLabel: vehicleInfoLabel(order),
    plateLabel: plate || "KRONO",
    isPending: false,
    statusCode: status,
    statusLabel: liveStatusLabel(status),
    progress: clampProgress(progressFromStatus(status)),
    driverAvatarUrl: avatarRaw,
    driverPhone: digitsForTel(driver?.phone),
    bannerClockLabel: formatBannerClock(order),
    vehicleMarkerUrl: bikerMarkerUri(),
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

let didWarmNativeBridge = false;

/**
 * Précharge le factory `OrderTrackingLive` et laisse une fenêtre au runtime natif
 * avant le premier `start()` (appel idéal depuis `_layout` au cold start iOS).
 */
export async function warmOrderLiveActivityNativeBridge(): Promise<void> {
  if (!supportsLiveActivitiesIOS()) return;
  getFactory();
  if (didWarmNativeBridge) {
    laTrace("warmOrderLiveActivityNativeBridge: déjà exécuté — skip délai");
    return;
  }
  didWarmNativeBridge = true;
  laTrace("warmOrderLiveActivityNativeBridge: début");
  await yieldBeforeLiveActivityStart();
  laTrace("warmOrderLiveActivityNativeBridge: fin");
}

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
    laTrace("sync: entrée start/update", {
      orderId: order!.id,
      status: order!.status,
      hasDriverAvatarUrl: Boolean(props.driverAvatarUrl?.trim()),
      appState: AppState.currentState,
    });

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

    laTrace("sync: avant endAllLiveActivities", { orderId: order!.id });
    await endAllLiveActivities();
    laTrace("sync: après endAllLiveActivities — warm-up (layout → bridge → tick)", {
      orderId: order!.id,
    });
    await yieldBeforeLiveActivityStart();
    laTrace("sync: avant f.start (Activity.request)", { orderId: order!.id });
    const live = f.start(props, url);
    active = { orderId: order!.id, live };
    laTrace("sync: après f.start", { orderId: order!.id });
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
