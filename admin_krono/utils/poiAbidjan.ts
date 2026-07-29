/**
 * POI curatés - restaurants, cinémas, etc., par ville.
 * Complète Mapbox/Overpass pour afficher toutes les succursales (style Yango)
 *
 * Chaque groupe est tagué par ville : searchCuratedPoi ne renvoie que les POI de la ville
 * déduite de la position réelle de l'utilisateur (cityHint), pour ne jamais suggérer un lieu
 * d'une autre ville comme s'il était à proximité (ex: cinéma d'Abidjan proposé à un client à
 * Bouaké). Sans cityHint, tout est renvoyé (comportement historique, utilisé nulle part sans
 * position connue en pratique).
 */
export interface CuratedPoi {
  name: string
  full_address: string
  place_formatted: string
  coordinates: { lat: number; lng: number }
  phone?: string
  hours?: string
  category: 'restaurant' | 'cinema' | 'pharmacy' | 'other'
}

/** Mots-clés de recherche → POI correspondants, groupés par ville */
const POI_ENTRIES: { city: string; keywords: string[]; pois: CuratedPoi[] }[] = [
  {
    city: 'Abidjan',
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
 * Retourne les POI dont les keywords matchent la requête, filtrés par ville si cityHint fourni.
 */
export function searchCuratedPoi(query: string, cityHint?: string): CuratedPoi[] {
  const q = query.trim().toLowerCase().replace(/'/g, '')
  if (q.length < 2) return []

  const results: CuratedPoi[] = []
  for (const entry of POI_ENTRIES) {
    if (cityHint && entry.city !== cityHint) continue
    const matches = entry.keywords.some((kw) => q.includes(kw.toLowerCase().replace(/'/g, '')))
    if (matches) {
      results.push(...entry.pois)
    }
  }
  return results
}
