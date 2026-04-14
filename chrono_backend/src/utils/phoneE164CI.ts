/**
 * Aligné sur app_chrono/utils/e164Phone.ts — clés de comparaison avec users.phone.
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

export function phoneDigitsKey(p: string): string {
  return p.replace(/\D/g, '');
}

/** Plusieurs formes possibles en base (E.164, 225…, 07…). */
export function buildPhoneLookupDigitKeys(raw: string): string[] {
  const keys = new Set<string>();
  const trimmed = (raw || '').trim();
  if (!trimmed) return [];

  const d0 = phoneDigitsKey(trimmed);
  if (d0.length >= 8) keys.add(d0);

  const e164 = toE164CI(trimmed);
  if (e164) {
    const full = phoneDigitsKey(e164);
    if (full.length >= 8) keys.add(full);
    if (full.startsWith('225') && full.length >= 12) {
      keys.add(full.slice(3));
    }
  }

  return [...keys];
}

/** Derniers 10 chiffres (mobile CI) — fallback si le stockage en base varie. */
export function buildPhoneLookupDigitSuffixKeys(digitKeys: string[]): string[] {
  const out = new Set<string>();
  for (const k of digitKeys) {
    if (k.length >= 10) out.add(k.slice(-10));
  }
  return [...out];
}
