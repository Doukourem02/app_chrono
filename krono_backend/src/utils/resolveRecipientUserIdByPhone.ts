import pool from '../config/db.js';
import logger from '../utils/logger.js';
import { buildPhoneLookupDigitKeys, buildPhoneLookupDigitSuffixKeys } from './phoneE164CI.js';

/**
 * Retourne l’id utilisateur client (unique) pour ce numéro, ou null si ambigu / introuvable.
 */
export async function lookupClientUserIdByPhone(raw: string): Promise<string | null> {
  const trimmed = (raw || '').trim();
  if (trimmed.length < 8) return null;
  if (!process.env.DATABASE_URL) return null;

  const keys = buildPhoneLookupDigitKeys(trimmed);
  if (!keys.length) return null;
  const suffixKeys = buildPhoneLookupDigitSuffixKeys(keys);

  try {
    const r = await pool.query<{ id: string }>(
      `SELECT id FROM users
       WHERE role::text = 'client'
         AND phone IS NOT NULL
         AND (
           regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g') = ANY($1::text[])
           OR (
             COALESCE(array_length($2::text[], 1), 0) > 0
             AND char_length(regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g')) >= 10
             AND right(regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g'), 10) = ANY($2::text[])
           )
         )
       LIMIT 3`,
      [keys, suffixKeys]
    );

    if (r.rows.length !== 1) {
      if (r.rows.length > 1) {
        logger.warn('[recipient-resolve] plusieurs comptes client pour ce numéro — pas d’attribution', {
          keysCount: keys.length,
        });
      }
      return null;
    }

    return r.rows[0].id;
  } catch (e: unknown) {
    logger.warn('[recipient-resolve] lookup', e instanceof Error ? e.message : String(e));
    return null;
  }
}

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

  const rid = await lookupClientUserIdByPhone(raw);
  if (!rid) {
    logger.info('[recipient-resolve] aucun compte client correspondant au téléphone destinataire', {
      orderIdPrefix: order.id?.slice(0, 8),
    });
    return;
  }

  (order as { recipient_user_id?: string | null }).recipient_user_id = rid;
  (order as { recipient_is_registered?: boolean }).recipient_is_registered = true;
  logger.info('[recipient-resolve] destinataire auto-résolu', {
    orderIdPrefix: order.id?.slice(0, 8),
    recipientUserIdPrefix: rid.slice(0, 8),
  });
}
