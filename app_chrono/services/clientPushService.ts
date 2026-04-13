/**
 * Notifications distantes : enregistrement du token Expo sur l’API + écoute pour resynchroniser
 * commandes / socket quand un événement arrive (complément indispensable hors premier plan sur iOS).
 */
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { config } from "../config";
import { logger } from "../utils/logger";
import { apiFetch } from "../utils/apiFetch";
import { userApiService } from "./userApiService";

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
  const token = await userApiService.ensureAccessToken();
  if (!token) {
    logger.warn("registerPush: pas de JWT", "clientPush");
    return false;
  }
  const platform = Platform.OS === "ios" ? "ios" : "android";
  const response = await apiFetch(
    `${config.apiUrl}/api/push/register`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        expoPushToken,
        platform,
        app: "client",
      }),
    },
    { maxRetries: 1 }
  );
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    let errCode: string | undefined;
    try {
      const j = JSON.parse(text) as { errCode?: string; message?: string };
      errCode = j.errCode;
    } catch {
      /* ignore */
    }
    logger.warn("registerPush: HTTP non OK — aucune ligne créée dans push_tokens", "clientPush", {
      status: response.status,
      errCode,
      body: text.slice(0, 300),
    });
    return false;
  }
  return true;
}

/**
 * Demande la permission + envoie le token Expo à POST /api/push/register.
 * À appeler après connexion (JWT disponible).
 */
export async function initializeClientPushNotifications(_userId: string): Promise<void> {
  if (Platform.OS === "web") return;

  ensureNotificationHandler();

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Krono",
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
    logger.warn("Notifications refusées par l’utilisateur", "clientPush");
    return;
  }

  const projectId =
    (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas
      ?.projectId ?? Constants.easConfig?.projectId;

  if (!projectId || typeof projectId !== "string") {
    logger.warn("EAS projectId manquant (extra.eas.projectId) — token push impossible", "clientPush");
    return;
  }

  try {
    const push = await Notifications.getExpoPushTokenAsync({ projectId });
    const saved = await registerTokenWithBackend(push.data);
    if (saved) {
      logger.info("Token push client enregistré côté API", "clientPush", { platform: Platform.OS });
    }
  } catch (e) {
    logger.warn(
      "getExpoPushTokenAsync ou register échoué (Android : souvent FCM non configuré sur expo.dev — voir docs/checklists/android-push-fcm.md)",
      "clientPush",
      e
    );
  }
}

/**
 * Resynchroniser l’app quand une notification arrive ou est ouverte (données à jour).
 */
export function setupClientPushListeners(onRefresh: () => void): () => void {
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
