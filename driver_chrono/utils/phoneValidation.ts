/**
 * Validation des numéros de téléphone Côte d'Ivoire.
 * Mobile : 01 (Moov), 05 (MTN), 07 (Orange) + 8 chiffres.
 * Format accepté : 07 12 34 56 78, +225 07 12 34 56 78, +225712345678
 */
const MOBILE_PREFIXES = ['01', '05', '07'];

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

export function isValidCIPhone(phone: string): boolean {
  const digits = normalizePhone(phone);
  if (digits.length === 10 && digits.startsWith('0')) {
    return MOBILE_PREFIXES.some((p) => digits.startsWith(p)) && /^\d{10}$/.test(digits);
  }
  if (digits.length === 12 && digits.startsWith('225')) {
    const suffix = digits.slice(3);
    return MOBILE_PREFIXES.some((p) => suffix.startsWith(p)) && suffix.length === 9;
  }
  if (digits.length === 9 && /^[157]\d{8}$/.test(digits)) {
    return true;
  }
  return false;
}

export function getPhoneValidationError(phone: string): string | null {
  if (!phone || !phone.trim()) return null;
  if (isValidCIPhone(phone)) return null;
  return 'Numéro invalide. Format attendu : 07 XX XX XX XX (Orange), 05 XX XX XX XX (MTN) ou 01 XX XX XX XX (Moov).';
}
