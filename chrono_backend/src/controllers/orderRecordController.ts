import { Request, Response } from 'express';
import { supabase, supabaseAdmin } from '../config/supabase.js';
import logger from '../utils/logger.js';
import type { JWTPayload } from '../types/index.js';
import { computeDynamicDeliveryPrice } from '../services/dynamicPricing.js';
import { computeB2BCommission, incrementPartnerUsage } from '../services/b2bCommissionService.js';
import pool from '../config/db.js';
import { notifyDriversForOrder } from '../sockets/orderSocket.js';
import { haversineDistanceKm } from '../services/priceCalculator.js';
import qrCodeService from '../services/qrCodeService.js';

type AuthenticatedRequest = Request & {
  body: {
    userId?: string;
    pickup?: unknown;
    dropoff?: unknown;
    method?: string;
    priceCfa?: number;
    distanceKm?: number;
    speedOptionId?: string;
    routeDurationSeconds?: number;
    routeDurationTypicalSeconds?: number;
    partner_id?: string | null;
    recipient?: { name?: string; phone?: string };
    notes?: string;
    notifyDrivers?: boolean;
    preferred_driver_id?: string | null;
  };
  user?: JWTPayload;
};

type Coords = { latitude?: number; longitude?: number };

/** Toujours émettre une ligne recherchable `[orders/record]` dans Better Stack / Render. */
function logOrderRecord(
  level: 'info' | 'warn',
  event: string,
  meta?: Record<string, unknown>
): void {
  const payload = { event, ...meta };
  if (level === 'info') {
    logger.info('[orders/record]', payload);
  } else {
    logger.warn('[orders/record]', payload);
  }
}

function readCoords(loc: unknown): { lat?: number; lon?: number } {
  if (!loc || typeof loc !== 'object') return {};
  const c = (loc as { coordinates?: Coords }).coordinates;
  if (!c || typeof c !== 'object') return {};
  const lat = c.latitude;
  const lon = c.longitude;
  return {
    lat: typeof lat === 'number' && Number.isFinite(lat) ? lat : undefined,
    lon: typeof lon === 'number' && Number.isFinite(lon) ? lon : undefined,
  };
}

function toUsableCoordinates(lat?: number, lon?: number): { latitude: number; longitude: number } | undefined {
  const usable = typeof lat === 'number' && Number.isFinite(lat)
    && typeof lon === 'number' && Number.isFinite(lon)
    && !(lat === 0 && lon === 0);
  return usable ? { latitude: lat, longitude: lon } : undefined;
}

function distanceFromLocations(pickup: unknown, dropoff: unknown): number | undefined {
  const p = readCoords(pickup);
  const d = readCoords(dropoff);
  const pickupCoords = toUsableCoordinates(p.lat, p.lon);
  const dropoffCoords = toUsableCoordinates(d.lat, d.lon);
  if (!pickupCoords || !dropoffCoords) return undefined;
  return haversineDistanceKm(pickupCoords, dropoffCoords);
}

