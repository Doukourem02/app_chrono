/**
 * Service de géofencing pour détecter l'arrivée du livreur
 */

interface Coordinates {
  latitude: number;
  longitude: number;
}

/**
 * Calcule de la distance en mètres entre deux points GPS :formule de Haversine
 */
export function calculateDistance(
  point1: Coordinates,
  point2: Coordinates
): number {
  const R = 6371000; // Rayon de la Terre en mètres
  const dLat = toRad(point2.latitude - point1.latitude);
  const dLon = toRad(point2.longitude - point1.longitude);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(point1.latitude)) *
      Math.cos(toRad(point2.latitude)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** Rayon de la zone de géofencing en mètres */
export const GEOFENCE_RADIUS = 50;

/** Durée minimale (ms) dans la zone avant validation automatique */
export const AUTO_VALIDATE_DELAY = 10000;

/**
 * Vérifie si le livreur est dans la zone de géofencing
 * @param driverPosition Position actuelle du livreur
 * @param targetPosition Position cible (pickup ou dropoff)
 * @param radius Rayon de la zone en mètres (par défaut 50m)
 * @returns true si le livreur est dans la zone
 */
export function isInGeofence(
  driverPosition: Coordinates | null,
  targetPosition: Coordinates | null,
  radius: number = GEOFENCE_RADIUS
): boolean {
  if (!driverPosition || !targetPosition) {
    return false;
  }

  const distance = calculateDistance(driverPosition, targetPosition);
  return distance <= radius;
}

/**
 * Calcule la distance restante jusqu'à la zone de géofencing
 * @param driverPosition Position actuelle du livreur
 * @param targetPosition Position cible
 * @param radius Rayon de la zone en mètres
 * @returns Distance en mètres (négative si déjà dans la zone, 0 si exactement sur le bord)
 */
export function getDistanceToGeofence(
  driverPosition: Coordinates | null,
  targetPosition: Coordinates | null,
  radius: number = GEOFENCE_RADIUS
): number | null {
  if (!driverPosition || !targetPosition) {
    return null;
  }

  const distance = calculateDistance(driverPosition, targetPosition);
  return distance - radius;
}

/**
 * Détermine le statut de géofencing
 */
export enum GeofenceStatus {
  OUTSIDE = 'outside',
  ENTERING = 'entering',
  INSIDE = 'inside',
  VALIDATED = 'validated',
}

export interface GeofenceState {
  status: GeofenceStatus;
  distance: number | null; // Distance en mètres
  enteredAt: number | null; // Timestamp d'entrée dans la zone (ms)
  timeInZone: number; // Temps passé dans la zone (ms)
}

/**
 * Calcule l'état actuel du géofencing
 */
export function calculateGeofenceState(
  driverPosition: Coordinates | null,
  targetPosition: Coordinates | null,
  previousState: GeofenceState | null,
  radius: number = GEOFENCE_RADIUS
): GeofenceState {
  const now = Date.now();
  const isInside = isInGeofence(driverPosition, targetPosition, radius);
  const distance = getDistanceToGeofence(driverPosition, targetPosition, radius);

  if (!isInside) {
    return {
      status: GeofenceStatus.OUTSIDE,
      distance,
      enteredAt: null,
      timeInZone: 0,
    };
  }

  const wasInside = previousState?.status === GeofenceStatus.INSIDE ||
                  previousState?.status === GeofenceStatus.ENTERING;
  const enteredAt = wasInside && previousState?.enteredAt
    ? previousState.enteredAt
    : now;

  const timeInZone = now - enteredAt;

  if (!wasInside) {
    return {
      status: GeofenceStatus.ENTERING,
      distance,
      enteredAt,
      timeInZone: 0,
    };
  }

  return {
    status: GeofenceStatus.INSIDE,
    distance,
    enteredAt,
    timeInZone,
  };
}

/**
 * Vérifie si la validation automatique doit être déclenchée
 */
export function shouldAutoValidate(state: GeofenceState): boolean {
  return (
    state.status === GeofenceStatus.INSIDE &&
    state.timeInZone >= AUTO_VALIDATE_DELAY
  );
}

