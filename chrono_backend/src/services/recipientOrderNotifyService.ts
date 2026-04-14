import pool from '../config/db.js';
import logger from '../utils/logger.js';
import { lookupClientUserIdByPhone } from '../utils/resolveRecipientUserIdByPhone.js';
import { notifyOrderStatusPushes } from './expoPushService.js';
import { isTwilioSmsConfigured, sendTransactionalSMSTwilio } from './twilioSmsService.js';
import {
  isTrackWebPushConfigured,
  sendTrackWebPushForSubscriptions,
} from './trackWebPushService.js';

const NOTIFY_STATUSES = new Set([
  'accepted',
  'enroute',
  'picked_up',
  'delivering',
  'completed',
  'cancelled',
]);

/**
 * Une seule chaîne de notifications (Expo + web + SMS) par (commande, statut).
 * Évite les doublons quand deux chemins métiers appellent notify (ex. scan QR + socket livreur).
 */
async function claimOrderStatusNotification(orderId: string, statusNorm: string): Promise<boolean> {
  if (!process.env.DATABASE_URL) return true;
  try {
    const r = await pool.query(
      `INSERT INTO order_status_push_sent (order_id, status, sent_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (order_id, status) DO NOTHING
       RETURNING order_id`,
      [orderId, statusNorm]
    );
    return (r.rowCount ?? 0) > 0;
  } catch (e: unknown) {
    const code = e && typeof e === 'object' && 'code' in e ? String((e as { code?: string }).code) : '';
    if (code === '42P01') {
      return true;
    }
    logger.warn('[recipient-notify] claim notification:', e instanceof Error ? e.message : String(e));
    return true;
  }
}

/**
 * Textes alignés sur les push app pour SMS / Web Push sur le lien de suivi.
 */
export function copyForPublicTrackStatus(status: string): { title: string; body: string } | null {
  const s = (status || '').toLowerCase();
  switch (s) {
    case 'accepted':
      return {
        title: 'Course acceptée',
        body: 'Un livreur a accepté votre commande.',
      };
    case 'enroute':
      return {
        title: 'En route',
        body: 'Le livreur est en route vers le point de collecte de colis.',
      };
    case 'picked_up':
      return {
        title: 'Colis récupéré',
        body: 'Votre colis a été récupéré.',
      };
    case 'delivering':
      return {
        title: 'En livraison',
        body: 'Le livreur est en route vers vous.',
      };
    case 'completed':
      return {
        title: 'Livraison terminée',
        body: 'Votre commande est livrée.',
      };
    case 'cancelled':
      return {
        title: 'Commande annulée',
        body: 'Votre commande a été annulée.',
      };
    default:
      return null;
  }
}

export function extractRecipientPhoneFromOrder(order: {
  recipient?: { phone?: string } | null;
  dropoff?: { details?: { phone?: string; recipientPhone?: string } };
}): string | null {
  const p =
    order?.recipient?.phone ||
    order?.dropoff?.details?.phone ||
    order?.dropoff?.details?.recipientPhone ||
    '';
  if (typeof p !== 'string') return null;
  const t = p.trim();
  return t.length >= 8 ? t : null;
}

/** Base URL publique de la page /track (admin Next), sans slash final — SMS avec lien cliquable. */
export function publicTrackPageBaseUrl(): string | null {
  const u =
    process.env.PUBLIC_TRACK_BASE_URL?.trim() ||
    process.env.TRACK_PAGE_BASE_URL?.trim() ||
    '';
  if (!u || u.includes('localhost') || u.includes('127.0.0.1')) return null;
  return u.replace(/\/$/, '');
}

