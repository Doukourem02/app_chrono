import { config } from '../config';

const MAPBOX_GEOCODE_URL = 'https://api.mapbox.com/search/geocode/v6/forward';

/**
 * Géocodage direct (texte → coords) pour aligner pickup/dropoff quand l’autocomplete
 * n’a pas renvoyé de coordonnées (saisie libre, retrieve échoué).
 */
export async function forwardGeocodeAddress(
  query: string,
  country: string = 'ci'
): Promise<{ latitude: number; longitude: number } | null> {
  const token = config.mapboxAccessToken;
  if (!token || !query.trim()) return null;

  try {
    const params = new URLSearchParams({
      q: query.trim(),
      access_token: token,
      limit: '1',
      country,
    });
    const res = await fetch(`${MAPBOX_GEOCODE_URL}?${params}`);
    if (!res.ok) return null;
    const data = await res.json();
    const feat = data?.features?.[0];
    const coords = feat?.geometry?.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) return null;
    const [lng, lat] = coords;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { latitude: lat, longitude: lng };
  } catch {
    return null;
  }
}
