/**
 * Enregistrement du token Expo Push sur l’API (app livreur).
 * Aligné sur app_chrono/services/clientPushService.ts
 */
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { config } from "../config";
import { logger } from "../utils/logger";
import { apiFetch } from "../utils/apiFetch";
import { apiService } from "./apiService";

let handlerConfigured = false;

function ensureNotificationHandler(): void {
  if (handlerConfigured) return;
  handlerConfigured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

async function registerTokenWithBackend(expoPushToken: string): Promise<boolean> {
  const { token } = await apiService.ensureAccessToken();
  if (!token) {
    logger.warn("registerPush: pas de JWT", "driverPush");
    return false;
  }
  const platform = Platform.OS === "ios" ? "ios" : "android";
  const response = await apiFetch(`${config.apiUrl}/api/push/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      expoPushToken,
      platform,
      app: "driver",
    }),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    let errCode: string | undefined;
    try {
      const j = JSON.parse(text) as { errCode?: string; message?: string };
      errCode = j.errCode;
    } catch {
      /* ignore */
    }
    logger.warn("registerPush: HTTP non OK — aucune ligne créée dans push_tokens", "driverPush", {
      status: response.status,
      errCode,
      body: text.slice(0, 300),
    });
    return false;
  }
  return true;
}

/**
 * Permission + envoi du token à POST /api/push/register (après connexion).
 */
export async function initializeDriverPushNotifications(_userId: string): Promise<void> {
  if (Platform.OS === "web") return;

  ensureNotificationHandler();

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Krono pro",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      sound: "default",
    });
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== "granted") {
    logger.warn("Notifications refusées par l’utilisateur", "driverPush");
    return;
  }

  const projectId =
    (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas
      ?.projectId ?? Constants.easConfig?.projectId;

  if (!projectId || typeof projectId !== "string") {
    logger.warn("EAS projectId manquant (extra.eas.projectId) — token push impossible", "driverPush");
    return;
  }

  try {
    const push = await Notifications.getExpoPushTokenAsync({ projectId });
    const saved = await registerTokenWithBackend(push.data);
    if (saved) {
      logger.info("Token push livreur enregistré côté API", "driverPush", { platform: Platform.OS });
    }
  } catch (e) {
    logger.warn(
      "getExpoPushTokenAsync ou register échoué (Android : FCM sur expo.dev — voir docs/checklists/android-push-fcm.md)",
      "driverPush",
      e
    );
  }
}

export function setupDriverPushListeners(onRefresh: () => void): () => void {
  ensureNotificationHandler();

  const sub1 = Notifications.addNotificationReceivedListener(() => {
    onRefresh();
  });
  const sub2 = Notifications.addNotificationResponseReceivedListener(() => {
    onRefresh();
  });

  return () => {
    sub1.remove();
    sub2.remove();
  };
}
