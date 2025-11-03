import pool from './db.js';

const DEFAULT_ASSIGNMENT_SOURCE = 'socket';

function coerceDate(value) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseDurationToMinutes(duration) {
  if (duration == null) return null;
  if (typeof duration === 'number' && Number.isFinite(duration)) {
    return Math.round(duration);
  }

  const lower = duration.toString().toLowerCase();
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

function parseJsonField(value) {
  if (!value) return null;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }
  return value;
}

function buildHistoryDetail(detail = {}) {
  const clean = {};
  Object.entries(detail).forEach(([key, val]) => {
    if (val === undefined) return;
    if (val instanceof Date) {
      clean[key] = val.toISOString();
      return;
    }
    if (typeof val === 'object' && val !== null) {
      clean[key] = buildHistoryDetail(val);
      return;
    }
    clean[key] = val;
  });
  return clean;
}

async function recordStatusHistory(orderId, status, detail = {}) {
  try {
    await pool.query(
      `INSERT INTO order_status_history (order_id, status, detail)
       VALUES ($1, $2, $3)`,
      [orderId, status, Object.keys(detail).length ? JSON.stringify(detail) : null]
    );
  } catch (error) {
    console.warn('⚠️ Impossible d\'enregistrer l\'historique du statut:', error.message);
  }
}

async function upsertOrderAssignment(orderId, driverId, { assignedAt, acceptedAt, declinedAt } = {}) {
  if (!orderId || !driverId) return;

  const assigned = coerceDate(assignedAt) || new Date();
  const accepted = coerceDate(acceptedAt);
  const declined = coerceDate(declinedAt);

  const updateResult = await pool.query(
    `UPDATE order_assignments
       SET assigned_at = COALESCE($3, assigned_at),
           accepted_at = COALESCE($4, accepted_at),
           declined_at = COALESCE($5, declined_at)
     WHERE order_id = $1 AND driver_id = $2
     RETURNING id`,
    [orderId, driverId, assigned, accepted, declined]
  );

  if (updateResult.rowCount === 0) {
    await pool.query(
      `INSERT INTO order_assignments (id, order_id, driver_id, assigned_at, accepted_at, declined_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)` ,
      [orderId, driverId, assigned, accepted, declined]
    );
  }
}

export async function recordOrderAssignment(orderId, driverId, timestamps = {}) {
  try {
    await upsertOrderAssignment(orderId, driverId, timestamps);
  } catch (error) {
    console.warn('⚠️ Impossible de persister l\'affectation commande:', error?.message || error);
  }
}

/**
 * Sauvegarde une commande dans PostgreSQL
 */
export async function saveOrder(order) {
  try {
    const now = new Date();
    const createdAt = coerceDate(order.createdAt) || now;
    const acceptedAt = coerceDate(order.acceptedAt);
    const completedAt = coerceDate(order.completedAt);
    const cancelledAt = coerceDate(order.cancelledAt);
    const updatedAt = coerceDate(order.updatedAt) || now;
    const driverId = order.driverId || order.driver?.id || null;
    const etaMinutes = parseDurationToMinutes(order.estimatedDuration);

    await pool.query(
      `INSERT INTO orders (
        id, user_id, driver_id,
        pickup_address, dropoff_address,
        delivery_method, price_cfa, distance_km, eta_minutes,
        status, created_at, updated_at, accepted_at, completed_at, cancelled_at
      ) VALUES (
        $1, $2, $3,
        $4, $5,
        $6, $7, $8, $9,
        $10, $11, $12, $13, $14, $15
      )
      ON CONFLICT (id)
      DO UPDATE SET
        driver_id = EXCLUDED.driver_id,
        pickup_address = EXCLUDED.pickup_address,
        dropoff_address = EXCLUDED.dropoff_address,
        delivery_method = EXCLUDED.delivery_method,
        price_cfa = EXCLUDED.price_cfa,
        distance_km = EXCLUDED.distance_km,
        eta_minutes = EXCLUDED.eta_minutes,
        status = EXCLUDED.status,
        accepted_at = EXCLUDED.accepted_at,
        completed_at = EXCLUDED.completed_at,
        cancelled_at = EXCLUDED.cancelled_at,
        updated_at = EXCLUDED.updated_at`,
      [
        order.id,
        order.user?.id,
        driverId,
        JSON.stringify(order.pickup || null),
        JSON.stringify(order.dropoff || null),
        order.deliveryMethod || order.method || null,
        Number.isFinite(order.price) ? Math.round(order.price) : null,
        order.distance != null ? Number(order.distance) : null,
        etaMinutes,
        order.status || 'pending',
        createdAt,
        updatedAt,
        acceptedAt,
        completedAt,
        cancelledAt
      ]
    );

    await recordStatusHistory(order.id, order.status || 'pending', buildHistoryDetail({
      source: DEFAULT_ASSIGNMENT_SOURCE,
      user: order.user ? { id: order.user.id, name: order.user.name } : undefined,
      delivery_method: order.deliveryMethod || order.method,
      price_cfa: Number.isFinite(order.price) ? Math.round(order.price) : undefined,
      distance_km: order.distance,
    }));

    return true;
  } catch (error) {
    console.error('❌ Erreur lors de la sauvegarde de la commande:', error);
    throw error;
  }
}

