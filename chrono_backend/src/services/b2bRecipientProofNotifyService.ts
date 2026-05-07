import pool from '../config/db.js';
import { generateAndSaveTrackingToken } from '../config/orderStorage.js';
import qrCodeService from './qrCodeService.js';
import logger from '../utils/logger.js';
import { lookupClientUserIdByPhone } from '../utils/resolveRecipientUserIdByPhone.js';
import { publicTrackPageBaseUrl } from './recipientOrderNotifyService.js';
import { sendCampaignPushToUser } from './expoPushService.js';
import { isTwilioSmsConfigured, sendTransactionalSMSTwilio } from './twilioSmsService.js';
import {isTwilioWhatsAppConfigured,sendTransactionalWhatsAppTwilio,} from './twilioWhatsAppService.js';

type NotifyOrderRow = {
  id: string;
  user_id: string;
  recipient_user_id: string | null;
  recipient: unknown;
  dropoff_address: unknown;
  delivery_qr_code: string | null;
  delivery_verification_code: string | null;
  tracking_token: string | null;
  creator_first_name: string | null;
  creator_last_name: string | null;
  creator_email: string | null;
};

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

function recipientFromRow(row: NotifyOrderRow): { name: string; phone: string } {
  const recipient = parseJsonField(row.recipient) || {};
  const dropoff = parseJsonField(row.dropoff_address) || {};
  const details = dropoff?.details || {};
  const phone =
    (typeof recipient.phone === 'string' && recipient.phone.trim()) ||
    (typeof details.phone === 'string' && details.phone.trim()) ||
    (typeof details.recipientPhone === 'string' && details.recipientPhone.trim()) ||
    '';
  const name =
    (typeof recipient.name === 'string' && recipient.name.trim()) ||
    (typeof details.name === 'string' && details.name.trim()) ||
    (typeof details.recipientName === 'string' && details.recipientName.trim()) ||
    (phone ? `Destinataire (${phone})` : 'Destinataire');
  return { name, phone };
}

async function claimProofNotification(orderId: string): Promise<boolean> {
  if (!process.env.DATABASE_URL) return true;
  try {
    const r = await pool.query(
      `INSERT INTO order_status_push_sent (order_id, status, sent_at)
       VALUES ($1, 'b2b_delivery_proof', NOW())
       ON CONFLICT (order_id, status) DO NOTHING
       RETURNING order_id`,
      [orderId]
    );
    return (r.rowCount ?? 0) > 0;
  } catch (e: unknown) {
    const code = e && typeof e === 'object' && 'code' in e ? String((e as { code?: string }).code) : '';
    if (code === '42P01') return true;
    logger.warn('[b2b-recipient-proof] claim:', e instanceof Error ? e.message : String(e));
    return true;
  }
}

async function ensureProofAssets(row: NotifyOrderRow): Promise<{
  trackingToken: string | null;
  verificationCode: string | null;
}> {
  let trackingToken = row.tracking_token?.trim() || null;
  if (!trackingToken) {
    trackingToken = await generateAndSaveTrackingToken(row.id);
  }

  let verificationCode = row.delivery_verification_code?.trim() || null;
  if (!row.delivery_qr_code || !verificationCode) {
    const recipient = recipientFromRow(row);
    const creatorName =
      [row.creator_first_name, row.creator_last_name].filter(Boolean).join(' ').trim() ||
      row.creator_email ||
      'Client';
    const qr = await qrCodeService.generateDeliveryQRCode(
      row.id,
      `CMD-${row.id.substring(0, 8).toUpperCase()}`,
      recipient.name,
      recipient.phone,
      creatorName
    );
    verificationCode = qr.verificationCode;
  }

  return { trackingToken, verificationCode };
}

async function resolveRecipientUserId(row: NotifyOrderRow, phone: string): Promise<string | null> {
  const current = row.recipient_user_id?.trim() || null;
  if (current) return current;
  if (!phone) return null;

  const resolved = await lookupClientUserIdByPhone(phone);
  if (!resolved) return null;

  void pool
    .query(
      `UPDATE orders
       SET recipient_user_id = $1,
           recipient_is_registered = true,
           updated_at = NOW()
       WHERE id = $2
         AND recipient_user_id IS NULL`,
      [resolved, row.id]
    )
    .catch((e: unknown) => {
      logger.warn('[b2b-recipient-proof] persist recipient:', e instanceof Error ? e.message : String(e));
    });

  return resolved;
}

