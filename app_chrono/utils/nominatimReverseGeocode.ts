/**
 * Reverse geocoding Nominatim (OpenStreetMap)
 * Bonne couverture pour Abidjan - utilisé quand Mapbox n'a pas d'adresses
 */

const NOMINATIM_REVERSE_URL = 'https://nominatim.openstreetmap.org/reverse';

const NOMINATIM_HEADERS: HeadersInit = {
  'User-Agent': 'ChronoLivraison/1.0 (app-mobile-reverse-geocode)',
};

interface NominatimAddress {
  road?: string;
  house_number?: string;
  suburb?: string;
  neighbourhood?: string;
  city?: string;
  state?: string;
  country?: string;
}

interface NominatimResult {
  display_name?: string;
  address?: NominatimAddress;
}

function cleanAddress(address: string): string {
  return address
    .replace(/, Côte d'Ivoire$/, '')
    .replace(/,\s*Abidjan,\s*Abidjan/g, ', Abidjan')
    .replace(/^Unnamed Road,?\s*/, '')
    .replace(/^Route sans nom,?\s*/, '')
    .replace(/\s*,\s*$/, '')
    .trim();
}

/**
 * Construit une adresse à partir du résultat Nominatim
 * Priorité : road + house_number > road > display_name
 */
function buildAddress(result: NominatimResult): string | null {
  const addr = result.address;
  if (!addr) return result.display_name || null;

  // Adresse structurée : "Rue Panama City, 772" (priorité rue + numéro)
  if (addr.road) {
    const street = addr.road.trim();
    const num = addr.house_number?.trim();
    if (street) {
      if (num) {
        return `${street}, ${num}`;
      }
      const locality = addr.suburb || addr.neighbourhood || addr.city;
      return locality ? `${street}, ${locality}` : street;
    }
  }

  return result.display_name || null;
}

/**
 * Reverse geocode via Nominatim (OSM)
 * Utile pour Abidjan où Mapbox n'a pas toujours d'adresses
 */
export async function nominatimReverseGeocode(
  latitude: number,
  longitude: number
): Promise<string | null> {
  try {
    const params = new URLSearchParams({
      lat: String(latitude),
      lon: String(longitude),
      format: 'json',
      addressdetails: '1',
      zoom: '18',
      'accept-language': 'fr',
    });

    const response = await fetch(`${NOMINATIM_REVERSE_URL}?${params}`, {
      headers: NOMINATIM_HEADERS,
    });

    if (!response.ok) return null;

    const data: NominatimResult = await response.json();
    const raw = buildAddress(data);

    if (raw && raw.length > 3) {
      return cleanAddress(raw);
    }

    return null;
  } catch {
    return null;
  }
}
