/**
 * Calcule le bearing (cap) entre deux points GPS en degrés
 * Le bearing est l'angle dans le sens horaire depuis le nord (0° = Nord, 90° = Est, 180° = Sud, 270° = Ouest)
 * 
 * @param from Point de départ { latitude, longitude }
 * @param to Point d'arrivée { latitude, longitude }
 * @returns Bearing en degrés (0-360)
 */
export function calculateBearing(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number }
): number {
  const lat1 = toRadians(from.latitude);
  const lat2 = toRadians(to.latitude);
  const deltaLon = toRadians(to.longitude - from.longitude);

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

/**
 * Calcule la différence d'angle la plus courte entre deux bearings
 * Utile pour animer la rotation de manière fluide
 * 
 * @param currentBearing Bearing actuel (0-360)
 * @param targetBearing Bearing cible (0-360)
 * @returns Différence d'angle (-180 à 180)
 */
export function getShortestAngleDifference(
  currentBearing: number,
  targetBearing: number
): number {
  let diff = targetBearing - currentBearing;
  
  // Normaliser la différence entre -180 et 180
  if (diff > 180) {
    diff -= 360;
  } else if (diff < -180) {
    diff += 360;
  }
  
  return diff;
}

