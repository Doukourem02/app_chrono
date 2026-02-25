/**
 * POI curatés Abidjan - restaurants, cinémas, etc.
 * Complète Mapbox/Overpass pour afficher toutes les succursales (style Yango)
 */
export interface CuratedPoi {
  name: string;
  full_address: string;
  place_formatted: string;
  coordinates: { lat: number; lng: number };
  phone?: string;
  hours?: string;
  category: 'restaurant' | 'cinema' | 'pharmacy' | 'other';
}

/** Mots-clés de recherche → POI correspondants */
const POI_ENTRIES: { keywords: string[]; pois: CuratedPoi[] }[] = [
  {
    keywords: ["o'takkos", 'otakkos', 'otakos', 'takkos'],
    pois: [
      {
        name: "O'Takkos 2 Plateaux",
        full_address: "O'Takkos, 2 Plateaux, Cocody, Abidjan, Côte d'Ivoire",
        place_formatted: '2 Plateaux, Cocody',
        coordinates: { lat: 5.373251, lng: -3.99031 },
        phone: undefined,
        hours: '11h–23h',
        category: 'restaurant',
      },
      {
        name: "O'Takkos Résidentiel",
        full_address: "O'Takkos, Résidentiel, Cocody, Abidjan, Côte d'Ivoire",
        place_formatted: 'Résidentiel, Cocody',
        coordinates: { lat: 5.358, lng: -4.008 },
        hours: '11h–23h',
        category: 'restaurant',
      },
      {
        name: "O'Takkos Faya",
        full_address:
          "O'Takkos, Boulevard Germain Koffi Gadeau, Faya Saint Paul, Cocody, Abidjan, Côte d'Ivoire",
        place_formatted: 'Faya, Riviera, Cocody',
        coordinates: { lat: 5.358, lng: -3.988 },
        phone: '07 08 41 89 66',
        hours: '11h–23h',
        category: 'restaurant',
      },
      {
        name: "O'Takkos Angré",
        full_address: "O'Takkos, 7e tranche Angré, Cocody, Abidjan, Côte d'Ivoire",
        place_formatted: '7e tranche Angré, Cocody',
        coordinates: { lat: 5.382, lng: -3.965 },
        phone: '05 46 51 07 44',
        hours: '11h–23h',
        category: 'restaurant',
      },
      {
        name: "O'Takkos Zone 4",
        full_address:
          "O'Takkos, Rue Louis Lumière, derrière Maison Kayser, Zone 4, Marcory, Abidjan, Côte d'Ivoire",
        place_formatted: 'Zone 4, Marcory',
        coordinates: { lat: 5.278, lng: -3.995 },
        phone: '07 03 05 16 99',
        hours: '11h–00h',
        category: 'restaurant',
      },
      {
        name: "O'Takkos Yopougon",
        full_address: "O'Takkos, Annaneraie, Yopougon, Abidjan, Côte d'Ivoire",
        place_formatted: 'Annaneraie, Yopougon',
        coordinates: { lat: 5.342, lng: -4.085 },
        phone: '07 47 52 16 01',
        hours: '11h–23h',
        category: 'restaurant',
      },
    ],
  },
  {
    keywords: ['pathe', 'pathé', 'pathé cinema', 'pathe cinema', 'cap sud'],
    pois: [
      {
        name: 'Pathé Cap Sud',
        full_address: 'Pathé Cap Sud, Centre commercial Cap Sud, Boulevard Félix Houphouët-Boigny, Marcory, Abidjan, Côte d\'Ivoire',
        place_formatted: 'Cap Sud, Marcory',
        coordinates: { lat: 5.27, lng: -4.0 },
        hours: '10h–1h (3h ven-sam)',
        category: 'cinema',
      },
    ],
  },
];

/**
 * Recherche dans les POI curatés.
 * Retourne les POI dont les keywords matchent la requête.
 */
export function searchCuratedPoi(query: string): CuratedPoi[] {
  const q = query.trim().toLowerCase().replace(/'/g, '');
  if (q.length < 2) return [];

  const results: CuratedPoi[] = [];
  for (const entry of POI_ENTRIES) {
    const matches = entry.keywords.some((kw) => q.includes(kw.replace(/'/g, '')) || kw.replace(/'/g, '').includes(q));
    if (matches) {
      results.push(...entry.pois);
    }
  }
  return results;
}
