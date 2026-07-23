import pool from '../config/db.js';
import { maskUserId } from '../utils/maskSensitiveData.js';
import logger from '../utils/logger.js';
import {
  connectedDrivers,
  DRIVER_DB_POSITION_MAX_AGE_MIN,
} from './orderSocketState.js';
import type { NearbyDriver, OrderCoordinates } from './orderSocketTypes.js';
import {
  getDistanceInKm,
  driverMatchesOrderEngin,
  orderRequiredEngin,
  enrichCandidateVehicleTypes,
} from './orderSocketUtils.js';

// ── enrichCandidateVehicleTypes is re-exported from utils ──────────────────────
export { enrichCandidateVehicleTypes };

// ── findNearbyDrivers ──────────────────────────────────────────────────────────
// Fonction pour trouver les chauffeurs proches disponibles
// Aucune restriction sur le nombre de commandes qu'un client peut envoyer au même driver
// Les clients peuvent envoyer un nombre illimité de commandes au même driver
//
// Sources fusionnées : (1) realDriverStatuses sur ce processus (2) driver_profiles en PostgreSQL
// pour résilience (redémarrage serveur, autre instance API vs instance Socket.IO sans adapter Redis).
export async function findNearbyDrivers(
  pickupCoords: OrderCoordinates,
  deliveryMethod: string,
  maxDistance: number = 10
): Promise<NearbyDriver[]> {
  const DEBUG = process.env.DEBUG_SOCKETS === 'true';
  const { realDriverStatuses } = await import('../controllers/driverController.js');

  type Candidate = NearbyDriver & {
    current_latitude: number;
    current_longitude: number;
    is_online: boolean;
    is_available: boolean;
  };

  const candidates = new Map<string, Candidate>();
  let memoryOnlineWithGps = 0;

  if (DEBUG) {
    logger.debug(`Recherche livreurs proches: ${realDriverStatuses.size} livreurs en mémoire`);
  }

  for (const [driverId, driverData] of realDriverStatuses.entries()) {
    if (!driverData.is_online || !driverData.is_available) {
      if (DEBUG) {
        logger.debug(
          `Livreur ${driverId.slice(0, 8)} ignoré: online=${driverData.is_online}, available=${driverData.is_available}`
        );
      }
      continue;
    }

    if (!driverData.current_latitude || !driverData.current_longitude) {
      if (DEBUG) {
        logger.debug(`Livreur ${driverId.slice(0, 8)} ignoré: pas de position GPS`);
      }
      continue;
    }

    memoryOnlineWithGps += 1;
    candidates.set(driverId, {
      driverId,
      distance: 0,
      ...driverData,
      current_latitude: Number(driverData.current_latitude),
      current_longitude: Number(driverData.current_longitude),
      is_online: true,
      is_available: true,
      vehicle_type: (driverData as { vehicle_type?: string }).vehicle_type,
    });
  }

  let dbMerged = 0;
  if (process.env.DATABASE_URL) {
    try {
      const { rows } = await pool.query<{
        user_id: string;
        current_latitude: string | number;
        current_longitude: string | number;
        updated_at: Date;
        vehicle_type: string | null;
      }>(
        `SELECT user_id, current_latitude, current_longitude, updated_at, vehicle_type
         FROM driver_profiles
         WHERE is_online = true
           AND is_available = true
           AND current_latitude IS NOT NULL
           AND current_longitude IS NOT NULL
           AND updated_at > NOW() - ($1::int * INTERVAL '1 minute')`,
        [DRIVER_DB_POSITION_MAX_AGE_MIN]
      );

      for (const row of rows) {
        if (candidates.has(row.user_id)) {
          continue;
        }
        const lat = Number(row.current_latitude);
        const lng = Number(row.current_longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
          continue;
        }
        dbMerged += 1;
        candidates.set(row.user_id, {
          driverId: row.user_id,
          distance: 0,
          user_id: row.user_id,
          is_online: true,
          is_available: true,
          current_latitude: lat,
          current_longitude: lng,
          updated_at: row.updated_at?.toISOString?.() ?? String(row.updated_at),
          vehicle_type: row.vehicle_type ?? undefined,
        });
      }
    } catch (dbErr: any) {
      logger.warn('[findNearbyDrivers] fusion driver_profiles ignorée:', dbErr?.message || dbErr);
    }
  }

  await enrichCandidateVehicleTypes(candidates as Map<string, Record<string, unknown>>);

  const nearbyDrivers: NearbyDriver[] = [];

  for (const [driverId, driverData] of candidates.entries()) {
    const distance = getDistanceInKm(
      pickupCoords.latitude,
      pickupCoords.longitude,
      driverData.current_latitude,
      driverData.current_longitude
    );

    if (distance <= maxDistance) {
      const vt = (driverData as { vehicle_type?: string }).vehicle_type;
      if (!driverMatchesOrderEngin(vt, deliveryMethod)) {
        if (DEBUG) {
          logger.debug(
            `Livreur ${driverId.slice(0, 8)} ignoré: engin ${vt ?? 'non renseigné'} ≠ commande ${orderRequiredEngin(deliveryMethod)}`
          );
        }
        continue;
      }
      if (DEBUG) {
        logger.debug(`Livreur ${driverId.slice(0, 8)} trouvé à ${distance.toFixed(2)}km`);
      }
      nearbyDrivers.push({
        ...driverData,
        driverId,
        distance,
      });
    } else if (DEBUG) {
      logger.debug(
        `Livreur ${driverId.slice(0, 8)} trop loin: ${distance.toFixed(2)}km (max: ${maxDistance}km)`
      );
    }
  }

  if (nearbyDrivers.length === 0) {
    logger.warn('[findNearbyDrivers] Aucun livreur dans le rayon', {
      maxDistanceKm: maxDistance,
      memoryMapSize: (await import('../controllers/driverController.js'))
        .realDriverStatuses.size,
      memoryOnlineWithGps,
      dbSupplementMerged: dbMerged,
      candidateCountBeforeRadius: candidates.size,
      connectedDriverSockets: connectedDrivers.size,
      deliveryMethod,
    });
  } else if (DEBUG) {
    logger.debug(
      `Total livreurs trouvés: ${nearbyDrivers.length} (db+mem fusion, +${dbMerged} depuis DB)`
    );
  }

  return nearbyDrivers.sort((a, b) => a.distance - b.distance);
}

