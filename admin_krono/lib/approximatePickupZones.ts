/**
 * Liste des zones de retrait pour commandes téléphoniques sans GPS (alignée sur le backend,
 * krono_backend/src/utils/approximatePickupZones.ts). Groupée par ville pour le <select>.
 * Abidjan et Bouaké sont le point de départ, pas une limite — ajouter une ville se fait en
 * ajoutant ses entrées ci-dessous (`city` est une chaîne libre) ; APPROXIMATE_PICKUP_CITIES
 * et le regroupement du <select> s'adaptent automatiquement, sans toucher au code appelant.
 */
export type City = string

export const APPROXIMATE_PICKUP_ZONE_OPTIONS: { value: string; label: string; city: City }[] = [
  // Abidjan
  { value: 'abobo', label: 'Abobo', city: 'Abidjan' },
  { value: 'adjame', label: 'Adjamé', city: 'Abidjan' },
  { value: 'attecoube', label: 'Attécoubé', city: 'Abidjan' },
  { value: 'cocody', label: 'Cocody', city: 'Abidjan' },
  { value: 'koumassi', label: 'Koumassi', city: 'Abidjan' },
  { value: 'marcory', label: 'Marcory', city: 'Abidjan' },
  { value: 'plateau', label: 'Plateau', city: 'Abidjan' },
  { value: 'portbouet', label: 'Port-Bouët', city: 'Abidjan' },
  { value: 'treichville', label: 'Treichville', city: 'Abidjan' },
  { value: 'yopougon', label: 'Yopougon', city: 'Abidjan' },
  { value: 'bingerville', label: 'Bingerville', city: 'Abidjan' },
  { value: 'anyama', label: 'Anyama', city: 'Abidjan' },
  { value: 'songon', label: 'Songon', city: 'Abidjan' },

  // Bouaké
  { value: 'bouake_centre', label: 'Bouaké Centre', city: 'Bouaké' },
  { value: 'bouake_air_france', label: 'Air France', city: 'Bouaké' },
  { value: 'bouake_koko', label: 'Koko', city: 'Bouaké' },
  { value: 'bouake_nimbo', label: 'Nimbo', city: 'Bouaké' },
  { value: 'bouake_belleville', label: 'Belleville', city: 'Bouaké' },
  { value: 'bouake_kennedy', label: 'Kennedy', city: 'Bouaké' },
  { value: 'bouake_dar_es_salam', label: 'Dar-es-Salam', city: 'Bouaké' },
  { value: 'bouake_ngattakro', label: "N'Gattakro", city: 'Bouaké' },
]

/** Villes distinctes présentes dans la liste ci-dessus, dans leur ordre d'apparition. */
export const APPROXIMATE_PICKUP_CITIES: City[] = Array.from(
  new Set(APPROXIMATE_PICKUP_ZONE_OPTIONS.map((z) => z.city))
)