function parseJsonField(raw: unknown): any {
  if (raw == null) return null;
  if (typeof raw === 'object') return raw;
  if (typeof raw !== 'string') return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function loadOrderNotifyRow(orderId: string): Promise<{
  trackingToken: string | null;
  recipientUserId: string | null;
  recipientPhone: string | null;
} | null> {
  if (!process.env.DATABASE_URL) return null;
  try {
    const r = await pool.query<{
      tracking_token: string | null;
      recipient_user_id: string | null;
      recipient: unknown;
      dropoff_address: unknown;
    }>(
      `SELECT tracking_token, recipient_user_id, recipient, dropoff_address
       FROM orders WHERE id = $1 LIMIT 1`,
      [orderId]
    );
    const row = r.rows[0];
    if (!row) return null;

    const rec = parseJsonField(row.recipient);
    const drop = parseJsonField(row.dropoff_address);
    let phone =
      (typeof rec?.phone === 'string' && rec.phone.trim()) ||
      (typeof drop?.details?.phone === 'string' && drop.details.phone.trim()) ||
      (typeof drop?.details?.recipientPhone === 'string' && drop.details.recipientPhone.trim()) ||
      null;
    if (phone && phone.length < 8) phone = null;

    return {
      trackingToken: row.tracking_token?.trim() || null,
      recipientUserId: row.recipient_user_id || null,
      recipientPhone: phone,
    };
  } catch (e: unknown) {
    logger.warn('[recipient-notify] loadOrder:', e instanceof Error ? e.message : String(e));
    return null;
  }
}

/**
 * Push Expo (payeur + destinataire inscrit), Web Push (abonnés du lien /track), SMS si pas de compte destinataire.
 */
export async function notifyAllForOrderStatus(params: {
  orderId: string;
  status: string;
  payerUserId: string;
  recipientUserId?: string | null;
  recipientPhone?: string | null;
  trackingToken?: string | null;
}): Promise<void> {
  const { orderId, status, payerUserId } = params;
  if (!orderId || !payerUserId) return;

  const statusNorm = status.toLowerCase();
  const claimed = await claimOrderStatusNotification(orderId, statusNorm);
  if (!claimed) {
    logger.info('[recipient-notify] déjà notifié pour ce statut — ignoré (anti-doublon)', {
      orderIdPrefix: orderId.slice(0, 8),
      status: statusNorm,
    });
    return;
  }

  const row = await loadOrderNotifyRow(orderId);

  let recipientUserId =
    row?.recipientUserId?.trim() ||
    (typeof params.recipientUserId === 'string' ? params.recipientUserId.trim() : null) ||
    null;

  const trackingToken =
    row?.trackingToken || (params.trackingToken && params.trackingToken.trim()) || null;

  const recipientPhone =
    row?.recipientPhone ||
    (params.recipientPhone && params.recipientPhone.trim()) ||
    null;

  if (!recipientUserId && recipientPhone) {
    const resolved = await lookupClientUserIdByPhone(recipientPhone);
    if (resolved) {
      recipientUserId = resolved;
      void pool
        .query(
          `UPDATE orders
           SET recipient_user_id = $1,
               recipient_is_registered = true,
               updated_at = NOW()
           WHERE id = $2
             AND recipient_user_id IS NULL`,
          [resolved, orderId]
        )
        .then(() => {
          logger.info('[recipient-notify] destinataire résolu au notify + persist DB', {
            orderIdPrefix: orderId.slice(0, 8),
            recipientUserIdPrefix: resolved.slice(0, 8),
          });
        })
        .catch((e: unknown) => {
          logger.warn(
            '[recipient-notify] persist recipient_user_id:',
            e instanceof Error ? e.message : String(e)
          );
        });
    }
  }

  const trackBase = publicTrackPageBaseUrl();
  const trackUrl =
    trackingToken && trackBase
      ? `${trackBase}/track/${encodeURIComponent(trackingToken)}`
      : null;

  void notifyOrderStatusPushes({
    orderId,
    status,
    payerUserId,
    recipientUserId,
    trackUrl,
  }).catch((e: unknown) => {
    logger.warn('[recipient-notify] expo:', e instanceof Error ? e.message : String(e));
  });

  const copy = copyForPublicTrackStatus(statusNorm);
  if (!copy || !NOTIFY_STATUSES.has(statusNorm)) return;

  if (trackingToken && isTrackWebPushConfigured()) {
    void sendTrackWebPushForSubscriptions(trackingToken, {
      title: copy.title,
      body: copy.body,
      openPath: `/track/${encodeURIComponent(trackingToken)}`,
      data: { orderId, status: statusNorm, type: 'order_status' },
    }).catch((e: unknown) => {
      logger.warn('[recipient-notify] web-push:', e instanceof Error ? e.message : String(e));
    });
  }

  if (!recipientUserId && recipientPhone && isTwilioSmsConfigured()) {
    logger.info('[recipient-notify] fallback SMS (destinataire sans compte lié)', {
      orderIdPrefix: orderId.slice(0, 8),
      status: statusNorm,
    });
    const brand = process.env.TWILIO_SMS_BODY_BRAND?.trim() || 'Krono';
    let smsBody = `${brand} — ${copy.title}. ${copy.body}`;
    const trackBase = publicTrackPageBaseUrl();
    if (trackingToken && trackBase) {
      smsBody += ` Suivi: ${trackBase}/track/${trackingToken}`;
    } else if (trackingToken && !trackBase) {
      logger.warn(
        '[recipient-notify] SMS sans lien /track : définir PUBLIC_TRACK_BASE_URL (URL HTTPS de l’admin, ex. https://admin.tondomaine.com)'
      );
    }
    void sendTransactionalSMSTwilio(recipientPhone, smsBody).catch((e: unknown) => {
      logger.warn('[recipient-notify] sms:', e instanceof Error ? e.message : String(e));
    });
  }
}
