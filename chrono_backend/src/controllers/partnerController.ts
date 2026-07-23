import { Request, Response } from 'express';
import pool from '../config/db.js';
import logger from '../utils/logger.js';
import qrCodeService from '../services/qrCodeService.js';
import {
  clientHeadline,
  normalizeProductStatus,
  orderStatusDefinition,
  progressWithEtaCap,
  statusBaseProgress,
} from '../utils/orderProductRules.js';
import {
  parseLocationField,
  partnerRecipientFromOrder,
  partnerCreatorName,
  toPartnerTrackingCoordinates,
  etaLabelForPartnerTracking,
} from './partnerControllerUtils.js';

export const getPartnerOrderTracking = async (req: Request, res: Response): Promise<void> => {
  const partnerId = (req as any).partnerUser?.partnerId ?? req.params.partnerId;
  const { orderId } = req.params;

  if (!partnerId || !orderId) {
    res.status(400).json({ success: false, message: 'partnerId et orderId requis' });
    return;
  }

  try {
    const result = await pool.query(
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
        o.updated_at,
        o.recipient,
        o.delivery_qr_scanned_at,
        d.first_name as driver_first_name,
        d.last_name as driver_last_name,
        d.phone as driver_phone,
        d.avatar_url as driver_avatar_url,
        dp.profile_image_url as driver_profile_image_url,
        dp.vehicle_plate as driver_vehicle_plate,
        dp.vehicle_type as driver_vehicle_type,
        dp.current_latitude as driver_lat,
        dp.current_longitude as driver_lng,
        dp.heading_degrees as driver_heading,
        latest_proof.qr_code_type as delivery_proof_method,
        latest_proof.scanned_at as delivery_proof_validated_at
      FROM orders o
      LEFT JOIN users d ON o.driver_id = d.id
      LEFT JOIN driver_profiles dp ON dp.user_id = o.driver_id
      LEFT JOIN LATERAL (
        SELECT qr_code_type, scanned_at
        FROM qr_code_scans
        WHERE order_id = o.id AND is_valid = true
        ORDER BY scanned_at DESC
        LIMIT 1
      ) latest_proof ON true
      WHERE o.id = $1 AND o.partner_id = $2
      LIMIT 1`,
      [orderId, partnerId]
    );

    if (!result.rows?.length) {
      res.status(404).json({ success: false, message: 'Commande introuvable pour ce partenaire' });
      return;
    }

    const row = result.rows[0];
    const pickup = parseLocationField(row.pickup_address);
    const dropoff = parseLocationField(row.dropoff_address);
    const recipient = parseLocationField(row.recipient);
    const status = normalizeProductStatus(row.status) ?? row.status;
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
    const etaLabel = etaLabelForPartnerTracking(
      status,
      safeDriverCoordinates,
      pickup,
      dropoff,
      row.delivery_method
    );
    const progress = progressWithEtaCap(status, statusBaseProgress(status), etaLabel);
    const driverName =
      row.driver_first_name || row.driver_last_name
        ? [row.driver_first_name, row.driver_last_name].filter(Boolean).join(' ')
        : null;

    res.json({
      success: true,
      data: {
        id: row.id,
        status,
        phase: orderStatusDefinition(status).phase,
        statusLabel: etaLabel ? clientHeadline(status, etaLabel) : orderStatusDefinition(status).clientLabel,
        etaLabel,
        progress,
        pickup: {
          name: pickup.name || pickup.label || 'Point de collecte',
          address: pickup.address || pickup.formatted_address || pickup.street || '',
          coordinates: toPartnerTrackingCoordinates(pickup),
        },
        dropoff: {
          name: dropoff.name || dropoff.label || recipient.name || 'Destination',
          address: dropoff.address || dropoff.formatted_address || dropoff.street || '',
          coordinates: toPartnerTrackingCoordinates(dropoff),
        },
        recipient: {
          name: recipient.name || recipient.fullName || null,
          phone: recipient.phone || null,
        },
        driver: row.driver_id
          ? {
              id: row.driver_id,
              name: driverName,
              phone: row.driver_phone || null,
              avatarUrl: row.driver_avatar_url || row.driver_profile_image_url || null,
              vehiclePlate: row.driver_vehicle_plate || null,
              vehicleType: row.driver_vehicle_type || null,
              latitude: safeDriverCoordinates?.latitude ?? null,
              longitude: safeDriverCoordinates?.longitude ?? null,
              heading: (() => {
                const heading = row.driver_heading;
                if (heading == null || heading === '') return null;
                const n = Number(heading);
                return Number.isFinite(n) ? n : null;
              })(),
            }
          : null,
        price: row.price_cfa != null ? Number(row.price_cfa) : null,
        deliveryMethod: row.delivery_method,
        distance: row.distance_km != null ? Number(row.distance_km) : null,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        proof: {
          method: row.delivery_proof_method || null,
          validatedAt: row.delivery_proof_validated_at || row.delivery_qr_scanned_at || null,
        },
      },
    });
  } catch (error: any) {
    logger.error('[partnerController] getPartnerOrderTracking error:', error);
    res.status(500).json({ success: false, message: 'Erreur lors du chargement du suivi partenaire' });
  }
};

export const getPartnerOrderQRCode = async (req: Request, res: Response): Promise<void> => {
  const partnerId = (req as any).partnerUser?.partnerId ?? req.params.partnerId;
  const { orderId } = req.params;

  if (!partnerId || !orderId) {
    res.status(400).json({ success: false, message: 'partnerId et orderId requis' });
    return;
  }

  try {
    const result = await pool.query(
      `SELECT
         o.id,
         o.status,
         o.recipient,
         o.dropoff_address,
         o.delivery_qr_code,
         o.delivery_verification_code,
         o.delivery_qr_scanned_at,
         u.first_name as creator_first_name,
         u.last_name as creator_last_name,
         u.email as creator_email
       FROM orders o
       LEFT JOIN users u ON u.id = o.user_id
       WHERE o.id = $1 AND o.partner_id = $2
       LIMIT 1`,
      [orderId, partnerId]
    );

    if (!result.rows?.length) {
      res.status(404).json({ success: false, message: 'Commande introuvable pour ce partenaire' });
      return;
    }

    const row = result.rows[0];
    const status = normalizeProductStatus(row.status) ?? row.status;
    const alreadyValidated = Boolean(row.delivery_qr_scanned_at);
    const canShowQRCode =
      !alreadyValidated && ['picked_up', 'delivering'].includes(String(status || '').toLowerCase());

    if (!canShowQRCode) {
      res.json({
        success: true,
        data: {
          orderId: row.id,
          orderNumber: `CMD-${String(row.id).substring(0, 8).toUpperCase()}`,
          status,
          showQRCode: false,
          proofAlreadyValidated: alreadyValidated,
          qrCodeImage: null,
          verificationCode: null,
          message: alreadyValidated
            ? 'La preuve de livraison a déjà été validée.'
            : 'Le QR code sera disponible après le ramassage du colis.',
        },
      });
      return;
    }

    let qr = await qrCodeService.getOrderQRCode(row.id);
    if (!qr || !qr.verificationCode) {
      const recipient = partnerRecipientFromOrder(row);
      qr = await qrCodeService.generateDeliveryQRCode(
        row.id,
        `CMD-${String(row.id).substring(0, 8).toUpperCase()}`,
        recipient.name,
        recipient.phone,
        partnerCreatorName(row)
      );
    }

    res.json({
      success: true,
      data: {
        orderId: row.id,
        orderNumber: qr.qrCodeData.orderNumber,
        status,
        showQRCode: true,
        proofAlreadyValidated: false,
        qrCodeImage: qr.qrCodeImage,
        verificationCode: qr.verificationCode ?? null,
        expiresAt: qr.qrCodeData.expiresAt,
      },
    });
  } catch (error: any) {
    logger.error('[partnerController] getPartnerOrderQRCode error:', error);
    res.status(500).json({ success: false, message: 'Erreur lors du chargement du QR de livraison' });
  }
};
