import pool from '../config/db.js';
import logger from '../utils/logger.js';
import { sendCampaignPushToUser } from './expoPushService.js';

type AppRole = 'client' | 'driver';
type CampaignKey =
  | 'client_delivery_intent'
  | 'client_weekend_delivery'
  | 'driver_nearby_orders'
  | 'driver_high_demand'
  | 'driver_offline_nudge';

type Candidate = {
  userId: string;
  metadata?: Record<string, unknown>;
};

type CampaignCopy = {
  key: CampaignKey;
  appRole: AppRole;
  title: string;
  body: string;
  data: Record<string, unknown>;
  cooldown: string;
};

const ACTIVE_ORDER_STATUSES = [
  'pending',
  'accepted',
  'enroute',
  'in_progress',
  'picked_up',
  'delivering',
];
const DEFAULT_TIMEZONE = 'Africa/Abidjan';
const ALLOWED_START_HOUR = 10;
const ALLOWED_END_HOUR = 20;
const DEFAULT_INTERVAL_MS = 60 * 60 * 1000;
const DRIVER_NEARBY_RADIUS_KM = 8;

let scheduler: ReturnType<typeof setInterval> | null = null;
let running = false;

function envFlag(name: string): boolean {
  const value = String(process.env[name] || '').trim().toLowerCase();
  return value === '1' || value === 'true' || value === 'yes';
}

function envNumber(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function campaignTimezone(): string {
  return process.env.NOTIFICATION_CAMPAIGNS_TIMEZONE?.trim() || DEFAULT_TIMEZONE;
}

function localParts(date = new Date()): { hour: number; weekday: string } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: campaignTimezone(),
    hour: '2-digit',
    hour12: false,
    weekday: 'short',
  }).formatToParts(date);
  const hour = Number(parts.find((part) => part.type === 'hour')?.value || 0);
  const weekday = parts.find((part) => part.type === 'weekday')?.value || '';
  return { hour, weekday };
}

function isAllowedCampaignWindow(): boolean {
  const { hour } = localParts();
  return hour >= ALLOWED_START_HOUR && hour < ALLOWED_END_HOUR;
}

function isWeekendPlacementDay(): boolean {
  const { weekday } = localParts();
  return weekday === 'Fri' || weekday === 'Sat';
}

function maxPerRun(): number {
  return Math.min(envNumber('NOTIFICATION_CAMPAIGNS_MAX_PER_RUN', 50), 250);
}

function activeStatusSql(): string {
  return ACTIVE_ORDER_STATUSES.map((status) => `'${status}'`).join(', ');
}

function asNumber(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function extractCoordinates(value: unknown): { latitude: number; longitude: number } | null {
  if (!value || typeof value !== 'object') return null;
  const obj = value as Record<string, unknown>;
  const coords =
    obj.coordinates && typeof obj.coordinates === 'object'
      ? (obj.coordinates as Record<string, unknown>)
      : obj;
  const latitude = asNumber(coords.latitude ?? coords.lat);
  const longitude = asNumber(coords.longitude ?? coords.lng ?? coords.lon);
  if (latitude == null || longitude == null) return null;
  return { latitude, longitude };
}

function distanceKm(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number }
): number {
  const earthRadiusKm = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * earthRadiusKm * Math.asin(Math.sqrt(h));
}

