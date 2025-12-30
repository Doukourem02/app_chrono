/**
 * Calcule le bearing (cap) entre deux points GPS en degrés
 * Le bearing est l'angle dans le sens horaire depuis le nord (0° = Nord, 90° = Est, 180° = Sud, 270° = Ouest)
 * 
 * @param from Point de départ { lat, lng }
 * @param to Point d'arrivée { lat, lng }
 * @returns Bearing en degrés (0-360)
 */
export function calculateBearing(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number }
): number {
  const lat1 = toRadians(from.lat);
  const lat2 = toRadians(to.lat);
  const deltaLon = toRadians(to.lng - from.lng);

  const y = Math.sin(deltaLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLon);

  let bearing = Math.atan2(y, x);
  bearing = toDegrees(bearing);
  bearing = (bearing + 360) % 360; // Normaliser entre 0 et 360

  return bearing;
}

/**
 * Convertit les degrés en radians
 */
function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Convertit les radians en degrés
 */
function toDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}

