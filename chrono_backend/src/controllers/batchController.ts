import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { supabase, supabaseAdmin } from '../config/supabase.js';
import pool from '../config/db.js';
import { optimizeRouteOrder } from '../utils/haversine.js';
import { emitBatchAssigned, emitBatchOfferToAllConnectedDrivers, emitBatchOfferToDrivers, findAllAvailableDrivers } from '../sockets/orderSocket.js';
import { notifyAllForOrderStatus } from '../services/recipientOrderNotifyService.js';
import logger from '../utils/logger.js';
import type { JWTPayload } from '../types/index.js';
import qrCodeService from '../services/qrCodeService.js';
import { completeTransactionsForOrder } from '../utils/createTransactionForOrder.js';
import { saveDeliveryProofRecord } from '../config/orderStorage.js';
import { computeDynamicDeliveryPrice } from '../services/dynamicPricing.js';
import { computeB2BCommission, incrementPartnerUsage } from '../services/b2bCommissionService.js';
import { haversineDistanceKm } from '../services/priceCalculator.js';

const db = () => supabaseAdmin ?? supabase;
type AuthenticatedRequest = Request & { user?: JWTPayload };
type BatchProofMethod = 'qr_scan' | 'manual_code' | 'photo_signature' | 'batch_driver_confirmation';
type BatchOrderInput = {
  order_id?: string;
  lat?: number;
  lng?: number;
  recipient?: { name?: string; phone?: string; address?: string };
  notes?: string;
  client_order_index?: number;
};

type BatchOrderDraft = {
  order_id: string;
  lat?: number;
  lng?: number;
  client_order_index: number;
  createdByBatch: boolean;
};

function parseJsonField(value: unknown): any {
  if (!value) return null;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  return value;
}

function recipientFromOrder(row: any): { name: string; phone: string } {
  const recipient = parseJsonField(row.recipient) || {};
  const dropoff = parseJsonField(row.dropoff_address || row.dropoff) || {};
  const details = dropoff?.details || {};
  const phone =
    (typeof recipient.phone === 'string' && recipient.phone.trim()) ||
    (typeof details.phone === 'string' && details.phone.trim()) ||
    (typeof details.recipientPhone === 'string' && details.recipientPhone.trim()) ||
    '';
  const name =
    (typeof recipient.name === 'string' && recipient.name.trim()) ||
    (typeof details.name === 'string' && details.name.trim()) ||
    (typeof details.recipientName === 'string' && details.recipientName.trim()) ||
    (phone ? `Destinataire (${phone})` : 'Destinataire');
  return { name, phone };
}

function toCoords(lat?: number, lng?: number): { latitude: number; longitude: number } | undefined {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return undefined;
  if (Math.abs(lat as number) > 90 || Math.abs(lng as number) > 180) return undefined;
  return { latitude: lat as number, longitude: lng as number };
}

