import http2 from 'node:http2';
import jwt from 'jsonwebtoken';
import pool from '../config/db.js';
import logger from '../utils/logger.js';
import { getDirections } from '../utils/mapboxService.js';
import {
  clientStatusLabel,
  normalizeProductStatus,
  progressFloorForStatus,
  progressRangeForPhase,
  progressWithEtaCap,
  statusBaseProgress,
} from '../utils/orderProductRules.js';

const LIVE_ACTIVITY_NAME = 'OrderTrackingLive';

type LiveActivityTokenRow = {
  id: string;
  order_id: string;
  user_id: string;
  activity_id: string | null;
  live_activity_name: string;
  apns_push_token: string;
  last_props: Record<string, unknown> | null;
};

type OrderLiveActivityRow = {
  id: string;
  user_id: string;
  status: string | null;
  created_at: Date | string | null;
  pickup?: unknown;
  dropoff?: unknown;
  delivery_method?: string | null;
  eta_minutes?: number | null;
  estimated_duration?: string | null;
  driver_id: string | null;
  driver_phone: string | null;
  driver_first_name: string | null;
  driver_last_name: string | null;
  driver_avatar_url: string | null;
  driver_profile_image_url: string | null;
  driver_vehicle_plate: string | null;
  driver_vehicle_type: string | null;
  driver_vehicle_brand: string | null;
  driver_vehicle_model: string | null;
  driver_vehicle_color: string | null;
  driver_current_latitude: number | string | null;
  driver_current_longitude: number | string | null;
};

type Coordinates = {
  latitude: number;
  longitude: number;
};

type ProgressPhase = 'pickup' | 'dropoff';

type OrderTrackingLiveProps = {
  etaLabel: string;
  vehicleLabel?: string;
  vehicleInfoLabel?: string;
  plateLabel?: string;
  isPending?: boolean;
  statusCode?: string;
  statusLabel?: string;
  progress?: number;
  driverAvatarUrl?: string;
  driverInitials?: string;
  driverPhone?: string;
  bannerClockLabel?: string;
  vehicleMarkerUrl?: string;
};

type ApnsResult = {
  ok: boolean;
  statusCode: number;
  reason?: string;
};

type LiveActivityNotifyResult = {
  activeTokenCount: number;
  apnsConfigured: boolean;
  successfulPushCount: number;
  shouldSuppressClassicPush: boolean;
};

const FINAL_STATUSES = new Set(['completed', 'cancelled', 'declined']);
const LIVE_ACTIVITY_ONLY_STATUSES = new Set(['accepted', 'enroute', 'in_progress', 'picked_up', 'delivering']);
const ARRIVAL_RADIUS_METERS = 45;
const SAME_STOP_RADIUS_METERS = 80;
const MIN_PROGRESS_DELTA_FOR_LOCATION_PUSH = 0.015;
const ROUTE_ETA_CACHE_TTL_MS = 15_000;

const phaseProgressByOrder = new Map<string, {
  phase: ProgressPhase;
  initialDistanceMeters: number;
  lastProgress: number;
}>();

const phaseEtaByOrder = new Map<string, {
  phase: ProgressPhase;
  etaLabel: string;
}>();

const routeEtaByOrder = new Map<string, {
  phase: ProgressPhase;
  etaLabel: string;
  originKey: string;
  targetKey: string;
  expiresAt: number;
}>();

const lastLocationPushAtByOrder = new Map<string, number>();

let cachedProviderToken: { token: string; expiresAt: number } | null = null;

function env(name: string): string {
  return process.env[name]?.trim() || '';
}

function apnsBundleId(): string {
  return env('APNS_BUNDLE_ID') || env('IOS_BUNDLE_IDENTIFIER') || 'com.anonymous.app-chrono';
}

function apnsPrivateKey(): string {
  const raw = env('APNS_PRIVATE_KEY');
  if (raw) return raw.replace(/\\n/g, '\n');
  const b64 = env('APNS_PRIVATE_KEY_BASE64');
  if (!b64) return '';
  try {
    return Buffer.from(b64, 'base64').toString('utf8').replace(/\\n/g, '\n');
  } catch {
    return '';
  }
}

function isApnsConfigured(): boolean {
  return Boolean(env('APNS_KEY_ID') && env('APNS_TEAM_ID') && apnsBundleId() && apnsPrivateKey());
}

