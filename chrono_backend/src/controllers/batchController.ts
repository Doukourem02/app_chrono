import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { supabase, supabaseAdmin } from '../config/supabase.js';
import pool from '../config/db.js';
import { optimizeRouteOrder } from '../utils/haversine.js';
import { emitBatchAssigned, findAllAvailableDrivers } from '../sockets/orderSocket.js';
import logger from '../utils/logger.js';
import type { JWTPayload } from '../types/index.js';
import qrCodeService from '../services/qrCodeService.js';
import { completeTransactionsForOrder } from '../utils/createTransactionForOrder.js';
import { saveDeliveryProofRecord } from '../config/orderStorage.js';

const db = () => supabaseAdmin ?? supabase;
type AuthenticatedRequest = Request & { user?: JWTPayload };
type BatchProofMethod = 'qr_scan' | 'manual_code' | 'photo_signature' | 'batch_driver_confirmation';

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
    let availableDrivers = await findAllAvailableDrivers('moto', { b2bOnly: true });
    if (availableDrivers.length === 0) {
      logger.warn('[batchController] Aucun livreur opt-in B2B disponible — fallback tous livreurs disponibles');
      availableDrivers = await findAllAvailableDrivers('moto');
    }
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

  await ensureBatchOrderProofs(orders.map((order) => order.order_id));

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
    await db()
      .from('delivery_batches')
      .update({ status: 'completed' })
      .eq('id', batchId);
  }

  res.json({ success: true, data: { orderId, status } });
};
