/**
 * Service de géocodage - Mapbox uniquement
 */
import logger from './logger.js';
import { geocodeForward } from './mapboxService.js';

interface GeocodeResult {
  latitude: number;
  longitude: number;
}

/**
 * Géocode une adresse en coordonnées GPS (Mapbox)
 */
export async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
  const mapboxResult = await geocodeForward(address, { country: 'ci', limit: 1 });
  if (mapboxResult) {
    return { latitude: mapboxResult.latitude, longitude: mapboxResult.longitude };
  }
  logger.warn(`[geocodeService] Geocoding failed for address "${address}"`);
  return null;
}

