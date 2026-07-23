/**
 * Rappels locaux côté client : uniquement les rappels utiles hors tracking.
 * Le suivi temps réel est déjà couvert par l’écran de tracking, la Live Activity et les push statut.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import type { OrderRequest } from "../store/useOrderStore";
import { logger } from "../utils/logger";
import { userApiService } from "./userApiService";

const REMINDER_CHANNEL_ID = "krono-reminders";
const REMINDER_PREFIX = "krono:client-reminder:";
const REMINDER_STATE_KEY = "@krono_client_smart_reminders";
const KRONO_PURPLE = "#A78BFA";
const DAY_MS = 24 * 60 * 60 * 1000;
const RATING_REMINDER_DELAY_SECONDS = 30 * 60;

type ReminderPlan = {
  identifier: string;
  title: string;
  body: string;
  seconds: number;
  cooldownMs: number;
  data: Record<string, string>;
};

function ratingReminderIdentifier(orderId: string): string {
  return `${REMINDER_PREFIX}${orderId}:rating`;
}

async function hasExistingRating(orderId: string): Promise<boolean> {
  try {
    const result = await userApiService.getOrderRating(orderId);
    return Boolean(result.success && result.data);
  } catch {
    return false;
  }
}

async function buildReminderPlan(order: OrderRequest): Promise<ReminderPlan | null> {
  if (order.status !== "completed") return null;
  if (!(order.driverId || order.driver?.id)) return null;
  if (await hasExistingRating(order.id)) return null;

  return {
    identifier: ratingReminderIdentifier(order.id),
    title: "Votre avis compte",
    body: "Pensez à noter votre livreur. Votre retour aide Krono à garder un service fiable.",
    seconds: RATING_REMINDER_DELAY_SECONDS,
    cooldownMs: 7 * DAY_MS,
    data: {
      type: "order_rating_reminder",
      orderId: order.id,
      status: order.status,
    },
  };
}

async function ensureReminderChannel(): Promise<void> {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL_ID, {
    name: "Rappels Krono",
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 180, 120, 180],
    lightColor: KRONO_PURPLE,
    sound: "default",
  });
}

async function notificationsAllowed(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  const isGranted = (perm: unknown): boolean => {
    const p = perm as any;
    const iosStatus = p?.ios?.status;
    if (typeof iosStatus === "number") return iosStatus === 2 || iosStatus === 3 || iosStatus === 4;
    if (typeof p?.granted === "boolean") return p.granted;
    if (typeof p?.status === "string") return p.status === "granted";
    return false;
  };

  const current = await Notifications.getPermissionsAsync();
  if (isGranted(current)) return true;
  const requested = await Notifications.requestPermissionsAsync();
  return isGranted(requested);
}

async function readReminderState(): Promise<Record<string, number>> {
  try {
    const raw = await AsyncStorage.getItem(REMINDER_STATE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, number>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

async function writeReminderState(state: Record<string, number>): Promise<void> {
  await AsyncStorage.setItem(REMINDER_STATE_KEY, JSON.stringify(state));
}

function pruneReminderState(
  state: Record<string, number>,
  wantedIds: Set<string>,
  now: number
): Record<string, number> {
  const next: Record<string, number> = {};
  for (const [id, scheduledAt] of Object.entries(state)) {
    if (!wantedIds.has(id)) continue;
    if (!Number.isFinite(scheduledAt) || now - scheduledAt > DAY_MS) continue;
    next[id] = scheduledAt;
  }
  return next;
}

export async function reconcileClientSmartReminders(activeOrders: OrderRequest[]): Promise<void> {
  if (Platform.OS === "web") return;

  try {
    const plans = (
      await Promise.all(activeOrders.map((order) => buildReminderPlan(order)))
    ).filter((plan): plan is ReminderPlan => Boolean(plan));

    const wantedIds = new Set(plans.map((plan) => plan.identifier));
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const scheduledKronoIds = scheduled
      .map((notification) => notification.identifier)
      .filter((id) => id.startsWith(REMINDER_PREFIX));

    await Promise.all(
      scheduledKronoIds
        .filter((id) => !wantedIds.has(id))
        .map((id) => Notifications.cancelScheduledNotificationAsync(id))
    );

    if (!plans.length) {
      const state = await readReminderState();
      const pruned = pruneReminderState(state, wantedIds, Date.now());
      await writeReminderState(pruned);
      return;
    }

    if (!(await notificationsAllowed())) return;
    await ensureReminderChannel();

    const now = Date.now();
    const scheduledIds = new Set(scheduledKronoIds);
    const state = pruneReminderState(await readReminderState(), wantedIds, now);

    for (const plan of plans) {
      if (scheduledIds.has(plan.identifier)) continue;
      const lastScheduledAt = state[plan.identifier] || 0;
      if (lastScheduledAt && now - lastScheduledAt < plan.cooldownMs) continue;

      await Notifications.scheduleNotificationAsync({
        identifier: plan.identifier,
        content: {
          title: plan.title,
          body: plan.body,
          data: plan.data,
          sound: "default",
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: plan.seconds,
          repeats: false,
          channelId: REMINDER_CHANNEL_ID,
        },
      });
      state[plan.identifier] = now;
    }

    await writeReminderState(state);
  } catch (e) {
    logger.warn("[client-reminders] reconciliation échouée", "clientSmartReminder", e);
  }
}

export async function cancelClientRatingReminder(orderId: string | null | undefined): Promise<void> {
  if (Platform.OS === "web" || !orderId) return;

  try {
    const id = ratingReminderIdentifier(orderId);
    await Notifications.cancelScheduledNotificationAsync(id);
    const state = await readReminderState();
    if (state[id]) {
      delete state[id];
      await writeReminderState(state);
    }
  } catch (e) {
    logger.warn("[client-reminders] annulation rappel notation échouée", "clientSmartReminder", e);
  }
}

export async function cancelClientSmartReminders(): Promise<void> {
  if (Platform.OS === "web") return;

  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      scheduled
        .map((notification) => notification.identifier)
        .filter((id) => id.startsWith(REMINDER_PREFIX))
        .map((id) => Notifications.cancelScheduledNotificationAsync(id))
    );
    await AsyncStorage.removeItem(REMINDER_STATE_KEY);
  } catch (e) {
    logger.warn("[client-reminders] annulation échouée", "clientSmartReminder", e);
  }
}