function apnsOrigin(): string {
  const configured = env('APNS_ENV').toLowerCase();
  return configured === 'sandbox'
    ? 'https://api.sandbox.push.apple.com'
    : 'https://api.push.apple.com';
}

function providerToken(): string {
  const now = Date.now();
  if (cachedProviderToken && cachedProviderToken.expiresAt > now + 30_000) {
    return cachedProviderToken.token;
  }

  const keyId = env('APNS_KEY_ID');
  const teamId = env('APNS_TEAM_ID');
  const privateKey = apnsPrivateKey();
  const token = jwt.sign({}, privateKey, {
    algorithm: 'ES256',
    issuer: teamId,
    header: {
      alg: 'ES256',
      kid: keyId,
    },
    expiresIn: '50m',
  });

  cachedProviderToken = {
    token,
    expiresAt: now + 50 * 60_000,
  };
  return token;
}

function normalizeStatus(status: string): string {
  return normalizeProductStatus(status) ?? status.trim().toLowerCase();
}

function progressFromStatus(status: string): number {
  return statusBaseProgress(status);
}

function statusLabel(status: string): string {
  return clientStatusLabel(status);
}

function vehicleTypeLabel(value: string | null | undefined): string {
  const v = (value || '').trim().toLowerCase();
  if (v === 'moto') return 'Moto';
  if (v === 'cargo') return 'Cargo';
  if (v === 'vehicule' || v === 'vehicle' || v === 'car') return 'Voiture';
  return value?.trim() || 'Voiture';
}

function liveActivityVehicleType(value: string | null | undefined): 'moto' | 'vehicule' | 'cargo' | null {
  const normalized = (value || '').trim().toLowerCase();
  if (normalized === 'moto' || normalized === 'vehicule' || normalized === 'cargo') return normalized;
  if (normalized === 'vehicle' || normalized === 'voiture' || normalized === 'car') return 'vehicule';
  return null;
}