async function notifyOneRecipient(row: NotifyOrderRow): Promise<void> {
  const claimed = await claimProofNotification(row.id);
  if (!claimed) return;

  const recipient = recipientFromRow(row);
  const { trackingToken, verificationCode } = await ensureProofAssets(row);
  if (!verificationCode) {
    logger.warn('[b2b-recipient-proof] code manquant après génération', {
      orderIdPrefix: row.id.slice(0, 8),
    });
    return;
  }

  const trackBase = publicTrackPageBaseUrl();
  const trackUrl = trackingToken && trackBase
    ? `${trackBase}/track/${encodeURIComponent(trackingToken)}`
    : null;
  const orderLabel = `CMD-${row.id.substring(0, 8).toUpperCase()}`;
  const brand = process.env.TWILIO_SMS_BODY_BRAND?.trim() || 'Krono';
  const message =
    `${brand} - code de réception ${orderLabel}: ${verificationCode}. ` +
    `Montrez ce code ou le QR au livreur Krono à la remise du colis.` +
    (trackUrl ? ` Lien: ${trackUrl}` : '');

  const recipientUserId = await resolveRecipientUserId(row, recipient.phone);
  if (recipientUserId) {
    void sendCampaignPushToUser({
      userId: recipientUserId,
      appRole: 'client',
      title: 'Code de réception Krono',
      body: `Votre code de réception est ${verificationCode}. Montrez le QR ou le code au livreur.`,
      data: {
        type: 'delivery_proof_code',
        orderId: row.id,
        ...(trackUrl ? { trackUrl } : {}),
      },
    }).catch((e: unknown) => {
      logger.warn('[b2b-recipient-proof] push:', e instanceof Error ? e.message : String(e));
    });
  }

  const whatsappDisabled =
    String(process.env.DISABLE_B2B_RECIPIENT_WHATSAPP || '').trim() === '1' ||
    String(process.env.DISABLE_B2B_RECIPIENT_WHATSAPP || '').toLowerCase() === 'true';
  const smsDisabled =
    String(process.env.DISABLE_B2B_RECIPIENT_SMS || '').trim() === '1' ||
    String(process.env.DISABLE_B2B_RECIPIENT_SMS || '').toLowerCase() === 'true';

  if (!recipient.phone) {
    logger.warn('[b2b-recipient-proof] téléphone destinataire manquant', {
      orderIdPrefix: row.id.slice(0, 8),
      hasRecipientUser: Boolean(recipientUserId),
    });
    return;
  }

  if (!whatsappDisabled && isTwilioWhatsAppConfigured()) {
    const wa = await sendTransactionalWhatsAppTwilio(recipient.phone, message);
    if (wa.success) return;
    logger.warn('[b2b-recipient-proof] WhatsApp échoué, fallback SMS', wa.error);
  }

  if (!smsDisabled && isTwilioSmsConfigured()) {
    await sendTransactionalSMSTwilio(recipient.phone, message).catch((e: unknown) => {
      logger.warn('[b2b-recipient-proof] sms:', e instanceof Error ? e.message : String(e));
    });
  }
}

export async function notifyB2BBatchRecipientsProof(orderIds: string[]): Promise<void> {
  const ids = [...new Set(orderIds.filter(Boolean))];
  if (!ids.length || !process.env.DATABASE_URL) return;

  try {
    const { rows } = await pool.query<NotifyOrderRow>(
      `SELECT
         o.id,
         o.user_id,
         o.recipient_user_id,
         o.recipient,
         o.dropoff_address,
         o.delivery_qr_code,
         o.delivery_verification_code,
         o.tracking_token,
         u.first_name AS creator_first_name,
         u.last_name AS creator_last_name,
         u.email AS creator_email
       FROM orders o
       LEFT JOIN users u ON u.id = o.user_id
       WHERE o.id = ANY($1::uuid[])`,
      [ids]
    );

    for (const row of rows) {
      await notifyOneRecipient(row).catch((e: unknown) => {
        logger.warn('[b2b-recipient-proof] order:', e instanceof Error ? e.message : String(e));
      });
    }
  } catch (e: unknown) {
    logger.warn('[b2b-recipient-proof] batch:', e instanceof Error ? e.message : String(e));
  }
}
