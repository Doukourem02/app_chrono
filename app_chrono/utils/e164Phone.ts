/**
 * Mobiles Côte d’Ivoire : 01 / 05 / 07 + 8 chiffres.
 * Sortie canonique : +2250Xxxxxxxxx (ex. +2250504343424).
 */
const MOBILE_PREFIXES = ['01', '05', '07'] as const;

function digitsOnly(phone: string): string {
  return phone.replace(/\D/g, '');
}

export function toE164CI(phone: string): string | null {
  const d = digitsOnly(phone);
  const compact = phone.trim().replace(/[\s().-]/g, '');

  if (d.length === 10 && d.startsWith('0')) {
    if (MOBILE_PREFIXES.some((p) => d.startsWith(p))) {
      return `+225${d}`;
    }
    return null;
  }

  if (d.length === 13 && d.startsWith('225')) {
    const nat = d.slice(3);
    if (/^0[157]\d{8}$/.test(nat)) {
      return `+225${nat}`;
    }
  }

  if (d.length === 12 && d.startsWith('225')) {
    const nat = d.slice(3);
    if (/^[157]\d{8}$/.test(nat)) {
      return `+2250${nat}`;
    }
  }

  if (compact.startsWith('+225')) {
    const rest = compact.slice(4).replace(/\D/g, '');
    if (rest.length === 10 && /^0[157]\d{8}$/.test(rest)) {
      return `+225${rest}`;
    }
    if (rest.length === 9 && /^[157]\d{8}$/.test(rest)) {
      return `+2250${rest}`;
    }
  }

  return null;
}