function toNumber(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function coordinatesFromLocation(value: unknown): { latitude: number; longitude: number } | null {
  const record = value as Record<string, unknown> | null | undefined;
  const coords = (record?.coordinates || record) as Record<string, unknown> | null | undefined;
  if (!coords) return null;
  const latitude = toNumber(coords.latitude ?? coords.lat);
  const longitude = toNumber(coords.longitude ?? coords.lng);
  if (latitude == null || longitude == null) return null;
  return { latitude, longitude };
}

function calculateDistanceMeters(
  point1: { latitude: number; longitude: number },
  point2: { latitude: number; longitude: number }
): number {
  const toRad = (degrees: number) => (degrees * Math.PI) / 180;
  const earthRadiusMeters = 6371000;
  const dLat = toRad(point2.latitude - point1.latitude);
  const dLon = toRad(point2.longitude - point1.longitude);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(point1.latitude)) *
      Math.cos(toRad(point2.latitude)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function calculateETAForVehicle(distanceMeters: number, vehicleType: 'moto' | 'vehicule' | 'cargo' | null): number {
  if (!Number.isFinite(distanceMeters) || distanceMeters <= 0) return 1;
  const speedKmh = vehicleType === 'moto' ? 35 : vehicleType === 'cargo' ? 25 : 30;
  return Math.max(1, Math.ceil((distanceMeters / 1000 / speedKmh) * 60));
}

function clampProgress(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function driverCoordsFromRow(row: OrderLiveActivityRow): Coordinates | null {
  const latitude = toNumber(row.driver_current_latitude);
  const longitude = toNumber(row.driver_current_longitude);
  if (latitude == null || longitude == null) return null;
  return { latitude, longitude };
}

function progressPhaseForStatus(status: string): ProgressPhase | null {
  const normalized = normalizeStatus(status);
  if (normalized === 'accepted' || normalized === 'enroute' || normalized === 'in_progress') return 'pickup';
  if (normalized === 'picked_up' || normalized === 'delivering') return 'dropoff';
  return null;
}

function phaseTargetForRow(row: OrderLiveActivityRow, phase: ProgressPhase): Coordinates | null {
  return coordinatesFromLocation(phase === 'pickup' ? row.pickup : row.dropoff);
}

function phaseProgressRangeSafe(phase: ProgressPhase): { start: number; end: number } {
  return progressRangeForPhase(phase) ?? { start: 0.58, end: 0.96 };
}

function normalizedStopAddress(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function pickupToDropoffDistance(row: OrderLiveActivityRow): number | null {
  const pickup = coordinatesFromLocation(row.pickup);
  const dropoff = coordinatesFromLocation(row.dropoff);
  if (!pickup || !dropoff) return null;
  return calculateDistanceMeters(pickup, dropoff);
}

function coordsCacheKey(coords: Coordinates): string {
  return `${coords.latitude.toFixed(5)},${coords.longitude.toFixed(5)}`;
}

function routeEtaLabelFromSeconds(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '';
  if (seconds < 60) return '< 1 min';
  return `${Math.max(1, Math.round(seconds / 60))} min`;
}

function isSamePickupDropoffStop(row: OrderLiveActivityRow): boolean {
  const pickupRecord = row.pickup as Record<string, unknown> | null | undefined;
  const dropoffRecord = row.dropoff as Record<string, unknown> | null | undefined;
  const pickupAddress = normalizedStopAddress(pickupRecord?.address);
  const dropoffAddress = normalizedStopAddress(dropoffRecord?.address);
  if (pickupAddress && dropoffAddress && pickupAddress === dropoffAddress) {
    return true;
  }
  const distance = pickupToDropoffDistance(row);
  return distance != null && distance <= SAME_STOP_RADIUS_METERS;
}

function etaLabelFromOrder(row: OrderLiveActivityRow): string {
  if (typeof row.eta_minutes === 'number' && Number.isFinite(row.eta_minutes) && row.eta_minutes > 0) {
    return `${Math.max(1, Math.round(row.eta_minutes))} min`;
  }
  const raw = typeof row.estimated_duration === 'string' ? row.estimated_duration.trim() : '';
  const minutes = raw.match(/^(\d+)\s*(?:min|mn|minutes?)?$/i);
  if (minutes) return `${minutes[1]} min`;
  return raw || '';
}

function progressFromDriverMovement(
  row: OrderLiveActivityRow,
  status: string,
  driverCoords: Coordinates | null | undefined,
): { progress: number; etaLabel?: string; arrivedAtStop?: boolean } {
  const normalized = normalizeStatus(status);
  const statusProgress = clampProgress(statusBaseProgress(normalized));
  const phase = progressPhaseForStatus(normalized);
  if (!phase) {
    phaseProgressByOrder.delete(row.id);
    phaseEtaByOrder.delete(row.id);
    return { progress: statusProgress };
  }

  const existing = phaseProgressByOrder.get(row.id);
  const existingEta = phaseEtaByOrder.get(row.id);

  if (phase === 'dropoff' && isSamePickupDropoffStop(row)) {
    const sameStopDistanceMeters = pickupToDropoffDistance(row) ?? 0;
    const progress = Math.max(phaseProgressRangeSafe('dropoff').end, existing?.lastProgress ?? 0);
    phaseEtaByOrder.delete(row.id);
    phaseProgressByOrder.set(row.id, {
      phase,
      initialDistanceMeters: Math.max(sameStopDistanceMeters, ARRIVAL_RADIUS_METERS),
      lastProgress: progress,
    });
    return { progress, arrivedAtStop: true };
  }

  if (!driverCoords) {
    return {
      progress: existing && existing.phase === phase ? Math.max(statusProgress, existing.lastProgress) : statusProgress,
      etaLabel: existingEta && existingEta.phase === phase ? existingEta.etaLabel : undefined,
    };
  }

  const target = phaseTargetForRow(row, phase);
  if (!target) {
    return {
      progress: statusProgress,
      etaLabel: existingEta && existingEta.phase === phase ? existingEta.etaLabel : undefined,
    };
  }

  const remainingMeters = calculateDistanceMeters(driverCoords, target);
  if (!Number.isFinite(remainingMeters)) {
    return {
      progress: statusProgress,
      etaLabel: existingEta && existingEta.phase === phase ? existingEta.etaLabel : undefined,
    };
  }

  const range = phaseProgressRangeSafe(phase);
  const floor = Math.max(range.start, progressFloorForStatus(normalized));
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

  phaseProgressByOrder.set(row.id, {
    phase,
    initialDistanceMeters,
    lastProgress: progress,
  });

  if (remainingMeters <= ARRIVAL_RADIUS_METERS) {
    phaseEtaByOrder.delete(row.id);
    return { progress, arrivedAtStop: true };
  }

  const etaLabel = `${calculateETAForVehicle(remainingMeters, liveActivityVehicleType(row.delivery_method))} min`;
  phaseEtaByOrder.set(row.id, { phase, etaLabel });
  return { progress, etaLabel, arrivedAtStop: false };
}

function fallbackEtaLabel(
  row: OrderLiveActivityRow,
  status: string,
  fallback: Partial<OrderTrackingLiveProps>,
): string {
  const normalized = normalizeStatus(status);
  if (normalized === 'accepted' || normalized === 'enroute') {
    return etaLabelFromOrder(row);
  }
  const phase = progressPhaseForStatus(normalized);
  const cached = phase ? phaseEtaByOrder.get(row.id) : null;
  if (cached && cached.phase === phase) return cached.etaLabel;
  if (phase && typeof fallback.etaLabel === 'string' && fallback.etaLabel.trim()) {
    return fallback.etaLabel.trim();
  }
  if (normalized === 'pending') return '—';
  return '';
}

async function resolveRouteEtaLabel(
  row: OrderLiveActivityRow,
  status: string,
  driverCoords: Coordinates | null | undefined,
): Promise<string | undefined> {
  const phase = progressPhaseForStatus(status);
  if (!phase || !driverCoords) return undefined;
  const target = phaseTargetForRow(row, phase);
  if (!target) return undefined;

  const remainingMeters = calculateDistanceMeters(driverCoords, target);
  if (!Number.isFinite(remainingMeters) || remainingMeters <= ARRIVAL_RADIUS_METERS) {
    routeEtaByOrder.delete(row.id);
    return undefined;
  }

  const originKey = coordsCacheKey(driverCoords);
  const targetKey = coordsCacheKey(target);
  const cached = routeEtaByOrder.get(row.id);
  const now = Date.now();
  if (
    cached &&
    cached.phase === phase &&
    cached.originKey === originKey &&
    cached.targetKey === targetKey &&
    cached.expiresAt > now
  ) {
    return cached.etaLabel;
  }

  try {
    const directions = await getDirections(
      { lat: driverCoords.latitude, lng: driverCoords.longitude },
      { lat: target.latitude, lng: target.longitude },
    );
    const durationSeconds = directions ? (directions.durationTypical ?? directions.duration) : 0;
    const etaLabel = routeEtaLabelFromSeconds(durationSeconds);
    if (!etaLabel) return undefined;
    routeEtaByOrder.set(row.id, {
      phase,
      etaLabel,
      originKey,
      targetKey,
      expiresAt: now + ROUTE_ETA_CACHE_TTL_MS,
    });
    return etaLabel;
  } catch (error: unknown) {
    logger.warn('[live-activity-apns] ETA route Mapbox indisponible', error instanceof Error ? error.message : String(error));
    return undefined;
  }
}

function clockLabel(value: Date | string | null): string {
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' }).format(d);
}

function driverName(row: OrderLiveActivityRow): string {
  return [row.driver_first_name, row.driver_last_name].filter(Boolean).join(' ').trim();
}

function driverInitials(row: OrderLiveActivityRow | null, fallbackName: string | undefined): string {
  const source =
    [row?.driver_first_name, row?.driver_last_name].filter(Boolean).join(' ').trim() ||
    fallbackName?.trim() ||
    'Krono';
  const initials = source
    .split(/\s+/)
    .map((part) => part.trim()[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return initials || 'K';
}

function vehicleInfoLabel(row: OrderLiveActivityRow): string {
  const model = [row.driver_vehicle_brand, row.driver_vehicle_model].filter(Boolean).join(' ').trim();
  return [
    row.driver_vehicle_plate?.trim(),
    row.driver_vehicle_color?.trim(),
    model || vehicleTypeLabel(row.driver_vehicle_type),
  ]
    .filter(Boolean)
    .join(' · ');
}

function digitsForTel(phone: string | null): string {
  if (!phone?.trim()) return '';
  return phone.replace(/[^\d+]/g, '');
}

function liveActivityImageUrl(...values: Array<string | null | undefined>): string {
  for (const value of values) {
    const url = value?.trim();
    if (!url) continue;
    if (/^(https?:\/\/|file:\/\/|data:image\/)/i.test(url)) return url;
    if (url.startsWith('//')) return `https:${url}`;
  }
  return '';
}

async function mergeProps(
  base: Record<string, unknown> | null,
  row: OrderLiveActivityRow | null,
  status: string,
  driverCoordsOverride?: Coordinates | null,
): Promise<OrderTrackingLiveProps> {
  const statusCode = normalizeStatus(status || row?.status || 'pending');
  const pending = statusCode === 'pending';
  const driver = row ? driverName(row) : '';
  const info = row ? vehicleInfoLabel(row) : '';
  const fallback = (base || {}) as Partial<OrderTrackingLiveProps>;
  const movement = row
    ? progressFromDriverMovement(row, statusCode, driverCoordsOverride ?? driverCoordsFromRow(row))
    : { progress: progressFromStatus(statusCode) };
  const routeEtaLabel = row
    ? await resolveRouteEtaLabel(row, statusCode, driverCoordsOverride ?? driverCoordsFromRow(row))
    : undefined;
  const eta = row ? (routeEtaLabel || movement.etaLabel || fallbackEtaLabel(row, statusCode, fallback)) : statusCode === 'accepted' || statusCode === 'enroute'
    ? fallback.etaLabel || ''
    : pending
      ? '—'
      : '';
  const baseProgress = Math.max(movement.progress ?? progressFromStatus(statusCode), Number(fallback.progress || 0) || 0);

  return {
    etaLabel: eta,
    vehicleLabel: pending ? 'Recherche livreur' : driver || fallback.vehicleLabel || 'Krono',
    vehicleInfoLabel: pending ? fallback.vehicleInfoLabel || 'Recherche livreur' : info || fallback.vehicleInfoLabel || 'Livraison Krono',
    plateLabel: row?.driver_vehicle_plate?.trim() || fallback.plateLabel || 'KRONO',
    isPending: pending,
    statusCode,
    statusLabel: movement.arrivedAtStop ? 'Livreur arrivé' : statusLabel(statusCode),
    progress: progressWithEtaCap(statusCode, baseProgress, eta),
    driverAvatarUrl: liveActivityImageUrl(
      row?.driver_avatar_url,
      row?.driver_profile_image_url,
      fallback.driverAvatarUrl,
    ),
    driverInitials: driverInitials(row, fallback.vehicleLabel),
    driverPhone: row ? digitsForTel(row.driver_phone) : fallback.driverPhone || '',
    bannerClockLabel: row ? clockLabel(row.created_at) : fallback.bannerClockLabel || '—',
    vehicleMarkerUrl: fallback.vehicleMarkerUrl || '',
  };
}

async function loadOrder(orderId: string): Promise<OrderLiveActivityRow | null> {
  const result = await pool.query<OrderLiveActivityRow>(
    `SELECT
       o.*,
       d.phone as driver_phone,
       d.first_name as driver_first_name,
       d.last_name as driver_last_name,
       d.avatar_url as driver_avatar_url,
       dp.profile_image_url as driver_profile_image_url,
       dp.vehicle_plate as driver_vehicle_plate,
       dp.vehicle_type as driver_vehicle_type,
       dp.vehicle_brand as driver_vehicle_brand,
       dp.vehicle_model as driver_vehicle_model,
       dp.vehicle_color as driver_vehicle_color,
       dp.current_latitude as driver_current_latitude,
       dp.current_longitude as driver_current_longitude
     FROM orders o
     LEFT JOIN users d ON d.id = o.driver_id
     LEFT JOIN driver_profiles dp ON dp.user_id = o.driver_id
     WHERE o.id = $1
     LIMIT 1`,
    [orderId]
  );
  return result.rows[0] || null;
}

async function loadActiveTokens(orderId: string, userId: string): Promise<LiveActivityTokenRow[]> {
  const result = await pool.query<LiveActivityTokenRow>(
    `SELECT id, order_id, user_id, activity_id, live_activity_name, apns_push_token, last_props
     FROM live_activity_tokens
     WHERE order_id = $1
       AND user_id = $2
       AND invalidated_at IS NULL
     ORDER BY updated_at DESC`,
    [orderId, userId]
  );
  return result.rows;
}

function sendApnsLiveActivityPush(
  apnsPushToken: string,
  event: 'update' | 'end',
  props: OrderTrackingLiveProps
): Promise<ApnsResult> {
  if (!isApnsConfigured()) {
    return Promise.resolve({ ok: false, statusCode: 0, reason: 'APNS_NOT_CONFIGURED' });
  }

  const issuedAt = Math.floor(Date.now() / 1000);
  const aps: Record<string, unknown> = {
    timestamp: issuedAt,
    event,
    'content-state': {
      name: LIVE_ACTIVITY_NAME,
      props: JSON.stringify(props),
    },
  };

  if (event === 'end') {
    aps['dismissal-date'] = issuedAt;
  }

  const payload = JSON.stringify({ aps });
  const bundleId = apnsBundleId();
  let authToken = '';
  try {
    authToken = providerToken();
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return Promise.resolve({ ok: false, statusCode: 0, reason: `APNS_PROVIDER_TOKEN_FAILED: ${msg}` });
  }

  return new Promise((resolve) => {
    const client = http2.connect(apnsOrigin());
    let settled = false;

    const finish = (result: ApnsResult) => {
      if (settled) return;
      settled = true;
      client.close();
      resolve(result);
    };

    client.on('error', (error) => {
      finish({ ok: false, statusCode: 0, reason: error.message });
    });

    const req = client.request({
      ':method': 'POST',
      ':path': `/3/device/${apnsPushToken}`,
      authorization: `bearer ${authToken}`,
      'apns-topic': `${bundleId}.push-type.liveactivity`,
      'apns-push-type': 'liveactivity',
      'apns-priority': event === 'end' ? '10' : '5',
    });

    let body = '';
    let statusCode = 0;

    req.setEncoding('utf8');
    req.on('response', (headers) => {
      const raw = headers[':status'];
      statusCode = typeof raw === 'number' ? raw : Number(raw || 0);
    });
    req.on('data', (chunk) => {
      body += String(chunk);
    });
    req.on('end', () => {
      let reason = body;
      try {
        const parsed = JSON.parse(body) as { reason?: string };
        reason = parsed.reason || body;
      } catch {
        /* keep raw */
      }
      finish({
        ok: statusCode >= 200 && statusCode < 300,
        statusCode,
        reason: reason || undefined,
      });
    });
    req.on('error', (error) => {
      finish({ ok: false, statusCode, reason: error.message });
    });
    req.end(payload);
  });
}

async function invalidateToken(tokenId: string, status: string, error: string | null): Promise<void> {
  await pool.query(
    `UPDATE live_activity_tokens
     SET invalidated_at = COALESCE(invalidated_at, NOW()),
         last_apns_status = $2,
         last_apns_error = $3,
         updated_at = NOW()
     WHERE id = $1`,
    [tokenId, status, error]
  );
}

async function markTokenPushed(
  tokenId: string,
  props: OrderTrackingLiveProps,
  status: string,
  error: string | null
): Promise<void> {
  await pool.query(
    `UPDATE live_activity_tokens
     SET last_props = $2::jsonb,
         last_apns_status = $3,
         last_apns_error = $4,
         last_payload_at = NOW(),
         updated_at = NOW()
     WHERE id = $1`,
    [tokenId, JSON.stringify(props), status, error]
  );
}

export async function hasActiveLiveActivity(orderId: string, userId: string): Promise<boolean> {
  if (!process.env.DATABASE_URL) return false;
  try {
    const result = await pool.query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM live_activity_tokens
         WHERE order_id = $1 AND user_id = $2 AND invalidated_at IS NULL
       )`,
      [orderId, userId]
    );
    return Boolean(result.rows[0]?.exists);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('live_activity_tokens')) return false;
    logger.warn('[live-activity-apns] lecture tokens:', msg);
    return false;
  }
}

export async function notifyLiveActivitiesForOrderStatus(params: {
  orderId: string;
  status: string;
  payerUserId: string;
}): Promise<LiveActivityNotifyResult> {
  const empty: LiveActivityNotifyResult = {
    activeTokenCount: 0,
    apnsConfigured: isApnsConfigured(),
    successfulPushCount: 0,
    shouldSuppressClassicPush: false,
  };

  if (!process.env.DATABASE_URL) return empty;

  const { orderId, status, payerUserId } = params;
  const statusNorm = normalizeStatus(status);

  try {
    const tokens = await loadActiveTokens(orderId, payerUserId);
    if (!tokens.length) return empty;

    const row = await loadOrder(orderId);
    const event: 'update' | 'end' = FINAL_STATUSES.has(statusNorm) ? 'end' : 'update';
    let successCount = 0;

    if (!isApnsConfigured()) {
      logger.warn('[live-activity-apns] APNs non configuré — fallback push classique conservé', {
        orderIdPrefix: orderId.slice(0, 8),
        status: statusNorm,
        activeTokenCount: tokens.length,
      });
      return {
        ...empty,
        activeTokenCount: tokens.length,
      };
    }

    for (const token of tokens) {
      const props = await mergeProps(token.last_props, row, statusNorm);
      const result = await sendApnsLiveActivityPush(token.apns_push_token, event, props);
      const detail = result.reason || null;

      if (result.ok) {
        successCount += 1;
        await markTokenPushed(token.id, props, `apns_${event}_ok`, null);
        if (event === 'end') {
          await invalidateToken(token.id, 'ended', null);
        }
      } else {
        await markTokenPushed(token.id, props, `apns_${event}_failed_${result.statusCode}`, detail);
        if (result.statusCode === 400 || result.statusCode === 410) {
          await invalidateToken(token.id, `apns_invalid_${result.statusCode}`, detail);
        }
        logger.warn('[live-activity-apns] push APNs échoué', {
          orderIdPrefix: orderId.slice(0, 8),
          status: statusNorm,
          httpStatus: result.statusCode,
          reason: detail,
        });
      }
    }

    return {
      activeTokenCount: tokens.length,
      apnsConfigured: true,
      successfulPushCount: successCount,
      shouldSuppressClassicPush: successCount > 0 && LIVE_ACTIVITY_ONLY_STATUSES.has(statusNorm),
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.warn('[live-activity-apns] notify:', msg);
    return empty;
  }
}

export async function notifyLiveActivitiesForDriverLocation(params: {
  orderId: string;
  status: string;
  payerUserId: string;
  driverCoords: Coordinates;
}): Promise<void> {
  if (!process.env.DATABASE_URL) return;

  const { orderId, status, payerUserId, driverCoords } = params;
  const statusNorm = normalizeStatus(status);
  if (!LIVE_ACTIVITY_ONLY_STATUSES.has(statusNorm)) return;

  const now = Date.now();
  const lastAt = lastLocationPushAtByOrder.get(orderId) ?? 0;
  if (now - lastAt < 12000) return;
  lastLocationPushAtByOrder.set(orderId, now);

  try {
    const tokens = await loadActiveTokens(orderId, payerUserId);
    if (!tokens.length) return;

    const row = await loadOrder(orderId);
    if (!row) return;

    for (const token of tokens) {
      const fallback = (token.last_props || {}) as Partial<OrderTrackingLiveProps>;
      const nextProps = await mergeProps(token.last_props, row, statusNorm, driverCoords);
      const previousProgress = Number(fallback.progress || 0) || 0;
      const progressDelta = Math.abs((nextProps.progress ?? 0) - previousProgress);
      const previousEta = typeof fallback.etaLabel === 'string' ? fallback.etaLabel : '';
      const previousStatus = typeof fallback.statusCode === 'string' ? fallback.statusCode : '';
      if (
        previousStatus === nextProps.statusCode &&
        previousEta === nextProps.etaLabel &&
        progressDelta < MIN_PROGRESS_DELTA_FOR_LOCATION_PUSH
      ) {
        continue;
      }

      const result = await sendApnsLiveActivityPush(token.apns_push_token, 'update', nextProps);
      const detail = result.reason || null;
      if (result.ok) {
        await markTokenPushed(token.id, nextProps, 'apns_update_location_ok', null);
      } else {
        await markTokenPushed(token.id, nextProps, `apns_update_location_failed_${result.statusCode}`, detail);
        if (result.statusCode === 400 || result.statusCode === 410) {
          await invalidateToken(token.id, `apns_invalid_${result.statusCode}`, detail);
        }
        logger.warn('[live-activity-apns] push position APNs échoué', {
          orderIdPrefix: orderId.slice(0, 8),
          status: statusNorm,
          httpStatus: result.statusCode,
          reason: detail,
        });
      }
    }
  } catch (error: unknown) {
    logger.warn('[live-activity-apns] notify position:', error instanceof Error ? error.message : String(error));
  }
}