/**
 * Met à jour le statut d'une commande
 */
export async function updateOrderStatus(orderId, status, updates = {}) {
  try {
    const setClauses = ['status = $2', 'updated_at = now()'];
    const values = [orderId, status];
    let paramIndex = 3;

    const driverId = updates.driver_id || null;
    const acceptedAt = coerceDate(updates.accepted_at) || (status === 'accepted' ? new Date() : null);
    const completedAt = coerceDate(updates.completed_at) || (status === 'completed' ? new Date() : null);
    const cancelledAt = coerceDate(updates.cancelled_at) || (status === 'cancelled' ? new Date() : null);

    if (driverId) {
      setClauses.push(`driver_id = $${paramIndex}`);
      values.push(driverId);
      paramIndex++;
    }

    if (acceptedAt) {
      setClauses.push(`accepted_at = $${paramIndex}`);
      values.push(acceptedAt);
      paramIndex++;
    }

    if (completedAt) {
      setClauses.push(`completed_at = $${paramIndex}`);
      values.push(completedAt);
      paramIndex++;
    }

    if (cancelledAt) {
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

    await pool.query(
      `UPDATE orders SET ${setClauses.join(', ')} WHERE id = $1`,
      values
    );

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
  } catch (error) {
    console.error('❌ Erreur lors de la mise à jour de la commande:', error);
    throw error;
  }
}

/**
 * Récupère une commande par son ID
 */
export async function getOrderById(orderId) {
  try {
    const result = await pool.query(
      `SELECT * FROM orders WHERE id = $1`,
      [orderId]
    );

    if (result.rows.length === 0) {
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
      estimatedDuration: etaMinutes != null ? `${etaMinutes} min` : null,
      proof: null,
    };
  } catch (error) {
    console.error('❌ Erreur lors de la récupération de la commande:', error);
    throw error;
  }
}

/**
 * Récupère toutes les commandes actives d'un utilisateur
 */
export async function getActiveOrdersByUser(userId) {
  try {
    const result = await pool.query(
      `SELECT * FROM orders 
       WHERE user_id = $1 
       AND status IN ('pending', 'accepted', 'enroute', 'picked_up')
       ORDER BY created_at DESC`,
      [userId]
    );

    return result.rows.map((order) => {
      const etaMinutes = order.eta_minutes != null ? Number(order.eta_minutes) : null;
      return {
        ...order,
        pickup: parseJsonField(order.pickup_address),
        dropoff: parseJsonField(order.dropoff_address),
        price: order.price_cfa != null ? Number(order.price_cfa) : null,
        deliveryMethod: order.delivery_method,
        distance: order.distance_km != null ? Number(order.distance_km) : null,
        estimatedDuration: etaMinutes != null ? `${etaMinutes} min` : null,
      };
    });
  } catch (error) {
    console.error('❌ Erreur lors de la récupération des commandes actives:', error);
    throw error;
  }
}

/**
 * Récupère toutes les commandes actives d'un chauffeur
 */
export async function getActiveOrdersByDriver(driverId) {
  try {
    const result = await pool.query(
      `SELECT * FROM orders 
       WHERE driver_id = $1 
       AND status IN ('accepted', 'enroute', 'picked_up')
       ORDER BY accepted_at DESC`,
      [driverId]
    );

    return result.rows.map((order) => {
      const etaMinutes = order.eta_minutes != null ? Number(order.eta_minutes) : null;
      return {
        ...order,
        pickup: parseJsonField(order.pickup_address),
        dropoff: parseJsonField(order.dropoff_address),
        price: order.price_cfa != null ? Number(order.price_cfa) : null,
        deliveryMethod: order.delivery_method,
        distance: order.distance_km != null ? Number(order.distance_km) : null,
        estimatedDuration: etaMinutes != null ? `${etaMinutes} min` : null,
      };
    });
  } catch (error) {
    console.error('❌ Erreur lors de la récupération des commandes du chauffeur:', error);
    throw error;
  }
}

/**
 * Marque une commande comme terminée et la supprime du cache actif après un délai
 */
export async function completeOrder(orderId) {
  try {
    await updateOrderStatus(orderId, 'completed', {
      completed_at: new Date()
    });
    
    // La commande reste en DB pour l'historique, mais est supprimée du cache actif
    return true;
  } catch (error) {
    console.error('❌ Erreur lors de la finalisation de la commande:', error);
    throw error;
  }
}

export async function saveDeliveryProofRecord({
  orderId,
  driverId,
  proofType,
  fileUrl,
  otpCode,
  notes,
  metadata,
}) {
  try {
    await pool.query(
      `INSERT INTO delivery_proofs (id, order_id, driver_id, proof_type, file_url, otp_code, notes, metadata)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7)` ,
      [
        orderId,
        driverId,
        proofType,
        fileUrl || null,
        otpCode || null,
        notes || null,
        metadata ? JSON.stringify(metadata) : null,
      ]
    );
  } catch (error) {
    console.error('❌ Erreur lors de l\'enregistrement de la preuve de livraison:', error);
    throw error;
  }
}

