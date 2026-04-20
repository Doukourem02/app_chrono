/**
 * Notifications distantes : enregistrement du token Expo sur l’API + écoute pour resynchroniser
 * commandes / socket quand un événement arrive (complément indispensable hors premier plan sur iOS).
 */
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { AppState, Linking, Platform } from "react-native";
import { router } from "expo-router";
import { config } from "../config";
import { logger } from "../utils/logger";
import { apiFetch } from "../utils/apiFetch";
import { userApiService } from "./userApiService";

let handlerConfigured = false;
/** Évite de rejouer la dernière notif à chaque focus session (cold start une fois). */
let coldStartNotificationHandled = false;

function asPushString(v: unknown): string | undefined {
  if (typeof v === "string" && v.trim()) return v.trim();
  return undefined;
}

/**
 * Navigation depuis le payload `data` d’une notification Expo (tap ou cold start).
 * Backend : `order_status` / `order_chat_message` + `orderId`, optionnel `trackUrl`, `conversationId`.
 */
export function navigateFromClientPushPayload(
  data: Record<string, unknown> | undefined | null
): void {
  if (!data || typeof data !== "object") return;
  const type = asPushString(data.type);
  const orderId = asPushString(data.orderId);
  const trackUrl = asPushString(data.trackUrl);

  if (type === "order_chat_message" && orderId) {
    router.push(`/order-tracking/${encodeURIComponent(orderId)}?openChat=1` as any);
    return;
  }
  if (type === "order_status" && orderId) {
    router.push(`/order-tracking/${encodeURIComponent(orderId)}` as any);
    return;
  }
  if (trackUrl && /^https?:\/\//i.test(trackUrl)) {
    void Linking.openURL(trackUrl);
  }
}

/** iOS : Keychain peut refuser `errSecInteractionNotAllowed` (-25308) si l’app n’est pas encore « active ». */
async function waitForIosPushKeychainReady(): Promise<void> {
  if (Platform.OS !== "ios") return;
  await new Promise<void>((resolve) => {
    const finish = () => setTimeout(resolve, 500);
    if (AppState.currentState === "active") {
      finish();
      return;
    }
    const timeout = setTimeout(() => {
      sub.remove();
      finish();
    }, 12000);
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "active") {
        clearTimeout(timeout);
        sub.remove();
        finish();
      }
    });
  });
}

/** À appeler une fois l’utilisateur connecté : ouvre l’écran si l’app a été lancée via une notif. */
export function processClientPushColdStartNavigation(): void {
  if (coldStartNotificationHandled) return;
  coldStartNotificationHandled = true;
  void Notifications.getLastNotificationResponseAsync()
    .then((response) => {
      if (!response) return;
      const data = response.notification.request.content
        .data as Record<string, unknown>;
      navigateFromClientPushPayload(data);
    })
    .catch((e) => {
      logger.warn("getLastNotificationResponseAsync (non bloquant)", "clientPush", e);
    });
}

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

export async function unregisterClientPushNotifications(): Promise<void> {
  if (Platform.OS === "web") return;

  const token = await userApiService.ensureAccessToken();
  if (!token) return;

  const projectId =
    (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas
      ?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId || typeof projectId !== "string") return;

  try {
    const push = await Notifications.getExpoPushTokenAsync({ projectId });
    await apiFetch(
      `${config.apiUrl}/api/push/register`,
      {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          app: "client",
          expoPushToken: push.data,
        }),
      },
      { maxRetries: 0 }
    );
  } catch (e) {
    logger.warn("unregisterPush: échec non bloquant", "clientPush", e);
  }
}

/**
 * Demande la permission + envoie le token Expo à POST /api/push/register.
 * À appeler après connexion (JWT disponible).
 */
export async function initializeClientPushNotifications(_userId: string): Promise<void> {
  if (Platform.OS === "web") return;

  try {
    await waitForIosPushKeychainReady();

    ensureNotificationHandler();

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "Krono",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        sound: "default",
      });
    }

    const isGranted = (perm: unknown): boolean => {
      const p = perm as any;
      // iOS (SDK55): p.ios.status is IosAuthorizationStatus (0..4). Granted = 2/3/4.
      const iosStatus = p?.ios?.status;
      if (typeof iosStatus === "number") {
        return iosStatus === 2 || iosStatus === 3 || iosStatus === 4;
      }
      // Some Expo versions expose these directly.
      if (typeof p?.granted === "boolean") return p.granted;
      if (typeof p?.status === "string") return p.status === "granted";
      return false;
    };

    let granted = false;
    try {
      const perm = await Notifications.getPermissionsAsync();
      granted = isGranted(perm);
    } catch (e) {
      logger.warn("getPermissionsAsync (notifications) — Keychain / timing iOS ?", "clientPush", e);
      return;
    }
    if (!granted) {
      try {
        const req = await Notifications.requestPermissionsAsync();
        granted = isGranted(req);
      } catch (e) {
        logger.warn("requestPermissionsAsync (notifications)", "clientPush", e);
        return;
      }
    }
    if (!granted) {
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
        "getExpoPushTokenAsync ou register échoué (Android : souvent FCM non configuré sur expo.dev — voir docs/krono-reference-unique.md)",
        "clientPush",
        e
      );
    }
  } catch (e) {
    logger.warn("initializeClientPushNotifications (non bloquant)", "clientPush", e);
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
  const sub2 = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content
      .data as Record<string, unknown>;
    navigateFromClientPushPayload(data);
    onRefresh();
  });

  return () => {
    sub1.remove();
    sub2.remove();
  };
}
