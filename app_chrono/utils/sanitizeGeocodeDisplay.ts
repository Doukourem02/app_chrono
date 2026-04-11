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

/** Une seule ligne lisible : pas de collage « deux adresses » dans un champ. */
export function singleLineAddressInput(text: string): string {
  const oneLine = text.replace(/\r\n|\r|\n/g, ' ').replace(/\s{2,}/g, ' ').trim();
  const arrowSplit = oneLine.split(/\s*[→➔>]\s*/);
  if (arrowSplit.length > 1) return arrowSplit[0].trim();
  const deA = oneLine.match(/^(.+?)\s+(?:à|À):\s*(.+)$/);
  if (deA) return deA[1].trim();
  return oneLine;
}