async function hasAnyCampaignSince(userId: string, interval: string): Promise<boolean> {
  const result = await pool.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1
       FROM public.notification_campaign_deliveries
       WHERE user_id = $1
         AND sent_at > NOW() - $2::interval
     ) AS exists`,
    [userId, interval]
  );
  return Boolean(result.rows[0]?.exists);
}

async function claimCampaignDelivery(
  userId: string,
  appRole: AppRole,
  campaignKey: CampaignKey,
  cooldown: string,
  metadata: Record<string, unknown>
): Promise<boolean> {
  const result = await pool.query<{ id: string }>(
    `INSERT INTO public.notification_campaign_deliveries (
       user_id, app_role, campaign_key, metadata
     )
     SELECT $1, $2, $3, $5::jsonb
     WHERE NOT EXISTS (
       SELECT 1
       FROM public.notification_campaign_deliveries
       WHERE user_id = $1
         AND campaign_key = $3
         AND sent_at > NOW() - $4::interval
     )
     RETURNING id`,
    [userId, appRole, campaignKey, cooldown, JSON.stringify(metadata || {})]
  );
  return Boolean(result.rows[0]?.id);
}

async function sendCampaign(candidate: Candidate, copy: CampaignCopy): Promise<boolean> {
  if (await hasAnyCampaignSince(candidate.userId, '20 hours')) return false;
  const claimed = await claimCampaignDelivery(
    candidate.userId,
    copy.appRole,
    copy.key,
    copy.cooldown,
    candidate.metadata || {}
  );
  if (!claimed) return false;

  await sendCampaignPushToUser({
    userId: candidate.userId,
    appRole: copy.appRole,
    title: copy.title,
    body: copy.body,
    data: {
      ...copy.data,
      campaignKey: copy.key,
    },
  });
  return true;
}

async function clientReactivationCandidates(limit: number): Promise<Candidate[]> {
  const result = await pool.query<{ user_id: string }>(
    `SELECT u.id AS user_id
     FROM public.users u
     WHERE u.role::text = 'client'
       AND u.status::text = 'active'
       AND EXISTS (
         SELECT 1 FROM public.push_tokens pt
         WHERE pt.user_id = u.id AND pt.app_role = 'client' AND pt.invalidated_at IS NULL
       )
       AND EXISTS (
         SELECT 1 FROM public.orders o
         WHERE o.user_id = u.id AND o.status = 'completed'
       )
       AND NOT EXISTS (
         SELECT 1 FROM public.orders o
         WHERE o.user_id = u.id AND o.status IN (${activeStatusSql()})
       )
       AND NOT EXISTS (
         SELECT 1 FROM public.orders o
         WHERE o.user_id = u.id AND o.created_at > NOW() - INTERVAL '10 days'
       )
       AND (u.last_login IS NULL OR u.last_login < NOW() - INTERVAL '48 hours')
     ORDER BY u.last_login ASC NULLS FIRST
     LIMIT $1`,
    [limit]
  );
  return result.rows.map((row) => ({ userId: row.user_id }));
}

async function clientWeekendCandidates(limit: number): Promise<Candidate[]> {
  if (!isWeekendPlacementDay()) return [];
  const result = await pool.query<{ user_id: string }>(
    `SELECT u.id AS user_id
     FROM public.users u
     WHERE u.role::text = 'client'
       AND u.status::text = 'active'
       AND EXISTS (
         SELECT 1 FROM public.push_tokens pt
         WHERE pt.user_id = u.id AND pt.app_role = 'client' AND pt.invalidated_at IS NULL
       )
       AND EXISTS (
         SELECT 1 FROM public.orders o
         WHERE o.user_id = u.id AND o.status = 'completed'
       )
       AND NOT EXISTS (
         SELECT 1 FROM public.orders o
         WHERE o.user_id = u.id AND o.status IN (${activeStatusSql()})
       )
       AND NOT EXISTS (
         SELECT 1 FROM public.orders o
         WHERE o.user_id = u.id AND o.created_at > NOW() - INTERVAL '14 days'
       )
       AND (u.last_login IS NULL OR u.last_login < NOW() - INTERVAL '72 hours')
     ORDER BY u.last_login ASC NULLS FIRST
     LIMIT $1`,
    [limit]
  );
  return result.rows.map((row) => ({ userId: row.user_id }));
}

async function pendingPickupCoordinates(): Promise<Array<{ latitude: number; longitude: number }>> {
  const result = await pool.query<{ pickup: unknown }>(
    `SELECT pickup
     FROM public.orders
     WHERE status = 'pending'
       AND created_at > NOW() - INTERVAL '45 minutes'
     ORDER BY created_at DESC
     LIMIT 50`
  );
  return result.rows
    .map((row) => extractCoordinates(row.pickup))
    .filter((coords): coords is { latitude: number; longitude: number } => Boolean(coords));
}

async function driverOfflineCandidates(limit: number): Promise<
  Array<Candidate & { latitude?: number; longitude?: number }>
> {
  const result = await pool.query<{
    user_id: string;
    current_latitude: string | number | null;
    current_longitude: string | number | null;
  }>(
    `SELECT u.id AS user_id, dp.current_latitude, dp.current_longitude
     FROM public.users u
     JOIN public.driver_profiles dp ON dp.user_id = u.id
     WHERE u.role::text = 'driver'
       AND u.status::text = 'active'
       AND EXISTS (
         SELECT 1 FROM public.push_tokens pt
         WHERE pt.user_id = u.id AND pt.app_role = 'driver' AND pt.invalidated_at IS NULL
       )
       AND NOT EXISTS (
         SELECT 1 FROM public.orders o
         WHERE o.driver_id = u.id AND o.status IN (${activeStatusSql()})
       )
       AND COALESCE(dp.is_online, false) = false
       AND (u.last_login IS NULL OR u.last_login < NOW() - INTERVAL '2 hours')
     ORDER BY dp.updated_at DESC NULLS LAST
     LIMIT $1`,
    [limit]
  );
  return result.rows.map((row) => ({
    userId: row.user_id,
    latitude: asNumber(row.current_latitude) ?? undefined,
    longitude: asNumber(row.current_longitude) ?? undefined,
  }));
}

async function driverNearbyOrderCandidates(limit: number): Promise<Candidate[]> {
  const pickups = await pendingPickupCoordinates();
  if (!pickups.length) return [];
  const drivers = await driverOfflineCandidates(limit * 2);
  const nearby: Candidate[] = [];

  for (const driver of drivers) {
    if (driver.latitude == null || driver.longitude == null) continue;
    const driverCoords = { latitude: driver.latitude, longitude: driver.longitude };
    const minDistance = Math.min(...pickups.map((pickup) => distanceKm(driverCoords, pickup)));
    if (minDistance <= DRIVER_NEARBY_RADIUS_KM) {
      nearby.push({
        userId: driver.userId,
        metadata: { nearestPendingOrderKm: Number(minDistance.toFixed(2)) },
      });
    }
    if (nearby.length >= limit) break;
  }

  return nearby;
}

async function demandSnapshot(): Promise<{ pending: number; onlineDrivers: number }> {
  const result = await pool.query<{ pending: string; online_drivers: string }>(
    `SELECT
       (SELECT COUNT(*) FROM public.orders WHERE status = 'pending') AS pending,
       (SELECT COUNT(*) FROM public.driver_profiles
        WHERE is_online = true AND is_available = true) AS online_drivers`
  );
  return {
    pending: Number(result.rows[0]?.pending || 0),
    onlineDrivers: Number(result.rows[0]?.online_drivers || 0),
  };
}

async function driverHighDemandCandidates(limit: number): Promise<Candidate[]> {
  const snapshot = await demandSnapshot();
  const highDemand =
    snapshot.pending >= 3 || (snapshot.pending >= 2 && snapshot.pending > snapshot.onlineDrivers);
  if (!highDemand) return [];
  const drivers = await driverOfflineCandidates(limit);
  return drivers.map((driver) => ({
    userId: driver.userId,
    metadata: snapshot,
  }));
}

async function driverOfflineNudgeCandidates(limit: number): Promise<Candidate[]> {
  const snapshot = await demandSnapshot();
  if (snapshot.pending < 1) return [];
  const result = await pool.query<{ user_id: string }>(
    `SELECT u.id AS user_id
     FROM public.users u
     JOIN public.driver_profiles dp ON dp.user_id = u.id
     WHERE u.role::text = 'driver'
       AND u.status::text = 'active'
       AND EXISTS (
         SELECT 1 FROM public.push_tokens pt
         WHERE pt.user_id = u.id AND pt.app_role = 'driver' AND pt.invalidated_at IS NULL
       )
       AND NOT EXISTS (
         SELECT 1 FROM public.orders o
         WHERE o.driver_id = u.id AND o.status IN (${activeStatusSql()})
       )
       AND COALESCE(dp.is_online, false) = false
       AND dp.updated_at > NOW() - INTERVAL '14 days'
       AND dp.updated_at < NOW() - INTERVAL '8 hours'
       AND (u.last_login IS NULL OR u.last_login < NOW() - INTERVAL '8 hours')
     ORDER BY dp.updated_at DESC NULLS LAST
     LIMIT $1`,
    [limit]
  );
  return result.rows.map((row) => ({
    userId: row.user_id,
    metadata: snapshot,
  }));
}

async function runCampaign(
  copy: CampaignCopy,
  candidates: Candidate[],
  limit: number
): Promise<number> {
  let sent = 0;
  for (const candidate of candidates.slice(0, limit)) {
    try {
      const ok = await sendCampaign(candidate, copy);
      if (ok) sent += 1;
    } catch (e: unknown) {
      logger.warn('[notification-campaigns] envoi ignoré:', e instanceof Error ? e.message : String(e));
    }
  }
  return sent;
}

export async function runNotificationCampaignsOnce(): Promise<void> {
  if (!process.env.DATABASE_URL) return;
  if (!isAllowedCampaignWindow()) {
    logger.info('[notification-campaigns] hors fenêtre 10h-20h, aucun envoi');
    return;
  }

  const limit = maxPerRun();
  const campaigns: Array<{ copy: CampaignCopy; getCandidates: () => Promise<Candidate[]> }> = [
    {
      copy: {
        key: 'client_delivery_intent',
        appRole: 'client',
        title: 'Un colis à envoyer ?',
        body: 'Besoin d’envoyer un colis aujourd’hui ? Krono peut s’en charger rapidement.',
        data: { type: 'campaign_client_delivery_intent' },
        cooldown: '7 days',
      },
      getCandidates: () => clientReactivationCandidates(limit),
    },
    {
      copy: {
        key: 'client_weekend_delivery',
        appRole: 'client',
        title: 'Livraison du week-end',
        body: 'Un colis à faire livrer ce week-end ? Lancez une livraison en quelques secondes.',
        data: { type: 'campaign_client_delivery_intent' },
        cooldown: '21 days',
      },
      getCandidates: () => clientWeekendCandidates(limit),
    },
    {
      copy: {
        key: 'driver_high_demand',
        appRole: 'driver',
        title: 'Forte demande',
        body: 'Forte demande dans votre zone. Connectez-vous pour recevoir des courses.',
        data: { type: 'campaign_driver_high_demand' },
        cooldown: '3 days',
      },
      getCandidates: () => driverHighDemandCandidates(limit),
    },
    {
      copy: {
        key: 'driver_nearby_orders',
        appRole: 'driver',
        title: 'Courses disponibles',
        body: 'Des courses sont disponibles près de vous.',
        data: { type: 'campaign_driver_nearby_orders' },
        cooldown: '1 day',
      },
      getCandidates: () => driverNearbyOrderCandidates(limit),
    },
    {
      copy: {
        key: 'driver_offline_nudge',
        appRole: 'driver',
        title: 'Disponible aujourd’hui ?',
        body: 'Vous êtes hors ligne. Passez en ligne si vous êtes disponible.',
        data: { type: 'campaign_driver_offline_nudge' },
        cooldown: '7 days',
      },
      getCandidates: () => driverOfflineNudgeCandidates(limit),
    },
  ];

  for (const campaign of campaigns) {
    const candidates = await campaign.getCandidates();
    const sent = await runCampaign(campaign.copy, candidates, limit);
    if (sent > 0) {
      logger.info('[notification-campaigns] campagne envoyée', {
        campaignKey: campaign.copy.key,
        sent,
      });
    }
  }
}

export function startNotificationCampaignScheduler(): void {
  if (scheduler) return;
  if (!envFlag('NOTIFICATION_CAMPAIGNS_ENABLED')) {
    logger.info('[notification-campaigns] désactivées (NOTIFICATION_CAMPAIGNS_ENABLED=true pour activer)');
    return;
  }

  const intervalMs = envNumber('NOTIFICATION_CAMPAIGNS_INTERVAL_MS', DEFAULT_INTERVAL_MS);
  const runSafely = () => {
    if (running) return;
    running = true;
    runNotificationCampaignsOnce()
      .catch((e: unknown) => {
        logger.warn('[notification-campaigns] run échoué:', e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        running = false;
      });
  };

  setTimeout(runSafely, 2 * 60 * 1000);
  scheduler = setInterval(runSafely, intervalMs);
  logger.info('[notification-campaigns] scheduler démarré', {
    intervalMs,
    timezone: campaignTimezone(),
    window: `${ALLOWED_START_HOUR}h-${ALLOWED_END_HOUR}h`,
  });
}
