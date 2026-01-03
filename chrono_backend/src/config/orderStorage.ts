import pool from './db.js';
import { maskOrderId, maskUserId } from '../utils/maskSensitiveData.js';
import logger from '../utils/logger.js'; const DEFAULT_ASSIGNMENT_SOURCE = 'socket'; interface Order { id: string; user?: {
    id: string;
    name?: string;
    avatar?: string;
    rating?: number;
    phone?: string;
  };
  driver?: {
    id: string;
  };
  driverId?: string;
  pickup?: any;
  dropoff?: any;
  recipient?: any;
  packageImages?: string[];
  price?: number;
  deliveryMethod?: string;
  method?: string;
  distance?: number;
  estimatedDuration?: string | number;
  status?: string;
  createdAt?: Date | string;
  acceptedAt?: Date | string;
  completedAt?: Date | string;
  cancelledAt?: Date | string;
  updatedAt?: Date | string;
  assignedAt?: Date | string;
}

interface OrderUpdates {
  driver_id?: string;
  accepted_at?: Date | string;
  completed_at?: Date | string;
  cancelled_at?: Date | string;
  assigned_at?: Date | string;
  declined_at?: Date | string;
  price_cfa?: number;
  distance_km?: number;
  eta_minutes?: number;
  [key: string]: any;
}

interface OrderAssignmentTimestamps {
  assignedAt?: Date | string;
  acceptedAt?: Date | string;
  declinedAt?: Date | string;
}

interface DeliveryProofRecord {
  orderId: string;
  driverId: string;
  proofType: string;
  fileUrl?: string;
  otpCode?: string;
  notes?: string;
  metadata?: any;
}

