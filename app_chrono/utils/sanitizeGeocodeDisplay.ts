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
 * Segments souvent ajoutés en fin par Mapbox / Nominatim : inutiles pour une appli 100 % en CI.
 */
function isIvorianAdminTailSegment(segment: string): boolean {
  const n = stripAccentsLower(segment);
  if (!n) return false;
  if (n.startsWith('cote d')) return true;
  if (n === 'ci' || n === 'ci.' || n === 'ivoire') return true;
  if (n === 'ivory coast') return true;
  if (n === 'abidjan') return true;

  const communes = new Set([
    'abobo',
    'adjame',
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
  ]);
  if (communes.has(n)) return true;

  const quartiers = new Set([
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
  return quartiers.has(n);
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

/**
 * Libellé affiché après choix d'une suggestion : respecte la saisie « rue, numéro », évite
 * « numéro, rue » imposé par Mapbox, et tronque les suffixes admin ivoiriens.
 */
export function formatAutocompleteSelectedAddress(raw: string, userTyped: string): string {
  const u = sanitizeGeocodeDisplayString(singleLineAddressInput(userTyped)).trim();
  const cleanedRaw = sanitizeGeocodeDisplayString(singleLineAddressInput(raw));

  const userStreetThenNum = u.match(/^(.+?),\s*(\d[\w\s\-\/]{0,24})\s*$/);
  if (userStreetThenNum && !/^\d/.test(userStreetThenNum[1].trim())) {
    return `${userStreetThenNum[1].trim()}, ${userStreetThenNum[2].trim()}`;
  }

  let stripped = stripLocalAdminSuffixes(cleanedRaw);
  const parts = stripped.split(',').map((p) => p.trim()).filter(Boolean);

  if (parts.length === 2 && /^\d[\w\s\-\/]*$/.test(parts[0]) && !/^\d/.test(parts[1])) {
    return `${parts[1]}, ${parts[0]}`;
  }

  const head = parts[0] ?? stripped;
  const numCommaStreet = head.match(/^(\d{1,6})\s*,\s*(.+)$/);
  if (numCommaStreet && !/^\d/.test(numCommaStreet[2].trim())) {
    const rest = parts.length > 1 ? parts.slice(1).join(', ') : '';
    const core = `${numCommaStreet[2].trim()}, ${numCommaStreet[1]}`;
    return rest ? `${core}, ${rest}` : core;
  }
  const numSpaceStreet = head.match(/^(\d{1,6})\s+(.+)$/);
  if (numSpaceStreet && !/^\d/.test(numSpaceStreet[2].trim())) {
    const rest = parts.length > 1 ? parts.slice(1).join(', ') : '';
    const core = `${numSpaceStreet[2].trim()}, ${numSpaceStreet[1]}`;
    return rest ? `${core}, ${rest}` : core;
  }

  return stripped;
}
