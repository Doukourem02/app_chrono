/**
 * Centres approximatifs (lat, lng) des communes/quartiers des villes couvertes par Krono.
 * Abidjan et Bouaké sont le point de départ, pas une limite — ajouter une ville se fait en
 * ajoutant ses entrées ci-dessous, sans toucher au type ni au code appelant (`city` est une
 * chaîne libre, pas une énumération figée).
 * Utilisés quand l'admin crée une commande « téléphone / hors-ligne » sans GPS au retrait :
 * le matching livreur utilise findNearbyDrivers autour de ce point au lieu de notifier toute la ville.
 *
 * Coordonnées Bouaké de bonne foi mais non vérifiées sur le terrain (contrairement à la liste
 * Abidjan, plus ancienne et déjà éprouvée) — à confirmer/affiner avant un vrai lancement là-bas.
 */
export type City = string;

export const APPROXIMATE_PICKUP_ZONES: Record<
  string,
  { latitude: number; longitude: number; labelFr: string; city: City }
> = {
  // Abidjan
  abobo: { latitude: 5.416, longitude: -4.015, labelFr: 'Abobo', city: 'Abidjan' },
  adjame: { latitude: 5.358, longitude: -4.027, labelFr: 'Adjamé', city: 'Abidjan' },
  attecoube: { latitude: 5.358, longitude: -4.048, labelFr: 'Attécoubé', city: 'Abidjan' },
  cocody: { latitude: 5.358, longitude: -3.989, labelFr: 'Cocody', city: 'Abidjan' },
  koumassi: { latitude: 5.292, longitude: -3.958, labelFr: 'Koumassi', city: 'Abidjan' },
  marcory: { latitude: 5.278, longitude: -3.993, labelFr: 'Marcory', city: 'Abidjan' },
  plateau: { latitude: 5.319, longitude: -4.02, labelFr: 'Plateau', city: 'Abidjan' },
  portbouet: { latitude: 5.238, longitude: -3.957, labelFr: 'Port-Bouët', city: 'Abidjan' },
  treichville: { latitude: 5.304, longitude: -4.008, labelFr: 'Treichville', city: 'Abidjan' },
  yopougon: { latitude: 5.339, longitude: -4.084, labelFr: 'Yopougon', city: 'Abidjan' },
  bingerville: { latitude: 5.358, longitude: -3.888, labelFr: 'Bingerville', city: 'Abidjan' },
  anyama: { latitude: 5.488, longitude: -4.052, labelFr: 'Anyama', city: 'Abidjan' },
  songon: { latitude: 5.318, longitude: -4.178, labelFr: 'Songon', city: 'Abidjan' },

  // Bouaké
  bouake_centre: { latitude: 7.6906, longitude: -5.0303, labelFr: 'Bouaké Centre', city: 'Bouaké' },
  bouake_air_france: { latitude: 7.6975, longitude: -5.0511, labelFr: 'Air France', city: 'Bouaké' },
  bouake_koko: { latitude: 7.7064, longitude: -5.0272, labelFr: 'Koko', city: 'Bouaké' },
  bouake_nimbo: { latitude: 7.6811, longitude: -5.0433, labelFr: 'Nimbo', city: 'Bouaké' },
  bouake_belleville: { latitude: 7.6733, longitude: -5.0244, labelFr: 'Belleville', city: 'Bouaké' },
  bouake_kennedy: { latitude: 7.6844, longitude: -5.0397, labelFr: 'Kennedy', city: 'Bouaké' },
  bouake_dar_es_salam: { latitude: 7.7167, longitude: -5.0167, labelFr: 'Dar-es-Salam', city: 'Bouaké' },
  bouake_ngattakro: { latitude: 7.7011, longitude: -5.0386, labelFr: "N'Gattakro", city: 'Bouaké' },
};

export function resolveApproximatePickupZone(
  zoneId: string | undefined | null
): { latitude: number; longitude: number; labelFr: string; city: City } | null {
  if (!zoneId || typeof zoneId !== 'string') return null;
  const key = zoneId.trim().toLowerCase();
  return APPROXIMATE_PICKUP_ZONES[key] ?? null;
}
