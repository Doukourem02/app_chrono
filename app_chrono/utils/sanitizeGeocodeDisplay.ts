/**
 * Retire des artefacts parfois présents dans les libellés Mapbox / Nominatim / Google.
 */
export function sanitizeGeocodeDisplayString(raw: string): string {
  if (!raw || typeof raw !== 'string') return '';
  let s = raw.trim();
  s = s.replace(/\byyyy\s*Abidjan\b/gi, 'Abidjan');
  s = s.replace(/\byyyy\s*,\s*Abidjan\b/gi, 'Abidjan');
  s = s.replace(/,\s*yyyy\s*,/gi, ',');
  s = s.replace(/,\s*yyyy$/i, '');
  s = s.replace(/,\s*,/g, ',').replace(/\s{2,}/g, ' ').trim();
  return s;
}

/**
 * Une seule ligne lisible : pas de collage « deux adresses » dans un champ
 * (flèches → ou motif « … à: … »). Les espaces à l’intérieur d’une adresse
 * (« Rue Panama City 772 », « Pharmacie Saint Gabriel ») sont conservés.
 * On ne fait pas trim() en fin de chaîne pendant la saisie, sinon l’espace
 * après le dernier mot disparaît et on ne peut plus enchaîner le mot suivant.
 */
export function singleLineAddressInput(text: string): string {
  const oneLine = text
    .replace(/\r\n|\r|\n/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/^\s+/, '');
  const arrowSplit = oneLine.split(/\s*[→➔>]\s*/);
  if (arrowSplit.length > 1) return arrowSplit[0].trim();
  const deA = oneLine.match(/^(.+?)\s+(?:à|À):\s*(.+)$/);
  if (deA) return deA[1].trim();
  return oneLine;
}

function stripAccentsLower(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

/**
 * ---------------------------------------------------------------------------
 * Pourquoi il y a une liste de noms (Abobo, Cocody, Attécoubé, etc.) ?
 * ---------------------------------------------------------------------------
 * Ce ne sont PAS des adresses saisies par les utilisateurs : rien n’est
 * « stocké » ici pour la base de données.
 *
 * Les API (Mapbox, OpenStreetMap…) renvoient souvent une longue chaîne avec
 * des virgules, par exemple :
 *   "Rue Panama City, 772, Adjamé, Abidjan, Côte d'Ivoire"
 * On découpe par virgule et on enlève les morceaux de FIN qui ne sont que
 * du contexte administratif (commune, ville, pays), pour n’afficher que la
 * partie utile en appli locale — comme Yango.
 *
 * Les noms ci-dessous sont en minuscules SANS ACCENTS : on compare ainsi au
 * dernier segment (ex. "Adjamé" → "adjame") pour décider de l’ôter.
 *
 * Attécoubé apparaît parfois écrit "attecoube", parfois "attcoube" selon la
 * source : ce sont deux orthographes pour LA MÊME commune, pas deux lieux.
 * ---------------------------------------------------------------------------
 */

/** Pays / ville : toujours retirés s’ils sont le dernier segment après une virgule. */
function isCountryOrCityTail(n: string): boolean {
  if (n.startsWith('cote d')) return true;
  if (n === 'ci' || n === 'ci.' || n === 'ivoire') return true;
  if (n === 'ivory coast') return true;
  if (n === 'abidjan') return true;
  return false;
}

/** Communes du district d’Abidjan (noms normalisés, sans accent). */
const ABIDJAN_COMMUNE_TAIL = new Set<string>([
  'abobo',
  'adjame',
  'attecoube',
  'attcoube', // même commune qu’« attecoube », variante vue dans certaines données
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
]);

/**
 * Quartiers souvent répétés en fin de ligne géocodeur (même logique : à retirer pour l’UI locale).
 */
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
]);

function isIvorianAdminTailSegment(segment: string): boolean {
  const n = stripAccentsLower(segment);
  if (!n) return false;
  if (isCountryOrCityTail(n)) return true;
  if (ABIDJAN_COMMUNE_TAIL.has(n)) return true;
  return ABIDJAN_QUARTIER_TAIL.has(n);
}

