import { Request, Response } from 'express';
import { supabase, supabaseAdmin } from '../config/supabase.js';
import { optimizeRouteOrder } from '../utils/haversine.js';
import { emitBatchAssigned, findAllAvailableDrivers } from '../sockets/orderSocket.js';
import logger from '../utils/logger.js';

const db = () => supabaseAdmin ?? supabase;

// ─── POST /api/batches — créer une tournée ────────────────────────────────────
// Body: { partner_id?, user_id, driver_id?, orders: [{ order_id, lat?, lng? }] }
export const createBatch = async (req: Request, res: Response): Promise<void> => {
  const { partner_id, user_id, driver_id, orders } = req.body as {
    partner_id?: string;
    user_id?: string;
    driver_id?: string;
    orders: Array<{ order_id: string; lat?: number; lng?: number }>;
  };

  if (!orders?.length) {
    res.status(400).json({ success: false, message: 'Le tableau orders est requis et non vide' });
    return;
  }
  if (!partner_id && !user_id) {
    res.status(400).json({ success: false, message: 'partner_id ou user_id est requis' });
    return;
  }

  let assignedDriverId = driver_id || null;
  if (!assignedDriverId) {
    const availableDrivers = await findAllAvailableDrivers('moto');
    assignedDriverId = availableDrivers[0]?.driverId ?? null;
  }

  // Optimiser l'ordre si les coordonnées sont fournies
  let optimizedOrder: number[];
  const hasCoords = orders.every((o) => o.lat !== undefined && o.lng !== undefined);

  if (hasCoords) {
    const points = orders.map((o, i) => ({ lat: o.lat!, lng: o.lng!, originalIndex: i }));
    optimizedOrder = optimizeRouteOrder(points);
  } else {
    optimizedOrder = orders.map((_, i) => i);
  }

  // Créer la delivery_batch
  const { data: batch, error: batchErr } = await db()
    .from('delivery_batches')
    .insert({
      partner_id: partner_id ?? null,
      user_id: user_id ?? null,
      driver_id: assignedDriverId,
      status: 'pending',
    })
    .select()
    .single();

  if (batchErr || !batch) {
    logger.error('[batchController] createBatch error:', batchErr);
    res.status(500).json({ success: false, message: 'Erreur lors de la création de la tournée' });
    return;
  }

  // Insérer les batch_orders avec position optimisée
  const batchOrdersPayload = optimizedOrder.map((originalIdx, position) => ({
    batch_id: (batch as any).id,
    order_id: orders[originalIdx]!.order_id,
    position: position + 1,
  }));

  const { error: boErr } = await db().from('batch_orders').insert(batchOrdersPayload);

  if (boErr) {
    logger.error('[batchController] insert batch_orders error:', boErr);
    // Rollback batch
    await db().from('delivery_batches').delete().eq('id', (batch as any).id);
    res.status(500).json({ success: false, message: 'Erreur lors de l\'insertion des commandes dans la tournée' });
    return;
  }

  // Notifier le livreur attitré via socket (une seule notification pour toute la tournée)
  if (assignedDriverId) {
    const emitted = emitBatchAssigned(assignedDriverId, {
      batchId: (batch as any).id,
      ordersCount: orders.length,
      ...(partner_id ? { partner_id } : {}),
    });
    if (!emitted) {
      logger.warn('[batchController] Tournée créée mais livreur non connecté', {
        batchId: (batch as any).id,
        driverId: assignedDriverId,
      });
    }
  }

  res.status(201).json({ success: true, data: { ...batch, driver_id: assignedDriverId, orders_count: orders.length } });
};

// ─── GET /api/batches/:id — détail tournée + statuts ────────────────────────
export const getBatch = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  const { data: batch, error: batchErr } = await db()
    .from('delivery_batches')
    .select('*')
    .eq('id', id)
    .single();

  if (batchErr || !batch) {
    res.status(404).json({ success: false, message: 'Tournée introuvable' });
    return;
  }

  // Récupérer les commandes ordonnées + statut depuis orders
  const { data: batchOrders, error: boErr } = await db()
    .from('batch_orders')
    .select(`
      position,
      order_id,
      orders (
        id,
        status,
        pickup_address,
        dropoff_address,
        recipient,
        price_cfa
      )
    `)
    .eq('batch_id', id)
    .order('position', { ascending: true });

  if (boErr) {
    logger.error('[batchController] getBatch orders error:', boErr);
    res.status(500).json({ success: false, message: 'Erreur lors de la récupération des commandes' });
    return;
  }

  res.json({
    success: true,
    data: {
      ...batch,
      orders: batchOrders ?? [],
    },
  });
};

// ─── PATCH /api/batches/:id/orders/:orderId — valider une livraison ──────────
export const validateBatchOrder = async (req: Request, res: Response): Promise<void> => {
  const { id: batchId, orderId } = req.params;
  const { status } = req.body as { status: 'completed' | 'cancelled' };

  if (!['completed', 'cancelled'].includes(status)) {
    res.status(400).json({ success: false, message: 'status doit être completed ou cancelled' });
    return;
  }

  // Vérifier que la commande appartient bien à cette tournée
  const { data: batchOrder, error: checkErr } = await db()
    .from('batch_orders')
    .select('id')
    .eq('batch_id', batchId)
    .eq('order_id', orderId)
    .single();

  if (checkErr || !batchOrder) {
    res.status(404).json({ success: false, message: 'Commande non trouvée dans cette tournée' });
    return;
  }

  // Mettre à jour le statut de la commande
  const updateData: Record<string, any> = { status };
  if (status === 'completed') updateData.completed_at = new Date().toISOString();
  if (status === 'cancelled')  updateData.cancelled_at = new Date().toISOString();

  const { error: orderErr } = await db()
    .from('orders')
    .update(updateData)
    .eq('id', orderId);

  if (orderErr) {
    logger.error('[batchController] validateBatchOrder update error:', orderErr);
    res.status(500).json({ success: false, message: 'Erreur lors de la mise à jour de la commande' });
    return;
  }

  // Vérifier si toutes les commandes de la tournée sont terminées
  const { data: remaining } = await db()
    .from('batch_orders')
    .select('orders!inner(status)')
    .eq('batch_id', batchId)
    .not('orders.status', 'in', '("completed","cancelled")');

  if (!remaining?.length) {
    await db()
      .from('delivery_batches')
      .update({ status: 'completed' })
      .eq('id', batchId);
  }

  res.json({ success: true, data: { orderId, status } });
};
