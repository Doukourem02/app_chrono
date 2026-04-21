import { AppState, InteractionManager, Platform } from "react-native";
import { Asset } from "expo-asset";
import type { LiveActivity, LiveActivityFactory } from "expo-widgets";
import type { OrderRequest, OrderStatus } from "../store/useOrderStore";
import { config } from "../config";
import { apiFetch } from "../utils/apiFetch";
import { logger } from "../utils/logger";
import { reportLiveActivityIssue } from "../utils/sentry";
import { calculateDistance, calculateETAForVehicle, formatETA } from "../utils/etaCalculator";
import { DELIVERY_IN_PROGRESS_STATUSES, normalizeOrderStatus } from "../utils/orderStatusNormalize";
import type { OrderTrackingLiveProps } from "../widgets/orderTrackingLiveActivity";
import { userApiService } from "./userApiService";

/** Préfixe unique pour Console / Xcode : filtrer sur `ExpoWidgets`, `LiveActivity`, `OrderTrackingLive`, `orderLiveActivity`. */
const LA_LOG_PREFIX =
  "[ExpoWidgets][LiveActivity][OrderTrackingLive][orderLiveActivity]";

/**
 * Court délai après `end` + runAfterInteractions pour limiter la course entre
 * l’écriture App Group / runtime widget et `Activity.request` (logs iOS : Archive was nil).
 */
const LIVE_ACTIVITY_PRE_START_YIELD_MS = 72;
const MIN_LIVE_ACTIVITY_GPS_UPDATE_MS = 6000;
const MIN_PROGRESS_DELTA_FOR_FAST_UPDATE = 0.03;
const MIN_PROGRESS_DELTA_FOR_UPDATE = 0.015;
const ARRIVAL_RADIUS_METERS = 45;
const SAME_STOP_RADIUS_METERS = 80;

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

type Coordinates = {
  latitude: number;
  longitude: number;
};

type ProgressPhase = "pickup" | "dropoff";

type PhaseProgressState = {
  phase: ProgressPhase;
  initialDistanceMeters: number;
  lastProgress: number;
};

type LastLiveActivityUpdate = {
  orderId: string;
  statusCode?: string;
  statusLabel?: string;
  progress: number;
  etaLabel: string;
  at: number;
};

const phaseProgressByOrder = new Map<string, PhaseProgressState>();
let lastLiveActivityUpdate: LastLiveActivityUpdate | null = null;

const BIKER_MARKER_ASSET = Asset.fromModule(require("../assets/images/biker.png"));
let didPrepareBikerMarkerAsset = false;

function bikerMarkerUri(): string {
  return BIKER_MARKER_ASSET.localUri || BIKER_MARKER_ASSET.uri || "";
}

async function prepareLiveActivityAssets(): Promise<void> {
  if (didPrepareBikerMarkerAsset && bikerMarkerUri()) return;
  try {
    await BIKER_MARKER_ASSET.downloadAsync();
    didPrepareBikerMarkerAsset = true;
  } catch (error) {
    didPrepareBikerMarkerAsset = false;
    logger.warn("[orderLiveActivity] marqueur livreur Live Activity indisponible", "orderLiveActivity", error);
  }
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

function progressPhaseForStatus(status: OrderStatus): ProgressPhase | null {
  switch (status) {
    case "accepted":
    case "enroute":
    case "in_progress":
      return "pickup";
    case "picked_up":
    case "delivering":
      return "dropoff";
    default:
      return null;
  }
}

function phaseTargetForOrder(order: OrderRequest, phase: ProgressPhase): Coordinates | null {
  const coords = phase === "pickup" ? order.pickup?.coordinates : order.dropoff?.coordinates;
  if (
    !coords ||
    typeof coords.latitude !== "number" ||
    typeof coords.longitude !== "number" ||
    !Number.isFinite(coords.latitude) ||
    !Number.isFinite(coords.longitude)
  ) {
    return null;
  }
  return coords;
}

function phaseProgressRange(phase: ProgressPhase): { start: number; end: number } {
  if (phase === "pickup") {
    return { start: 0.14, end: 0.54 };
  }
  return { start: 0.58, end: 0.96 };
}

function statusFloorProgress(status: OrderStatus): number {
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
      return progressFromStatus(status);
  }
}

