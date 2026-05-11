import { Request, Response } from 'express';
import { Server as SocketIOServer } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import pool from '../config/db.js';
import { supabaseAdmin } from '../config/supabase.js';
import { saveOrder, generateAndSaveTrackingToken } from '../config/orderStorage.js';
import qrCodeService from '../services/qrCodeService.js';
import { broadcastOrderUpdateToAdmins } from '../sockets/adminSocket.js';
import { activeOrders, connectedUsers, notifyDriversForOrder } from '../sockets/orderSocket.js';
import { formatDeliveryId } from '../utils/formatDeliveryId.js';
import { geocodeAddress } from '../utils/geocodeService.js';
import logger from '../utils/logger.js';
import { resolveApproximatePickupZone } from '../utils/abidjanApproximatePickupZones.js';
import { formatEtaMinutes, realisticEtaMinutesFromRoute } from '../utils/ivoryCoastEta.js';
import { computeDynamicDeliveryPrice } from '../services/dynamicPricing.js';
import { haversineDistanceKm } from '../services/priceCalculator.js';
import { isUsableLatLon, positiveNumber, DeliveryCodeSmsStatus, sendAdminOrderDeliveryCodeSms } from './adminControllerUtils.js';

export const getAdminOngoingDeliveries = async (req: Request, res: Response): Promise<void> => {
  try {
    logger.info('🚀 [getAdminOngoingDeliveries] DÉBUT');

    const ongoingStatuses = ['pending', 'accepted', 'enroute', 'in_progress', 'picked_up', 'delivering'];

    let rows: any[] = [];
    let usedFallback = false;

    if (process.env.DATABASE_URL) {
      const query = `SELECT * FROM orders
                     WHERE status IN ('pending', 'accepted', 'enroute', 'in_progress', 'picked_up', 'delivering')
                     ORDER BY created_at DESC`;
      try {
        const result = await (pool as any).query(query);
        rows = result.rows || [];
        logger.info(`[getAdminOngoingDeliveries] Pool: ${rows.length} lignes récupérées`);
      } catch (queryError: any) {
        logger.error('[getAdminOngoingDeliveries] Erreur pool SQL:', queryError);
      }
    } else {
      logger.warn('DATABASE_URL non configuré, tentative via Supabase');
    }

    if (rows.length === 0 && supabaseAdmin) {
      logger.info('[getAdminOngoingDeliveries] Fallback Supabase (pool vide ou indisponible)');
      usedFallback = true;
      try {
        const { data: supabaseRows, error: supabaseError } = await supabaseAdmin
          .from('orders')
          .select('*')
          .in('status', ongoingStatuses)
          .order('created_at', { ascending: false });

        if (supabaseError) {
          logger.error('[getAdminOngoingDeliveries] Erreur Supabase fallback:', supabaseError.message);
        } else {
          rows = supabaseRows || [];
        }
      } catch (supabaseErr: any) {
        logger.error('[getAdminOngoingDeliveries] Exception Supabase fallback:', supabaseErr);
      }
    }

    const parseJsonField = (field: any): any => {
      if (!field) return null;
      if (typeof field === 'string') {
        try { return JSON.parse(field); } catch { return field; }
      }
      return field;
    };

    const userIds = [...new Set(rows.map((o: any) => o.user_id).filter(Boolean))];
    const driverIds = [...new Set(rows.map((o: any) => o.driver_id).filter(Boolean))];

    let usersMap = new Map();
    let driversMap = new Map();

    if (userIds.length > 0) {
      try {
        if (!usedFallback) {
          const usersResult = await (pool as any).query(
            `SELECT id, email, phone, first_name, last_name, avatar_url, role FROM users WHERE id = ANY($1)`,
            [userIds]
          );
          usersResult.rows.forEach((user: any) => {
            const full_name = (user.first_name && user.last_name)
              ? `${user.first_name} ${user.last_name}`
              : (user.first_name || user.last_name || null);
            usersMap.set(user.id, { ...user, full_name });
          });
        } else if (supabaseAdmin) {
          const { data: supabaseUsers } = await supabaseAdmin
            .from('users')
            .select('id, email, phone, first_name, last_name, avatar_url, role')
            .in('id', userIds);
          (supabaseUsers || []).forEach((user: any) => {
            const full_name = (user.first_name && user.last_name)
              ? `${user.first_name} ${user.last_name}`
              : (user.first_name || user.last_name || null);
            usersMap.set(user.id, { ...user, full_name });
          });
        }
      } catch (usersError) {
        logger.warn('Erreur lors de la récupération des utilisateurs:', usersError);
      }
    }

    if (driverIds.length > 0) {
      try {
        if (!usedFallback) {
          const driversResult = await (pool as any).query(
            `SELECT id, email, phone, first_name, last_name, avatar_url, role FROM users WHERE id = ANY($1)`,
            [driverIds]
          );
          driversResult.rows.forEach((driver: any) => {
            const full_name = (driver.first_name && driver.last_name)
              ? `${driver.first_name} ${driver.last_name}`
              : (driver.first_name || driver.last_name || null);
            driversMap.set(driver.id, { ...driver, full_name });
          });
        } else if (supabaseAdmin) {
          const { data: supabaseDrivers } = await supabaseAdmin
            .from('users')
            .select('id, email, phone, first_name, last_name, avatar_url, role')
            .in('id', driverIds);
          (supabaseDrivers || []).forEach((driver: any) => {
            const full_name = (driver.first_name && driver.last_name)
              ? `${driver.first_name} ${driver.last_name}`
              : (driver.first_name || driver.last_name || null);
            driversMap.set(driver.id, { ...driver, full_name });
          });
        }
      } catch (driversError) {
        logger.warn('Erreur lors de la récupération des drivers:', driversError);
      }
    }

    const formatted = rows.map((order: any) => {
      const pickup = parseJsonField(order.pickup_address || order.pickup);
      const dropoff = parseJsonField(order.dropoff_address || order.dropoff);
      const shipmentNumber = formatDeliveryId(order.id, order.created_at);

      let pickupCoords: { lat: number; lng: number } | null = null;
      if (pickup?.coordinates) {
        if (pickup.coordinates.latitude && pickup.coordinates.longitude) {
          pickupCoords = { lat: pickup.coordinates.latitude, lng: pickup.coordinates.longitude };
        } else if (pickup.coordinates.lat && pickup.coordinates.lng) {
          pickupCoords = { lat: pickup.coordinates.lat, lng: pickup.coordinates.lng };
        }
      } else if (pickup?.latitude && pickup?.longitude) {
        pickupCoords = { lat: pickup.latitude, lng: pickup.longitude };
      }

      let dropoffCoords: { lat: number; lng: number } | null = null;
      if (dropoff?.coordinates) {
        if (dropoff.coordinates.latitude && dropoff.coordinates.longitude) {
          dropoffCoords = { lat: dropoff.coordinates.latitude, lng: dropoff.coordinates.longitude };
        } else if (dropoff.coordinates.lat && dropoff.coordinates.lng) {
          dropoffCoords = { lat: dropoff.coordinates.lat, lng: dropoff.coordinates.lng };
        }
      } else if (dropoff?.latitude && dropoff?.longitude) {
        dropoffCoords = { lat: dropoff.latitude, lng: dropoff.longitude };
      }

      const client = order.user_id ? usersMap.get(order.user_id) : null;
      const driver = order.driver_id ? driversMap.get(order.driver_id) : null;

      return {
        id: order.id,
        shipmentNumber,
        type: 'Orders',
        status: order.status,
        pickup: {
          name: pickup?.name || pickup?.address || pickup?.formatted_address || 'Adresse inconnue',
          address: pickup?.address || pickup?.formatted_address || pickup?.street || 'Adresse inconnue',
          coordinates: pickupCoords,
        },
        dropoff: {
          name: dropoff?.name || dropoff?.address || dropoff?.formatted_address || 'Adresse inconnue',
          address: dropoff?.address || dropoff?.formatted_address || dropoff?.street || 'Adresse inconnue',
          coordinates: dropoffCoords,
        },
        driverId: order.driver_id,
        userId: order.user_id,
        createdAt: order.created_at,
        client: client ? { id: client.id, email: client.email, full_name: client.full_name, phone: client.phone, avatar_url: client.avatar_url } : null,
        driver: driver ? { id: driver.id, email: driver.email, full_name: driver.full_name, phone: driver.phone, avatar_url: driver.avatar_url } : null,
      };
    });

    res.json({ success: true, data: formatted });
  } catch (error: any) {
    logger.error('Erreur getAdminOngoingDeliveries:', error);

    const isConnectionError = error.message && (
      error.message.includes('SASL') || error.message.includes('password') ||
      error.message.includes('ENOTFOUND') || error.message.includes('getaddrinfo') ||
      error.message.includes('ECONNREFUSED') || error.message.includes('ETIMEDOUT') ||
      error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT'
    );

    if (isConnectionError) {
      logger.warn('Erreur de connexion DB, retour de données vides');
      res.json({ success: true, data: [] });
      return;
    }

    res.status(500).json({ success: false, message: 'Erreur serveur', error: error.message });
  }
};

