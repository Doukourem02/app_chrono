/**
 * Centres approximatifs (lat, lng) des communes d’Abidjan et périphérie proche.
 * Utilisés quand l’admin crée une commande « téléphone / hors-ligne » sans GPS au retrait :
 * le matching livreur utilise findNearbyDrivers autour de ce point au lieu de notifier toute la ville.
 */
export const ABIDJAN_APPROXIMATE_PICKUP_ZONES: Record<
  string,
  { latitude: number; longitude: number; labelFr: string }
> = {
  abobo: { latitude: 5.416, longitude: -4.015, labelFr: 'Abobo' },
  adjame: { latitude: 5.358, longitude: -4.027, labelFr: 'Adjamé' },
  attecoube: { latitude: 5.358, longitude: -4.048, labelFr: 'Attécoubé' },
  cocody: { latitude: 5.358, longitude: -3.989, labelFr: 'Cocody' },
  koumassi: { latitude: 5.292, longitude: -3.958, labelFr: 'Koumassi' },
  marcory: { latitude: 5.278, longitude: -3.993, labelFr: 'Marcory' },
  plateau: { latitude: 5.319, longitude: -4.02, labelFr: 'Plateau' },
  portbouet: { latitude: 5.238, longitude: -3.957, labelFr: 'Port-Bouët' },
  treichville: { latitude: 5.304, longitude: -4.008, labelFr: 'Treichville' },
  yopougon: { latitude: 5.339, longitude: -4.084, labelFr: 'Yopougon' },
  bingerville: { latitude: 5.358, longitude: -3.888, labelFr: 'Bingerville' },
  anyama: { latitude: 5.488, longitude: -4.052, labelFr: 'Anyama' },
  songon: { latitude: 5.318, longitude: -4.178, labelFr: 'Songon' },
};

export function resolveApproximatePickupZone(
  zoneId: string | undefined | null
): { latitude: number; longitude: number; labelFr: string } | null {
  if (!zoneId || typeof zoneId !== 'string') return null;
  const key = zoneId.trim().toLowerCase();
  return ABIDJAN_APPROXIMATE_PICKUP_ZONES[key] ?? null;
}
