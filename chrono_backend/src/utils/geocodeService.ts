/**
 * Service de géocodage utilisant Google Geocoding API
 */

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

/**
 * Géocode une adresse en coordonnées GPS
 * @param address - L'adresse à géocoder
 * @returns Les coordonnées GPS ou null si le géocodage échoue
 */
export async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
  const googleApiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_API_KEY;
  
  if (!googleApiKey || googleApiKey.startsWith('<')) {
    console.warn('[geocodeService] Google API key not configured');
    return null;
  }

  try {
    const encodedAddress = encodeURIComponent(address);
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${googleApiKey}&language=fr&region=ci`;
    
    const response = await fetch(url);
    const data = await response.json() as GoogleGeocodeResponse;

    if (data.status === 'OK' && data.results && data.results.length > 0) {
      const location = data.results[0].geometry.location;
      return {
        latitude: location.lat,
        longitude: location.lng,
      };
    } else {
      console.warn(`[geocodeService] Geocoding failed for address "${address}": ${data.status}`);
      return null;
    }
  } catch (error) {
    console.error('[geocodeService] Error geocoding address:', error);
    return null;
  }
}

