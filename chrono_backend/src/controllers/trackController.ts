import { Request, Response } from 'express';
import pool from '../config/db.js';
import qrCodeService from '../services/qrCodeService.js';
import logger from '../utils/logger.js';

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
        dp.current_latitude as driver_lat,
        dp.current_longitude as driver_lng
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
        status,
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
              latitude: row.driver_lat != null ? Number(row.driver_lat) : null,
              longitude: row.driver_lng != null ? Number(row.driver_lng) : null,
            }
          : null,
        price: row.price_cfa != null ? Number(row.price_cfa) : null,
        deliveryMethod: row.delivery_method,
        distance: row.distance_km != null ? Number(row.distance_km) : null,
        createdAt: row.created_at,
        qrCodeImage,
        showQRCode,
      },
    });
  } catch (error: any) {
    logger.error('Erreur getTrackByToken:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};
