import pool from '../config/db.js';
import { maskUserId } from '../utils/maskSensitiveData.js';
import logger from '../utils/logger.js';
import { realDriverStatuses } from '../controllers/driverController.js';
import {
  getIoInstance,
  connectedDrivers,
  declinedBatchOffers,
  lastBatchOfferReplayAt,
} from './orderSocketState.js';
import type { NearbyDriver, BatchSocketPayload } from './orderSocketTypes.js';
import { driverMatchesOrderEngin } from './orderSocketUtils.js';

export function emitBatchAssigned(driverId: string, payload: BatchSocketPayload): boolean {
  const io = getIoInstance();
  if (!io) return false;
  const socketId = connectedDrivers.get(driverId);
  if (!socketId) return false;
  io.to(socketId).emit('batch-assigned', payload);
  return true;
}

export function emitBatchOfferToDrivers(
  drivers: NearbyDriver[],
  payload: BatchSocketPayload
): number {
  const io = getIoInstance();
  if (!io) return 0;
  let emitted = 0;
  const seen = new Set<string>();
  for (const driver of drivers) {
    const driverId = driver.driverId;
    if (!driverId || seen.has(driverId)) continue;
    seen.add(driverId);
    const declinedDrivers = declinedBatchOffers.get(payload.batchId);
    if (declinedDrivers?.has(driverId)) continue;
    const socketId = connectedDrivers.get(driverId);
    if (!socketId) continue;
    io.to(socketId).emit('batch-assigned', { ...payload, status: 'offer' });
    emitted += 1;
  }
  return emitted;
}

export async function emitBatchOfferToAllConnectedDrivers(
  payload: BatchSocketPayload
): Promise<number> {
  const io = getIoInstance();
  if (!io) return 0;

  let emitted = 0;
  for (const [driverId, socketId] of connectedDrivers.entries()) {
    const declinedDrivers = declinedBatchOffers.get(payload.batchId);
    if (declinedDrivers?.has(driverId)) continue;
    if (!(await isDriverEligibleForBatchOffer(driverId))) continue;

    io.to(socketId).emit('batch-assigned', { ...payload, status: 'offer' });
    emitted += 1;
  }

  return emitted;
}

export async function isDriverEligibleForBatchOffer(driverId: string): Promise<boolean> {
  const memoryStatus = realDriverStatuses.get(driverId) as any;
  if (memoryStatus && (!memoryStatus.is_online || !memoryStatus.is_available)) {
    return false;
  }

  if (!process.env.DATABASE_URL) {
    return true;
  }

  try {
    const { rows } = await pool.query<{
      vehicle_type: string | null;
      is_online: boolean | null;
      is_available: boolean | null;
    }>(
      `SELECT vehicle_type, is_online, is_available
         FROM driver_profiles
        WHERE user_id = $1
        LIMIT 1`,
      [driverId]
    );
    const profile = rows[0];
    if (!profile) return true;
    if (profile.is_online === false || profile.is_available === false) return false;
    return driverMatchesOrderEngin(profile.vehicle_type, 'moto');
  } catch (err: any) {
    logger.warn('[batch-offer-replay] Vérification livreur ignorée:', err?.message || err);
    return true;
  }
}

export async function emitPendingBatchOffersToDriver(
  driverId: string,
  socketId: string,
  options: { throttleMs?: number } = {}
): Promise<number> {
  const io = getIoInstance();
  if (!io || !driverId || !socketId || !process.env.DATABASE_URL) return 0;

  const throttleMs = options.throttleMs ?? 5000;
  const now = Date.now();
  const last = lastBatchOfferReplayAt.get(driverId) ?? 0;
  if (throttleMs > 0 && now - last < throttleMs) return 0;
  lastBatchOfferReplayAt.set(driverId, now);

  if (!(await isDriverEligibleForBatchOffer(driverId))) return 0;

  try {
    const { rows } = await pool.query<{
      id: string;
      partner_id: string | null;
      orders_count: string;
    }>(
      `SELECT db.id,
              db.partner_id,
              COUNT(bo.order_id)::text AS orders_count
         FROM delivery_batches db
         JOIN batch_orders bo ON bo.batch_id = db.id
         JOIN orders o ON o.id = bo.order_id
        WHERE db.driver_id IS NULL
          AND COALESCE(db.status, 'pending') = 'pending'
          AND o.status = 'pending'
        GROUP BY db.id, db.partner_id, db.created_at
        ORDER BY db.created_at DESC
        LIMIT 10`
    );

    let emitted = 0;
    for (const row of rows) {
      if (declinedBatchOffers.get(row.id)?.has(driverId)) continue;
      io.to(socketId).emit('batch-assigned', {
        batchId: row.id,
        ordersCount: Number.parseInt(row.orders_count ?? '0', 10) || 0,
        ...(row.partner_id ? { partner_id: row.partner_id } : {}),
        status: 'offer',
      });
      emitted += 1;
    }

    if (emitted > 0) {
      logger.info('[batch-offer-replay] Tournées en attente rejouées au livreur', undefined, {
        driverId: maskUserId(driverId),
        count: emitted,
      });
    }

    return emitted;
  } catch (err: any) {
    logger.warn(
      '[batch-offer-replay] Relecture des tournées en attente impossible:',
      err?.message || err
    );
    return 0;
  }
}