export const getAdminOrdersByStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const status = req.query.status as string | undefined;
    logger.info('🚀 [getAdminOrdersByStatus] DÉBUT, status:', status);

    const emptyCountsResponse = {
      success: true,
      data: [],
      counts: {
        all: 0, onProgress: 0, successful: 0, onHold: 0, canceled: 0,
        changes: { all: 0, onProgress: 0, successful: 0, onHold: 0, canceled: 0 },
      },
    };

    if (!process.env.DATABASE_URL) {
      logger.warn('DATABASE_URL non configuré pour getAdminOrdersByStatus');
      res.json(emptyCountsResponse);
      return;
    }

    const onProgressStatuses = ['accepted', 'enroute', 'in_progress', 'picked_up', 'delivering'];
    const onHoldStatuses = ['pending', 'declined'];

    const statusMap: Record<string, string[]> = {
      all: [],
      onProgress: onProgressStatuses,
      successful: ['completed'],
      onHold: onHoldStatuses,
      canceled: ['cancelled'],
    };

    const statusesToFilter = status && statusMap[status] ? statusMap[status] : [];

    let query = `SELECT o.*,
      d.first_name as driver_first_name, d.last_name as driver_last_name,
      u.first_name as client_first_name, u.last_name as client_last_name
    FROM orders o
    LEFT JOIN users d ON o.driver_id = d.id
    LEFT JOIN users u ON o.user_id = u.id`;
    const queryParams: any[] = [];

    if (statusesToFilter.length > 0) {
      query += ` WHERE o.status = ANY($1)`;
      queryParams.push(statusesToFilter);
    }

    query += ' ORDER BY o.created_at DESC LIMIT 2000';

    let result;
    try {
      result = await (pool as any).query(query, queryParams);
    } catch (queryError: any) {
      logger.error('[getAdminOrdersByStatus] Erreur lors de la requête SQL:', queryError);
      throw queryError;
    }

    const now = new Date();
    const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    const formatStatusList = (statuses: string[]) => statuses.map((s) => `'${s}'`).join(', ');

    const countsQuery = `
      SELECT
        COUNT(*) FILTER (WHERE status IN (${formatStatusList(onProgressStatuses)}) AND created_at >= $1) as onProgress,
        COUNT(*) FILTER (WHERE status = 'completed' AND created_at >= $1) as successful,
        COUNT(*) FILTER (WHERE status IN (${formatStatusList(onHoldStatuses)}) AND created_at >= $1) as onHold,
        COUNT(*) FILTER (WHERE status = 'cancelled' AND created_at >= $1) as canceled,
        COUNT(*) FILTER (WHERE created_at >= $1) as all,
        COUNT(*) FILTER (WHERE status IN (${formatStatusList(onProgressStatuses)}) AND created_at >= $2 AND created_at < $3) as onProgressLastMonth,
        COUNT(*) FILTER (WHERE status = 'completed' AND created_at >= $2 AND created_at < $3) as successfulLastMonth,
        COUNT(*) FILTER (WHERE status IN (${formatStatusList(onHoldStatuses)}) AND created_at >= $2 AND created_at < $3) as onHoldLastMonth,
        COUNT(*) FILTER (WHERE status = 'cancelled' AND created_at >= $2 AND created_at < $3) as canceledLastMonth,
        COUNT(*) FILTER (WHERE created_at >= $2 AND created_at < $3) as allLastMonth
      FROM orders
    `;

    let countsResult;
    try {
      countsResult = await (pool as any).query(countsQuery, [
        startOfCurrentMonth.toISOString(),
        startOfLastMonth.toISOString(),
        endOfLastMonth.toISOString(),
      ]);
    } catch (countsError: any) {
      logger.error('[getAdminOrdersByStatus] Erreur lors de la requête de comptage:', countsError);
      countsResult = { rows: [{ onProgress: 0, successful: 0, onHold: 0, canceled: 0, all: 0, onProgressLastMonth: 0, successfulLastMonth: 0, onHoldLastMonth: 0, canceledLastMonth: 0, allLastMonth: 0 }] };
    }

    const row = countsResult.rows[0] || {};
    const onProgress = parseInt(row.onProgress || '0');
    const successful = parseInt(row.successful || '0');
    const onHold = parseInt(row.onHold || '0');
    const canceled = parseInt(row.canceled || '0');
    const all = parseInt(row.all || '0');

    const calculateChange = (current: number, last: number): number => {
      if (last === 0) return current > 0 ? 100 : 0;
      return Math.round(((current - last) / last) * 100);
    };

    const counts = {
      all,
      onProgress,
      successful,
      onHold,
      canceled,
      changes: {
        all: calculateChange(all, parseInt(row.allLastMonth || '0')),
        onProgress: calculateChange(onProgress, parseInt(row.onProgressLastMonth || '0')),
        successful: calculateChange(successful, parseInt(row.successfulLastMonth || '0')),
        onHold: calculateChange(onHold, parseInt(row.onHoldLastMonth || '0')),
        canceled: calculateChange(canceled, parseInt(row.canceledLastMonth || '0')),
      },
    };

    const parseJsonField = (field: any): any => {
      if (!field) return null;
      if (typeof field === 'string') {
        try { return JSON.parse(field); } catch { return field; }
      }
      return field;
    };

    const formatted = result.rows.map((order: any) => {
      const pickup = parseJsonField(order.pickup_address || order.pickup);
      const dropoff = parseJsonField(order.dropoff_address || order.dropoff);
      const deliveryId = formatDeliveryId(order.id, order.created_at);

      return {
        id: order.id,
        deliveryId,
        date: new Date(order.created_at).toLocaleDateString('fr-FR', {
          day: '2-digit', month: '2-digit', year: 'numeric',
        }),
        departure: pickup?.address || pickup?.formatted_address || pickup?.name || pickup?.street || 'Adresse inconnue',
        destination: dropoff?.address || dropoff?.formatted_address || dropoff?.name || dropoff?.street || 'Adresse inconnue',
        status: order.status,
        delivery_qr_scanned_at: order.delivery_qr_scanned_at,
        clientName: [order.client_first_name, order.client_last_name].filter(Boolean).join(' ') || null,
        driverName: [order.driver_first_name, order.driver_last_name].filter(Boolean).join(' ') || null,
        price: order.price_cfa ?? order.price ?? null,
        is_phone_order: order.is_phone_order ?? false,
        is_b2b_order: order.is_b2b_order ?? false,
      };
    });

    res.json({ success: true, data: formatted, counts });
  } catch (error: any) {
    logger.error('Erreur getAdminOrdersByStatus:', error);

    if (error.message && (error.message.includes('SASL') || error.message.includes('password'))) {
      res.json({
        success: true,
        data: [],
        counts: {
          all: 0, onProgress: 0, successful: 0, onHold: 0, canceled: 0,
          changes: { all: 0, onProgress: 0, successful: 0, onHold: 0, canceled: 0 },
        },
      });
      return;
    }

    res.status(500).json({ success: false, message: 'Erreur serveur', error: error.message });
  }
};

