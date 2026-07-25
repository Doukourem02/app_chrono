import pool from '../config/db.js';
import logger from '../utils/logger.js';

export type PromoApplication = {
  promoCodeId: string;
  discountAmountCfa: number;
};

/**
 * Valide un code promo et calcule la réduction à appliquer sur `basePrice`.
 * Ne s'applique jamais aux commandes B2B (tarification négociée séparément) —
 * c'est à l'appelant de ne pas invoquer cette fonction pour une commande B2B.
 * Retourne null si le code est absent — le prix reste inchangé.
 */
export async function validateAndApplyPromoCode(
  rawCode: string | undefined,
  basePrice: number
): Promise<{ application: PromoApplication | null; error?: string }> {
  if (!rawCode || typeof rawCode !== 'string' || !rawCode.trim()) {
    return { application: null };
  }
  const code = rawCode.trim().toUpperCase();

  const tableCheck = await pool.query(
    `SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'promo_codes'
    )`
  );
  if (!tableCheck.rows[0]?.exists) {
    return { application: null, error: 'Code promo invalide' };
  }

  const result = await pool.query(
    `SELECT id, discount_type, discount_value, max_uses, current_uses, valid_from, valid_until, is_active
     FROM promo_codes WHERE UPPER(code) = $1`,
    [code]
  );

  if (result.rows.length === 0) {
    return { application: null, error: 'Code promo introuvable' };
  }

  const promo = result.rows[0];
  const now = new Date();

  if (promo.is_active === false) {
    return { application: null, error: 'Code promo inactif' };
  }
  if (promo.valid_from && new Date(promo.valid_from) > now) {
    return { application: null, error: 'Code promo pas encore valide' };
  }
  if (promo.valid_until && new Date(promo.valid_until) < now) {
    return { application: null, error: 'Code promo expiré' };
  }
  if (promo.max_uses != null && Number(promo.current_uses ?? 0) >= Number(promo.max_uses)) {
    return { application: null, error: 'Code promo épuisé' };
  }

  const discountValue = Number(promo.discount_value);
  let discountAmountCfa = 0;
  if (promo.discount_type === 'percentage') {
    discountAmountCfa = Math.round((basePrice * discountValue) / 100);
  } else if (promo.discount_type === 'fixed') {
    discountAmountCfa = Math.round(discountValue);
  } else {
    return { application: null, error: 'Code promo mal configuré' };
  }
  discountAmountCfa = Math.max(0, Math.min(discountAmountCfa, basePrice));

  return { application: { promoCodeId: promo.id, discountAmountCfa } };
}

/** Incrémente le compteur d'usage — best-effort, ne bloque jamais la création de commande. */
export async function incrementPromoCodeUsage(promoCodeId: string): Promise<void> {
  try {
    await pool.query(
      `UPDATE promo_codes SET current_uses = COALESCE(current_uses, 0) + 1, updated_at = NOW() WHERE id = $1`,
      [promoCodeId]
    );
  } catch (err) {
    logger.warn('[promoCodeService] Échec incrémentation current_uses promo_codes (non bloquant)', err);
  }
}