function safeAddress(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

async function canUsePartner(authUser: JWTPayload | undefined, partnerId: string): Promise<boolean> {
  if (!authUser?.id) return false;
  if (authUser.role === 'admin' || authUser.role === 'super_admin') return true;
  const member = await pool.query(
    `SELECT 1 FROM partner_users WHERE partner_id = $1 AND user_id = $2 LIMIT 1`,
    [partnerId, authUser.id]
  );
  return (member.rowCount ?? 0) > 0;
}

async function getOrderColumns(): Promise<Set<string>> {
  const result = await pool.query(
    `SELECT column_name
       FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'orders'`
  );
  return new Set(result.rows.map((row) => row.column_name as string));
}

async function loadClientName(userId: string): Promise<string> {
  const result = await pool.query(
    `SELECT email, first_name, last_name FROM users WHERE id = $1 LIMIT 1`,
    [userId]
  );
  const user = result.rows[0];
  return [user?.first_name, user?.last_name].filter(Boolean).join(' ').trim() || user?.email || 'Client B2B';
}

async function markOrderAsBatchB2B(
  orderId: string,
  partnerId: string | undefined,
  recipient?: { name?: string; phone?: string },
  notes?: string,
  preferredDriverId?: string | null
): Promise<void> {
  const columns = await getOrderColumns();
  const setClauses: string[] = [];
  const values: unknown[] = [];
  let index = 1;

  const addValue = (column: string, value: unknown) => {
    setClauses.push(`${column} = $${index}`);
    values.push(value);
    index += 1;
  };

  if (partnerId && columns.has('partner_id')) addValue('partner_id', partnerId);
  if (columns.has('is_b2b_order')) addValue('is_b2b_order', true);
  if (columns.has('payment_method_type')) addValue('payment_method_type', 'deferred');
  if (columns.has('payment_status')) addValue('payment_status', 'delayed');
  if (columns.has('payment_payer')) addValue('payment_payer', 'client');
  if (preferredDriverId && columns.has('preferred_driver_id')) addValue('preferred_driver_id', preferredDriverId);
  if (columns.has('recipient') && recipient) addValue('recipient', JSON.stringify(recipient));
  if (columns.has('notes') && notes) addValue('notes', notes);

  if (columns.has('updated_at')) setClauses.push('updated_at = now()');
  if (!setClauses.length) return;

  values.push(orderId);
  await pool.query(`UPDATE orders SET ${setClauses.join(', ')} WHERE id = $${index}`, values);
}

async function createBatchChildOrder(params: {
  userId: string;
  partnerId?: string;
  driverId?: string | null;
  pickupAddress: string;
  pickupCoords?: { latitude: number; longitude: number };
  input: BatchOrderInput;
}): Promise<BatchOrderDraft> {
  const recipientAddress = safeAddress(params.input.recipient?.address);
  const recipientName = safeAddress(params.input.recipient?.name) || 'Destinataire';
  const recipientPhone = safeAddress(params.input.recipient?.phone);
  if (!recipientAddress || !recipientPhone) {
    throw new Error('Chaque arrêt doit contenir une adresse et un téléphone destinataire.');
  }

  const dropoffCoords = toCoords(params.input.lat, params.input.lng);
  const dropoff = {
    address: recipientAddress,
    ...(dropoffCoords ? { coordinates: dropoffCoords } : {}),
    details: {
      recipient_name: recipientName,
      phone: recipientPhone,
      ...(params.input.notes ? { driver_notes: params.input.notes } : {}),
    },
    _chrono_partner: { is_b2b_order: true },
  };
  const pickup = {
    address: params.pickupAddress,
    ...(params.pickupCoords ? { coordinates: params.pickupCoords } : {}),
    _chrono_partner: { is_b2b_order: true },
  };

  const distanceKm = params.pickupCoords && dropoffCoords
    ? haversineDistanceKm(params.pickupCoords, dropoffCoords)
    : 5;
  const dynamic = await computeDynamicDeliveryPrice({
    distanceKm,
    method: 'moto',
    pickupLatitude: params.pickupCoords?.latitude,
    pickupLongitude: params.pickupCoords?.longitude,
    isB2BPriority: true,
  });

  const { data, error } = await db().rpc('fn_create_order', {
    p_user_id: params.userId,
    p_pickup: pickup,
    p_dropoff: dropoff,
    p_method: 'moto',
    p_price: dynamic.totalCfa,
    p_distance: distanceKm,
  });
  if (error || !data) {
    throw new Error(error?.message || 'Erreur création commande enfant');
  }

  const orderId = String(data);
  await markOrderAsBatchB2B(
    orderId,
    params.partnerId,
    { name: recipientName, phone: recipientPhone },
    params.input.notes,
    params.driverId
  );

  try {
    await qrCodeService.generateDeliveryQRCode(
      orderId,
      `CMD-${orderId.substring(0, 8).toUpperCase()}`,
      recipientName,
      recipientPhone,
      await loadClientName(params.userId)
    );
  } catch (qrErr: any) {
    logger.warn('[batchController] QR/code commande enfant non bloquant:', qrErr?.message || qrErr);
  }

  if (params.partnerId) {
    const commission = await computeB2BCommission(params.partnerId).catch(() => null);
    if (commission) {
      await pool.query(
        `UPDATE orders SET commission_rate = $1, commission_type = $2 WHERE id = $3`,
        [commission.rate, commission.type, orderId]
      ).catch((err: any) => {
        logger.warn('[batchController] commission_rate storage non bloquant:', err?.message || err);
      });
    }
    await incrementPartnerUsage(params.partnerId).catch((usageErr: any) => {
      logger.warn('[batchController] usage partenaire batch non bloquant:', usageErr?.message || usageErr);
    });
  }

  return {
    order_id: orderId,
    lat: params.input.lat,
    lng: params.input.lng,
    client_order_index: params.input.client_order_index ?? 0,
    createdByBatch: true,
  };
}

async function ensureBatchOrderProofs(orderIds: string[]): Promise<void> {
  if (!orderIds.length) return;

  try {
    const result = await pool.query(
      `SELECT
         o.id,
         o.recipient,
         o.dropoff_address,
         o.dropoff,
         o.delivery_qr_code,
         o.delivery_verification_code,
         u.first_name,
         u.last_name,
         u.email
       FROM orders o
       LEFT JOIN users u ON u.id = o.user_id
       WHERE o.id = ANY($1::uuid[])`,
      [orderIds]
    );

    for (const row of result.rows) {
      if (row.delivery_qr_code && row.delivery_verification_code) continue;
      const recipient = recipientFromOrder(row);
      const creatorName =
        [row.first_name, row.last_name].filter(Boolean).join(' ').trim() ||
        row.email ||
        'Client';
      await qrCodeService.generateDeliveryQRCode(
        row.id,
        `CMD-${String(row.id).substring(0, 8).toUpperCase()}`,
        recipient.name,
        recipient.phone,
        creatorName
      );
    }
  } catch (err: any) {
    logger.warn('[batchController] génération QR/code batch non bloquante:', err?.message || err);
  }
}

async function latestValidProofs(orderIds: string[]): Promise<Record<string, any>> {
  if (!orderIds.length) return {};
  try {
    const result = await pool.query(
      `SELECT DISTINCT ON (qs.order_id)
         qs.order_id,
         qs.qr_code_type,
         qs.scanned_at,
         qs.location,
         qs.scanned_by,
         u.first_name,
         u.last_name,
         u.email
       FROM qr_code_scans qs
       LEFT JOIN users u ON u.id = qs.scanned_by
       WHERE qs.order_id = ANY($1::uuid[])
         AND qs.is_valid = true
       ORDER BY qs.order_id, qs.scanned_at DESC`,
      [orderIds]
    );
    return Object.fromEntries(result.rows.map((row) => [
      row.order_id,
      {
        method: row.qr_code_type,
        validated_at: row.scanned_at,
        location: row.location,
        validated_by: {
          id: row.scanned_by,
          name: [row.first_name, row.last_name].filter(Boolean).join(' ') || row.email || row.scanned_by,
        },
      },
    ]));
  } catch (err: any) {
    logger.warn('[batchController] lecture preuves batch impossible:', err?.message || err);
    return {};
  }
}

async function saveAlternativePhoto(orderId: string, photoBase64?: string | null): Promise<string | null> {
  if (!photoBase64) return null;
  const cleaned = String(photoBase64).replace(/^data:image\/\w+;base64,/, '');
  if (!cleaned.trim()) return null;
  const proofsDir = path.join(process.cwd(), 'tmp_proofs');
  if (!fs.existsSync(proofsDir)) fs.mkdirSync(proofsDir, { recursive: true });
  const filepath = path.join(proofsDir, `${orderId}_${Date.now()}_batch.jpg`);
  await fs.promises.writeFile(filepath, Buffer.from(cleaned, 'base64'));
  return filepath;
}

// ─── PATCH /api/batches/:id/pickup — confirmer la collecte de tous les colis ──
export const confirmBatchPickup = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id: batchId } = req.params;

  const { data: batch, error } = await db()
    .from('delivery_batches')
    .select('id, driver_id, status')
    .eq('id', batchId)
    .single();

  if (error || !batch) {
    res.status(404).json({ success: false, message: 'Tournée introuvable' });
    return;
  }

  if (req.user?.id && batch.driver_id && batch.driver_id !== req.user.id) {
    res.status(403).json({ success: false, message: 'Cette tournée ne vous est pas assignée' });
    return;
  }

  const { error: updateError } = await db()
    .from('delivery_batches')
    .update({ status: 'in_progress' })
    .eq('id', batchId);

  if (updateError) {
    logger.error('[batchController] confirmBatchPickup update error:', updateError);
    res.status(500).json({ success: false, message: 'Erreur lors de la confirmation de la collecte' });
    return;
  }

  // Mettre à jour les commandes de la tournée à picked_up + récupérer les IDs pour notifier
  const pickedUpResult = await pool.query<{ id: string; user_id: string }>(
    `UPDATE orders o
        SET status = 'picked_up', updated_at = NOW()
       FROM batch_orders bo
      WHERE bo.batch_id = $1
        AND bo.order_id = o.id
        AND o.status IN ('accepted', 'enroute', 'in_progress')
   RETURNING o.id, o.user_id`,
    [batchId]
  ).catch((err: any) => {
    logger.warn('[batchController] confirmBatchPickup order status update warning:', err?.message);
    return null;
  });

  // Notifier chaque commande : push "Colis récupéré" → payeur + destinataire + SMS fallback
  if (pickedUpResult?.rows?.length) {
    for (const row of pickedUpResult.rows) {
      void notifyAllForOrderStatus({
        orderId: row.id,
        status: 'picked_up',
        payerUserId: row.user_id,
      }).catch((e: any) => {
        logger.warn('[batchController] notify picked_up per order:', e?.message);
      });
    }
  }

  res.json({ success: true });
};