export const getAdminOrderById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { orderId } = req.params;
    if (!orderId) {
      res.status(400).json({ success: false, message: 'orderId requis' });
      return;
    }

    const result = await (pool as any).query(
      `SELECT
        o.*,
        d.first_name as driver_first_name, d.last_name as driver_last_name,
        d.phone as driver_phone, d.email as driver_email,
        u.first_name as client_first_name, u.last_name as client_last_name,
        u.phone as client_phone, u.email as client_email,
        scanned_by_u.first_name as scanned_by_first_name,
        scanned_by_u.last_name as scanned_by_last_name,
        latest_proof.qr_code_type as delivery_proof_method,
        latest_proof.location as delivery_proof_location,
        latest_proof.device_info as delivery_proof_metadata
      FROM orders o
      LEFT JOIN users d ON o.driver_id = d.id
      LEFT JOIN users u ON o.user_id = u.id
      LEFT JOIN users scanned_by_u ON o.delivery_qr_scanned_by = scanned_by_u.id
      LEFT JOIN LATERAL (
        SELECT qr_code_type, location, device_info
        FROM qr_code_scans
        WHERE order_id = o.id AND is_valid = true
        ORDER BY scanned_at DESC LIMIT 1
      ) latest_proof ON true
      WHERE o.id = $1`,
      [orderId]
    );

    if (!result.rows?.length) {
      res.status(404).json({ success: false, message: 'Commande introuvable' });
      return;
    }

    const order = result.rows[0];
    const parseJsonField = (field: any): any => {
      if (!field) return null;
      if (typeof field === 'string') {
        try { return JSON.parse(field); } catch { return field; }
      }
      return field;
    };

    const pickup = parseJsonField(order.pickup_address || order.pickup);
    const dropoff = parseJsonField(order.dropoff_address || order.dropoff);

    res.json({
      success: true,
      data: {
        id: order.id,
        deliveryId: formatDeliveryId(order.id, order.created_at),
        status: order.status,
        createdAt: order.created_at,
        completedAt: order.completed_at,
        departure: pickup?.address || pickup?.formatted_address || pickup?.name || pickup?.street || 'Adresse inconnue',
        destination: dropoff?.address || dropoff?.formatted_address || dropoff?.name || dropoff?.street || 'Adresse inconnue',
        price: order.price_cfa ?? order.price,
        deliveryMethod: order.delivery_method,
        distance: order.distance_km,
        delivery_qr_scanned_at: order.delivery_qr_scanned_at,
        delivery_proof_method: order.delivery_proof_method || null,
        delivery_proof_location: parseJsonField(order.delivery_proof_location),
        delivery_proof_metadata: parseJsonField(order.delivery_proof_metadata),
        delivery_qr_scanned_by: order.delivery_qr_scanned_by
          ? {
              id: order.delivery_qr_scanned_by,
              name: [order.scanned_by_first_name, order.scanned_by_last_name].filter(Boolean).join(' ') || order.delivery_qr_scanned_by,
            }
          : null,
        driver: order.driver_id
          ? {
              id: order.driver_id,
              name: [order.driver_first_name, order.driver_last_name].filter(Boolean).join(' ') || 'Livreur',
              phone: order.driver_phone,
              email: order.driver_email,
            }
          : null,
        client: order.user_id
          ? {
              id: order.user_id,
              name: [order.client_first_name, order.client_last_name].filter(Boolean).join(' ') || 'Client',
              phone: order.client_phone,
              email: order.client_email,
            }
          : null,
      },
    });
  } catch (error: any) {
    logger.error('Erreur getAdminOrderById:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur', error: error.message });
  }
};

