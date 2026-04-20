/**
 * Alignement client en arrière-plan : à chaque point GPS (hors premier plan), resynchronise
 * les commandes via l’API pour limiter le décalage socket / UI.
 * Les notifications push restent le canal principal pour alerter hors app.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { Platform } from "react-native";
import { useAuthStore } from "../store/useAuthStore";
import type { OrderRequest, OrderStatus } from "../store/useOrderStore";
import { logger } from "../utils/logger";
import { userApiService } from "./userApiService";
import { syncClientOrdersFromApi } from "./userAppResync";

export const CLIENT_BACKGROUND_LOCATION_TASK = "krono-client-background-location-v1";

const DUTY_KEY = "@krono_client_background_duty";
const DUTY_NOTIFICATION_KEY = "@krono_client_background_notification";
const KRONO_PURPLE = "#A78BFA";

type AndroidTrackingNotification = {
  title: string;
  body: string;
  signature: string;
};

const PICKUP_STATUSES = new Set<OrderStatus>(["accepted", "enroute", "in_progress"]);
const DELIVERY_STATUSES = new Set<OrderStatus>(["picked_up", "delivering"]);

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeEtaLabel(value: unknown): string {
  const raw = cleanText(value);
  if (!raw) return "";
  const numberMatch = raw.match(/\d+/);
  if (!numberMatch) return "";
  return `${numberMatch[0]} min`;
}

function capitalized(value: unknown): string {
  const raw = cleanText(value);
  if (!raw) return "";
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function vehicleInfo(order?: OrderRequest | null): string {
  const driver = order?.driver;
  if (!driver && !order?.deliveryMethod) return "";

  const plate = cleanText(driver?.vehicle_plate || driver?.vehiclePlate).toUpperCase();
  const color = capitalized(driver?.vehicle_color || driver?.vehicleColor);
  const brand = cleanText(driver?.vehicle_brand || driver?.vehicleBrand);
  const model = cleanText(driver?.vehicle_model || driver?.vehicleModel);
  const vehicleName = [brand, model].filter(Boolean).join(" ");
  const type = capitalized(driver?.vehicle_type || driver?.vehicleType || order?.deliveryMethod);

  return [plate, color, vehicleName || type].filter(Boolean).join(" · ");
}

function buildAndroidTrackingNotification(order?: OrderRequest | null): AndroidTrackingNotification {
  const status = order?.status;
  const eta = normalizeEtaLabel(order?.estimatedDuration);
  const vehicle = vehicleInfo(order);

  if (status === "pending") {
    return {
      title: "Krono — recherche de livreur",
      body: "Recherche de livreur en cours. On vous prévient dès qu’un livreur accepte.",
      signature: JSON.stringify({ status, orderId: order?.id || "", eta, vehicle }),
    };
  }

  if (status && PICKUP_STATUSES.has(status)) {
    const lead = eta ? `Prise en charge dans ${eta}` : "Prise en charge en cours";
    return {
      title: "Krono — prise en charge",
      body: [lead, vehicle].filter(Boolean).join(" · "),
      signature: JSON.stringify({ status, orderId: order?.id || "", eta, vehicle }),
    };
  }

  if (status && DELIVERY_STATUSES.has(status)) {
    const lead = eta ? `Livraison dans ${eta}` : "Livraison en cours";
    return {
      title: "Krono — livraison en cours",
      body: [lead, vehicle].filter(Boolean).join(" · "),
      signature: JSON.stringify({ status, orderId: order?.id || "", eta, vehicle }),
    };
  }

  return {
    title: "Krono — suivi de commande",
    body: vehicle || "Mise à jour de l’état de votre livraison.",
    signature: JSON.stringify({ status: status || "none", orderId: order?.id || "", eta, vehicle }),
  };
}

export async function setClientBackgroundDutyUser(userId: string | null): Promise<void> {
  if (!userId) {
    await AsyncStorage.removeItem(DUTY_KEY);
    return;
  }
  await AsyncStorage.setItem(DUTY_KEY, JSON.stringify({ userId, t: Date.now() }));
}

export async function clearClientBackgroundDutyUser(): Promise<void> {
  await AsyncStorage.removeItem(DUTY_KEY);
}

async function setClientBackgroundNotificationSignature(signature: string | null): Promise<void> {
  if (!signature) {
    await AsyncStorage.removeItem(DUTY_NOTIFICATION_KEY);
    return;
  }
  await AsyncStorage.setItem(DUTY_NOTIFICATION_KEY, signature);
}

async function readClientBackgroundNotificationSignature(): Promise<string | null> {
  return AsyncStorage.getItem(DUTY_NOTIFICATION_KEY);
}

async function readDutyUserId(): Promise<string | null> {
  try {
    const raw = await AsyncStorage.getItem(DUTY_KEY);
    if (!raw) return null;
    const j = JSON.parse(raw) as { userId?: string };
    return typeof j.userId === "string" ? j.userId : null;
  } catch {
    return null;
  }
}

if (Platform.OS !== "web") {
  TaskManager.defineTask(CLIENT_BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
    if (error) {
      logger.warn("[client-bg] tâche erreur", "clientBgLocation", String(error));
      return;
    }
    if (!data) return;

    const payload = data as { locations?: Location.LocationObject[] };
    if (!payload.locations?.length) return;

    try {
      if (!useAuthStore.persist.hasHydrated()) {
        await new Promise<void>((resolve) => {
          const unsub = useAuthStore.persist.onFinishHydration(() => {
            unsub?.();
            resolve();
          });
        });
      }
    } catch {
      /* ignore */
    }

    const userId = await readDutyUserId();
    if (!userId) return;

    const token = await userApiService.ensureAccessToken();
    if (!token) return;

    try {
      await syncClientOrdersFromApi(userId);
    } catch (e) {
      if (__DEV__) {
        logger.debug("[client-bg] sync commandes échouée", "clientBgLocation", e);
      }
    }
  });
}