function coerceDate(value: any): Date | null {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseDurationToMinutes(duration: any): number | null {
  if (duration == null) return null;
if (typeof duration === 'number' && Number.isFinite(duration)) { return Math.round(duration); } const lower = duration.toString().toLowerCase();
  let minutes = 0;

  const hoursMatch = lower.match(/(\d+)\s*h/);
  if (hoursMatch) {
    minutes += parseInt(hoursMatch[1], 10) * 60;
  }

  const minutesMatch = lower.match(/(\d+)\s*min/);
  if (minutesMatch) {
    minutes += parseInt(minutesMatch[1], 10);
  }

  if (minutes === 0) {
    const numeric = parseFloat(lower);
    if (!Number.isNaN(numeric)) {
      return Math.round(numeric);
    }
    return null;
  }

  return minutes;
}

function parseJsonField(value: any): any {
  if (!value) return null;
if (typeof value === 'string') { try { return JSON.parse(value); } catch {
      return null;
    }
  }
  return value;
}

function buildHistoryDetail(detail: any = {}): Record<string, any> {
  const clean: Record<string, any> = {};
  Object.entries(detail).forEach(([key, val]) => {
    if (val === undefined) return;
    if (val instanceof Date) {
      clean[key] = val.toISOString();
      return;
    }
  if (typeof val === 'object' && val !== null) { clean[key] = buildHistoryDetail(val); return; }
    clean[key] = val;
  });
  return clean;
}

async function recordStatusHistory(orderId: string, status: string, detail: any = {}): Promise<void> {
  try {
    await (pool as any).query(
      `INSERT INTO order_status_history (order_id, status, detail) VALUES ($1, $2, $3)`, [orderId, status, Object.keys(detail).length ? JSON.stringify(detail) : null] );
  } catch (error: any) {
  logger.warn('Impossible d\'enregistrer l\'historique du statut:', error.message); }
} async function upsertOrderAssignment( orderId: string,
  driverId: string,
  timestamps: OrderAssignmentTimestamps = {}
): Promise<void> {
  if (!orderId || !driverId) return;

  try {
  
    const tableCheck = await (pool as any).query(
      `SELECT EXISTS ( SELECT FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'order_assignments' )` ); const hasOrderAssignments = tableCheck.rows[0]?.exists === true; if (!hasOrderAssignments) { return;
    }

    const idColumnCheck = await (pool as any).query(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'order_assignments' AND column_name = 'id'` ); const hasIdColumn = idColumnCheck.rows.length > 0; const assigned = coerceDate(timestamps.assignedAt) || new Date(); const accepted = coerceDate(timestamps.acceptedAt); const declined = coerceDate(timestamps.declinedAt);

    const updateQuery = hasIdColumn
      ? `UPDATE order_assignments SET assigned_at = COALESCE($3, assigned_at),
              accepted_at = COALESCE($4, accepted_at),
              declined_at = COALESCE($5, declined_at)
        WHERE order_id = $1 AND driver_id = $2
      RETURNING id` : `UPDATE order_assignments SET assigned_at = COALESCE($3, assigned_at), accepted_at = COALESCE($4, accepted_at),
              declined_at = COALESCE($5, declined_at)
      WHERE order_id = $1 AND driver_id = $2`; const updateResult = await (pool as any).query(updateQuery, [orderId, driverId, assigned, accepted, declined]);

    if (updateResult.rowCount === 0) {
      if (hasIdColumn) {
        await (pool as any).query(
          `INSERT INTO order_assignments (id, order_id, driver_id, assigned_at, accepted_at, declined_at) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)`, [orderId, driverId, assigned, accepted, declined] );
      } else {
        await (pool as any).query(
          `INSERT INTO order_assignments (order_id, driver_id, assigned_at, accepted_at, declined_at) VALUES ($1, $2, $3, $4, $5)`, [orderId, driverId, assigned, accepted, declined] );
      }
    }
  } catch (error) {
  }
}

export async function recordOrderAssignment(
  orderId: string,
  driverId: string,
  timestamps: OrderAssignmentTimestamps = {}
): Promise<void> {
  try {
    await upsertOrderAssignment(orderId, driverId, timestamps);
  } catch (error: any) {
  logger.warn('Impossible de persister l\'affectation commande:', error?.message || error); }
}

export async function saveOrder(order: Order): Promise<boolean> {
  try {
    const now = new Date();
    const createdAt = coerceDate(order.createdAt) || now;
    const acceptedAt = coerceDate(order.acceptedAt);
    const completedAt = coerceDate(order.completedAt);
    const cancelledAt = coerceDate(order.cancelledAt);
    const updatedAt = coerceDate(order.updatedAt) || now;
    const driverId = order.driverId || order.driver?.id || null;
    const etaMinutes = parseDurationToMinutes(order.estimatedDuration);

    const columnsInfo = await (pool as any).query(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = ANY($1)`,
      [['pickup', 'pickup_address', 'dropoff', 'dropoff_address', 'driver_id', 'price', 'price_cfa', 'distance', 'distance_km', 'accepted_at', 'completed_at', 'cancelled_at', 'updated_at', 'recipient', 'package_images', 'payment_method_id', 'payment_method_type', 'payment_status', 'payment_payer', 'client_paid_amount', 'recipient_user_id', 'recipient_is_registered', 'recipient_paid_amount', 'recipient_payment_status', 'recipient_payment_method_type']]
    );
    
    const columnSet = new Set(columnsInfo.rows.map((row: any) => row.column_name));
    const pickupColumn = columnSet.has('pickup_address') ? 'pickup_address' : columnSet.has('pickup') ? 'pickup' : null;
    const dropoffColumn = columnSet.has('dropoff_address') ? 'dropoff_address' : columnSet.has('dropoff') ? 'dropoff' : null;
    const priceColumn = columnSet.has('price_cfa') ? 'price_cfa' : columnSet.has('price') ? 'price' : null;
    const distanceColumn = columnSet.has('distance_km') ? 'distance_km' : columnSet.has('distance') ? 'distance' : null;
    const hasDriverColumn = columnSet.has('driver_id');
    
    if (!pickupColumn || !dropoffColumn) {
      throw new Error('Colonnes pickup/dropoff non trouvées dans la table orders');
    }
    
    const columns: string[] = ['id', 'user_id'];
    const values: any[] = [order.id, order.user?.id];
    const placeholders: string[] = ['$1', '$2'];
    let paramIndex = 3;
    
    if (hasDriverColumn && driverId) {
      columns.push('driver_id');
      values.push(driverId);
      placeholders.push(`$${paramIndex}`);
      paramIndex++;
    }
    
    columns.push(pickupColumn, dropoffColumn);
    values.push(JSON.stringify(order.pickup || null), JSON.stringify(order.dropoff || null));
    placeholders.push(`$${paramIndex}`, `$${paramIndex + 1}`);
    paramIndex += 2;
    
    if (columnSet.has('recipient')) {
      columns.push('recipient');
      values.push(order.recipient ? JSON.stringify(order.recipient) : null);
      placeholders.push(`$${paramIndex}`);
      paramIndex++;
    }
    
    if (columnSet.has('package_images')) {
      columns.push('package_images');
      const packageImages = order.packageImages || (order.dropoff as any)?.details?.photos || [];
      values.push(packageImages.length > 0 ? packageImages : null);
      placeholders.push(`$${paramIndex}`);
      paramIndex++;
    }
    
    columns.push('delivery_method');
    values.push(order.deliveryMethod || order.method || null);
    placeholders.push(`$${paramIndex}`);
    paramIndex++;
    
    if (priceColumn) {
      columns.push(priceColumn);
      values.push(Number.isFinite(order.price) ? Math.round(order.price!) : null);
      placeholders.push(`$${paramIndex}`);
      paramIndex++;
    }
    
    if (distanceColumn) {
      columns.push(distanceColumn);
      values.push(order.distance != null ? Number(order.distance) : null);
      placeholders.push(`$${paramIndex}`);
      paramIndex++;
    }
    
    const etaColumn = columnSet.has('eta_minutes') ? 'eta_minutes' : columnSet.has('estimated_duration') ? 'estimated_duration' : null;
    if (etaColumn) {
      columns.push(etaColumn);
      values.push(etaMinutes);
      placeholders.push(`$${paramIndex}`);
      paramIndex++;
    }
    
    columns.push('status', 'created_at');
    values.push(order.status || 'pending', createdAt);
    placeholders.push(`$${paramIndex}`, `$${paramIndex + 1}`);
    paramIndex += 2;
    
    // Ajouter les colonnes de paiement si elles existent (toujours sauvegarder, même si null)
    if (columnSet.has('payment_method_id')) {
      columns.push('payment_method_id');
      values.push((order as any).payment_method_id || null);
      placeholders.push(`$${paramIndex}`);
      paramIndex++;
    }
    
    if (columnSet.has('payment_method_type')) {
      columns.push('payment_method_type');
      values.push((order as any).payment_method_type || null);
      placeholders.push(`$${paramIndex}`);
      paramIndex++;
    }
    
    if (columnSet.has('payment_status')) {
      columns.push('payment_status');
      values.push((order as any).payment_status || 'pending');
      placeholders.push(`$${paramIndex}`);
      paramIndex++;
    }
    
    if (columnSet.has('payment_payer')) {
      columns.push('payment_payer');
      values.push((order as any).payment_payer || 'client');
      placeholders.push(`$${paramIndex}`);
      paramIndex++;
    }
    
    // Sauvegarder le montant payé partiellement par le client (toujours sauvegarder, même si 0)
    if (columnSet.has('client_paid_amount')) {
      const clientPaidAmount = (order as any).partial_amount || (order as any).client_paid_amount || 0;
      columns.push('client_paid_amount');
      values.push(clientPaidAmount);
      placeholders.push(`$${paramIndex}`);
      paramIndex++;
    }
    
    if (columnSet.has('recipient_user_id')) {
      columns.push('recipient_user_id');
      values.push((order as any).recipient_user_id || null);
      placeholders.push(`$${paramIndex}`);
      paramIndex++;
    }
    
    if (columnSet.has('recipient_is_registered')) {
      columns.push('recipient_is_registered');
      values.push((order as any).recipient_is_registered !== undefined ? (order as any).recipient_is_registered : false);
      placeholders.push(`$${paramIndex}`);
      paramIndex++;
    }
    
    if (columnSet.has('updated_at')) {
      columns.push('updated_at');
      values.push(updatedAt);
      placeholders.push(`$${paramIndex}`);
      paramIndex++;
    }
    
    if (columnSet.has('accepted_at') && acceptedAt) {
      columns.push('accepted_at');
      values.push(acceptedAt);
      placeholders.push(`$${paramIndex}`);
      paramIndex++;
    }
    
    if (columnSet.has('completed_at') && completedAt) {
      columns.push('completed_at');
      values.push(completedAt);
      placeholders.push(`$${paramIndex}`);
      paramIndex++;
    }
    
    if (columnSet.has('cancelled_at') && cancelledAt) {
      columns.push('cancelled_at');
      values.push(cancelledAt);
      placeholders.push(`$${paramIndex}`);
      paramIndex++;
    }
    
    const updateClauses: string[] = [];
    if (hasDriverColumn && driverId) {
      updateClauses.push(`driver_id = EXCLUDED.driver_id`);
    }
    updateClauses.push(
      `${pickupColumn} = EXCLUDED.${pickupColumn}`,
      `${dropoffColumn} = EXCLUDED.${dropoffColumn}`,
      `delivery_method = EXCLUDED.delivery_method`
    );
    
    if (columnSet.has('recipient')) {
      updateClauses.push(`recipient = EXCLUDED.recipient`);
    }
    
    if (columnSet.has('package_images')) {
      updateClauses.push(`package_images = EXCLUDED.package_images`);
    }
    
    if (priceColumn) {
      updateClauses.push(`${priceColumn} = EXCLUDED.${priceColumn}`);
    }
    
    if (distanceColumn) {
      updateClauses.push(`${distanceColumn} = EXCLUDED.${distanceColumn}`);
    }
    
    if (etaColumn) {
      updateClauses.push(`${etaColumn} = EXCLUDED.${etaColumn}`);
    }
    
    updateClauses.push(`status = EXCLUDED.status`);
    
    // Mettre à jour les colonnes de paiement si elles existent
    if (columnSet.has('payment_method_id')) {
      updateClauses.push(`payment_method_id = EXCLUDED.payment_method_id`);
    }
    
    if (columnSet.has('payment_method_type')) {
      updateClauses.push(`payment_method_type = EXCLUDED.payment_method_type`);
    }
    
    if (columnSet.has('payment_status')) {
      updateClauses.push(`payment_status = EXCLUDED.payment_status`);
    }
    
    if (columnSet.has('payment_payer')) {
      updateClauses.push(`payment_payer = EXCLUDED.payment_payer`);
    }
    
    if (columnSet.has('client_paid_amount')) {
      updateClauses.push(`client_paid_amount = EXCLUDED.client_paid_amount`);
    }
    
    if (columnSet.has('recipient_user_id')) {
      updateClauses.push(`recipient_user_id = EXCLUDED.recipient_user_id`);
    }
    
    if (columnSet.has('recipient_is_registered')) {
      updateClauses.push(`recipient_is_registered = EXCLUDED.recipient_is_registered`);
    }
    
    if (columnSet.has('recipient_paid_amount')) {
      updateClauses.push(`recipient_paid_amount = EXCLUDED.recipient_paid_amount`);
    }
    
    if (columnSet.has('recipient_payment_status')) {
      updateClauses.push(`recipient_payment_status = EXCLUDED.recipient_payment_status`);
    }
    
    if (columnSet.has('recipient_payment_method_type')) {
      updateClauses.push(`recipient_payment_method_type = EXCLUDED.recipient_payment_method_type`);
    }
    
    if (columnSet.has('updated_at')) {
      updateClauses.push(`updated_at = EXCLUDED.updated_at`);
    }
    
    if (columnSet.has('accepted_at')) {
      updateClauses.push(`accepted_at = EXCLUDED.accepted_at`);
    }
    
    if (columnSet.has('completed_at')) {
      updateClauses.push(`completed_at = EXCLUDED.completed_at`);
    }
    
    if (columnSet.has('cancelled_at')) {
      updateClauses.push(`cancelled_at = EXCLUDED.cancelled_at`);
    }
    
    await (pool as any).query(
      `INSERT INTO orders (${columns.join(', ')}) VALUES (${placeholders.join(', ')}) ON CONFLICT (id) DO UPDATE SET ${updateClauses.join(', ')}`,
      values
    );
    
    await recordStatusHistory(order.id, order.status || 'pending', buildHistoryDetail({
      source: DEFAULT_ASSIGNMENT_SOURCE,
      user: order.user ? { id: order.user.id, name: order.user.name } : undefined,
      delivery_method: order.deliveryMethod || order.method,
      price_cfa: Number.isFinite(order.price) ? Math.round(order.price!) : undefined,
      distance_km: order.distance,
    }));

    return true;
  } catch (error: any) {
    logger.error('Erreur lors de la sauvegarde de la commande:', error);
    throw error;
  }
}

