/**
 * Service Mapbox côté backend - Geocoding, Directions, Search Box
 * Token serveur uniquement (MAPBOX_ACCESS_TOKEN) - jamais exposé au client
 */
import logger from './logger.js';

const MAPBOX_GEOCODE_FORWARD = 'https://api.mapbox.com/search/geocode/v6/forward';
const MAPBOX_GEOCODE_REVERSE = 'https://api.mapbox.com/search/geocode/v6/reverse';
const MAPBOX_DIRECTIONS = 'https://api.mapbox.com/directions/v5/mapbox/driving-traffic';
const MAPBOX_SEARCH_SUGGEST = 'https://api.mapbox.com/search/searchbox/v1/suggest';
const MAPBOX_SEARCH_RETRIEVE = 'https://api.mapbox.com/search/searchbox/v1/retrieve';

function getToken(): string | null {
  const token = process.env.MAPBOX_ACCESS_TOKEN;
  if (!token || token.startsWith('<')) return null;
  return token;
}

export interface GeocodeResult {
  latitude: number;
  longitude: number;
  address?: string;
}

export interface ReverseGeocodeResult {
  address: string;
  latitude: number;
  longitude: number;
}

export interface DirectionsResult {
  coordinates: { lat: number; lng: number }[];
  duration: number;
  durationTypical?: number;
  distance: number;
}

export interface SearchSuggestion {
  mapbox_id: string;
  name?: string;
  address?: string;
  full_address?: string;
  place_formatted?: string;
  feature_type?: string;
}

export interface SearchRetrieveResult {
  mapbox_id: string;
  address?: string;
  latitude: number;
  longitude: number;
}

/**
 * Forward geocoding : adresse → coordonnées
 */
export async function geocodeForward(address: string, options?: { country?: string; limit?: number }): Promise<GeocodeResult | null> {
  const token = getToken();
  if (!token) {
    logger.warn('[mapboxService] MAPBOX_ACCESS_TOKEN not configured');
    return null;
  }

  try {
    const params = new URLSearchParams({
      q: address.trim(),
      access_token: token,
      language: 'fr',
      limit: String(options?.limit ?? 1),
    });
    if (options?.country) params.set('country', options.country);

    const res = await fetch(`${MAPBOX_GEOCODE_FORWARD}?${params}`);
    const data = (await res.json()) as { features?: Array<{ geometry?: { coordinates?: [number, number] }; properties?: { full_address?: string } }> };

    const feature = data?.features?.[0];
    if (!feature?.geometry?.coordinates) return null;

    const [lng, lat] = feature.geometry.coordinates;
    return {
      latitude: lat,
      longitude: lng,
      address: feature.properties?.full_address,
    };
  } catch (error) {
    logger.error('[mapboxService] geocodeForward error:', error);
    return null;
  }
}

/**
 * Reverse geocoding : coordonnées → adresse
 */
export async function reverseGeocode(latitude: number, longitude: number): Promise<ReverseGeocodeResult | null> {
  const token = getToken();
  if (!token) return null;

  try {
    const params = new URLSearchParams({
      longitude: String(longitude),
      latitude: String(latitude),
      access_token: token,
      language: 'fr',
    });

    const res = await fetch(`${MAPBOX_GEOCODE_REVERSE}?${params}`);
    const data = (await res.json()) as { features?: Array<{ geometry?: { coordinates?: [number, number] }; properties?: { full_address?: string } }> };

    const feature = data?.features?.[0];
    if (!feature?.geometry?.coordinates) return null;

    const [lng, lat] = feature.geometry.coordinates;
    const address = feature.properties?.full_address ?? `${lat},${lng}`;
    return { address, latitude: lat, longitude: lng };
  } catch (error) {
    logger.error('[mapboxService] reverseGeocode error:', error);
    return null;
  }
}

/**
 * Directions avec trafic (driving-traffic)
 */
export async function getDirections(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number }
): Promise<DirectionsResult | null> {
  const token = getToken();
  if (!token) return null;

  try {
    const coords = `${origin.lng},${origin.lat};${destination.lng},${destination.lat}`;
    const params = new URLSearchParams({ geometries: 'geojson', access_token: token });
    const res = await fetch(`${MAPBOX_DIRECTIONS}/${coords}?${params}`);
    const data = (await res.json()) as {
      code?: string;
      routes?: Array<{
        geometry?: { coordinates?: [number, number][] };
        legs?: Array<{ duration?: number; duration_typical?: number; distance?: number }>;
        duration?: number;
        distance?: number;
      }>;
    };

    if (data.code !== 'Ok' || !data.routes?.[0]) return null;

    const route = data.routes[0];
    const leg = route.legs?.[0];
    const geometryCoords = route.geometry?.coordinates;
    const coordinates = geometryCoords
      ? geometryCoords.map(([lng, lat]) => ({ lat, lng }))
      : [];

    return {
      coordinates,
      duration: leg?.duration ?? route.duration ?? 0,
      durationTypical: leg?.duration_typical,
      distance: leg?.distance ?? route.distance ?? 0,
    };
  } catch (error) {
    logger.error('[mapboxService] getDirections error:', error);
    return null;
  }
}

/**
 * Search Box API - suggest (autocomplete)
 */
export async function searchSuggest(
  query: string,
  options?: { country?: string; proximity?: string; limit?: number; sessionToken?: string }
): Promise<SearchSuggestion[]> {
  const token = getToken();
  if (!token) return [];

  try {
    const params = new URLSearchParams({
      q: query.trim(),
      access_token: token,
      language: 'fr',
      limit: String(options?.limit ?? 10),
    });
    if (options?.country) params.set('country', options.country);
    if (options?.proximity) params.set('proximity', options.proximity);
    if (options?.sessionToken) params.set('session_token', options.sessionToken);

    const res = await fetch(`${MAPBOX_SEARCH_SUGGEST}?${params}`);
    const data = (await res.json()) as { suggestions?: SearchSuggestion[] };

    return data?.suggestions ?? [];
  } catch (error) {
    logger.error('[mapboxService] searchSuggest error:', error);
    return [];
  }
}

/**
 * Search Box API - retrieve (récupérer les coordonnées d'une suggestion)
 */
export async function searchRetrieve(
  mapboxId: string,
  options?: { sessionToken?: string }
): Promise<SearchRetrieveResult | null> {
  const token = getToken();
  if (!token) return null;

  try {
    const params = new URLSearchParams({ access_token: token });
    if (options?.sessionToken) params.set('session_token', options.sessionToken);

    const res = await fetch(`${MAPBOX_SEARCH_RETRIEVE}/${encodeURIComponent(mapboxId)}?${params}`);
    const data = (await res.json()) as {
      features?: Array<{
        geometry?: { coordinates?: [number, number] };
        properties?: { coordinates?: { latitude: number; longitude: number }; full_address?: string };
      }>;
    };

    const feature = data?.features?.[0];
    if (!feature) return null;

    let latitude: number;
    let longitude: number;

    if (feature.geometry?.coordinates) {
      const [lng, lat] = feature.geometry.coordinates;
      latitude = lat;
      longitude = lng;
    } else if (feature.properties?.coordinates) {
      latitude = feature.properties.coordinates.latitude;
      longitude = feature.properties.coordinates.longitude;
    } else {
      return null;
    }

    return {
      mapbox_id: mapboxId,
      address: feature.properties?.full_address,
      latitude,
      longitude,
    };
  } catch (error) {
    logger.error('[mapboxService] searchRetrieve error:', error);
    return null;
  }
}
