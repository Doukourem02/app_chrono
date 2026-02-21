/**
 * Reverse geocoding Mapbox Geocoding API v6
 * Aligné avec admin_chrono pour des adresses précises (ex: Rue Panama City, 772)
 */

const MAPBOX_REVERSE_URL = 'https://api.mapbox.com/search/geocode/v6/reverse';

interface MapboxReverseFeature {
  type: string;
  properties?: {
    name?: string;
    full_address?: string;
    place_formatted?: string;
    feature_type?: string;
    context?: {
      address?: {
        address_number?: string;
        street_name?: string;
        name?: string;
      };
      street?: { name?: string };
      place?: { name?: string };
      locality?: { name?: string };
      district?: { name?: string };
      neighborhood?: { name?: string };
    };
  };
}

interface MapboxReverseResponse {
  type: string;
  features?: MapboxReverseFeature[];
}

/**
 * Construit une adresse lisible à partir du contexte Mapbox
 * Priorité : adresse complète (rue + numéro) > name > place_formatted
 */
function buildAddressFromFeature(feature: MapboxReverseFeature): string | null {
  const props = feature.properties;
  if (!props) return null;

  const ctx = props.context;
  const addr = ctx?.address;

  // Adresse structurée : "Rue Panama City, 772" ou "772 Rue Panama City"
  if (addr?.street_name) {
    const street = addr.street_name.trim();
    const num = addr.address_number?.trim();
    if (street) {
      if (num) {
        return `${street}, ${num}`;
      }
      return street;
    }
  }

  // Fallback : name (ex: "Rue Panama City, 772")
  if (props.name && props.name.length > 3) {
    return props.name;
  }

  // Fallback : full_address
  if (props.full_address && props.full_address.length > 3) {
    return props.full_address;
  }

  // Dernier recours : place_formatted (quartier, ville)
  if (props.place_formatted) {
    return props.place_formatted;
  }

  return null;
}

/**
 * Nettoie l'adresse pour la Côte d'Ivoire (cohérent avec admin_chrono)
 */
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
 * Reverse geocode : coordonnées → adresse
 * Utilise Mapbox Geocoding v6 pour des résultats précis (rues, numéros)
 */
export async function mapboxReverseGeocode(
  latitude: number,
  longitude: number,
  accessToken: string,
  options?: { language?: string; country?: string; types?: string }
): Promise<string | null> {
  if (!accessToken || accessToken.startsWith('<')) return null;

  try {
    const params = new URLSearchParams({
      longitude: String(longitude),
      latitude: String(latitude),
      access_token: accessToken,
      language: options?.language || 'fr',
      country: options?.country || 'ci',
    });

    // types=address priorise les adresses (rue + numéro) plutôt que les quartiers (ex: Cité Colombe)
    const types = options?.types || 'address';
    params.set('types', types);
    params.set('limit', '5');

    const url = `${MAPBOX_REVERSE_URL}?${params}`;
    const response = await fetch(url);
    const data: MapboxReverseResponse = await response.json();

    if (!response.ok || !data.features?.length) {
      return null;
    }

    // Priorité : address > street > place
    const addressFeature = data.features.find((f) => f.properties?.context?.address);
    const streetFeature = data.features.find((f) => f.properties?.context?.street);
    const anyFeature = data.features[0];

    const feature = addressFeature || streetFeature || anyFeature;
    const raw = buildAddressFromFeature(feature);

    if (raw && raw.length > 3) {
      return cleanAddress(raw);
    }

    return null;
  } catch {
    return null;
  }
}