export async function updateOrderStatus(
  orderId: string,
  status: string,
  updates: OrderUpdates = {}
): Promise<boolean> {
  // Mapper "delivering" vers "picked_up" car "delivering" n'existe pas dans l'enum PostgreSQL
  // "delivering" est un statut intermédiaire utilisé côté application mais pas dans la DB
  const dbStatus = status === 'delivering' ? 'picked_up' : status;
  try {
    const columnsInfo = await (pool as any).query(
      `SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = ANY($1)`,
      [['driver_id', 'accepted_at', 'completed_at', 'cancelled_at', 'updated_at']]
    );
    
    const columnSet = new Set(columnsInfo.rows.map((row: any) => row.column_name));
    const hasDriverColumn = columnSet.has('driver_id');
    const hasUpdatedAt = columnSet.has('updated_at');
    const hasAcceptedAt = columnSet.has('accepted_at');
    const hasCompletedAt = columnSet.has('completed_at');
    const hasCancelledAt = columnSet.has('cancelled_at');
    
    const setClauses: string[] = ['status = $2'];
    const values: any[] = [orderId, dbStatus]; // Utiliser dbStatus (mappé) au lieu de status (original)
    let paramIndex = 3;
    
    if (hasUpdatedAt) {
      setClauses.push('updated_at = now()');
    }
    
    let driverId = updates.driver_id || null;
    
    // Si driver_id n'est pas fourni mais que la colonne existe, essayer de le récupérer depuis order_assignments
    if (hasDriverColumn && !driverId && dbStatus === 'completed') {
      try {
        const existingOrderQuery = await (pool as any).query(
          `SELECT driver_id FROM orders WHERE id = $1`,
          [orderId]
        );
        if (existingOrderQuery.rows.length > 0 && existingOrderQuery.rows[0].driver_id) {
          driverId = existingOrderQuery.rows[0].driver_id;
          logger.debug(`driver_id récupéré depuis orders pour order ${maskOrderId(orderId)}: ${maskUserId(driverId)}`);
        } else {
          // Essayer de récupérer depuis order_assignments
          const assignmentQuery = await (pool as any).query(
            `SELECT driver_id FROM order_assignments 
            WHERE order_id = $1 AND accepted_at IS NOT NULL 
            ORDER BY accepted_at DESC LIMIT 1`,
            [orderId]
          );
          if (assignmentQuery.rows.length > 0 && assignmentQuery.rows[0].driver_id) {
            driverId = assignmentQuery.rows[0].driver_id;
            logger.debug(`driver_id récupéré depuis order_assignments pour order ${maskOrderId(orderId)}: ${maskUserId(driverId)}`);
          }
        }
      } catch (err: any) {
        logger.warn(`Erreur récupération driver_id pour order ${maskOrderId(orderId)}:`, err.message);
      }
    }
    
    const acceptedAt = coerceDate(updates.accepted_at) || (dbStatus === 'accepted' ? new Date() : undefined);
    const completedAt = coerceDate(updates.completed_at) || (dbStatus === 'completed' ? new Date() : undefined);
    const cancelledAt = coerceDate(updates.cancelled_at) || (dbStatus === 'cancelled' ? new Date() : undefined);
    
    if (hasDriverColumn && driverId) {
      setClauses.push(`driver_id = $${paramIndex}`);
      values.push(driverId);
      paramIndex++;
      logger.info(`Mise à jour driver_id pour order ${maskOrderId(orderId)}: ${maskUserId(driverId)}`);
    } else if (hasDriverColumn && !driverId && status === 'completed') {
      // Si on complète une commande sans driver_id, c'est un problème
      logger.warn(`hasDriverColumn=true mais driverId est null/undefined pour order ${maskOrderId(orderId)} en statut completed`);
    } else if (!hasDriverColumn) {
      logger.warn(`Colonne driver_id n'existe pas dans orders pour order ${maskOrderId(orderId)}`);
    }
    
    if (hasAcceptedAt && acceptedAt) {
      setClauses.push(`accepted_at = $${paramIndex}`);
      values.push(acceptedAt);
      paramIndex++;
    }
    
    if (hasCompletedAt && completedAt) {
      setClauses.push(`completed_at = $${paramIndex}`);
      values.push(completedAt);
      paramIndex++;
    }
    
    if (hasCancelledAt && cancelledAt) {
      setClauses.push(`cancelled_at = $${paramIndex}`);
      values.push(cancelledAt);
      paramIndex++;
    }

    if (updates.price_cfa != null) {
      setClauses.push(`price_cfa = $${paramIndex}`);
      values.push(Math.round(updates.price_cfa));
      paramIndex++;
    }

    if (updates.distance_km != null) {
      setClauses.push(`distance_km = $${paramIndex}`);
      values.push(Number(updates.distance_km));
      paramIndex++;
    }

    if (updates.eta_minutes != null) {
      setClauses.push(`eta_minutes = $${paramIndex}`);
      values.push(Math.round(updates.eta_minutes));
      paramIndex++;
    }

    const updateResult = await (pool as any).query(
      `UPDATE orders SET ${setClauses.join(', ')} WHERE id = $1`,
      values
    );
    
    // Vérifier que la mise à jour a bien été appliquée
    if (updateResult.rowCount === 0) {
      logger.warn(
        `[updateOrderStatus] Aucune ligne mise à jour pour commande ${orderId} avec statut ${dbStatus}`,
        undefined,
        { orderId, status, dbStatus, setClauses, values: values.map((v, i) => i === 0 ? maskOrderId(v) : (i === 1 ? v : '***')) }
      );
    } else {
      // Vérifier le statut réel dans la DB après la mise à jour
      try {
        const verifyResult = await (pool as any).query(
          'SELECT status FROM orders WHERE id = $1',
          [orderId]
        );
        if (verifyResult.rows.length > 0) {
          const actualStatus = verifyResult.rows[0].status;
          if (actualStatus !== dbStatus) {
            logger.error(
              `[updateOrderStatus] Incohérence de statut après UPDATE pour commande ${orderId}: attendu=${dbStatus}, réel=${actualStatus}`,
              undefined,
              { orderId, expectedStatus: dbStatus, actualStatus, status }
            );
          } else {
            logger.debug(
              `[updateOrderStatus] Statut vérifié dans DB pour commande ${orderId}: ${actualStatus}`,
              undefined,
              { orderId, status: actualStatus }
            );
          }
        }
      } catch (verifyError: any) {
        logger.warn(
          `[updateOrderStatus] Erreur vérification statut après UPDATE pour commande ${orderId}:`,
          verifyError
        );
      }
    }
    
    const historyDetail = buildHistoryDetail({
      ...updates,
      accepted_at: acceptedAt,
      completed_at: completedAt,
      cancelled_at: cancelledAt,
      driver_id: driverId || undefined,
    });

    await recordStatusHistory(orderId, status, historyDetail);

    if (driverId) {
      await upsertOrderAssignment(orderId, driverId, {
        assignedAt: updates.assigned_at,
        acceptedAt,
        declinedAt: status === 'declined' ? new Date() : updates.declined_at,
      });
    }
    
    return true;
  } catch (error: any) {
    logger.error('Erreur lors de la mise à jour de la commande:', error);
    throw error;
  }
}