// ── findAllAvailableDrivers ────────────────────────────────────────────────────
/**
 * Trouve tous les livreurs disponibles (pour les commandes B2B sans coordonnées GPS précises)
 */
export async function findAllAvailableDrivers(
  deliveryMethod: string,
  options: { b2bOnly?: boolean } = {}
): Promise<NearbyDriver[]> {
  const DEBUG = process.env.DEBUG_SOCKETS === 'true';
  // Import dynamique pour éviter les problèmes de dépendances circulaires
  const { realDriverStatuses } = await import('../controllers/driverController.js');
  const availableDrivers: NearbyDriver[] = [];

  if (DEBUG) {
    logger.debug(
      `[findAllAvailableDrivers] Recherche tous les livreurs disponibles: ${realDriverStatuses.size} livreurs en mémoire`
    );
  }

  // Vérifier aussi les livreurs connectés via socket
  const connectedDriversCount = connectedDrivers.size;
  if (DEBUG) {
    logger.debug(
      `[findAllAvailableDrivers] Livreurs connectés (socket): ${connectedDriversCount}`
    );
  }

  for (const [driverId, driverData] of realDriverStatuses.entries()) {
    if (!driverData.is_online || !driverData.is_available) {
      if (DEBUG) {
        logger.debug(
          `[findAllAvailableDrivers] Livreur ${maskUserId(driverId)} ignoré: online=${driverData.is_online}, available=${driverData.is_available}`
        );
      }
      continue;
    }

    // Vérifier si le livreur est connecté via socket
    const isConnected = connectedDrivers.has(driverId);
    if (!isConnected && DEBUG) {
      logger.debug(
        `[findAllAvailableDrivers] Livreur ${maskUserId(driverId)} disponible mais non connecté via socket`
      );
    }

    // Pour les commandes B2B, on accepte même les livreurs sans position GPS
    // car ils devront appeler le client pour obtenir la position exacte
    availableDrivers.push({
      driverId,
      distance: 0, // Distance inconnue pour les commandes B2B
      ...driverData,
    });
  }

  const seenIds = new Set(availableDrivers.map((d) => d.driverId));
  let dbMerged = 0;
  if (process.env.DATABASE_URL) {
    try {
      const { rows } = await pool.query<{ user_id: string }>(
        `SELECT user_id
         FROM driver_profiles
         WHERE is_online = true
           AND is_available = true
           AND updated_at > NOW() - ($1::int * INTERVAL '1 minute')`,
        [DRIVER_DB_POSITION_MAX_AGE_MIN]
      );
      for (const row of rows) {
        if (seenIds.has(row.user_id)) {
          continue;
        }
        seenIds.add(row.user_id);
        dbMerged += 1;
        availableDrivers.push({
          driverId: row.user_id,
          distance: 0,
          user_id: row.user_id,
          is_online: true,
          is_available: true,
        });
      }
    } catch (dbErr: any) {
      logger.warn(
        '[findAllAvailableDrivers] fusion driver_profiles ignorée:',
        dbErr?.message || dbErr
      );
    }
  }

  if (DEBUG) {
    logger.debug(
      `[findAllAvailableDrivers] Total livreurs disponibles: ${availableDrivers.length} (${
        availableDrivers.filter((d) => connectedDrivers.has(d.driverId)).length
      } connectés, +${dbMerged} DB)`
    );
  }

  const ids = [...new Set(availableDrivers.map((d) => d.driverId))];
  const vtMap = new Map<string, string>();
  const b2bOptInMap = new Map<string, boolean>();
  if (ids.length && process.env.DATABASE_URL) {
    try {
      const { rows } = await pool.query<{
        user_id: string;
        vehicle_type: string | null;
        accepts_b2b_orders?: boolean | null;
      }>(
        `SELECT user_id, vehicle_type, accepts_b2b_orders
           FROM driver_profiles
          WHERE user_id = ANY($1::uuid[])`,
        [ids]
      );
      for (const r of rows) {
        if (r.vehicle_type != null && String(r.vehicle_type).trim() !== '') {
          vtMap.set(r.user_id, r.vehicle_type);
        }
        b2bOptInMap.set(r.user_id, r.accepts_b2b_orders === true);
      }
    } catch (e: any) {
      logger.warn('[findAllAvailableDrivers] vehicle_type / accepts_b2b_orders:', e?.message);
    }
  }

  const filtered = availableDrivers.filter((d) => {
    let vt = (d as { vehicle_type?: string }).vehicle_type;
    if (vt == null || String(vt).trim() === '') vt = vtMap.get(d.driverId);
    if (!driverMatchesOrderEngin(vt, deliveryMethod)) return false;
    if (options.b2bOnly && b2bOptInMap.size > 0) {
      return b2bOptInMap.get(d.driverId) === true;
    }
    return true;
  });

  if (DEBUG && filtered.length < availableDrivers.length) {
    logger.debug(
      `[findAllAvailableDrivers] Filtrage engin: ${availableDrivers.length} → ${filtered.length} (commande=${orderRequiredEngin(deliveryMethod)})`
    );
  }

  return filtered.sort((a, b) => {
    const aConnected = connectedDrivers.has(a.driverId) ? 0 : 1;
    const bConnected = connectedDrivers.has(b.driverId) ? 0 : 1;
    if (aConnected !== bConnected) return aConnected - bConnected;
    return a.distance - b.distance;
  });
}

// ── prioritizePreferredDrivers ─────────────────────────────────────────────────
export function prioritizePreferredDrivers(
  drivers: NearbyDriver[],
  preferredDriverId?: string | null
): NearbyDriver[] {
  const preferred = preferredDriverId?.trim();
  if (!preferred) return drivers;
  return [...drivers].sort((a, b) => {
    const aPreferred = a.driverId === preferred ? 0 : 1;
    const bPreferred = b.driverId === preferred ? 0 : 1;
    if (aPreferred !== bPreferred) return aPreferred - bPreferred;
    return a.distance - b.distance;
  });
}