// ─── POST /api/batches — créer une tournée ────────────────────────────────────
// Body: { partner_id?, user_id, driver_id?, pickup_address?, pickup_coords?, orders: [{ order_id? } | { recipient, lat?, lng?, notes? }] }
export const createBatch = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { partner_id, user_id, driver_id, orders, pickup_address, pickup_coords } = req.body as {
    partner_id?: string;
    user_id?: string;
    driver_id?: string;
    pickup_address?: string;
    pickup_coords?: { latitude?: number; longitude?: number; lat?: number; lng?: number } | null;
    orders: BatchOrderInput[];
  };

  if (!orders?.length) {
    res.status(400).json({ success: false, message: 'Le tableau orders est requis et non vide' });
    return;
  }
  if (!partner_id && !user_id) {
    res.status(400).json({ success: false, message: 'partner_id ou user_id est requis' });
    return;
  }
  const needsChildOrderCreation = orders.some((order) => !order.order_id);
  if (needsChildOrderCreation && !user_id) {
    res.status(400).json({ success: false, message: 'user_id est requis pour créer les livraisons enfants' });
    return;
  }
  if (needsChildOrderCreation && !safeAddress(pickup_address)) {
    res.status(400).json({ success: false, message: 'pickup_address est requis pour créer une tournée' });
    return;
  }
  if (user_id && req.user?.id && req.user.id !== user_id && req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    res.status(403).json({ success: false, message: 'Accès refusé pour cet utilisateur' });
    return;
  }
  if (partner_id && !(await canUsePartner(req.user, partner_id))) {
    res.status(403).json({ success: false, message: 'Accès partenaire refusé' });
    return;
  }

  const explicitDriverId = typeof driver_id === 'string' && driver_id.trim() ? driver_id.trim() : null;
  let assignedDriverId = explicitDriverId;
  let automaticOfferDrivers: Awaited<ReturnType<typeof findAllAvailableDrivers>> = [];
  if (!assignedDriverId) {
    automaticOfferDrivers = await findAllAvailableDrivers('moto', { b2bOnly: true });
    if (automaticOfferDrivers.length === 0) {
      logger.warn('[batchController] Aucun livreur opt-in B2B disponible — fallback tous livreurs disponibles');
      automaticOfferDrivers = await findAllAvailableDrivers('moto');
    }
  }

  let preparedOrders: BatchOrderDraft[] = [];
  const pickupCoords = toCoords(
    pickup_coords?.latitude ?? pickup_coords?.lat,
    pickup_coords?.longitude ?? pickup_coords?.lng
  );
  {
    const settlements = await Promise.allSettled(
      orders.map(async (order, index) => {
        const clientIndex = Number.isFinite(order.client_order_index) ? Number(order.client_order_index) : index;
        if (typeof order.order_id === 'string' && order.order_id.trim()) {
          return {
            order_id: order.order_id.trim(),
            lat: order.lat,
            lng: order.lng,
            client_order_index: clientIndex,
            createdByBatch: false,
          } as BatchOrderDraft;
        }
        return createBatchChildOrder({
          userId: user_id!,
          partnerId: partner_id,
          driverId: assignedDriverId,
          pickupAddress: safeAddress(pickup_address),
          pickupCoords,
          input: { ...order, client_order_index: clientIndex },
        });
      })
    );
    const createdIds = settlements
      .filter((s): s is PromiseFulfilledResult<BatchOrderDraft> => s.status === 'fulfilled' && s.value.createdByBatch)
      .map((s) => s.value.order_id);
    const firstFailure = settlements.find((s): s is PromiseRejectedResult => s.status === 'rejected');
    if (firstFailure) {
      if (createdIds.length) {
        await db().from('orders').delete().in('id', createdIds);
      }
      const errMsg = firstFailure.reason?.message ?? 'Impossible de créer les commandes de la tournée';
      logger.warn('[batchController] create child orders error:', errMsg);
      res.status(400).json({ success: false, message: errMsg });
      return;
    }
    preparedOrders = settlements.map((s) => (s as PromiseFulfilledResult<BatchOrderDraft>).value);
  }

  // Optimiser l'ordre si les coordonnées sont fournies
  let optimizedOrder: number[];
  const hasCoords = preparedOrders.every((o) => o.lat !== undefined && o.lng !== undefined);

  if (hasCoords) {
    const points = preparedOrders.map((o, i) => ({ lat: o.lat!, lng: o.lng!, originalIndex: i }));
    optimizedOrder = optimizeRouteOrder(points);
  } else {
    optimizedOrder = preparedOrders.map((_, i) => i);
  }

  // Créer delivery_batch + batch_orders dans une transaction atomique
  const txClient = await pool.connect();
  let batch: { id: string } | null = null;
  try {
    await txClient.query('BEGIN');
    const { rows: batchRows } = await txClient.query<{ id: string }>(
      `INSERT INTO delivery_batches (partner_id, user_id, driver_id, status)
       VALUES ($1, $2, $3, 'pending') RETURNING id`,
      [partner_id ?? null, user_id ?? null, assignedDriverId ?? null]
    );
    if (!batchRows[0]) throw new Error('batch insert returned no rows');
    batch = batchRows[0];

    if (preparedOrders.length > 0) {
      const rows = optimizedOrder.map((originalIdx, pos) => [
        batch!.id,
        preparedOrders[originalIdx]!.order_id,
        pos + 1,
      ]);
      const placeholders = rows.map((_, i) => `($${i * 3 + 1}, $${i * 3 + 2}, $${i * 3 + 3})`).join(', ');
      await txClient.query(
        `INSERT INTO batch_orders (batch_id, order_id, position) VALUES ${placeholders}`,
        rows.flat()
      );
    }
    await txClient.query('COMMIT');

    // Émettre le socket immédiatement après le COMMIT — la liste de priorité
    // (B2B d'abord → fallback tous livreurs) est déjà calculée avant cette transaction.
    const batchId = batch!.id;
    if (assignedDriverId) {
      const emitted = emitBatchAssigned(assignedDriverId, {
        batchId,
        ordersCount: preparedOrders.length,
        ...(partner_id ? { partner_id } : {}),
        status: 'assigned',
      });
      if (!emitted) {
        logger.warn('[batchController] Tournée créée mais livreur non connecté', {
          batchId,
          driverId: assignedDriverId,
        });
      }
    } else {
      const offerPayload = {
        batchId,
        ordersCount: preparedOrders.length,
        ...(partner_id ? { partner_id } : {}),
        status: 'offer',
      };
      let emittedCount = emitBatchOfferToDrivers(automaticOfferDrivers, offerPayload);
      if (emittedCount === 0) {
        void emitBatchOfferToAllConnectedDrivers(offerPayload);
      }
      if (emittedCount === 0) {
        logger.warn('[batchController] Tournée créée mais aucun livreur connecté notifié', {
          batchId,
          candidateDrivers: automaticOfferDrivers.length,
        });
      }
    }
  } catch (txErr: any) {
    await txClient.query('ROLLBACK').catch(() => {});
    logger.error('[batchController] batch transaction error:', txErr?.message || txErr);
    res.status(500).json({ success: false, message: 'Erreur lors de la création de la tournée' });
    return;
  } finally {
    txClient.release();
  }

  // Génération QR de secours en arrière-plan — ne bloque pas la réponse ni le socket.
  ensureBatchOrderProofs(preparedOrders.map((order) => order.order_id)).catch(() => {});

  const ordersResponse = optimizedOrder.map((originalIdx, pos) => ({
    order_id: preparedOrders[originalIdx]!.order_id,
    position: pos + 1,
    client_order_index: preparedOrders[originalIdx]!.client_order_index,
  }));

  res.status(201).json({
    success: true,
    data: {
      id: batch!.id,
      driver_id: assignedDriverId,
      orders_count: preparedOrders.length,
      orders: ordersResponse,
    },
  });
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
        price_cfa,
        delivery_qr_scanned_at,
        delivery_qr_scanned_by,
        delivery_qr_code,
        delivery_verification_code
      )
    `)
    .eq('batch_id', id)
    .order('position', { ascending: true });

  if (boErr) {
    logger.error('[batchController] getBatch orders error:', boErr);
    res.status(500).json({ success: false, message: 'Erreur lors de la récupération des commandes' });
    return;
  }

  const orderIds = (batchOrders ?? []).map((item: any) => item.order_id).filter(Boolean);
  const proofsByOrderId = await latestValidProofs(orderIds);
  const ordersWithProofs = (batchOrders ?? []).map((item: any) => ({
    ...item,
    orders: {
      ...(Array.isArray(item.orders) ? item.orders[0] : item.orders),
      proof: proofsByOrderId[item.order_id] ?? null,
    },
  }));

  res.json({
    success: true,
    data: {
      ...batch,
      orders: ordersWithProofs,
    },
  });
};

// ─── PATCH /api/batches/:id/orders/:orderId — valider une livraison ──────────
export const validateBatchOrder = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id: batchId, orderId } = req.params;
  const { status, proofMethod, location, alternativeProof } = req.body as {
    status: 'completed' | 'cancelled';
    proofMethod?: BatchProofMethod;
    location?: { latitude?: number; longitude?: number };
    alternativeProof?: {
      photoBase64?: string | null;
      signatureName?: string | null;
      timestamp?: string | null;
    };
  };

  if (!['completed', 'cancelled'].includes(status)) {
    res.status(400).json({ success: false, message: 'status doit être completed ou cancelled' });
    return;
  }

  // Vérifier que la commande appartient bien à cette tournée et au livreur connecté
  const { data: batchOrder, error: checkErr } = await db()
    .from('batch_orders')
    .select('id, delivery_batches(driver_id)')
    .eq('batch_id', batchId)
    .eq('order_id', orderId)
    .single();

  if (checkErr || !batchOrder) {
    res.status(404).json({ success: false, message: 'Commande non trouvée dans cette tournée' });
    return;
  }

  const batchDriverId = Array.isArray((batchOrder as any).delivery_batches)
    ? (batchOrder as any).delivery_batches[0]?.driver_id
    : (batchOrder as any).delivery_batches?.driver_id;
  if (req.user?.id && batchDriverId && batchDriverId !== req.user.id) {
    res.status(403).json({ success: false, message: 'Cette tournée ne vous est pas assignée' });
    return;
  }

  const orderCheck = await pool.query(
    `SELECT id, status, driver_id FROM orders WHERE id = $1`,
    [orderId]
  );
  const orderRow = orderCheck.rows[0];
  if (!orderRow) {
    res.status(404).json({ success: false, message: 'Commande introuvable' });
    return;
  }
  if (req.user?.id && orderRow.driver_id && orderRow.driver_id !== req.user.id) {
    res.status(403).json({ success: false, message: 'Cette commande ne vous est pas assignée' });
    return;
  }

  if (status === 'completed') {
    const method = proofMethod;
    if (!method || !['qr_scan', 'manual_code', 'photo_signature', 'batch_driver_confirmation'].includes(method)) {
      res.status(400).json({
        success: false,
        message: 'Une preuve valide est requise avant de marquer cet arrêt livré',
      });
      return;
    }

    if (['qr_scan', 'manual_code'].includes(method)) {
      const proofCheck = await pool.query(
        `SELECT id FROM qr_code_scans
         WHERE order_id = $1
           AND scanned_by = $2
           AND is_valid = true
           AND qr_code_type = $3
         LIMIT 1`,
        [orderId, req.user?.id, method]
      );
      if (!proofCheck.rows.length) {
        res.status(400).json({
          success: false,
          message: 'Aucune preuve QR/code valide trouvée pour cet arrêt',
        });
        return;
      }
    }

    const st = String(orderRow.status || '').toLowerCase();
    if (!['picked_up', 'delivering', 'accepted', 'enroute', 'completed'].includes(st)) {
      res.status(400).json({
        success: false,
        message: `La livraison ne peut pas être clôturée depuis le statut ${st || orderRow.status}`,
      });
      return;
    }
  }

  // Mettre à jour le statut de la commande
  const updateData: Record<string, any> = { status };
  if (status === 'completed') {
    updateData.completed_at = new Date().toISOString();
    if (req.user?.id) {
      updateData.delivery_qr_scanned_at = new Date().toISOString();
      updateData.delivery_qr_scanned_by = req.user.id;
    }
  }
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

  if (status === 'completed' && req.user?.id && !['qr_scan', 'manual_code'].includes(String(proofMethod))) {
    try {
      const method = proofMethod === 'photo_signature' ? 'photo_signature' : 'batch_driver_confirmation';
      const fileUrl = method === 'photo_signature'
        ? await saveAlternativePhoto(orderId, alternativeProof?.photoBase64)
        : null;
      const metadata = {
        source: method,
        signatureName: alternativeProof?.signatureName || null,
        timestamp: alternativeProof?.timestamp || new Date().toISOString(),
        hasPhoto: !!fileUrl,
        batchId,
      };
      await pool.query(
        `INSERT INTO qr_code_scans
         (order_id, qr_code_type, scanned_by, location, device_info, is_valid)
         VALUES ($1, $2, $3, $4, $5, true)
         ON CONFLICT (order_id, scanned_by)
         DO UPDATE SET
           scanned_at = NOW(),
           qr_code_type = EXCLUDED.qr_code_type,
           location = EXCLUDED.location,
           device_info = EXCLUDED.device_info,
           is_valid = true,
           validation_error = NULL`,
        [
          orderId,
          method,
          req.user.id,
          location ? JSON.stringify(location) : null,
          JSON.stringify(metadata),
        ]
      );
      await saveDeliveryProofRecord({
        orderId,
        driverId: req.user.id,
        proofType: method,
        fileUrl: fileUrl || undefined,
        notes: method === 'photo_signature' ? 'Preuve alternative batch' : 'Confirmation livreur batch',
        metadata: { ...metadata, location: location || null },
      }).catch((err: any) => {
        logger.warn('[batchController] delivery_proofs non bloquant:', err?.message || err);
      });
      await completeTransactionsForOrder(orderId);
    } catch (proofErr: any) {
      logger.warn('[batchController] preuve batch non bloquante:', proofErr?.message || proofErr);
    }
  }

  // Vérifier si toutes les commandes de la tournée sont terminées
  const { data: remaining } = await db()
    .from('batch_orders')
    .select('orders!inner(status)')
    .eq('batch_id', batchId)
    .not('orders.status', 'in', '("completed","cancelled")');

  if (!remaining?.length) {
    const { data: allOrders } = await db()
      .from('batch_orders')
      .select('orders!inner(status)')
      .eq('batch_id', batchId);

    const statuses = (allOrders ?? []).map((o: any) =>
      Array.isArray(o.orders) ? o.orders[0]?.status : o.orders?.status
    );
    const hasCompleted = statuses.some((s: any) => s === 'completed');
    const hasCancelled = statuses.some((s: any) => s === 'cancelled');
    const batchFinalStatus = hasCompleted && hasCancelled ? 'partial' : 'completed';

    await db()
      .from('delivery_batches')
      .update({ status: batchFinalStatus })
      .eq('id', batchId);
  }

  res.json({ success: true, data: { orderId, status } });
};
