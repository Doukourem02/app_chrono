/**
 * Service de géocodage - Mapbox (priorité) avec fallback Google
 */
import logger from './logger.js';
import { geocodeForward } from './mapboxService.js';

interface GeocodeResult {
  latitude: number;
  longitude: number;
}

interface GoogleGeocodeResponse {
  status: string;
  results?: Array<{
    geometry: {
      location: {
        lat: number;
        lng: number;
      };
    };
  }>;
}

async function geocodeWithGoogle(address: string): Promise<GeocodeResult | null> {
  const googleApiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_API_KEY;
  if (!googleApiKey || googleApiKey.startsWith('<')) return null;

  try {
    const encodedAddress = encodeURIComponent(address);
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${googleApiKey}&language=fr&region=ci`;
    const response = await fetch(url);
    const data = (await response.json()) as GoogleGeocodeResponse;

    if (data.status === 'OK' && data.results && data.results.length > 0) {
      const location = data.results[0].geometry.location;
      return { latitude: location.lat, longitude: location.lng };
    }
  } catch (error) {
    logger.error('[geocodeService] Google fallback error:', error);
  }
  return null;
}

/**
 * Géocode une adresse en coordonnées GPS
 * Mapbox prioritaire (token serveur), fallback Google si Mapbox non configuré
 */
export async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
  // 1. Essayer Mapbox (token serveur MAPBOX_ACCESS_TOKEN)
  const mapboxResult = await geocodeForward(address, { country: 'ci', limit: 1 });
  if (mapboxResult) {
    return { latitude: mapboxResult.latitude, longitude: mapboxResult.longitude };
  }

  // 2. Fallback Google
  const googleResult = await geocodeWithGoogle(address);
  if (googleResult) return googleResult;

  logger.warn(`[geocodeService] Geocoding failed for address "${address}"`);
  return null;
}

