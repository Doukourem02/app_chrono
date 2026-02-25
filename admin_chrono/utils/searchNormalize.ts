/**
 * Normalisation des requêtes de recherche (style Google)
 * - Accents → lettres simples (é → e, è → e, ô → o)
 * - Ponctuation supprimée
 * - Alias courants (CHU Treichville = CHU de Treichville)
 */

const ACCENT_MAP: Record<string, string> = {
  à: 'a', á: 'a', â: 'a', ä: 'a', æ: 'ae',
  è: 'e', é: 'e', ê: 'e', ë: 'e',
  ì: 'i', í: 'i', î: 'i', ï: 'i',
  ò: 'o', ó: 'o', ô: 'o', ö: 'o', œ: 'oe',
  ù: 'u', ú: 'u', û: 'u', ü: 'u',
  ÿ: 'y', ý: 'y',
  ç: 'c', ñ: 'n',
}

const ALIASES: [RegExp, string][] = [
  [/\bchu\s+de\s+/gi, 'chu '],
  [/\bchu\s+treichville\b/gi, 'chu treichville'],
  [/\bpharmacie\s+saint\b/gi, 'pharmacie saint'],
  [/\bcap\s+sud\b/gi, 'cap sud'],
  [/\b2\s*plateaux?\b/gi, '2 plateaux'],
  [/\bdeux\s+plateaux\b/gi, '2 plateaux'],
]

/**
 * Normalise une chaîne pour la recherche : accents, ponctuation, espaces.
 */
export function normalize(query: string): string {
  let s = query.trim().toLowerCase()
  if (!s) return ''

  s = s.replace(/[''`"«»]/g, '')
  try {
    s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  } catch {
    s = s.split('').map((c) => ACCENT_MAP[c] ?? c).join('')
  }
  s = s.replace(/[^\p{L}\p{N}\s-]/gu, ' ').replace(/\s+/g, ' ').trim()
  return s
}

/**
 * Applique les alias courants avant normalisation.
 */
export function normalizeWithAliases(query: string): string {
  let s = query.trim()
  for (const [re, replacement] of ALIASES) {
    s = s.replace(re, replacement)
  }
  return normalize(s)
}

/**
 * Vérifie si la requête normalisée matche un terme.
 */
export function matchesNormalized(query: string, term: string): boolean {
  const q = normalizeWithAliases(query)
  const t = normalize(term)
  if (!q || !t) return false
  return q.includes(t) || t.includes(q)
}