export async function getOrderById(orderId: string): Promise<any | null> {
  try {
    const result = await (pool as any).query(
     `SELECT * FROM orders WHERE id = $1`, [orderId] ); if (!result.rows || result.rows.length === 0) {
      return null;
    }

    const order = result.rows[0];
    const pickup = parseJsonField(order.pickup_address);
    const dropoff = parseJsonField(order.dropoff_address);
    const etaMinutes = order.eta_minutes != null ? Number(order.eta_minutes) : null;

    return {
      ...order,
      pickup,
      dropoff,
      price: order.price_cfa != null ? Number(order.price_cfa) : null,
      deliveryMethod: order.delivery_method,
      distance: order.distance_km != null ? Number(order.distance_km) : null,
    estimatedDuration: etaMinutes != null ? `${etaMinutes} min` : null, proof: null, }; } catch (error: any) {
  logger.error('Erreur lors de la récupération de la commande:', error); throw error; }
} export async function getActiveOrdersByUser(userId: string): Promise<any[]> {
  try {
    const result = await (pool as any).query(
     `SELECT * FROM orders 
      WHERE user_id = $1 
    AND status IN ('pending', 'accepted', 'enroute', 'picked_up') 
    AND status NOT IN ('completed', 'cancelled', 'declined')
    ORDER BY created_at DESC`, [userId] ); return (result.rows || []).map((order: any) => { const etaMinutes = order.eta_minutes != null ? Number(order.eta_minutes) : null; return {
        ...order,
        pickup: parseJsonField(order.pickup_address),
        dropoff: parseJsonField(order.dropoff_address),
        price: order.price_cfa != null ? Number(order.price_cfa) : null,
        deliveryMethod: order.delivery_method,
        distance: order.distance_km != null ? Number(order.distance_km) : null,
      estimatedDuration: etaMinutes != null ? `${etaMinutes} min` : null, }; }); } catch (error: any) {
  logger.error('Erreur lors de la récupération des commandes actives:', error); throw error; }
} export async function getActiveOrdersByDriver(driverId: string): Promise<any[]> {
  try {
    const result = await (pool as any).query(
     `SELECT * FROM orders 
      WHERE driver_id = $1 
    AND status IN ('accepted', 'enroute', 'picked_up') 
    AND status NOT IN ('completed', 'cancelled', 'declined')
    ORDER BY created_at DESC`, [driverId] ); return (result.rows || []).map((order: any) => { const etaMinutes = order.eta_minutes != null ? Number(order.eta_minutes) : null; return {
        ...order,
        pickup: parseJsonField(order.pickup_address),
        dropoff: parseJsonField(order.dropoff_address),
        price: order.price_cfa != null ? Number(order.price_cfa) : null,
        deliveryMethod: order.delivery_method,
        distance: order.distance_km != null ? Number(order.distance_km) : null,
      estimatedDuration: etaMinutes != null ? `${etaMinutes} min` : null, }; }); } catch (error: any) {
  logger.error('Erreur lors de la récupération des commandes du chauffeur:', error); throw error; }
} export async function completeOrder(orderId: string): Promise<boolean> {
  try {
  await updateOrderStatus(orderId, 'completed', { completed_at: new Date() }); return true;
  } catch (error: any) {
  logger.error('Erreur lors de la finalisation de la commande:', error); throw error; }
} export async function saveDeliveryProofRecord(record: DeliveryProofRecord): Promise<void> {
  try {
    await (pool as any).query(
    `INSERT INTO delivery_proofs (id, order_id, driver_id, proof_type, file_url, otp_code, notes, metadata)
      VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7)`,
      [
        record.orderId,
        record.driverId,
        record.proofType,
        record.fileUrl || null,
        record.otpCode || null,
        record.notes || null,
        record.metadata ? JSON.stringify(record.metadata) : null,
      ]
    );
  } catch (error: any) {
  logger.error('Erreur lors de l\'enregistrement de la preuve de livraison:', error);
    throw error;
  }
}

