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
import { logger } from "../utils/logger";
import { userApiService } from "./userApiService";
import { syncClientOrdersFromApi } from "./userAppResync";

export const CLIENT_BACKGROUND_LOCATION_TASK = "krono-client-background-location-v1";

const DUTY_KEY = "@krono_client_background_duty";

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

export async function startClientBackgroundAlignment(userId: string): Promise<boolean> {
  if (Platform.OS === "web" || !userId) return false;

  try {
    const already = await Location.hasStartedLocationUpdatesAsync(CLIENT_BACKGROUND_LOCATION_TASK);
    if (already) {
      await setClientBackgroundDutyUser(userId);
      return true;
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
        notificationTitle: "Krono — suivi de commande",
        notificationBody: "Mise à jour de l’état de votre livraison.",
        notificationColor: "#8B5CF6",
      },
    });

    logger.info("[client-bg] démarré", "clientBgLocation", { userId: userId.slice(0, 8) });
    return true;
  } catch (e) {
    logger.warn("[client-bg] start échoué", "clientBgLocation", e);
    await clearClientBackgroundDutyUser();
    return false;
  }
}

export async function stopClientBackgroundAlignment(): Promise<void> {
  if (Platform.OS === "web") return;

  try {
    await clearClientBackgroundDutyUser();
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
