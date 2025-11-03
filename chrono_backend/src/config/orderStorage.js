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

  try {
    // Vérifier si la table order_assignments existe
    const tableCheck = await pool.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'order_assignments'
      )`
    );
    const hasOrderAssignments = tableCheck.rows[0]?.exists === true;
    
    if (!hasOrderAssignments) {
      // Table n'existe pas, ignorer silencieusement
      return;
    }

    // Vérifier si la colonne id existe
    const idColumnCheck = await pool.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'order_assignments'
         AND column_name = 'id'`
    );
    const hasIdColumn = idColumnCheck.rows.length > 0;

    const assigned = coerceDate(assignedAt) || new Date();
    const accepted = coerceDate(acceptedAt);
    const declined = coerceDate(declinedAt);

    // Construire la requête UPDATE avec ou sans RETURNING id
    const updateQuery = hasIdColumn
      ? `UPDATE order_assignments
           SET assigned_at = COALESCE($3, assigned_at),
               accepted_at = COALESCE($4, accepted_at),
               declined_at = COALESCE($5, declined_at)
         WHERE order_id = $1 AND driver_id = $2
         RETURNING id`
      : `UPDATE order_assignments
           SET assigned_at = COALESCE($3, assigned_at),
               accepted_at = COALESCE($4, accepted_at),
               declined_at = COALESCE($5, declined_at)
         WHERE order_id = $1 AND driver_id = $2`;

    const updateResult = await pool.query(updateQuery, [orderId, driverId, assigned, accepted, declined]);

    if (updateResult.rowCount === 0) {
      // Construire l'INSERT avec ou sans la colonne id
      if (hasIdColumn) {
        await pool.query(
          `INSERT INTO order_assignments (id, order_id, driver_id, assigned_at, accepted_at, declined_at)
           VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)` ,
          [orderId, driverId, assigned, accepted, declined]
        );
      } else {
        await pool.query(
          `INSERT INTO order_assignments (order_id, driver_id, assigned_at, accepted_at, declined_at)
           VALUES ($1, $2, $3, $4, $5)` ,
          [orderId, driverId, assigned, accepted, declined]
        );
      }
    }
  } catch (error) {
    // Ignorer les erreurs silencieusement (table ou colonnes manquantes)
    // La fonction recordOrderAssignment() gère déjà les erreurs
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
 * Détecte dynamiquement les colonnes disponibles pour compatibilité
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

    // Détecter les colonnes disponibles
    const columnsInfo = await pool.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'orders'
         AND column_name = ANY($1)`,
      [['pickup', 'pickup_address', 'dropoff', 'dropoff_address', 'driver_id', 'price', 'price_cfa', 'distance', 'distance_km', 'accepted_at', 'completed_at', 'cancelled_at', 'updated_at']]
    );

    const columnSet = new Set(columnsInfo.rows.map((row) => row.column_name));
    
    // Déterminer les noms de colonnes
    const pickupColumn = columnSet.has('pickup_address') ? 'pickup_address' : columnSet.has('pickup') ? 'pickup' : null;
    const dropoffColumn = columnSet.has('dropoff_address') ? 'dropoff_address' : columnSet.has('dropoff') ? 'dropoff' : null;
    const priceColumn = columnSet.has('price_cfa') ? 'price_cfa' : columnSet.has('price') ? 'price' : null;
    const distanceColumn = columnSet.has('distance_km') ? 'distance_km' : columnSet.has('distance') ? 'distance' : null;
    const hasDriverColumn = columnSet.has('driver_id');

    if (!pickupColumn || !dropoffColumn) {
      throw new Error('Colonnes pickup/dropoff non trouvées dans la table orders');
    }

    // Construire la requête dynamiquement
    const columns = ['id', 'user_id'];
    const values = [order.id, order.user?.id];
    const placeholders = ['$1', '$2'];
    let paramIndex = 3;

    // Ajouter driver_id seulement si la colonne existe
    if (hasDriverColumn && driverId) {
      columns.push('driver_id');
      values.push(driverId);
      placeholders.push(`$${paramIndex}`);
      paramIndex++;
    }

    // Colonnes pickup/dropoff (JSONB)
    columns.push(pickupColumn, dropoffColumn);
    values.push(JSON.stringify(order.pickup || null), JSON.stringify(order.dropoff || null));
    placeholders.push(`$${paramIndex}`, `$${paramIndex + 1}`);
    paramIndex += 2;

    // Colonnes méthode, prix, distance, ETA
    columns.push('delivery_method');
    values.push(order.deliveryMethod || order.method || null);
    placeholders.push(`$${paramIndex}`);
    paramIndex++;

    if (priceColumn) {
      columns.push(priceColumn);
      values.push(Number.isFinite(order.price) ? Math.round(order.price) : null);
      placeholders.push(`$${paramIndex}`);
      paramIndex++;
    }

    if (distanceColumn) {
      columns.push(distanceColumn);
      values.push(order.distance != null ? Number(order.distance) : null);
      placeholders.push(`$${paramIndex}`);
      paramIndex++;
    }

    // ETA minutes (peut être eta_minutes ou estimated_duration)
    const etaColumn = columnSet.has('eta_minutes') ? 'eta_minutes' : columnSet.has('estimated_duration') ? 'estimated_duration' : null;
    if (etaColumn) {
      columns.push(etaColumn);
      values.push(etaMinutes);
      placeholders.push(`$${paramIndex}`);
      paramIndex++;
    }

    // Colonnes statut et timestamps (vérifier l'existence)
    columns.push('status', 'created_at');
    values.push(order.status || 'pending', createdAt);
    placeholders.push(`$${paramIndex}`, `$${paramIndex + 1}`);
    paramIndex += 2;

    // Ajouter updated_at si la colonne existe
    if (columnSet.has('updated_at')) {
      columns.push('updated_at');
      values.push(updatedAt);
      placeholders.push(`$${paramIndex}`);
      paramIndex++;
    }

    // Ajouter accepted_at si la colonne existe
    if (columnSet.has('accepted_at') && acceptedAt) {
      columns.push('accepted_at');
      values.push(acceptedAt);
      placeholders.push(`$${paramIndex}`);
      paramIndex++;
    }

    // Ajouter completed_at si la colonne existe
    if (columnSet.has('completed_at') && completedAt) {
      columns.push('completed_at');
      values.push(completedAt);
      placeholders.push(`$${paramIndex}`);
      paramIndex++;
    }

    // Ajouter cancelled_at si la colonne existe
    if (columnSet.has('cancelled_at') && cancelledAt) {
      columns.push('cancelled_at');
      values.push(cancelledAt);
      placeholders.push(`$${paramIndex}`);
      paramIndex++;
    }

    // Construire la clause ON CONFLICT dynamiquement
    const updateClauses = [];
    if (hasDriverColumn && driverId) {
      updateClauses.push(`driver_id = EXCLUDED.driver_id`);
    }
    updateClauses.push(
      `${pickupColumn} = EXCLUDED.${pickupColumn}`,
      `${dropoffColumn} = EXCLUDED.${dropoffColumn}`,
      `delivery_method = EXCLUDED.delivery_method`
    );
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
    
    // Ajouter les colonnes de timestamps seulement si elles existent
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

    await pool.query(
      `INSERT INTO orders (${columns.join(', ')})
       VALUES (${placeholders.join(', ')})
       ON CONFLICT (id)
       DO UPDATE SET ${updateClauses.join(', ')}`,
      values
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
 * Détecte dynamiquement les colonnes disponibles pour compatibilité
 */
export async function updateOrderStatus(orderId, status, updates = {}) {
  try {
    // Détecter les colonnes disponibles
    const columnsInfo = await pool.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'orders'
         AND column_name = ANY($1)`,
      [['driver_id', 'accepted_at', 'completed_at', 'cancelled_at', 'updated_at']]
    );

    const columnSet = new Set(columnsInfo.rows.map((row) => row.column_name));
    const hasDriverColumn = columnSet.has('driver_id');
    const hasUpdatedAt = columnSet.has('updated_at');
    const hasAcceptedAt = columnSet.has('accepted_at');
    const hasCompletedAt = columnSet.has('completed_at');
    const hasCancelledAt = columnSet.has('cancelled_at');

    const setClauses = ['status = $2'];
    const values = [orderId, status];
    let paramIndex = 3;

    // Ajouter updated_at seulement si la colonne existe
    if (hasUpdatedAt) {
      setClauses.push('updated_at = now()');
    }

    const driverId = updates.driver_id || null;
    const acceptedAt = coerceDate(updates.accepted_at) || (status === 'accepted' ? new Date() : null);
    const completedAt = coerceDate(updates.completed_at) || (status === 'completed' ? new Date() : null);
    const cancelledAt = coerceDate(updates.cancelled_at) || (status === 'cancelled' ? new Date() : null);

    if (hasDriverColumn && driverId) {
      setClauses.push(`driver_id = $${paramIndex}`);
      values.push(driverId);
      paramIndex++;
      console.log(`✅ Mise à jour driver_id pour order ${orderId}: ${driverId}`);
    } else if (hasDriverColumn && !driverId) {
      console.log(`⚠️ hasDriverColumn=true mais driverId est null/undefined pour order ${orderId}`);
    } else if (!hasDriverColumn) {
      console.log(`⚠️ Colonne driver_id n'existe pas dans orders pour order ${orderId}`);
    }

    // Ajouter accepted_at seulement si la colonne existe ET si on a une valeur
    if (hasAcceptedAt && acceptedAt) {
      setClauses.push(`accepted_at = $${paramIndex}`);
      values.push(acceptedAt);
      paramIndex++;
    }

    // Ajouter completed_at seulement si la colonne existe ET si on a une valeur
    if (hasCompletedAt && completedAt) {
      setClauses.push(`completed_at = $${paramIndex}`);
      values.push(completedAt);
      paramIndex++;
    }

    // Ajouter cancelled_at seulement si la colonne existe ET si on a une valeur
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

