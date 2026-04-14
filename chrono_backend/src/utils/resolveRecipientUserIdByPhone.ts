import pool from '../config/db.js';
import logger from '../utils/logger.js';
import { buildPhoneLookupDigitKeys } from './phoneE164CI.js';

/**
 * Si le numéro du destinataire correspond à un compte client, renseigne recipient_user_id / recipient_is_registered.
 * N’écrase pas un recipient_user_id déjà fourni (ex. flux paiement).
 */
export async function resolveRecipientUserIdForOrder(order: {
  id?: string;
  user?: { id?: string };
  recipient?: { phone?: string } | null;
  dropoff?: { details?: { phone?: string; recipientPhone?: string } };
}): Promise<void> {
  const existing = (order as { recipient_user_id?: string | null }).recipient_user_id;
  if (existing && String(existing).trim()) return;

  const payerId = order.user?.id?.trim();
  if (!payerId) return;

  const raw =
    (typeof order.recipient?.phone === 'string' && order.recipient.phone.trim()) ||
    (typeof order.dropoff?.details?.phone === 'string' && order.dropoff.details.phone.trim()) ||
    (typeof order.dropoff?.details?.recipientPhone === 'string' &&
      order.dropoff.details.recipientPhone.trim()) ||
    '';
  if (raw.length < 8) return;

  const keys = buildPhoneLookupDigitKeys(raw);
  if (!keys.length) return;

  if (!process.env.DATABASE_URL) return;

  try {
    const r = await pool.query<{ id: string }>(
      `SELECT id FROM users
       WHERE role = 'client'
         AND phone IS NOT NULL
         AND regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g') = ANY($1::text[])
       LIMIT 2`,
      [keys]
    );

    if (r.rows.length !== 1) {
      if (r.rows.length > 1) {
        logger.warn('[recipient-resolve] plusieurs comptes client pour les mêmes clés téléphone — pas d’attribution', {
          orderIdPrefix: order.id?.slice(0, 8),
          keysCount: keys.length,
        });
      } else {
        logger.info('[recipient-resolve] aucun compte client correspondant au téléphone destinataire', {
          orderIdPrefix: order.id?.slice(0, 8),
          keysCount: keys.length,
        });
      }
      return;
    }

    const rid = r.rows[0].id;
    (order as { recipient_user_id?: string | null }).recipient_user_id = rid;
    (order as { recipient_is_registered?: boolean }).recipient_is_registered = true;
    logger.info('[recipient-resolve] destinataire auto-résolu', {
      orderIdPrefix: order.id?.slice(0, 8),
      recipientUserIdPrefix: rid.slice(0, 8),
    });
  } catch (e: unknown) {
    logger.warn(
      '[recipient-resolve]',
      e instanceof Error ? e.message : String(e)
    );
  }
}