function liveActivityVehicleType(
  value: OrderRequest["deliveryMethod"],
): "moto" | "vehicule" | "cargo" | null {
  return value === "moto" || value === "vehicule" || value === "cargo" ? value : null;
}

function pickupToDropoffDistance(order: OrderRequest): number | null {
  const pickup = phaseTargetForOrder(order, "pickup");
  const dropoff = phaseTargetForOrder(order, "dropoff");
  if (!pickup || !dropoff) return null;
  const distance = calculateDistance(pickup, dropoff);
  return Number.isFinite(distance) ? distance : null;
}

function normalizedStopAddress(value: string | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function isSamePickupDropoffStop(order: OrderRequest): boolean {
  const pickupAddress = normalizedStopAddress(order.pickup?.address);
  const dropoffAddress = normalizedStopAddress(order.dropoff?.address);
  if (pickupAddress && dropoffAddress && pickupAddress === dropoffAddress) {
    return true;
  }

  const distance = pickupToDropoffDistance(order);
  return distance != null && distance <= SAME_STOP_RADIUS_METERS;
}

function progressFromDriverMovement(
  order: OrderRequest,
  status: OrderStatus,
  driverCoords: Coordinates | null | undefined,
): { progress: number; etaLabel?: string; arrivedAtStop?: boolean } {
  const statusProgress = clampProgress(progressFromStatus(status));
  const phase = progressPhaseForStatus(status);
  if (!phase) {
    phaseProgressByOrder.delete(order.id);
    return { progress: statusProgress };
  }

  const existing = phaseProgressByOrder.get(order.id);
  if (phase === "dropoff" && isSamePickupDropoffStop(order)) {
    const sameStopDistanceMeters = pickupToDropoffDistance(order) ?? 0;
    const progress = Math.max(phaseProgressRange("dropoff").end, existing?.lastProgress ?? 0);
    phaseProgressByOrder.set(order.id, {
      phase,
      initialDistanceMeters: Math.max(sameStopDistanceMeters, ARRIVAL_RADIUS_METERS),
      lastProgress: progress,
    });
    return {
      progress,
      etaLabel: "1 min",
      arrivedAtStop: true,
    };
  }

  if (!driverCoords) {
    return {
      progress:
        existing && existing.phase === phase
          ? Math.max(statusProgress, existing.lastProgress)
          : statusProgress,
    };
  }

  const target = phaseTargetForOrder(order, phase);
  if (!target) {
    return { progress: statusProgress };
  }

  const remainingMeters = calculateDistance(driverCoords, target);
  if (!Number.isFinite(remainingMeters)) {
    return { progress: statusProgress };
  }

  const range = phaseProgressRange(phase);
  const floor = Math.max(range.start, statusFloorProgress(status));
  const shouldResetPhase = !existing || existing.phase !== phase;
  const previousInitial = shouldResetPhase ? 0 : existing.initialDistanceMeters;
  const initialDistanceMeters = Math.max(remainingMeters, previousInitial, ARRIVAL_RADIUS_METERS);
  const phaseRatio =
    remainingMeters <= ARRIVAL_RADIUS_METERS
      ? 1
      : clampProgress(1 - remainingMeters / initialDistanceMeters);
  const phaseProgress = range.start + phaseRatio * (range.end - range.start);
  const cappedProgress =
    remainingMeters <= ARRIVAL_RADIUS_METERS ? range.end : Math.min(range.end - 0.015, phaseProgress);
  const lastProgress = shouldResetPhase ? floor : existing.lastProgress;
  const progress = clampProgress(Math.max(floor, cappedProgress, lastProgress));

  phaseProgressByOrder.set(order.id, {
    phase,
    initialDistanceMeters,
    lastProgress: progress,
  });

  const etaMinutes = calculateETAForVehicle(remainingMeters, liveActivityVehicleType(order.deliveryMethod));
  return {
    progress,
    etaLabel: formatETA(Math.max(1, etaMinutes)),
    arrivedAtStop: remainingMeters <= ARRIVAL_RADIUS_METERS,
  };
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
  pushToken?: string;
  pushTokenSub?: { remove: () => void };
  lastRegisteredPushToken?: string;
  lastRegisteredPropsKey?: string;
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

function propsFromOrder(
  order: OrderRequest,
  driverCoords?: Coordinates | null,
): OrderTrackingLiveProps {
  const status = normalizeOrderStatus(order.status) ?? (order.status as OrderStatus);
  if (status === "pending") {
    phaseProgressByOrder.delete(order.id);
    return {
      etaLabel: "—",
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

  const movement = progressFromDriverMovement(order, status, driverCoords);

  return {
    etaLabel: movement.etaLabel || "",
    vehicleLabel: name || detail || "Krono",
    vehicleInfoLabel: vehicleInfoLabel(order),
    plateLabel: plate || "KRONO",
    isPending: false,
    statusCode: status,
    statusLabel: movement.arrivedAtStop ? "Arrivé" : liveStatusLabel(status),
    progress: movement.progress,
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

function shouldSkipLiveActivityUpdate(orderId: string, props: OrderTrackingLiveProps): boolean {
  if (!lastLiveActivityUpdate || lastLiveActivityUpdate.orderId !== orderId) {
    return false;
  }

  const progress = props.progress ?? 0;
  const progressDelta = Math.abs(progress - lastLiveActivityUpdate.progress);
  const etaLabel = props.etaLabel ?? "";
  const sameStatus = props.statusCode === lastLiveActivityUpdate.statusCode;
  const sameStatusLabel = props.statusLabel === lastLiveActivityUpdate.statusLabel;
  const sameEta = etaLabel === lastLiveActivityUpdate.etaLabel;
  const elapsedMs = Date.now() - lastLiveActivityUpdate.at;

  if (!sameStatus) return false;
  if (!sameStatusLabel) return false;
  if (sameEta && progressDelta < MIN_PROGRESS_DELTA_FOR_UPDATE) return true;
  return elapsedMs < MIN_LIVE_ACTIVITY_GPS_UPDATE_MS && progressDelta < MIN_PROGRESS_DELTA_FOR_FAST_UPDATE;
}

function markLiveActivityUpdated(orderId: string, props: OrderTrackingLiveProps): void {
  lastLiveActivityUpdate = {
    orderId,
    statusCode: props.statusCode,
    statusLabel: props.statusLabel,
    progress: props.progress ?? 0,
    etaLabel: props.etaLabel ?? "",
    at: Date.now(),
  };
}

function registrationPropsKey(props: OrderTrackingLiveProps): string {
  return JSON.stringify({
    etaLabel: props.etaLabel,
    statusCode: props.statusCode,
    statusLabel: props.statusLabel,
    vehicleInfoLabel: props.vehicleInfoLabel,
    driverAvatarUrl: props.driverAvatarUrl,
    vehicleMarkerUrl: props.vehicleMarkerUrl,
  });
}

async function registerLiveActivityPushToken(
  orderId: string,
  pushToken: string,
  props: OrderTrackingLiveProps,
  activityId?: string,
): Promise<void> {
  const cleanPushToken = pushToken.trim();
  if (!cleanPushToken) return;

  const current = active;
  const propsKey = registrationPropsKey(props);
  if (
    current?.orderId === orderId &&
    current.lastRegisteredPushToken === cleanPushToken &&
    current.lastRegisteredPropsKey === propsKey
  ) {
    return;
  }

  const token = await userApiService.ensureAccessToken();
  if (!token) {
    logger.warn("[orderLiveActivity] token JWT absent — push token ActivityKit non envoyé", "orderLiveActivity");
    return;
  }

  const response = await apiFetch(
    `${config.apiUrl}/api/push/live-activity/register`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        orderId,
        activityId: activityId || null,
        pushToken: cleanPushToken,
        liveActivityName: "OrderTrackingLive",
        props,
      }),
    },
    { maxRetries: 1 }
  );

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    logger.warn("[orderLiveActivity] enregistrement push token ActivityKit refusé", "orderLiveActivity", {
      orderId,
      status: response.status,
      body: text.slice(0, 240),
    });
    return;
  }

  if (active?.orderId === orderId) {
    active.pushToken = cleanPushToken;
    active.lastRegisteredPushToken = cleanPushToken;
    active.lastRegisteredPropsKey = propsKey;
  }
  laTrace("push token ActivityKit enregistré backend", { orderId, hasActivityId: Boolean(activityId) });
}

function syncLiveActivityPushToken(
  orderId: string,
  live: LiveActivity<OrderTrackingLiveProps>,
  props: OrderTrackingLiveProps,
): void {
  const sub = live.addPushTokenListener((event) => {
    void registerLiveActivityPushToken(orderId, event.pushToken, props, event.activityId).catch((e) => {
      logger.warn("[orderLiveActivity] listener push token ActivityKit", "orderLiveActivity", e);
    });
  });

  if (active?.orderId === orderId) {
    active.pushTokenSub?.remove();
    active.pushTokenSub = sub;
  }

  void live
    .getPushToken()
    .then((pushToken) => {
      if (!pushToken) return;
      return registerLiveActivityPushToken(orderId, pushToken, props);
    })
    .catch((e) => {
      logger.warn("[orderLiveActivity] getPushToken ActivityKit non disponible", "orderLiveActivity", e);
    });
}

async function markBackendLiveActivityEnded(orderId: string | null | undefined): Promise<void> {
  if (!orderId) return;
  const token = await userApiService.ensureAccessToken();
  if (!token) return;
  await apiFetch(
    `${config.apiUrl}/api/push/live-activity/end`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ orderId }),
    },
    { maxRetries: 0 }
  ).catch((e) => {
    logger.warn("[orderLiveActivity] marquage Live Activity terminée non bloquant", "orderLiveActivity", e);
  });
}

