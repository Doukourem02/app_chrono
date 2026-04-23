import { Request, Response } from 'express';
import pool from '../config/db.js';
import qrCodeService from '../services/qrCodeService.js';
import {
  getWebPushPublicKey,
  isTrackWebPushConfigured,
  saveTrackPushSubscription,
} from '../services/trackWebPushService.js';
import logger from '../utils/logger.js';
import {
  clientHeadline,
  normalizeProductStatus,
  orderStatusDefinition,
  progressWithEtaCap,
  statusBaseProgress,
} from '../utils/orderProductRules.js';

type PublicCoordinates = { latitude: number; longitude: number };

function toPublicCoordinates(value: unknown): PublicCoordinates | null {
  const record = value as Record<string, unknown> | null | undefined;
  const coords = (record?.coordinates || record) as Record<string, unknown> | null | undefined;
  if (!coords) return null;
  const latitude = typeof coords.latitude === 'number' ? coords.latitude : Number(coords.latitude ?? coords.lat);
  const longitude = typeof coords.longitude === 'number' ? coords.longitude : Number(coords.longitude ?? coords.lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude };
}

function calculateDistanceMeters(a: PublicCoordinates, b: PublicCoordinates): number {
  const toRad = (degrees: number) => (degrees * Math.PI) / 180;
  const earthRadiusMeters = 6371000;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const rLat1 = toRad(a.latitude);
  const rLat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(rLat1) * Math.cos(rLat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function etaLabelForTrack(
  status: string,
  driver: PublicCoordinates | null,
  pickup: unknown,
  dropoff: unknown,
  deliveryMethod: string | null
): string {
  const normalized = normalizeProductStatus(status) ?? status;
  if (normalized === 'pending') return '';
  if (normalized === 'in_progress') return '1 min';
  if (normalized === 'completed' || normalized === 'cancelled' || normalized === 'declined') return '';

  const etaMode = orderStatusDefinition(normalized).etaMode;
  const target =
    etaMode === 'pickup'
      ? toPublicCoordinates(pickup)
      : etaMode === 'dropoff'
        ? toPublicCoordinates(dropoff)
        : null;
  if (!driver || !target) return '';

  const distanceMeters = calculateDistanceMeters(driver, target);
  const method = (deliveryMethod || '').trim().toLowerCase();
  const speedKmh = method === 'moto' ? 35 : method === 'cargo' ? 25 : 30;
  const minutes = Math.max(1, Math.ceil((distanceMeters / 1000 / speedKmh) * 60));
  return `${minutes} min`;
}

/**
 * Suivi public d'une commande par token (sans authentification)
 * GET /api/track/:token
 * Utilisé par le destinataire qui n'a pas de compte Chrono
 */
export const getTrackByToken = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.params;
    if (!token) {
      res.status(400).json({ success: false, message: 'Token requis' });
      return;
    }

    const orderResult = await (pool as any).query(
      `SELECT 
        o.id,
        o.status,
        o.driver_id,
        o.pickup_address,
        o.dropoff_address,
        o.price_cfa,
        o.delivery_method,
        o.distance_km,
        o.created_at,
        o.delivery_qr_scanned_at,
        d.first_name as driver_first_name,
        d.last_name as driver_last_name,
        d.avatar_url as driver_avatar_url,
        dp.profile_image_url as driver_profile_image_url,
        dp.vehicle_plate as driver_vehicle_plate,
        dp.vehicle_type as driver_vehicle_type,
        dp.current_latitude as driver_lat,
        dp.current_longitude as driver_lng,
        dp.heading_degrees as driver_heading
      FROM orders o
      LEFT JOIN users d ON o.driver_id = d.id
      LEFT JOIN driver_profiles dp ON dp.user_id = o.driver_id
      WHERE o.tracking_token = $1`,
      [token]
    );

    if (!orderResult.rows?.length) {
      res.status(404).json({ success: false, message: 'Lien de suivi invalide ou expiré' });
      return;
    }

    const row = orderResult.rows[0];
    let pickup = row.pickup_address || row.pickup;
    let dropoff = row.dropoff_address || row.dropoff;
    if (typeof pickup === 'string') {
      try {
        pickup = JSON.parse(pickup);
      } catch {
        pickup = { address: '', coordinates: null };
      }
    }
    if (typeof dropoff === 'string') {
      try {
        dropoff = JSON.parse(dropoff);
      } catch {
        dropoff = { address: '', coordinates: null };
      }
    }

    const status = row.status;
    const normalizedStatus = normalizeProductStatus(status) ?? status;
    const driverCoordinates =
      row.driver_lat != null && row.driver_lng != null
        ? { latitude: Number(row.driver_lat), longitude: Number(row.driver_lng) }
        : null;
    const safeDriverCoordinates =
      driverCoordinates &&
      Number.isFinite(driverCoordinates.latitude) &&
      Number.isFinite(driverCoordinates.longitude)
        ? driverCoordinates
        : null;
    const etaLabel = etaLabelForTrack(
      normalizedStatus,
      safeDriverCoordinates,
      pickup,
      dropoff,
      row.delivery_method
    );
    const progress = progressWithEtaCap(normalizedStatus, statusBaseProgress(normalizedStatus), etaLabel);
    const qrNotScanned = !row.delivery_qr_scanned_at;
    // Afficher le QR tant qu'il n'a pas été scanné (même si completed - livreur a cliqué trop tôt)
    const showQRCode =
      ['picked_up', 'delivering'].includes(status) ||
      (status === 'completed' && qrNotScanned);
    let qrCodeImage: string | null = null;

    if (showQRCode) {
      const qr = await qrCodeService.getOrderQRCode(row.id);
      qrCodeImage = qr?.qrCodeImage ?? null;
    }

    const driverName =
      row.driver_first_name || row.driver_last_name
        ? [row.driver_first_name, row.driver_last_name].filter(Boolean).join(' ')
        : null;

    res.json({
      success: true,
      data: {
        id: row.id,
        status: normalizedStatus,
        phase: orderStatusDefinition(normalizedStatus).phase,
        statusLabel: etaLabel
          ? clientHeadline(normalizedStatus, etaLabel)
          : orderStatusDefinition(normalizedStatus).recipientLabel,
        etaLabel,
        progress,
        pickup: {
          address: pickup?.address || '',
          coordinates: pickup?.coordinates || null,
        },
        dropoff: {
          address: dropoff?.address || '',
          coordinates: dropoff?.coordinates || null,
        },
        driver: row.driver_id
          ? {
              id: row.driver_id,
              name: driverName,
              avatarUrl: row.driver_avatar_url || row.driver_profile_image_url || null,
              vehiclePlate: row.driver_vehicle_plate || null,
              vehicleType: row.driver_vehicle_type || null,
              latitude: safeDriverCoordinates?.latitude ?? null,
              longitude: safeDriverCoordinates?.longitude ?? null,
              heading: (() => {
                const h = row.driver_heading;
                if (h == null || h === '') return null;
                const n = Number(h);
                return Number.isFinite(n) ? n : null;
              })(),
            }
          : null,
        price: row.price_cfa != null ? Number(row.price_cfa) : null,
        deliveryMethod: row.delivery_method,
        distance: row.distance_km != null ? Number(row.distance_km) : null,
        createdAt: row.created_at,
        qrCodeImage,
        showQRCode,
        webPushAvailable: isTrackWebPushConfigured(),
      },
    });
  } catch (error: any) {
    logger.error('Erreur getTrackByToken:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

/**
 * GET /api/track/:token/vapid-public-key — clé publique VAPID (si Web Push configuré).
 */
export const getTrackVapidPublicKey = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.params;
    if (!token) {
      res.status(400).json({ success: false, message: 'Token requis' });
      return;
    }
    if (!isTrackWebPushConfigured()) {
      res.status(503).json({ success: false, message: 'Notifications navigateur non disponibles' });
      return;
    }
    const check = await pool.query(`SELECT 1 FROM orders WHERE tracking_token = $1 LIMIT 1`, [
      token,
    ]);
    if (!check.rows.length) {
      res.status(404).json({ success: false, message: 'Lien de suivi invalide ou expiré' });
      return;
    }
    const publicKey = getWebPushPublicKey();
    if (!publicKey) {
      res.status(503).json({ success: false, message: 'Web Push non configuré' });
      return;
    }
    res.json({ success: true, publicKey });
  } catch (error: any) {
    logger.error('Erreur getTrackVapidPublicKey:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

function isValidPushSubscription(
  body: unknown
): body is { endpoint: string; keys: { p256dh: string; auth: string } } {
  if (!body || typeof body !== 'object') return false;
  const b = body as Record<string, unknown>;
  if (typeof b.endpoint !== 'string' || !b.keys || typeof b.keys !== 'object') return false;
  const k = b.keys as Record<string, unknown>;
  return typeof k.p256dh === 'string' && typeof k.auth === 'string';
}

/**
 * POST /api/track/:token/push-subscribe — enregistre un abonnement Web Push pour ce lien.
 */
export const postTrackPushSubscribe = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.params;
    if (!token) {
      res.status(400).json({ success: false, message: 'Token requis' });
      return;
    }
    if (!isTrackWebPushConfigured()) {
      res.status(503).json({ success: false, message: 'Web Push non configuré' });
      return;
    }
    const check = await pool.query(`SELECT 1 FROM orders WHERE tracking_token = $1 LIMIT 1`, [
      token,
    ]);
    if (!check.rows.length) {
      res.status(404).json({ success: false, message: 'Lien de suivi invalide ou expiré' });
      return;
    }
    if (!isValidPushSubscription(req.body)) {
      res.status(400).json({ success: false, message: 'Subscription push invalide' });
      return;
    }
    await saveTrackPushSubscription(token, req.body);
    res.status(201).json({ success: true });
  } catch (error: any) {
    logger.error('Erreur postTrackPushSubscribe:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};
