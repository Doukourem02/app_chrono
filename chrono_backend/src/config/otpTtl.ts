/**
 * Durée de validité du code OTP (stockage DB/mémoire + textes SMS / email / WhatsApp).
 * OTP_TTL_MINUTES dans .env (défaut 5, plage 2–10).
 */
function parseOtpTtlMinutes(): number {
  const raw = process.env.OTP_TTL_MINUTES?.trim();
  if (!raw) return 5;
  const n = parseInt(raw, 10);
  if (Number.isNaN(n)) return 2;
  return Math.min(10, Math.max(2, n));
}

export const OTP_TTL_MINUTES = parseOtpTtlMinutes();
export const OTP_TTL_MS = OTP_TTL_MINUTES * 60 * 1000;
