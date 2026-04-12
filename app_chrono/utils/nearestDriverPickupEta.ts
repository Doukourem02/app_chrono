/**
 * ETA « livreur → point de collecte » : plus proche livreur en ligne / dispo / bon véhicule.
 * Estimation (ligne droite + vitesse moyenne) — se met à jour quand la flotte bouge ou le pickup change.
 */
import type { OnlineDriver } from '../hooks/useOnlineDrivers';
import { calculateDistance, calculateETAForVehicle } from './etaCalculator';

export type ClientDeliveryMethod = 'moto' | 'vehicule' | 'cargo';

function driverMatchesMethod(d: OnlineDriver, method: ClientDeliveryMethod): boolean {
  const vt = String(d.vehicle_type || '')
    .toLowerCase()
    .trim();
  return vt === method;
}

export function estimateNearestDriverEtaToPickup(
  pickup: { latitude: number; longitude: number } | null,
  drivers: OnlineDriver[],
  deliveryMethod: ClientDeliveryMethod
): { seconds: number } | null {
  if (
    !pickup ||
    pickup.latitude == null ||
    pickup.longitude == null ||
    Number.isNaN(pickup.latitude) ||
    Number.isNaN(pickup.longitude) ||
    !drivers.length
  ) {
    return null;
  }

  const eligible = drivers.filter(
    (d) =>
      d.is_online === true &&
      d.is_available !== false &&
      driverMatchesMethod(d, deliveryMethod) &&
      typeof d.current_latitude === 'number' &&
      typeof d.current_longitude === 'number' &&
      !Number.isNaN(d.current_latitude) &&
      !Number.isNaN(d.current_longitude)
  );
  if (!eligible.length) return null;

  let bestMinutes = Infinity;
  for (const d of eligible) {
    const meters = calculateDistance(pickup, {
      latitude: d.current_latitude,
      longitude: d.current_longitude,
    });
    const mins = calculateETAForVehicle(meters, deliveryMethod);
    if (mins < bestMinutes) bestMinutes = mins;
  }
  if (!Number.isFinite(bestMinutes)) return null;

  const seconds = Math.max(60, Math.ceil(bestMinutes * 60));
  return { seconds };
}

export function formatDriverPickupEtaBadge(seconds: number): string {
  if (seconds < 90) return '1 min';
  const m = Math.round(seconds / 60);
  return `${Math.max(1, m)} min`;
}