/** Termine toutes les Live Activities de ce type. */
async function endAllLiveActivities(): Promise<void> {
  const previousOrderId = active?.orderId ?? null;
  active?.pushTokenSub?.remove();
  active = null;
  lastLiveActivityUpdate = null;
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
  void markBackendLiveActivityEnded(previousOrderId);
}

export type SyncOrderLiveActivityOptions = {
  /** Déconnexion / arrêt explicite : fermer tout de suite sans attendre le debounce cold start. */
  immediateEnd?: boolean;
  /** Position livreur temps réel : permet une progression fluide entre deux statuts. */
  driverCoords?: Coordinates | null;
};

let didWarmNativeBridge = false;

/**
 * Précharge le factory `OrderTrackingLive` et laisse une fenêtre au runtime natif
 * avant le premier `start()` (appel idéal depuis `_layout` au cold start iOS).
 */
export async function warmOrderLiveActivityNativeBridge(): Promise<void> {
  if (!supportsLiveActivitiesIOS()) return;
  await prepareLiveActivityAssets();
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
    if (order?.id) phaseProgressByOrder.delete(order.id);
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
    await prepareLiveActivityAssets();
    const f = getFactory();
    const props = propsFromOrder(order!, options.driverCoords);
    const url = `appchrono://order-tracking/${encodeURIComponent(order!.id)}`;
    laTrace("sync: entrée start/update", {
      orderId: order!.id,
      status: order!.status,
      hasDriverAvatarUrl: Boolean(props.driverAvatarUrl?.trim()),
      appState: AppState.currentState,
    });

    if (active?.orderId === order!.id) {
      if (shouldSkipLiveActivityUpdate(order!.id, props)) {
        return;
      }
      try {
        await active.live.update(props);
        markLiveActivityUpdated(order!.id, props);
        if (active.pushToken) {
          void registerLiveActivityPushToken(order!.id, active.pushToken, props).catch((e) => {
            logger.warn("[orderLiveActivity] refresh props ActivityKit token", "orderLiveActivity", e);
          });
        }
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
        active.pushTokenSub?.remove();
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
    markLiveActivityUpdated(order!.id, props);
    syncLiveActivityPushToken(order!.id, live, props);
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