export const getAdminOrderQRScans = async (req: Request, res: Response): Promise<void> => {
  try {
    const { orderId } = req.params;
    if (!orderId) {
      res.status(400).json({ success: false, message: 'orderId requis' });
      return;
    }

    const history = await qrCodeService.getScanHistory(orderId);
    res.json({ success: true, data: history });
  } catch (error: any) {
    logger.error('Erreur getAdminOrderQRScans:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur', error: error.message });
  }
};

export const createAdminOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const adminUser = (req as any).user;
    if (!adminUser || (adminUser.role !== 'admin' && adminUser.role !== 'super_admin')) {
      res.status(403).json({ success: false, message: 'Accès refusé - Rôle admin requis' });
      return;
    }

    const {
      userId, pickup, dropoff, deliveryMethod, paymentMethodType,
      distance, price, notes, isPhoneOrder, isB2BOrder, driverNotes,
    } = req.body;

    if (!userId || !pickup || !dropoff || !deliveryMethod) {
      res.status(400).json({
        success: false,
        message: 'Champs obligatoires manquants: userId, pickup, dropoff, deliveryMethod',
      });
      return;
    }

    const isPhoneOrderBool = isPhoneOrder === true;

    if (!isPhoneOrderBool) {
      if (!isUsableLatLon(pickup.coordinates)) {
        res.status(400).json({ success: false, message: 'Coordonnées de pickup manquantes' });
        return;
      }
      if (!isUsableLatLon(dropoff.coordinates)) {
        res.status(400).json({ success: false, message: 'Coordonnées de dropoff manquantes' });
        return;
      }
    }

    const clientResult = await (pool as any).query(
      'SELECT id, email, phone, first_name, last_name, avatar_url FROM users WHERE id = $1 AND role = $2',
      [userId, 'client']
    );

    if (clientResult.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Client non trouvé' });
      return;
    }

    const client = clientResult.rows[0];
    const clientName = client.first_name && client.last_name
      ? `${client.first_name} ${client.last_name}`
      : client.email;

    const recipientPhoneInput =
      typeof dropoff?.details?.phone === 'string' ? dropoff.details.phone.trim() : '';
    if (!recipientPhoneInput) {
      res.status(400).json({
        success: false,
        message: 'Le numéro de téléphone de contact est obligatoire : saisissez-le dans le formulaire (numéro du client pour cette course).',
      });
      return;
    }

    let pickupCoords = isUsableLatLon(pickup.coordinates)
      ? { latitude: pickup.coordinates.latitude, longitude: pickup.coordinates.longitude }
      : null;

    let dropoffCoords = isUsableLatLon(dropoff.coordinates)
      ? { latitude: dropoff.coordinates.latitude, longitude: dropoff.coordinates.longitude }
      : null;

    if (!pickupCoords && pickup.address) {
      logger.info(`[createAdminOrder] Géocodage de l'adresse pickup: ${pickup.address}`);
      const geocoded = await geocodeAddress(pickup.address);
      if (geocoded) {
        pickupCoords = geocoded;
        logger.info(`[createAdminOrder] Pickup géocodé: ${geocoded.latitude}, ${geocoded.longitude}`);
      } else {
        logger.warn(`[createAdminOrder] Échec du géocodage pour pickup: ${pickup.address}`);
      }
    }

    if (!dropoffCoords && dropoff.address) {
      logger.info(`[createAdminOrder] Géocodage de l'adresse dropoff: ${dropoff.address}`);
      const geocoded = await geocodeAddress(dropoff.address);
      if (geocoded) {
        dropoffCoords = geocoded;
        logger.info(`[createAdminOrder] Dropoff géocodé: ${geocoded.latitude}, ${geocoded.longitude}`);
      } else {
        logger.warn(`[createAdminOrder] Échec du géocodage pour dropoff: ${dropoff.address}`);
      }
    }

    let pickupFromApproximateZone: { id: string; labelFr: string } | null = null;
    if (isPhoneOrderBool && !pickupCoords) {
      const rawZone = typeof req.body.approximatePickupZone === 'string' ? req.body.approximatePickupZone : '';
      const resolved = resolveApproximatePickupZone(rawZone);
      if (!resolved) {
        res.status(400).json({
          success: false,
          message: 'Pour une commande téléphonique sans position GPS au retrait, sélectionnez la commune ou zone du client afin de proposer la course aux livreurs à proximité.',
        });
        return;
      }
      pickupCoords = { latitude: resolved.latitude, longitude: resolved.longitude };
      pickupFromApproximateZone = { id: rawZone.trim().toLowerCase(), labelFr: resolved.labelFr };
    }

    const clientDistance = positiveNumber(distance);
    const clientPrice = positiveNumber(price);
    const serverDistance = pickupCoords && dropoffCoords
      ? haversineDistanceKm(pickupCoords, dropoffCoords)
      : clientDistance;

    if (!serverDistance) {
      res.status(400).json({
        success: false,
        message: 'Impossible de calculer la distance: sélectionnez des adresses avec GPS ou renseignez une distance valide.',
      });
      return;
    }

    const dynamic = await computeDynamicDeliveryPrice({
      distanceKm: serverDistance,
      method: deliveryMethod,
      pickupLatitude: pickupCoords?.latitude,
      pickupLongitude: pickupCoords?.longitude,
      isB2BPriority: isB2BOrder === true,
    });
    const serverPrice = dynamic.totalCfa;

    if (clientDistance != null && Math.abs(clientDistance - serverDistance) > 0.05) {
      logger.warn('[createAdminOrder] Écart distance admin/serveur', { clientDistance, serverDistance, deliveryMethod });
    }
    if (clientPrice != null && Math.abs(clientPrice - serverPrice) > 5) {
      logger.warn('[createAdminOrder] Écart prix admin/serveur', { clientPrice, serverPrice, serverDistance, deliveryMethod, labels: dynamic.labels });
    }

    const estimatedDuration = formatEtaMinutes(
      realisticEtaMinutesFromRoute({ distanceMeters: Math.max(0, serverDistance) * 1000, vehicleType: deliveryMethod })
    );

    const orderId = uuidv4();
    const chrono_admin = { placed_by_admin: true, is_phone_order: isPhoneOrderBool, is_b2b_order: isB2BOrder === true };
    const dropoffDetailsMerged: Record<string, unknown> = {
      ...(typeof dropoff.details === 'object' && dropoff.details ? dropoff.details : {}),
      phone: recipientPhoneInput,
    };
    if (typeof notes === 'string' && notes.trim()) {
      dropoffDetailsMerged.operator_course_notes = notes.trim();
    }
    if (typeof driverNotes === 'string' && driverNotes.trim()) {
      dropoffDetailsMerged.driver_notes = driverNotes.trim();
    }

    const order = {
      id: orderId,
      user: {
        id: client.id,
        name: clientName,
        first_name: client.first_name || undefined,
        last_name: client.last_name || undefined,
        phone: client.phone || undefined,
        email: client.email,
        avatar: client.avatar_url || undefined,
        rating: 4.5,
      },
      pickup: {
        address: pickup.address,
        coordinates: pickupCoords || undefined,
        _chrono_admin: chrono_admin,
        ...(pickupFromApproximateZone
          ? {
              approximate_pickup_zone: pickupFromApproximateZone.id,
              approximate_pickup_zone_label: pickupFromApproximateZone.labelFr,
              pickup_coordinates_are_approximate: true,
            }
          : {}),
      },
      dropoff: {
        address: dropoff.address,
        coordinates: dropoffCoords || undefined,
        details: dropoffDetailsMerged,
        _chrono_admin: chrono_admin,
      },
      recipient: { phone: recipientPhoneInput },
      packageImages: [],
      price: serverPrice,
      deliveryMethod,
      distance: Math.round(serverDistance * 100) / 100,
      estimatedDuration,
      status: 'pending',
      createdAt: new Date(),
    };

    (order as any).payment_method_type = paymentMethodType || 'cash';
    (order as any).payment_status = paymentMethodType === 'deferred' ? 'delayed' : 'pending';
    (order as any).payment_payer = 'client';
    if (isPhoneOrderBool) (order as any).is_phone_order = true;
    if (isB2BOrder === true) (order as any).is_b2b_order = true;
    if (typeof notes === 'string' && notes.trim()) (order as any).notes = notes.trim();
    if (typeof driverNotes === 'string' && driverNotes.trim()) (order as any).driver_notes = driverNotes.trim();

    let trackingTokenForRecipient: string | null = null;
    let deliveryVerificationCode: string | null = null;
    let deliveryCodeSmsStatus: DeliveryCodeSmsStatus = { status: 'not_attempted', reason: 'qr_not_generated_yet' };

    try {
      await saveOrder(order);
      logger.info(`[createAdminOrder] Commande ${orderId} créée par admin ${adminUser.id}`);

      try {
        const trackingToken = await generateAndSaveTrackingToken(orderId);
        if (trackingToken) {
          (order as { trackingToken?: string }).trackingToken = trackingToken;
          trackingTokenForRecipient = trackingToken;
        }
        const recipientName = order.recipient?.phone ? `Destinataire (${order.recipient.phone})` : (order.dropoff?.details?.phone ? `Destinataire (${order.dropoff.details.phone})` : 'Destinataire');
        const recipientPhone = order.recipient?.phone || order.dropoff?.details?.phone || '';
        const creatorName = (order.user as any)?.name || 'Client';
        if (recipientPhone) {
          const qr = await qrCodeService.generateDeliveryQRCode(orderId, `CMD-${orderId.substring(0, 8).toUpperCase()}`, recipientName, recipientPhone, creatorName);
          deliveryVerificationCode = qr.verificationCode;
          deliveryCodeSmsStatus = await sendAdminOrderDeliveryCodeSms({
            phone: recipientPhone,
            verificationCode: qr.verificationCode,
            orderId,
            trackingToken: trackingTokenForRecipient,
          });
          if (deliveryCodeSmsStatus.status === 'sent') {
            logger.info(`[createAdminOrder] Code livraison SMS envoyé pour ${orderId}`);
          } else {
            logger.warn('[createAdminOrder] Code livraison SMS non envoyé', { orderId, smsStatus: deliveryCodeSmsStatus });
          }
        }
      } catch (qrErr: any) {
        logger.warn(`[createAdminOrder] Échec tracking_token/QR pour ${orderId}:`, qrErr?.message);
      }

      activeOrders.set(order.id, order);
      const io = (req.app as any).get('io') as SocketIOServer | undefined;
      if (io) {
        const userSocketId = connectedUsers.get(userId);
        if (userSocketId) {
          io.to(userSocketId).emit('order-created', {
            success: true, order, dbSaved: true, dbError: null,
            message: 'Commande créée, recherche de chauffeur...',
          });
        }
      }

      if (io) {
        broadcastOrderUpdateToAdmins(io, 'order:created', { order });

        const finalPickupCoords = order.pickup.coordinates;
        const isB2BOrderValue = isB2BOrder === true;

        if (isB2BOrderValue) {
          logger.info(`[createAdminOrder] Commande B2B ${orderId} - notification de tous les livreurs disponibles`);
          notifyDriversForOrder(io, order, finalPickupCoords, deliveryMethod).catch((error) => {
            logger.warn(`[createAdminOrder] Erreur notification livreurs pour commande B2B ${orderId}:`, error);
          });
        } else if (isPhoneOrderBool) {
          logger.info(`[createAdminOrder] Commande téléphonique ${orderId} - notification livreurs`);
          notifyDriversForOrder(io, order, finalPickupCoords, deliveryMethod).catch((error) => {
            logger.warn(`[createAdminOrder] Erreur notification livreurs pour commande téléphonique ${orderId}:`, error);
          });
        } else if (finalPickupCoords && finalPickupCoords.latitude && finalPickupCoords.longitude) {
          notifyDriversForOrder(io, order, finalPickupCoords, deliveryMethod).catch((error) => {
            logger.warn(`[createAdminOrder] Erreur notification livreurs pour commande ${orderId}:`, error);
          });
        } else {
          logger.info(`[createAdminOrder] Commande ${orderId} créée sans coordonnées GPS - pas de recherche de livreurs`);
        }
      }

      if (paymentMethodType && serverPrice) {
        try {
          const { createTransactionAndInvoiceForOrder } = await import('../utils/createTransactionForOrder.js');
          await createTransactionAndInvoiceForOrder(
            orderId, userId, paymentMethodType, serverPrice, serverDistance,
            null, 0, null, false, undefined, undefined, 'client', undefined, null
          );
        } catch (transactionError: any) {
          logger.warn(`[createAdminOrder] Échec création transaction pour ${orderId}:`, transactionError.message);
        }
      }

      res.status(201).json({
        success: true,
        data: {
          id: orderId,
          deliveryVerificationCode,
          recipientDeliveryCode: deliveryVerificationCode,
          deliveryCodeSms: deliveryCodeSmsStatus,
          trackingToken: trackingTokenForRecipient,
        },
        message: 'Commande créée avec succès',
      });
    } catch (dbError: any) {
      logger.error('[createAdminOrder] Erreur sauvegarde DB:', dbError);
      res.status(500).json({ success: false, message: 'Erreur lors de la sauvegarde de la commande', error: dbError.message });
    }
  } catch (error: any) {
    logger.error('Erreur createAdminOrder:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur', error: error.message });
  }
};