/**
 * Retire commune, ville, pays et segments équivalents en fin de chaîne.
 */
export function stripLocalAdminSuffixes(address: string): string {
  if (!address || typeof address !== 'string') return '';
  const parts = address.split(',').map((p) => p.trim()).filter(Boolean);
  while (parts.length > 1 && isIvorianAdminTailSegment(parts[parts.length - 1])) {
    parts.pop();
  }
  return parts.join(', ');
}

/** Numéro seul (évite d’inverser « 2 plateaux » avec un nom de quartier). */
function isStrictHouseNumberSegment(seg: string): boolean {
  const t = seg.trim();
  if (!t) return false;
  return /^(\d{1,6})(?:\s*(bis|ter|b|t))?$/i.test(t);
}

/**
 * Affichage « appli locale » (style Yango) : pas de commune / Abidjan / pays en queue,
 * et ordre « Rue X, numéro » plutôt que « numéro, Rue X ».
 */
export function compactAddressForLocalDisplay(raw: string): string {
  if (!raw || typeof raw !== 'string') return '';
  let s = sanitizeGeocodeDisplayString(singleLineAddressInput(raw));
  if (!s) return '';

  let prev = '';
  while (s !== prev) {
    prev = s;
    s = stripLocalAdminSuffixes(s);
  }

  const reorderCommaParts = (input: string): string => {
    const parts = input.split(',').map((p) => p.trim()).filter(Boolean);
    if (
      parts.length >= 2 &&
      isStrictHouseNumberSegment(parts[0]) &&
      !/^\d/.test(parts[1].trim())
    ) {
      const [num, street, ...rest] = parts;
      return [street, num, ...rest].join(', ');
    }
    if (parts.length === 0) return input;
    const head = parts[0];
    const tail = parts.slice(1).join(', ');
    const numCommaStreet = head.match(/^(\d{1,6})\s*,\s*(.+)$/);
    if (numCommaStreet && !/^\d/.test(numCommaStreet[2].trim())) {
      const core = `${numCommaStreet[2].trim()}, ${numCommaStreet[1]}`;
      return tail ? `${core}, ${tail}` : core;
    }
    const numSpaceStreet = head.match(/^(\d{1,6})\s+(.+)$/);
    if (numSpaceStreet && !/^\d/.test(numSpaceStreet[2].trim())) {
      const core = `${numSpaceStreet[2].trim()}, ${numSpaceStreet[1]}`;
      return tail ? `${core}, ${tail}` : core;
    }
    return parts.join(', ');
  };

  s = reorderCommaParts(s);
  prev = '';
  while (s !== prev) {
    prev = s;
    s = stripLocalAdminSuffixes(s);
  }
  return s.trim();
}

export function addressesVisuallyEqual(a: string, b: string): boolean {
  const n = (s: string) =>
    stripAccentsLower(s.replace(/\s+/g, ' ').trim());
  return n(a) === n(b);
}

/**
 * Libellé après choix d'une suggestion : priorité à la saisie « rue, numéro »,
 * sinon compact local (troncature admin + ordre rue/numéro).
 */
export function formatAutocompleteSelectedAddress(raw: string, userTyped: string): string {
  const u = sanitizeGeocodeDisplayString(singleLineAddressInput(userTyped)).trim();
  const cleanedRaw = sanitizeGeocodeDisplayString(singleLineAddressInput(raw));

  const userStreetThenNum = u.match(/^(.+?),\s*(\d[\w\s\-\/]{0,24})\s*$/);
  if (userStreetThenNum && !/^\d/.test(userStreetThenNum[1].trim())) {
    return compactAddressForLocalDisplay(
      `${userStreetThenNum[1].trim()}, ${userStreetThenNum[2].trim()}`
    );
  }

  return compactAddressForLocalDisplay(cleanedRaw);
}
