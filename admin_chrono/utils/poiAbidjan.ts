/**
 * POI curatés Abidjan - restaurants, cinémas, etc.
 * Complète Mapbox/Overpass pour afficher toutes les succursales (style Yango)
 */
import { matchesNormalized } from './searchNormalize'

export interface CuratedPoi {
  name: string
  full_address: string
  place_formatted: string
  coordinates: { lat: number; lng: number }
  phone?: string
  hours?: string
  category: 'restaurant' | 'cinema' | 'pharmacy' | 'other'
}

/** Mots-clés de recherche → POI correspondants */
const POI_ENTRIES: { keywords: string[]; pois: CuratedPoi[] }[] = [
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
]

/**
 * Recherche dans les POI curatés.
 * Retourne les POI dont les keywords matchent la requête.
 */
export function searchCuratedPoi(query: string): CuratedPoi[] {
  const q = query.trim().toLowerCase().replace(/'/g, '')
  if (q.length < 2) return []

  const results: CuratedPoi[] = []
  for (const entry of POI_ENTRIES) {
    const matches = entry.keywords.some((kw) => matchesNormalized(q, kw))
    if (matches) {
      results.push(...entry.pois)
    }
  }
  return results
}
