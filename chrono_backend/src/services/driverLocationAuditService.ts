import pool from '../config/db.js';
import logger from '../utils/logger.js';
import { maskUserId } from '../utils/maskSensitiveData.js';

/** Dernière insertion par livreur (évite de saturer la DB à chaque tick GPS). */
const lastInsertByDriver = new Map<string, number>();
const MIN_INTERVAL_MS = 45_000;

function isValidCoord(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180 &&
    !(lat === 0 && lng === 0)
  );
}

/**
 * Enregistre une position dans driver_locations si le throttle le permet.
 * Appelée depuis updateDriverStatus quand le livreur envoie lat/lng.
 */
export async function recordDriverLocationThrottled(
  driverId: string,
  latitude: number,
  longitude: number
): Promise<void> {
  if (!isValidCoord(latitude, longitude)) {
    return;
  }

  const now = Date.now();
  const last = lastInsertByDriver.get(driverId) ?? 0;
  if (now - last < MIN_INTERVAL_MS) {
    return;
  }
  lastInsertByDriver.set(driverId, now);

  try {
    await (pool as any).query(
      `INSERT INTO public.driver_locations (driver_id, latitude, longitude)
       VALUES ($1, $2, $3)`,
      [driverId, latitude, longitude]
    );
  } catch (e: any) {
    const code = e?.code;
    const msg = e?.message || String(e);
    if (code === '42P01' || /driver_locations/i.test(msg)) {
      logger.debug(
        '[driver_locations] Table absente ou erreur schéma — exécuter migration 020:',
        msg
      );
      return;
    }
    logger.warn(
      `[driver_locations] Insert échoué pour ${maskUserId(driverId)}:`,
      msg
    );
  }
}
