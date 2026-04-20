import http2 from 'node:http2';
import jwt from 'jsonwebtoken';
import pool from '../config/db.js';
import logger from '../utils/logger.js';

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
};

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
  return status.trim().toLowerCase();
}

function progressFromStatus(status: string): number {
  switch (normalizeStatus(status)) {
    case 'pending':
      return 0.08;
    case 'accepted':
      return 0.2;
    case 'enroute':
      return 0.38;
    case 'in_progress':
      return 0.52;
    case 'picked_up':
      return 0.7;
    case 'delivering':
      return 0.88;
    case 'completed':
      return 1;
    default:
      return 0.12;
  }
}

function statusLabel(status: string): string {
  switch (normalizeStatus(status)) {
    case 'pending':
      return 'Recherche chauffeur';
    case 'accepted':
      return 'Livreur assigne';
    case 'enroute':
      return 'Vers le point de retrait';
    case 'in_progress':
      return 'Course en preparation';
    case 'picked_up':
      return 'Colis recupere';
    case 'delivering':
      return 'En livraison';
    case 'completed':
      return 'Livraison terminee';
    case 'cancelled':
      return 'Commande annulee';
    case 'declined':
      return 'Commande refusee';
    default:
      return 'Suivi Krono';
  }
}

function vehicleTypeLabel(value: string | null | undefined): string {
  const v = (value || '').trim().toLowerCase();
  if (v === 'moto') return 'Moto';
  if (v === 'cargo') return 'Cargo';
  if (v === 'vehicule' || v === 'vehicle' || v === 'car') return 'Voiture';
  return value?.trim() || 'Voiture';
}

function etaLabel(row: OrderLiveActivityRow, status: string): string {
  if (normalizeStatus(status) === 'pending') return '—';
  if (typeof row.eta_minutes === 'number' && Number.isFinite(row.eta_minutes) && row.eta_minutes > 0) {
    return `${Math.max(1, Math.round(row.eta_minutes))} min`;
  }
  const raw = typeof row.estimated_duration === 'string' ? row.estimated_duration.trim() : '';
  const minutes = raw.match(/^(\d+)\s*(?:min|mn|minutes?)?$/i);
  if (minutes) return `${minutes[1]} min`;
  return raw || '';
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

function mergeProps(
  base: Record<string, unknown> | null,
  row: OrderLiveActivityRow | null,
  status: string
): OrderTrackingLiveProps {
  const statusCode = normalizeStatus(status || row?.status || 'pending');
  const pending = statusCode === 'pending';
  const driver = row ? driverName(row) : '';
  const info = row ? vehicleInfoLabel(row) : '';
  const fallback = (base || {}) as Partial<OrderTrackingLiveProps>;

  return {
    etaLabel: row ? etaLabel(row, statusCode) : fallback.etaLabel || (pending ? '—' : ''),
    vehicleLabel: pending ? 'Recherche livreur' : driver || fallback.vehicleLabel || 'Krono',
    vehicleInfoLabel: pending ? fallback.vehicleInfoLabel || 'Recherche livreur' : info || fallback.vehicleInfoLabel || 'Livraison Krono',
    plateLabel: row?.driver_vehicle_plate?.trim() || fallback.plateLabel || 'KRONO',
    isPending: pending,
    statusCode,
    statusLabel: statusLabel(statusCode),
    progress: Math.max(progressFromStatus(statusCode), Number(fallback.progress || 0) || 0),
    driverAvatarUrl:
      row?.driver_avatar_url?.trim() ||
      row?.driver_profile_image_url?.trim() ||
      fallback.driverAvatarUrl ||
      '',
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
       dp.vehicle_color as driver_vehicle_color
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
      const props = mergeProps(token.last_props, row, statusNorm);
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
