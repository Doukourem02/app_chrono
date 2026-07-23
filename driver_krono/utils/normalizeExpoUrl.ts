/**
 * Corrige les fautes fréquentes dans les variables EAS (ex. https://https://host/path)
 * et retire le slash final pour éviter les doubles // dans les chemins d'API.
 */
export function normalizeExpoUrl(url: string | undefined, fallback: string): string {
  const raw = (url ?? '').trim() || fallback;
  let u = raw.replace(/^https?:\/\/https?:\/\//i, 'https://');
  u = u.replace(/\/$/, '');
  return u;
}
