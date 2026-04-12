/**
 * Retire des artefacts parfois présents dans les libellés Mapbox / Nominatim / Google.
 * Aligné sur app_chrono/utils/sanitizeGeocodeDisplay.ts
 */
export function sanitizeGeocodeDisplayString(raw: string): string {
  if (!raw || typeof raw !== 'string') return ''
  let s = raw.trim()
  s = s.replace(/\byyyy\s*Abidjan\b/gi, 'Abidjan')
  s = s.replace(/\byyyy\s*,\s*Abidjan\b/gi, 'Abidjan')
  s = s.replace(/,\s*yyyy\s*,/gi, ',')
  s = s.replace(/,\s*yyyy$/i, '')
  s = s.replace(/,\s*,/g, ',').replace(/\s{2,}/g, ' ').trim()
  return s
}

/**
 * Une seule ligne lisible : pas de collage « deux adresses » dans un champ
 * (flèches → ou motif « … à: … »).
 */
export function singleLineAddressInput(text: string): string {
  const oneLine = text
    .replace(/\r\n|\r|\n/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/^\s+/, '')
  const arrowSplit = oneLine.split(/\s*[→➔>]\s*/)
  if (arrowSplit.length > 1) return arrowSplit[0].trim()
  const deA = oneLine.match(/^(.+?)\s+(?:à|À):\s*(.+)$/)
  if (deA) return deA[1].trim()
  return oneLine
}

function stripAccentsLower(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
}

function isCountryOrCityTail(n: string): boolean {
  if (n.startsWith('cote d')) return true
  if (n === 'ci' || n === 'ci.' || n === 'ivoire') return true
  if (n === 'ivory coast') return true
  if (n === 'abidjan') return true
  return false
}

const ABIDJAN_COMMUNE_TAIL = new Set<string>([
  'abobo',
  'adjame',
  'attecoube',
  'attcoube',
  'cocody',
  'koumassi',
  'marcory',
  'plateau',
  'port-bouet',
  'portbouet',
  'treichville',
  'yopougon',
  'songon',
  'anyama',
  'bingerville',
  'brofodoume',
])

const ABIDJAN_QUARTIER_TAIL = new Set<string>([
  'williamsville',
  'dokui',
  'angre',
  'riviera',
  'deux plateaux',
  'deuxplateaux',
  '2 plateaux',
  'zone 4',
  'zone 4c',
])

function isIvorianAdminTailSegment(segment: string): boolean {
  const n = stripAccentsLower(segment)
  if (!n) return false
  if (isCountryOrCityTail(n)) return true
  if (ABIDJAN_COMMUNE_TAIL.has(n)) return true
  return ABIDJAN_QUARTIER_TAIL.has(n)
}

export function stripLocalAdminSuffixes(address: string): string {
  if (!address || typeof address !== 'string') return ''
  const parts = address.split(',').map((p) => p.trim()).filter(Boolean)
  while (parts.length > 1 && isIvorianAdminTailSegment(parts[parts.length - 1])) {
    parts.pop()
  }
  return parts.join(', ')
}

function isStrictHouseNumberSegment(seg: string): boolean {
  const t = seg.trim()
  if (!t) return false
  return /^(\d{1,6})(?:\s*(bis|ter|b|t))?$/i.test(t)
}

export function compactAddressForLocalDisplay(raw: string): string {
  if (!raw || typeof raw !== 'string') return ''
  let s = sanitizeGeocodeDisplayString(singleLineAddressInput(raw))
  if (!s) return ''

  let prev = ''
  while (s !== prev) {
    prev = s
    s = stripLocalAdminSuffixes(s)
  }

  const reorderCommaParts = (input: string): string => {
    const parts = input.split(',').map((p) => p.trim()).filter(Boolean)
    if (
      parts.length >= 2 &&
      isStrictHouseNumberSegment(parts[0]) &&
      !/^\d/.test(parts[1].trim())
    ) {
      const [num, street, ...rest] = parts
      return [street, num, ...rest].join(', ')
    }
    if (parts.length === 0) return input
    const head = parts[0]
    const tail = parts.slice(1).join(', ')
    const numCommaStreet = head.match(/^(\d{1,6})\s*,\s*(.+)$/)
    if (numCommaStreet && !/^\d/.test(numCommaStreet[2].trim())) {
      const core = `${numCommaStreet[2].trim()}, ${numCommaStreet[1]}`
      return tail ? `${core}, ${tail}` : core
    }
    const numSpaceStreet = head.match(/^(\d{1,6})\s+(.+)$/)
    if (numSpaceStreet && !/^\d/.test(numSpaceStreet[2].trim())) {
      const core = `${numSpaceStreet[2].trim()}, ${numSpaceStreet[1]}`
      return tail ? `${core}, ${tail}` : core
    }
    return parts.join(', ')
  }

  s = reorderCommaParts(s)
  prev = ''
  while (s !== prev) {
    prev = s
    s = stripLocalAdminSuffixes(s)
  }
  return s.trim()
}

export function addressesVisuallyEqual(a: string, b: string): boolean {
  const n = (s: string) => stripAccentsLower(s.replace(/\s+/g, ' ').trim())
  return n(a) === n(b)
}

export function formatAutocompleteSelectedAddress(raw: string, userTyped: string): string {
  const u = sanitizeGeocodeDisplayString(singleLineAddressInput(userTyped)).trim()
  const cleanedRaw = sanitizeGeocodeDisplayString(singleLineAddressInput(raw))

  const userStreetThenNum = u.match(/^(.+?),\s*(\d[\w\s\-\/]{0,24})\s*$/)
  if (userStreetThenNum && !/^\d/.test(userStreetThenNum[1].trim())) {
    return compactAddressForLocalDisplay(`${userStreetThenNum[1].trim()}, ${userStreetThenNum[2].trim()}`)
  }

  return compactAddressForLocalDisplay(cleanedRaw)
}
