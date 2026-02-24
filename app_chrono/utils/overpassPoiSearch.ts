/**
 * Recherche POI via Overpass API (OpenStreetMap)
 * Pharmacies, restaurants, écoles, KFC, Burger King, etc. - Côte d'Ivoire
 */
const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

// Bbox Abidjan (south, west, north, east)
const ABIDJAN_BBOX = '5.15,-4.25,5.55,-3.85';

const TERM_TO_OSM: Record<string, { tag: string; value: string }> = {
  pharmacie: { tag: 'amenity', value: 'pharmacy' },
  pharmacies: { tag: 'amenity', value: 'pharmacy' },
  restaurant: { tag: 'amenity', value: 'restaurant' },
  restaurants: { tag: 'amenity', value: 'restaurant' },
  école: { tag: 'amenity', value: 'school' },
  ecole: { tag: 'amenity', value: 'school' },
  écoles: { tag: 'amenity', value: 'school' },
  université: { tag: 'amenity', value: 'university' },
  hôpital: { tag: 'amenity', value: 'hospital' },
  hopital: { tag: 'amenity', value: 'hospital' },
  clinique: { tag: 'amenity', value: 'clinic' },
  supermarché: { tag: 'shop', value: 'supermarket' },
  supermarche: { tag: 'shop', value: 'supermarket' },
  kfc: { tag: 'name', value: 'KFC' },
  'burger king': { tag: 'name', value: 'Burger King' },
  mcdonald: { tag: 'name', value: 'McDonald' },
  mcdo: { tag: 'name', value: 'McDo' },
  banque: { tag: 'amenity', value: 'bank' },
  station: { tag: 'amenity', value: 'fuel' },
  zoo: { tag: 'tourism', value: 'zoo' },
  église: { tag: 'amenity', value: 'place_of_worship' },
  mosquée: { tag: 'amenity', value: 'place_of_worship' },
  marché: { tag: 'amenity', value: 'marketplace' },
  marche: { tag: 'amenity', value: 'marketplace' },
  boulangerie: { tag: 'shop', value: 'bakery' },
  coiffeur: { tag: 'shop', value: 'hairdresser' },
  bureau: { tag: 'office', value: 'yes' },
  hotel: { tag: 'tourism', value: 'hotel' },
  hôtel: { tag: 'tourism', value: 'hotel' },
  fastfood: { tag: 'amenity', value: 'fast_food' },
  'fast food': { tag: 'amenity', value: 'fast_food' },
};

function detectPoiCategory(query: string): { tag: string; value: string } | null {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return null;
  for (const [term, osm] of Object.entries(TERM_TO_OSM)) {
    if (q.includes(term) || term.includes(q)) return osm;
  }
  return null;
}

export interface OverpassPoiResult {
  name: string;
  mapbox_id: string;
  feature_type: string;
  address?: string;
  full_address: string;
  place_formatted: string;
  coordinates: { lat: number; lng: number };
  source: 'overpass';
}

export async function searchOverpassPoi(
  query: string,
  proximity?: { lat: number; lng: number }
): Promise<OverpassPoiResult[]> {
  const trimmed = query.trim();
  if (!trimmed || trimmed.length < 2) return [];

  const category = detectPoiCategory(trimmed);
  const bbox = ABIDJAN_BBOX;

  let overpassQuery: string;

  if (category && category.tag !== 'name') {
    const { tag, value } = category;
    // nwr = nodes + ways + relations (syntaxe Overpass valide)
    overpassQuery = `[out:json][timeout:15];nwr["${tag}"="${value}"](${bbox});out center;`;
  } else {
    const escaped = trimmed.replace(/[[\]\\^$.*+?()|{}]/g, '\\$&').replace(/"/g, '');
    overpassQuery = `[out:json][timeout:15];nwr["name"~"${escaped}",i](${bbox});out center;`;
  }

  try {
    const res = await fetch(OVERPASS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(overpassQuery)}`,
    });
    if (!res.ok) return [];
    const data = await res.json();
    const elements = (data.elements || []) as {
      type: string;
      id: number;
      lat?: number;
      lon?: number;
      center?: { lat: number; lon: number };
      tags?: { name?: string; 'addr:street'?: string; 'addr:postcode'?: string };
    }[];

    const results: OverpassPoiResult[] = [];
    const seen = new Set<string>();

    for (const el of elements) {
      const name = el.tags?.name || '';
      if (!name) continue;
      const lat = el.lat ?? el.center?.lat;
      const lon = el.lon ?? el.center?.lon;
      if (lat == null || lon == null) continue;
      const key = `${name}|${lat}|${lon}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const street = el.tags?.['addr:street'] || '';
      const addr = street ? `${street}, Abidjan` : 'Abidjan';
      const fullAddress = `${name}, ${addr}`;

      results.push({
        name,
        mapbox_id: `overpass-${el.type}-${el.id}`,
        feature_type: 'poi',
        full_address: fullAddress,
        place_formatted: addr,
        coordinates: { lat, lng: lon },
        source: 'overpass',
      });
    }

    if (proximity && results.length > 1) {
      results.sort((a, b) => {
        const distA = Math.hypot(a.coordinates.lat - proximity.lat, a.coordinates.lng - proximity.lng);
        const distB = Math.hypot(b.coordinates.lat - proximity.lat, b.coordinates.lng - proximity.lng);
        return distA - distB;
      });
    }

    return results.slice(0, 15);
  } catch {
    return [];
  }
}
