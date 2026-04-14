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

/** Livreurs en ligne, disponibles, bon type de véhicule — pour ETA et UI « X livreurs près du collecte ». */
export function getEligibleDriversForPickup(
  pickup: { latitude: number; longitude: number } | null,
  drivers: OnlineDriver[],
  deliveryMethod: ClientDeliveryMethod
): OnlineDriver[] {
  if (
    !pickup ||
    pickup.latitude == null ||
    pickup.longitude == null ||
    Number.isNaN(pickup.latitude) ||
    Number.isNaN(pickup.longitude) ||
    !drivers.length
  ) {
    return [];
  }

  return drivers.filter(
    (d) =>
      d.is_online === true &&
      d.is_available !== false &&
      driverMatchesMethod(d, deliveryMethod) &&
      typeof d.current_latitude === 'number' &&
      typeof d.current_longitude === 'number' &&
      !Number.isNaN(d.current_latitude) &&
      !Number.isNaN(d.current_longitude)
  );
}

/** Même filtre que l’ETA, trié par distance au point de collecte (plus proche en premier). */
export function listEligibleDriversSortedByPickup(
  pickup: { latitude: number; longitude: number } | null,
  drivers: OnlineDriver[],
  deliveryMethod: ClientDeliveryMethod
): OnlineDriver[] {
  const eligible = getEligibleDriversForPickup(pickup, drivers, deliveryMethod);
  if (!eligible.length || !pickup) return eligible;

  return [...eligible].sort((a, b) => {
    const ma = calculateDistance(pickup, {
      latitude: a.current_latitude,
      longitude: a.current_longitude,
    });
    const mb = calculateDistance(pickup, {
      latitude: b.current_latitude,
      longitude: b.current_longitude,
    });
    return ma - mb;
  });
}

export function estimateNearestDriverEtaToPickup(
  pickup: { latitude: number; longitude: number } | null,
  drivers: OnlineDriver[],
  deliveryMethod: ClientDeliveryMethod
): { seconds: number } | null {
  const eligible = getEligibleDriversForPickup(pickup, drivers, deliveryMethod);
  if (!eligible.length || !pickup) return null;

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