function parseJsonField(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function extractAddress(value: unknown): string {
  const parsed = parseJsonField(value);
  if (typeof parsed === 'string') return parsed;
  if (parsed && typeof parsed === 'object' && 'address' in parsed) {
    const address = (parsed as { address?: unknown }).address;
    return typeof address === 'string' ? address : '';
  }
  return '';
}

function normalizeLocation(value: unknown): { address?: string; coordinates?: Coords; details?: Record<string, unknown> } | null {
  const parsed = parseJsonField(value);
  if (!parsed) return null;
  if (typeof parsed === 'string') return { address: parsed };
  if (typeof parsed === 'object') {
    return parsed as { address?: string; coordinates?: Coords; details?: Record<string, unknown> };
  }
  return null;
}

async function getOrderColumns(): Promise<Set<string>> {
  const result = await (pool as any).query(
    `SELECT column_name
       FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'orders'`
  );
  return new Set(result.rows.map((row: any) => row.column_name as string));
}

async function updateB2BOrderMetadata(
  orderId: string,
  params: {
    partnerId: string;
    recipient?: { name?: string; phone?: string };
    notes?: string;
    preferredDriverId?: string | null;
  }
): Promise<void> {
  const columns = await getOrderColumns();
  const setClauses: string[] = [];
  const values: unknown[] = [];
  let index = 1;

  const addValue = (column: string, value: unknown) => {
    setClauses.push(`${column} = $${index}`);
    values.push(value);
    index++;
  };

  if (columns.has('partner_id')) addValue('partner_id', params.partnerId);
  if (columns.has('is_b2b_order')) addValue('is_b2b_order', true);
  if (columns.has('preferred_driver_id') && params.preferredDriverId) {
    addValue('preferred_driver_id', params.preferredDriverId);
  }
  if (columns.has('recipient') && params.recipient) {
    addValue('recipient', JSON.stringify(params.recipient));
  }

  const dropoffColumn = columns.has('dropoff_address')
    ? 'dropoff_address'
    : columns.has('dropoff')
      ? 'dropoff'
      : null;

  if (dropoffColumn && (params.recipient?.phone || params.recipient?.name || params.notes)) {
    const current = await (pool as any).query(
      `SELECT ${dropoffColumn} AS dropoff FROM orders WHERE id = $1`,
      [orderId]
    );
    const dropoff = normalizeLocation(current.rows[0]?.dropoff) ?? {};
    addValue(dropoffColumn, JSON.stringify({
      ...dropoff,
      details: {
        ...(dropoff.details ?? {}),
        ...(params.recipient?.name ? { recipient_name: params.recipient.name } : {}),
        ...(params.recipient?.phone ? { phone: params.recipient.phone } : {}),
        ...(params.notes ? { driver_notes: params.notes } : {}),
      },
    }));
  }

  if (columns.has('updated_at')) setClauses.push('updated_at = now()');
  if (!setClauses.length) return;

  values.push(orderId);
  await (pool as any).query(
    `UPDATE orders SET ${setClauses.join(', ')} WHERE id = $${index}`,
    values
  );
}

async function loadClientForOrder(userId: string): Promise<{
  id: string;
  name: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  avatar?: string;
}> {
  const result = await (pool as any).query(
    `SELECT id, email, phone, first_name, last_name, avatar_url
       FROM users
      WHERE id = $1
      LIMIT 1`,
    [userId]
  );
  const row = result.rows[0];
  if (!row) return { id: userId, name: 'Client B2B' };

  return {
    id: row.id,
    name: [row.first_name, row.last_name].filter(Boolean).join(' ').trim()
      || row.email
      || 'Client B2B',
    first_name: row.first_name || undefined,
    last_name: row.last_name || undefined,
    email: row.email || undefined,
    phone: row.phone || undefined,
    avatar: row.avatar_url || undefined,
  };
}

async function notifyB2BDrivers(
  req: AuthenticatedRequest,
  params: {
    orderId: string;
    userId: string;
    pickup: unknown;
    dropoff: unknown;
    method: string;
    priceCfa: number;
    distanceKm: number;
    recipient?: { name?: string; phone?: string };
    notes?: string;
    preferredDriverId?: string | null;
  }
): Promise<void> {
  const io = req.app.get('io');
  if (!io) {
    logger.warn('[orders/record] notification B2B ignorée: Socket.IO indisponible');
    return;
  }

  const pickupCoords = readCoords(params.pickup);
  const dropoffCoords = readCoords(params.dropoff);
  const client = await loadClientForOrder(params.userId);
  const order = {
    id: params.orderId,
    user: {
      id: client.id,
      name: client.name,
      first_name: client.first_name,
      last_name: client.last_name,
      phone: client.phone,
      email: client.email,
      avatar: client.avatar,
      rating: 4.5,
    },
    pickup: {
      address: extractAddress(params.pickup),
      coordinates: toUsableCoordinates(pickupCoords.lat, pickupCoords.lon),
      _chrono_partner: { is_b2b_order: true },
    },
    dropoff: {
      address: extractAddress(params.dropoff),
      coordinates: toUsableCoordinates(dropoffCoords.lat, dropoffCoords.lon),
      details: {
        ...(params.recipient?.name ? { recipient_name: params.recipient.name } : {}),
        ...(params.recipient?.phone ? { phone: params.recipient.phone } : {}),
        ...(params.notes ? { driver_notes: params.notes } : {}),
      },
      _chrono_partner: { is_b2b_order: true },
    },
    recipient: params.recipient,
    packageImages: [],
    price: params.priceCfa,
    deliveryMethod: params.method,
    distance: params.distanceKm,
    status: 'pending',
    createdAt: new Date(),
    is_b2b_order: true,
    ...(params.preferredDriverId ? { preferred_driver_id: params.preferredDriverId } : {}),
    payment_method_type: 'deferred',
    payment_status: 'delayed',
    payment_payer: 'client',
    notes: params.notes,
  };

  await notifyDriversForOrder(io, order as any, order.pickup.coordinates, params.method);
}

async function canUsePartner(authUser: JWTPayload, partnerId: string): Promise<boolean> {
  if (authUser.role === 'admin' || authUser.role === 'super_admin') return true;
  const member = await (pool as any).query(
    `SELECT 1 FROM partner_users WHERE partner_id = $1 AND user_id = $2 LIMIT 1`,
    [partnerId, authUser.id]
  );
  return member.rowCount > 0;
}

export const listOrderRecords = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const authUser = req.user;
    if (!authUser?.id) {
      res.status(401).json({ success: false, message: 'Non authentifié' });
      return;
    }

    const partnerId = typeof req.query.partner_id === 'string' ? req.query.partner_id.trim() : '';
    const status = typeof req.query.status === 'string' ? req.query.status.trim() : '';
    const pageRaw = Number(req.query.page ?? 1);
    const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;
    const limit = 100;
    const offset = (page - 1) * limit;

    if (partnerId && !(await canUsePartner(authUser, partnerId))) {
      res.status(403).json({ success: false, message: 'Accès partenaire refusé' });
      return;
    }

    const where: string[] = [];
    const values: unknown[] = [];
    let index = 1;

    if (partnerId) {
      where.push(`partner_id = $${index}`);
      values.push(partnerId);
      index++;
    } else {
      where.push(`user_id = $${index}`);
      values.push(authUser.id);
      index++;
    }

    if (status && status !== 'all') {
      where.push(`status = $${index}`);
      values.push(status);
      index++;
    }

    values.push(limit, offset);
    const result = await (pool as any).query(
      `SELECT id, user_id, partner_id, status, pickup_address, dropoff_address,
              delivery_method, price_cfa, distance_km, created_at, updated_at,
              is_b2b_order,
              delivery_qr_scanned_at,
              latest_proof.qr_code_type as delivery_proof_method,
              latest_proof.scanned_at as delivery_proof_validated_at
         FROM orders
         LEFT JOIN LATERAL (
           SELECT qr_code_type, scanned_at
           FROM qr_code_scans
           WHERE order_id = orders.id AND is_valid = true
           ORDER BY scanned_at DESC
           LIMIT 1
         ) latest_proof ON true
        WHERE ${where.join(' AND ')}
        ORDER BY created_at DESC
        LIMIT $${index} OFFSET $${index + 1}`,
      values
    );

    const data = result.rows.map((row: any) => {
      const pickup = normalizeLocation(row.pickup_address);
      const dropoff = normalizeLocation(row.dropoff_address);
      return {
        ...row,
        orderId: row.id,
        pickup,
        dropoff,
        pickup_address: pickup?.address ?? '',
        dropoff_address: dropoff?.address ?? '',
      };
    });

    res.json({ success: true, data });
  } catch (e: unknown) {
    logger.error('[orders] listOrderRecords error:', e);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

/**
 * Création d’enregistrement commande (RPC Supabase) côté serveur avec la service role.
 * L’app client n’envoie pas de JWT Supabase : son token est celui de l’API (auth-simple).
 * Les appels directs supabase.rpc() depuis le mobile provoquent des 401 si la RPC exige un rôle authentifié.
 * Prix : recalcul tarif dynamique (niveau C) — le montant client sert seulement de contrôle.
 */
export const createOrderRecord = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const authUser = req.user;
    if (!authUser?.id) {
      logOrderRecord('warn', 'client_error', { status: 401, reason: 'non_authenticated' });
      res.status(401).json({ success: false, message: 'Non authentifié' });
      return;
    }

    const {
      userId,
      pickup,
      dropoff,
      method,
      priceCfa,
      distanceKm,
      speedOptionId,
      routeDurationSeconds,
      routeDurationTypicalSeconds,
      partner_id,
      recipient,
      notes,
      notifyDrivers,
      preferred_driver_id,
    } = req.body;
    const isB2BRecord = Boolean(partner_id && typeof partner_id === 'string');

    if (!userId || typeof userId !== 'string') {
      logOrderRecord('warn', 'client_error', { status: 400, reason: 'userId_missing' });
      res.status(400).json({ success: false, message: 'userId requis' });
      return;
    }
    if (userId !== authUser.id) {
      logOrderRecord('warn', 'client_error', { status: 403, reason: 'userId_mismatch' });
      res.status(403).json({ success: false, message: 'Accès refusé' });
      return;
    }
    if (pickup == null || dropoff == null) {
      logOrderRecord('warn', 'client_error', { status: 400, reason: 'pickup_dropoff_missing' });
      res.status(400).json({ success: false, message: 'pickup et dropoff requis' });
      return;
    }
    if (isB2BRecord && !(await canUsePartner(authUser, partner_id as string))) {
      logOrderRecord('warn', 'client_error', { status: 403, reason: 'partner_access_denied' });
      res.status(403).json({ success: false, message: 'Accès partenaire refusé' });
      return;
    }
    if (!method || typeof method !== 'string') {
      logOrderRecord('warn', 'client_error', { status: 400, reason: 'method_missing' });
      res.status(400).json({ success: false, message: 'method requis' });
      return;
    }
    const computedDistanceKm = distanceFromLocations(pickup, dropoff);
    const effectiveDistanceKm =
      typeof distanceKm === 'number' && Number.isFinite(distanceKm) && distanceKm > 0
        ? distanceKm
        : computedDistanceKm != null && computedDistanceKm > 0
          ? computedDistanceKm
          : isB2BRecord
            ? 5
            : undefined;

    if (effectiveDistanceKm == null) {
      logOrderRecord('warn', 'client_error', { status: 400, reason: 'distanceKm_invalid' });
      res.status(400).json({ success: false, message: 'distanceKm requis (nombre > 0)' });
      return;
    }

    const { lat: pickupLat, lon: pickupLng } = readCoords(pickup);

    const rd =
      routeDurationSeconds != null &&
      Number.isFinite(Number(routeDurationSeconds)) &&
      Number(routeDurationSeconds) > 0
        ? Number(routeDurationSeconds)
        : undefined;
    const rt =
      routeDurationTypicalSeconds != null &&
      Number.isFinite(Number(routeDurationTypicalSeconds)) &&
      Number(routeDurationTypicalSeconds) > 0
        ? Number(routeDurationTypicalSeconds)
        : undefined;

    const dynamic = await computeDynamicDeliveryPrice({
      distanceKm: effectiveDistanceKm,
      method,
      speedOptionId: typeof speedOptionId === 'string' ? speedOptionId : undefined,
      pickupLatitude: pickupLat,
      pickupLongitude: pickupLng,
      routeDurationSeconds: rd,
      routeDurationTypicalSeconds: rt,
      isB2BPriority: isB2BRecord,
    });

    const serverPrice = dynamic.totalCfa;

    if (typeof priceCfa === 'number' && Number.isFinite(priceCfa)) {
      const diff = Math.abs(priceCfa - serverPrice);
      if (diff > 5) {
        logger.warn('[orders/record] Écart prix client/serveur', {
          event: 'price_mismatch',
          client: priceCfa,
          server: serverPrice,
          distanceKm: effectiveDistanceKm,
          method,
          labels: dynamic.labels,
        });
      }
    }
    if (
      typeof distanceKm === 'number' &&
      Number.isFinite(distanceKm) &&
      computedDistanceKm != null &&
      Math.abs(distanceKm - computedDistanceKm) > 0.05
    ) {
      logger.warn('[orders/record] Écart distance client/serveur', {
        event: 'distance_mismatch',
        client: distanceKm,
        server: computedDistanceKm,
        method,
      });
    }

    const client = supabaseAdmin ?? supabase;
    if (!supabaseAdmin) {
      logger.warn(
        'createOrderRecord: SUPABASE_SERVICE_ROLE_KEY absent — utilisation du client anon ; la RPC peut échouer (RLS).'
      );
    }

    const { data, error } = await client.rpc('fn_create_order', {
      p_user_id: userId,
      p_pickup: pickup,
      p_dropoff: dropoff,
      p_method: method,
      p_price: serverPrice,
      p_distance: effectiveDistanceKm,
    });

    if (error) {
      logOrderRecord('warn', 'fn_create_order_error', {
        message: error.message,
        code: error.code,
        details: error.details,
      });
      res.status(400).json({
        success: false,
        message: error.message || 'Erreur création commande',
        code: error.code,
      });
      return;
    }

    const orderId = data as string;
    logOrderRecord('info', 'success', { orderId });

    // ─── Logique B2B : commission + quota si partner_id présent ──────────────
    let b2bCommission: { rate: number; type: string; plan: string | null } | null = null;
    if (isB2BRecord) {
      try {
        const commission = await computeB2BCommission(partner_id);
        b2bCommission = { rate: commission.rate, type: commission.type, plan: commission.plan };

        // Rattacher la commande au partenaire + marquer B2B pour cohérence côté livreur
        await updateB2BOrderMetadata(orderId, {
          partnerId: partner_id,
          recipient,
          notes: typeof notes === 'string' && notes.trim() ? notes.trim() : undefined,
          preferredDriverId:
            typeof preferred_driver_id === 'string' && preferred_driver_id.trim()
              ? preferred_driver_id.trim()
              : null,
        });

        try {
          const recipientName =
            recipient?.name?.trim() ||
            (recipient?.phone ? `Destinataire (${recipient.phone})` : 'Destinataire');
          const recipientPhone = recipient?.phone?.trim() || '';
          const creator = await loadClientForOrder(userId);
          await qrCodeService.generateDeliveryQRCode(
            orderId,
            `CMD-${orderId.substring(0, 8).toUpperCase()}`,
            recipientName,
            recipientPhone,
            creator.name || 'Client B2B'
          );
        } catch (qrErr: any) {
          logger.warn('[orders/record] Échec génération QR B2B', {
            orderId,
            message: qrErr?.message,
          });
        }

        // Incrémenter le quota mensuel
        await incrementPartnerUsage(partner_id);

        if (notifyDrivers === true) {
          await notifyB2BDrivers(req, {
            orderId,
            userId,
            pickup,
            dropoff,
            method,
            priceCfa: serverPrice,
            distanceKm: effectiveDistanceKm,
            recipient,
            notes: typeof notes === 'string' && notes.trim() ? notes.trim() : undefined,
            preferredDriverId:
              typeof preferred_driver_id === 'string' && preferred_driver_id.trim()
                ? preferred_driver_id.trim()
                : null,
          });
        }

        logOrderRecord('info', 'b2b_commission_applied', { orderId, partner_id, rate: commission.rate, type: commission.type });
      } catch (b2bErr) {
        logger.warn('[orders/record] b2b commission non bloquante', b2bErr);
      }
    }

    res.json({
      success: true,
      data: {
        orderId,
        priceCfa: serverPrice,
        distanceKm: effectiveDistanceKm,
        dynamicPricing: {
          labels: dynamic.labels,
          contextFactorApplied: dynamic.contextFactorApplied,
        },
        ...(b2bCommission ? { b2bCommission } : {}),
      },
    });
  } catch (e: unknown) {
    logOrderRecord('warn', 'unexpected_error', {
      message: e instanceof Error ? e.message : String(e),
    });
    logger.error('createOrderRecord inattendu', e);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur',
    });
  }
};
