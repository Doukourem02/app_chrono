import webpush from 'web-push';
import pool from '../config/db.js';
import logger from '../utils/logger.js';

let vapidConfigured = false;

export function isTrackWebPushConfigured(): boolean {
  return Boolean(
    process.env.WEB_PUSH_PUBLIC_KEY?.trim() &&
      process.env.WEB_PUSH_PRIVATE_KEY?.trim() &&
      process.env.WEB_PUSH_SUBJECT?.trim()
  );
}

export function getWebPushPublicKey(): string | null {
  const k = process.env.WEB_PUSH_PUBLIC_KEY?.trim();
  return k || null;
}

function ensureVapidConfigured(): void {
  if (vapidConfigured) return;
  const publicKey = process.env.WEB_PUSH_PUBLIC_KEY?.trim();
  const privateKey = process.env.WEB_PUSH_PRIVATE_KEY?.trim();
  const subject = process.env.WEB_PUSH_SUBJECT?.trim();
  if (!publicKey || !privateKey || !subject) {
    throw new Error('WEB_PUSH_* incomplet');
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidConfigured = true;
}

export async function saveTrackPushSubscription(
  trackingToken: string,
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } }
): Promise<void> {
  if (!process.env.DATABASE_URL) return;
  await pool.query(
    `INSERT INTO track_web_push_subscriptions (tracking_token, endpoint, p256dh, auth)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (tracking_token, endpoint)
     DO UPDATE SET p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth`,
    [trackingToken, subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth]
  );
}

export async function sendTrackWebPushForSubscriptions(
  trackingToken: string,
  payload: { title: string; body: string; openPath?: string; data?: Record<string, string> }
): Promise<void> {
  if (!isTrackWebPushConfigured() || !process.env.DATABASE_URL) return;

  let rows: { endpoint: string; p256dh: string; auth: string }[];
  try {
    const r = await pool.query<{ endpoint: string; p256dh: string; auth: string }>(
      `SELECT endpoint, p256dh, auth FROM track_web_push_subscriptions WHERE tracking_token = $1`,
      [trackingToken]
    );
    rows = r.rows;
  } catch (e: unknown) {
    logger.warn('[web-push] lecture subscriptions:', e instanceof Error ? e.message : String(e));
    return;
  }

  if (!rows.length) return;

  try {
    ensureVapidConfigured();
  } catch (e: unknown) {
    logger.warn('[web-push] VAPID:', e instanceof Error ? e.message : String(e));
    return;
  }

  const jsonPayload = JSON.stringify({
    title: payload.title,
    body: payload.body,
    openPath: payload.openPath || `/track/${encodeURIComponent(trackingToken)}`,
    data: payload.data || {},
  });

  for (const row of rows) {
    try {
      await webpush.sendNotification(
        {
          endpoint: row.endpoint,
          keys: { p256dh: row.p256dh, auth: row.auth },
        },
        jsonPayload,
        { TTL: 86_400 }
      );
    } catch (e: unknown) {
      const status = (e as { statusCode?: number })?.statusCode;
      if (status === 410 || status === 404) {
        await pool
          .query(`DELETE FROM track_web_push_subscriptions WHERE endpoint = $1`, [row.endpoint])
          .catch(() => {});
      }
      logger.warn('[web-push] envoi:', (e as Error)?.message || String(e));
    }
  }
}