export const cancelAdminOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const { orderId } = req.params;
    const { reason } = req.body;

    if (!orderId) {
      res.status(400).json({ success: false, message: 'orderId est requis' });
      return;
    }

    logger.info(`🔧 [cancelAdminOrder] Tentative d'annulation de la commande ${orderId} par l'admin`);

    const dbResult = await (pool as any).query('SELECT * FROM orders WHERE id = $1', [orderId]);

    if (!dbResult.rows || dbResult.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Commande non trouvée' });
      return;
    }

    const dbOrder = dbResult.rows[0];
    const currentStatus = dbOrder.status;

    const cancellableStatuses = ['pending', 'accepted', 'enroute', 'picked_up'];
    if (!cancellableStatuses.includes(currentStatus)) {
      res.status(400).json({ success: false, message: `Impossible d'annuler une commande avec le statut: ${currentStatus}` });
      return;
    }

    await (pool as any).query(
      'UPDATE orders SET status = $1, cancelled_at = NOW() WHERE id = $2',
      ['cancelled', orderId]
    );

    try {
      const { cancelDeferredTransactionForOrder } = await import('../utils/createTransactionForOrder.js');
      await cancelDeferredTransactionForOrder(orderId);
    } catch (cancelTxError: any) {
      logger.warn('[cancelAdminOrder] Erreur annulation transactions différées:', cancelTxError.message);
    }

    logger.info(`[cancelAdminOrder] Commande ${orderId} annulée avec succès par l'admin`);

    try {
      const io = req.app.get('io') as SocketIOServer | undefined;
      if (io) {
        if (dbOrder.user_id) {
          const { connectedUsers: users } = await import('../sockets/orderSocket.js');
          const userSocketId = users.get(dbOrder.user_id);
          if (userSocketId) {
            io.to(userSocketId).emit('order:cancelled', { orderId, reason: reason || 'admin_cancelled' });
          }
        }

        if (dbOrder.driver_id) {
          const { connectedUsers: users } = await import('../sockets/orderSocket.js');
          const driverSocketId = users.get(dbOrder.driver_id);
          if (driverSocketId) {
            io.to(driverSocketId).emit('order:cancelled', { orderId, reason: reason || 'admin_cancelled' });
          }
        }

        broadcastOrderUpdateToAdmins(io, 'order:cancelled', { orderId, status: 'cancelled', reason: reason || 'admin_cancelled' });
      }
    } catch (socketError: any) {
      logger.warn('[cancelAdminOrder] Erreur lors de la notification WebSocket:', socketError.message);
    }

    res.json({ success: true, message: 'Commande annulée avec succès', order: { ...dbOrder, status: 'cancelled' } });
  } catch (error: any) {
    logger.error('[cancelAdminOrder] Erreur lors de l\'annulation:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur', error: error.message });
  }
};