export async function requestClientBackgroundLocationPermission(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  const fg = await Location.getForegroundPermissionsAsync();
  if (fg.status !== Location.PermissionStatus.GRANTED) return false;
  const bg = await Location.getBackgroundPermissionsAsync();
  if (bg.status === Location.PermissionStatus.GRANTED) return true;
  const res = await Location.requestBackgroundPermissionsAsync();
  return res.status === Location.PermissionStatus.GRANTED;
}

export async function startClientBackgroundAlignment(
  userId: string,
  order?: OrderRequest | null
): Promise<boolean> {
  if (Platform.OS === "web" || !userId) return false;

  try {
    const notification = buildAndroidTrackingNotification(order);
    const already = await Location.hasStartedLocationUpdatesAsync(CLIENT_BACKGROUND_LOCATION_TASK);
    if (already) {
      await setClientBackgroundDutyUser(userId);
      const previousSignature = await readClientBackgroundNotificationSignature();
      if (Platform.OS !== "android" || previousSignature === notification.signature) {
        return true;
      }
      await Location.stopLocationUpdatesAsync(CLIENT_BACKGROUND_LOCATION_TASK);
    }

    const fg = await Location.getForegroundPermissionsAsync();
    if (fg.status !== Location.PermissionStatus.GRANTED) {
      logger.warn("[client-bg] pas de permission premier plan", "clientBgLocation");
      return false;
    }

    let bg = await Location.getBackgroundPermissionsAsync();
    if (bg.status !== Location.PermissionStatus.GRANTED) {
      bg = await Location.requestBackgroundPermissionsAsync();
      if (bg.status !== Location.PermissionStatus.GRANTED) {
        logger.warn(
          "[client-bg] permission « Toujours » refusée — sync arrière-plan limitée",
          "clientBgLocation"
        );
        return false;
      }
    }

    await setClientBackgroundDutyUser(userId);

    await Location.startLocationUpdatesAsync(CLIENT_BACKGROUND_LOCATION_TASK, {
      accuracy: Location.Accuracy.Balanced,
      distanceInterval: 80,
      timeInterval: 25000,
      deferredUpdatesDistance: 100,
      deferredUpdatesInterval: 60000,
      showsBackgroundLocationIndicator: true,
      activityType: Location.ActivityType.OtherNavigation,
      pausesUpdatesAutomatically: true,
      foregroundService: {
        notificationTitle: notification.title,
        notificationBody: notification.body,
        notificationColor: KRONO_PURPLE,
      },
    });
    await setClientBackgroundNotificationSignature(notification.signature);

    logger.info("[client-bg] démarré", "clientBgLocation", { userId: userId.slice(0, 8) });
    return true;
  } catch (e) {
    logger.warn("[client-bg] start échoué", "clientBgLocation", e);
    await clearClientBackgroundDutyUser();
    await setClientBackgroundNotificationSignature(null);
    return false;
  }
}

export async function stopClientBackgroundAlignment(): Promise<void> {
  if (Platform.OS === "web") return;

  try {
    await clearClientBackgroundDutyUser();
    await setClientBackgroundNotificationSignature(null);
    const started = await Location.hasStartedLocationUpdatesAsync(CLIENT_BACKGROUND_LOCATION_TASK);
    if (started) {
      await Location.stopLocationUpdatesAsync(CLIENT_BACKGROUND_LOCATION_TASK);
    }
    if (__DEV__) {
      logger.debug("[client-bg] arrêté", "clientBgLocation");
    }
  } catch (e) {
    logger.warn("[client-bg] stop échoué", "clientBgLocation", e);
  }
}
