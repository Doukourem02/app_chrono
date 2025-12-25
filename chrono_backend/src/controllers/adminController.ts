import { Request, Response } from 'express';
import { Server as SocketIOServer } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import pool from '../config/db.js';
import { saveOrder } from '../config/orderStorage.js';
import { broadcastOrderUpdateToAdmins } from '../sockets/adminSocket.js';
import { notifyDriversForOrder } from '../sockets/orderSocket.js';
import { formatDeliveryId } from '../utils/formatDeliveryId.js';
import { geocodeAddress } from '../utils/geocodeService.js';
import logger from '../utils/logger.js';

const DAY_IN_MS = 24 * 60 * 60 * 1000;

const normalizeDate = (date: Date, endOfDay = false): Date => {
  const normalized = new Date(date);
  if (endOfDay) {
    normalized.setHours(23, 59, 59, 999);
  } else {
    normalized.setHours(0, 0, 0, 0);
  }
  return normalized;
};

const parseDateParam = (value?: string, endOfDay = false): Date | null => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return normalizeDate(parsed, endOfDay);
};

const getDateRange = (startParam?: string, endParam?: string) => {
  const now = new Date();
  let rangeStart = parseDateParam(startParam) ?? normalizeDate(new Date(now.getFullYear(), now.getMonth(), 1));
  let rangeEnd = parseDateParam(endParam, true) ?? normalizeDate(now, true);

  if (rangeStart > rangeEnd) {
    const tmp = rangeStart;
    rangeStart = normalizeDate(rangeEnd);
    rangeEnd = normalizeDate(tmp, true);
  }

  const duration = Math.max(rangeEnd.getTime() - rangeStart.getTime(), DAY_IN_MS);
  const previousEnd = normalizeDate(new Date(rangeStart.getTime() - 1), true);
  const previousStart = normalizeDate(new Date(previousEnd.getTime() - duration));

  return { rangeStart, rangeEnd, previousStart, previousEnd, duration };
};

/**
 * Récupère les statistiques du dashboard admin
 */
export const getAdminDashboardStats = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!process.env.DATABASE_URL) {
      logger.warn('DATABASE_URL non configuré pour getAdminDashboardStats');
      res.json({
        success: true,
        data: {
          onDelivery: 0,
          onDeliveryChange: 0,
          successDeliveries: 0,
          successDeliveriesChange: 0,
          revenue: 0,
          revenueChange: 0,
        },
      });
      return;
    }

    const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };
    const { rangeStart, rangeEnd, previousStart, previousEnd } = getDateRange(startDate, endDate);

    // Commandes en cours (dans la période sélectionnée)
    const activeOrdersResult = await (pool as any).query(
      `SELECT COUNT(*) as count FROM orders 
       WHERE status IN ('pending', 'accepted', 'enroute', 'picked_up')
       AND created_at <= $2
       AND (completed_at IS NULL OR completed_at >= $1)`,
      [rangeStart.toISOString(), rangeEnd.toISOString()]
    );
    const onDelivery = parseInt(activeOrdersResult.rows[0]?.count || '0');

    // Vérifier quelle colonne de prix existe
    const priceColumnsInfo = await (pool as any).query(
      `SELECT column_name FROM information_schema.columns 
       WHERE table_schema = 'public' AND table_name = 'orders' 
       AND column_name = ANY($1)`,
      [['price_cfa', 'price']]
    );
    const priceColumnSet = new Set(priceColumnsInfo.rows.map((row) => row.column_name));
    const priceColumn = priceColumnSet.has('price_cfa') ? 'price_cfa' : priceColumnSet.has('price') ? 'price' : null;

    if (!priceColumn) {
      logger.warn('Colonne de prix non trouvée dans orders');
      res.json({
        success: true,
        data: {
          onDelivery,
          onDeliveryChange: 0,
          successDeliveries: 0,
          successDeliveriesChange: 0,
          revenue: 0,
          revenueChange: 0,
        },
      });
      return;
    }

    // Livraisons complétées cette semaine
    const completedCurrentRangeResult = await (pool as any).query(
      `SELECT COUNT(*) as count, COALESCE(SUM(${priceColumn}), 0) as total_revenue
       FROM orders 
       WHERE status = 'completed' 
       AND completed_at >= $1 
       AND completed_at <= $2`,
      [rangeStart.toISOString(), rangeEnd.toISOString()]
    );
    const successDeliveries = parseInt(completedCurrentRangeResult.rows[0]?.count || '0');
    const revenue = parseFloat(completedCurrentRangeResult.rows[0]?.total_revenue || '0');

    // Livraisons complétées pendant la période précédente (même durée)
    const completedPreviousRangeResult = await (pool as any).query(
      `SELECT COUNT(*) as count, COALESCE(SUM(${priceColumn}), 0) as total_revenue
       FROM orders 
       WHERE status = 'completed' 
       AND completed_at >= $1 
       AND completed_at < $2`,
      [previousStart.toISOString(), previousEnd.toISOString()]
    );
    const successDeliveriesLastWeek = parseInt(completedPreviousRangeResult.rows[0]?.count || '0');
    const revenueLastWeek = parseFloat(completedPreviousRangeResult.rows[0]?.total_revenue || '0');

    const activeOrdersPreviousRangeResult = await (pool as any).query(
      `SELECT COUNT(*) as count FROM orders 
       WHERE status IN ('pending', 'accepted', 'enroute', 'picked_up')
       AND created_at <= $2
       AND (completed_at IS NULL OR completed_at >= $1)`,
      [previousStart.toISOString(), previousEnd.toISOString()]
    );
    const onDeliveryLastWeek = parseInt(activeOrdersPreviousRangeResult.rows[0]?.count || '0');

    // Calculer les pourcentages de changement
    const onDeliveryChange = onDeliveryLastWeek > 0
      ? ((onDelivery - onDeliveryLastWeek) / onDeliveryLastWeek) * 100
      : onDelivery > 0 ? 100 : 0;

    const successDeliveriesChange = successDeliveriesLastWeek > 0
      ? ((successDeliveries - successDeliveriesLastWeek) / successDeliveriesLastWeek) * 100
      : successDeliveries > 0 ? 100 : 0;

    const revenueChange = revenueLastWeek > 0
      ? ((revenue - revenueLastWeek) / revenueLastWeek) * 100
      : revenue > 0 ? 100 : 0;

    // Calculer le taux de satisfaction (moyenne des ratings)
    let averageRating = 0;
    let totalRatings = 0;
    try {
      const ratingsTableCheck = await (pool as any).query(
        `SELECT EXISTS (
          SELECT 1 FROM information_schema.tables 
          WHERE table_schema = 'public' AND table_name = 'ratings'
        )`
      );
      if (ratingsTableCheck.rows[0]?.exists) {
        const ratingsResult = await (pool as any).query(
          `SELECT COALESCE(AVG(rating)::numeric, 0) as avg_rating, COUNT(*) as count
           FROM ratings
           WHERE created_at >= $1 AND created_at <= $2`,
          [rangeStart.toISOString(), rangeEnd.toISOString()]
        );
        if (ratingsResult.rows[0]) {
          averageRating = parseFloat(ratingsResult.rows[0].avg_rating || '0');
          totalRatings = parseInt(ratingsResult.rows[0].count || '0');
        }
      }
    } catch (ratingError) {
      logger.warn('Erreur calcul rating moyen:', ratingError);
    }

    // Temps moyen de livraison (en minutes)
    let averageDeliveryTime = 0;
    try {
      const deliveryTimeResult = await (pool as any).query(
        `SELECT AVG(EXTRACT(EPOCH FROM (completed_at - created_at)) / 60) as avg_time
         FROM orders 
         WHERE status = 'completed' 
         AND completed_at >= $1 
         AND completed_at IS NOT NULL 
         AND created_at IS NOT NULL`,
        [rangeStart.toISOString()]
      );
      if (deliveryTimeResult.rows[0]?.avg_time) {
        averageDeliveryTime = Math.round(parseFloat(deliveryTimeResult.rows[0].avg_time || '0'));
      }
    } catch (timeError) {
      logger.warn('Erreur calcul temps moyen:', timeError);
    }

    // Taux d'annulation
    const cancelledCurrentRangeResult = await (pool as any).query(
      `SELECT COUNT(*) as count FROM orders 
       WHERE status = 'cancelled' 
       AND created_at >= $1`,
      [rangeStart.toISOString()]
    );
    const cancelledCurrentRange = parseInt(cancelledCurrentRangeResult.rows[0]?.count || '0');
    const totalOrdersCurrentRange = successDeliveries + cancelledCurrentRange;
    const cancellationRate = totalOrdersCurrentRange > 0
      ? (cancelledCurrentRange / totalOrdersCurrentRange) * 100
      : 0;

    // Nombre de clients actifs (qui ont passé au moins une commande cette semaine)
    const activeClientsResult = await (pool as any).query(
      `SELECT COUNT(DISTINCT user_id) as count FROM orders 
       WHERE created_at >= $1`,
      [rangeStart.toISOString()]
    );
    const activeClients = parseInt(activeClientsResult.rows[0]?.count || '0');

    // Nombre de drivers actifs (qui ont complété au moins une livraison cette semaine)
    const activeDriversResult = await (pool as any).query(
      `SELECT COUNT(DISTINCT driver_id) as count FROM orders 
       WHERE status = 'completed' 
       AND completed_at >= $1 
       AND driver_id IS NOT NULL`,
      [rangeStart.toISOString()]
    );
    const activeDrivers = parseInt(activeDriversResult.rows[0]?.count || '0');

    res.json({
      success: true,
      data: {
        onDelivery,
        onDeliveryChange: Math.round(onDeliveryChange * 10) / 10,
        successDeliveries,
        successDeliveriesChange: Math.round(successDeliveriesChange * 10) / 10,
        revenue,
        revenueChange: Math.round(revenueChange * 10) / 10,
        // Nouvelles métriques
        averageRating: Math.round(averageRating * 10) / 10,
        totalRatings,
        averageDeliveryTime,
        cancellationRate: Math.round(cancellationRate * 10) / 10,
        activeClients,
        activeDrivers,
      },
    });
  } catch (error: any) {
    logger.error('Erreur getAdminDashboardStats:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur',
      error: error.message,
    });
  }
};

/**
 * Récupère les analytics de livraison pour le dashboard admin
 */
export const getAdminDeliveryAnalytics = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!process.env.DATABASE_URL) {
      logger.warn('DATABASE_URL non configuré pour getAdminDeliveryAnalytics');
      res.json({
        success: true,
        data: [],
      });
      return;
    }

    const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };
    let rangeStart: Date;
    let rangeEnd: Date;
    if (startDate || endDate) {
      const range = getDateRange(startDate, endDate);
      rangeStart = range.rangeStart;
      rangeEnd = range.rangeEnd;
    } else {
      rangeEnd = normalizeDate(new Date(), true);
      rangeStart = new Date(rangeEnd);
      rangeStart.setMonth(rangeStart.getMonth() - 4);
      rangeStart = normalizeDate(rangeStart);
    }

    const result = await (pool as any).query(
      `SELECT 
        DATE_TRUNC('month', created_at) as month,
        COUNT(*) FILTER (WHERE status = 'completed') as delivered,
        COUNT(*) FILTER (WHERE status IN ('cancelled', 'declined')) as reported
       FROM orders 
       WHERE created_at >= $1
       AND created_at <= $2
       GROUP BY DATE_TRUNC('month', created_at)
       ORDER BY month ASC`,
      [rangeStart.toISOString(), rangeEnd.toISOString()]
    );

    const monthlyData = result.rows.map((row: any) => {
      const date = new Date(row.month);
      return {
        month: date.toLocaleDateString('fr-FR', { month: 'short' }),
        packageDelivered: parseInt(row.delivered || '0'),
        reported: parseInt(row.reported || '0'),
        sortDate: date,
      };
    });

    const sorted = monthlyData.sort((a, b) => a.sortDate.getTime() - b.sortDate.getTime());
    const trimmed = (startDate || endDate ? sorted : sorted.slice(-4)).map(({ sortDate, ...rest }) => rest);

    res.json({
      success: true,
      data: trimmed,
    });
  } catch (error: any) {
    logger.error('Erreur getAdminDeliveryAnalytics:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur',
      error: error.message,
    });
  }
};

/**
 * Récupère les activités récentes pour le dashboard admin
 */
export const getAdminRecentActivities = async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = parseInt(req.query.limit as string) || 5; // Limité à 5 par défaut
    const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };
    const hasFilters = Boolean(startDate || endDate);
    const range = hasFilters ? getDateRange(startDate, endDate) : null;

    logger.info('🚀 [getAdminRecentActivities] DÉBUT, limit:', limit);
    logger.debug('🔍 [getAdminRecentActivities] User from middleware:', (req as any).user);

    if (!process.env.DATABASE_URL) {
      logger.warn('DATABASE_URL non configuré pour getAdminRecentActivities');
      res.json({
        success: true,
        data: [],
      });
      return;
    }

    // Vérifier d'abord si la table orders a des données
    const countResult = await (pool as any).query(`SELECT COUNT(*) as count FROM orders`);
    const totalOrders = parseInt(countResult.rows[0]?.count || '0');
    logger.debug(`Total de commandes dans la table orders: ${totalOrders}`);

    if (totalOrders === 0) {
      logger.warn('La table orders est vide');
      res.json({
        success: true,
        data: [],
      });
      return;
    }

    // Récupérer toutes les commandes récentes (comme dans getActiveOrdersByUser - SELECT *)
    let query = `SELECT * FROM orders`;
    const params: any[] = [];
    const conditions: string[] = [];
    if (range) {
      conditions.push(`created_at >= $${params.length + 1}`);
      params.push(range.rangeStart.toISOString());
      conditions.push(`created_at <= $${params.length + 1}`);
      params.push(range.rangeEnd.toISOString());
    }
    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }
    params.push(limit);
    query += ` ORDER BY created_at DESC LIMIT $${params.length}`;
    logger.info('📝 [getAdminRecentActivities] Requête SQL:', query);
    logger.info('📝 [getAdminRecentActivities] Paramètres:', params);

    let result;
    try {
      result = await (pool as any).query(query, params);
      logger.info(`✅ [getAdminRecentActivities] Requête réussie: ${result.rows.length} lignes récupérées`);
    } catch (queryError: any) {
      logger.error('❌ [getAdminRecentActivities] Erreur lors de la requête SQL:', queryError);
      throw queryError;
    }

    if (result.rows.length > 0) {
      logger.debug('Première commande récupérée:', {
        id: result.rows[0].id,
        status: result.rows[0].status,
        created_at: result.rows[0].created_at,
        has_pickup_address: !!result.rows[0].pickup_address,
        has_pickup: !!result.rows[0].pickup,
        has_dropoff_address: !!result.rows[0].dropoff_address,
        has_dropoff: !!result.rows[0].dropoff,
      });
    }

    // Helper pour parser JSON (comme dans orderStorage.ts)
    const parseJsonField = (field: any): any => {
      if (!field) return null;
      if (typeof field === 'string') {
        try {
          return JSON.parse(field);
        } catch {
          return field;
        }
      }
      return field;
    };

    const formatted = result.rows.map((order: any) => {
      // Parser les adresses comme dans orderStorage.ts
      const pickup = parseJsonField(order.pickup_address || order.pickup);
      const dropoff = parseJsonField(order.dropoff_address || order.dropoff);

      let departure = 'Adresse inconnue';
      let destination = 'Adresse inconnue';

      if (pickup) {
        departure = pickup?.address || pickup?.formatted_address || pickup?.name || pickup?.street || (typeof pickup === 'string' ? pickup : 'Adresse inconnue');
      }

      if (dropoff) {
        destination = dropoff?.address || dropoff?.formatted_address || dropoff?.name || dropoff?.street || (typeof dropoff === 'string' ? dropoff : 'Adresse inconnue');
      }

      return {
        id: order.id,
        deliveryId: formatDeliveryId(order.id, order.created_at),
        date: new Date(order.created_at).toLocaleDateString('fr-FR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        }),
        departure,
        destination,
        status: order.status,
      };
    });

    logger.info(`✅ [getAdminRecentActivities] Données formatées: ${formatted.length} activités`);

    if (formatted.length > 0) {
      logger.debug('📋 [getAdminRecentActivities] Exemple de données formatées:', JSON.stringify(formatted[0], null, 2));
    } else {
      logger.warn('⚠️ [getAdminRecentActivities] Aucune donnée formatée - la table orders est peut-être vide ou les données ne correspondent pas au format attendu');
    }

    const response = {
      success: true,
      data: formatted,
    };

    logger.debug('📤 [getAdminRecentActivities] Sending response:', JSON.stringify(response, null, 2));

    res.json(response);
  } catch (error: any) {
    logger.error('Erreur getAdminRecentActivities:', error);

    // Gérer les erreurs de connexion DB comme dans getDriverRevenues
    if (error.message && (error.message.includes('SASL') || error.message.includes('password'))) {
      logger.warn('Erreur de connexion DB, retour de données vides');
      res.json({
        success: true,
        data: [],
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: 'Erreur serveur',
      error: error.message,
    });
  }
};

/**
 * Recherche globale dans les commandes, utilisateurs, etc.
 */
export const getAdminGlobalSearch = async (req: Request, res: Response): Promise<void> => {
  try {
    const query = req.query.q as string | undefined;
    logger.info('🚀 [getAdminGlobalSearch] DÉBUT, query:', query);

    if (!query || query.trim().length === 0) {
      res.json({
        success: true,
        data: {
          orders: [],
          users: [],
        },
      });
      return;
    }

    if (!process.env.DATABASE_URL) {
      logger.warn('DATABASE_URL non configuré pour getAdminGlobalSearch');
      res.json({
        success: true,
        data: {
          orders: [],
          users: [],
        },
      });
      return;
    }

    const searchTerm = `%${query.trim()}%`;
    const exactSearchTerm = query.trim();
    const upperQuery = query.trim().toUpperCase();
    const trimmedQuery = query.trim();

    // Détecter si c'est une recherche d'ID de commande (commence par CHL)
    // Si oui, on priorisera les commandes dans les résultats
    const isOrderSearch = upperQuery.startsWith('CHL');

    // Construire la condition de recherche pour l'ID formaté (si recherche de commande)
    let deliveryIdCondition = '';
    if (isOrderSearch) {
      deliveryIdCondition = `
        OR (
          'CHLV' || '–' || 
          TO_CHAR(o.created_at, 'YYMMDD') || '-' || 
          UPPER(SUBSTRING(REPLACE(o.id::text, '-', ''), -4))
        ) ILIKE $1
        OR (
          'CHLV' || '–' || 
          TO_CHAR(o.created_at, 'YYMMDD') || '-' || 
          UPPER(SUBSTRING(REPLACE(o.id::text, '-', ''), -4))
        ) ILIKE $4
        OR UPPER(SUBSTRING(REPLACE(o.id::text, '-', ''), 1, LENGTH($5))) = $5
      `;
    }

    // Rechercher dans TOUTES les commandes (par ID, statut, adresses, emails/téléphones/noms des clients/livreurs)
    // Améliorer la recherche pour mieux gérer tous les champs
    const ordersWhereClause = `
      (LOWER(o.id::text) ILIKE LOWER($1) OR
      LOWER(REPLACE(o.id::text, '-', '')) ILIKE LOWER($1) OR
      LOWER(COALESCE(o.status::text, '')) ILIKE LOWER($1) OR
      LOWER(COALESCE(o.pickup_address::text, '')) ILIKE LOWER($1) OR
      LOWER(COALESCE(o.dropoff_address::text, '')) ILIKE LOWER($1) OR
      LOWER(COALESCE(u.email, '')) ILIKE LOWER($1) OR
      LOWER(COALESCE(u.phone, '')) ILIKE LOWER($1) OR
      LOWER(COALESCE(u.first_name, '')) ILIKE LOWER($1) OR
      LOWER(COALESCE(u.last_name, '')) ILIKE LOWER($1) OR
      LOWER(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))) ILIKE LOWER($1) OR
      LOWER(CONCAT(COALESCE(u.last_name, ''), ' ', COALESCE(u.first_name, ''))) ILIKE LOWER($1) OR
      LOWER(COALESCE(d.email, '')) ILIKE LOWER($1) OR
      LOWER(COALESCE(d.phone, '')) ILIKE LOWER($1) OR
      LOWER(COALESCE(d.first_name, '')) ILIKE LOWER($1) OR
      LOWER(COALESCE(d.last_name, '')) ILIKE LOWER($1) OR
      LOWER(CONCAT(COALESCE(d.first_name, ''), ' ', COALESCE(d.last_name, ''))) ILIKE LOWER($1) OR
      LOWER(CONCAT(COALESCE(d.last_name, ''), ' ', COALESCE(d.first_name, ''))) ILIKE LOWER($1)
      ${deliveryIdCondition})
    `;

    // Rechercher dans les commandes avec plus de précision
    const ordersQuery = `
      SELECT 
        o.id, 
        o.status, 
        o.created_at, 
        o.pickup_address, 
        o.dropoff_address,
        o.user_id,
        o.driver_id,
        u.first_name as user_first_name,
        u.last_name as user_last_name,
        u.email as user_email,
        d.first_name as driver_first_name,
        d.last_name as driver_last_name,
        d.email as driver_email
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      LEFT JOIN users d ON o.driver_id = d.id
      WHERE ${ordersWhereClause}
      ORDER BY 
        CASE 
          WHEN LOWER(o.id::text) = LOWER($2) THEN 1
          WHEN LOWER(REPLACE(o.id::text, '-', '')) LIKE LOWER($3) THEN 2
          ${isOrderSearch ? `WHEN (
            'CHLV' || '–' || 
            TO_CHAR(o.created_at, 'YYMMDD') || '-' || 
            UPPER(SUBSTRING(REPLACE(o.id::text, '-', ''), -4))
          ) ILIKE $4 THEN 2` : ''}
          WHEN LOWER(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))) ILIKE LOWER($1) THEN 3
          WHEN LOWER(CONCAT(COALESCE(d.first_name, ''), ' ', COALESCE(d.last_name, ''))) ILIKE LOWER($1) THEN 4
          WHEN LOWER(COALESCE(u.email, '')) ILIKE LOWER($1) THEN 5
          WHEN LOWER(COALESCE(d.email, '')) ILIKE LOWER($1) THEN 6
          ELSE 7
        END,
        o.created_at DESC
      LIMIT 10
    `;

    // Rechercher dans les utilisateurs avec recherche par nom et prénom
    // Simplifier la recherche pour qu'elle soit plus robuste
    const usersQuery = `
      SELECT id, email, phone, role, first_name, last_name, created_at
      FROM users
      WHERE 
        email ILIKE $1 OR
        phone ILIKE $1 OR
        role ILIKE $1 OR
        first_name ILIKE $1 OR
        last_name ILIKE $1 OR
        (first_name IS NOT NULL AND last_name IS NOT NULL AND CONCAT(first_name, ' ', last_name) ILIKE $1) OR
        (first_name IS NOT NULL AND last_name IS NOT NULL AND CONCAT(last_name, ' ', first_name) ILIKE $1)
      ORDER BY 
        CASE 
          WHEN email = $2 THEN 1
          WHEN email ILIKE $3 THEN 2
          WHEN role = $2 THEN 3
          WHEN first_name IS NOT NULL AND last_name IS NOT NULL AND CONCAT(first_name, ' ', last_name) ILIKE $1 THEN 4
          WHEN first_name ILIKE $1 THEN 5
          WHEN last_name ILIKE $1 THEN 6
          WHEN phone ILIKE $1 THEN 7
          ELSE 8
        END,
        created_at DESC
      LIMIT 10
    `;

    let ordersResult, usersResult;
    try {
      // Pour les commandes : searchTerm ($1), exactSearchTerm ($2), `${exactSearchTerm}%` ($3), et si orderSearch: `${upperQuery}%` ($4) et upperQuery ($5)
      const ordersParams: any[] = [searchTerm, exactSearchTerm, `${exactSearchTerm}%`];
      if (isOrderSearch) {
        ordersParams.push(`${upperQuery}%`, upperQuery);
      }
      logger.info('🔍 [getAdminGlobalSearch] Exécution requête commandes avec params:', ordersParams);
      ordersResult = await (pool as any).query(ordersQuery, ordersParams);
      logger.info(`✅ [getAdminGlobalSearch] Commandes trouvées: ${ordersResult.rows.length}`);

      // Pour les utilisateurs : searchTerm, exactSearchTerm, searchTerm (pour le tri)
      const usersParams = [searchTerm, exactSearchTerm, `${exactSearchTerm}%`];
      logger.info('🔍 [getAdminGlobalSearch] Exécution requête utilisateurs avec params:', usersParams);
      logger.info('🔍 [getAdminGlobalSearch] Requête SQL utilisateurs:', usersQuery);
      usersResult = await (pool as any).query(usersQuery, usersParams);
      logger.info(`✅ [getAdminGlobalSearch] Utilisateurs trouvés: ${usersResult.rows.length}`);
      if (usersResult.rows.length > 0) {
        logger.info('📋 [getAdminGlobalSearch] Exemples utilisateurs:', usersResult.rows.slice(0, 3).map((u: any) => ({
          id: u.id,
          email: u.email,
          first_name: u.first_name,
          last_name: u.last_name,
          role: u.role
        })));
      }
    } catch (queryError: any) {
      logger.error('❌ [getAdminGlobalSearch] Erreur lors de la requête SQL:', queryError);
      throw queryError;
    }

    // Helper pour parser JSON
    const parseJsonField = (field: any): any => {
      if (!field) return null;
      if (typeof field === 'string') {
        try {
          return JSON.parse(field);
        } catch {
          return field;
        }
      }
      return field;
    };

    const formattedOrders = ordersResult.rows.map((order: any) => {
      const pickup = parseJsonField(order.pickup_address);
      const dropoff = parseJsonField(order.dropoff_address);
      // Utiliser la fonction formatDeliveryId pour générer le format CHLV–YYMMDD-XXXX
      const deliveryId = formatDeliveryId(order.id, order.created_at);

      const clientName = (order.user_first_name && order.user_last_name)
        ? `${order.user_first_name} ${order.user_last_name}`
        : order.user_email || 'N/A';

      const driverName = (order.driver_first_name && order.driver_last_name)
        ? `${order.driver_first_name} ${order.driver_last_name}`
        : order.driver_email || 'N/A';

      return {
        id: order.id,
        deliveryId,
        status: order.status,
        pickup: pickup?.address || pickup?.formatted_address || pickup?.name || 'Adresse inconnue',
        dropoff: dropoff?.address || dropoff?.formatted_address || dropoff?.name || 'Adresse inconnue',
        clientName,
        driverName,
        createdAt: new Date(order.created_at).toLocaleDateString('fr-FR'),
      };
    });

    const formattedUsers = usersResult.rows.map((user: any) => {
      const fullName = (user.first_name && user.last_name)
        ? `${user.first_name} ${user.last_name}`
        : null;

      return {
        id: user.id,
        email: user.email,
        phone: user.phone || 'N/A',
        role: user.role,
        first_name: user.first_name || null,
        last_name: user.last_name || null,
        fullName,
        createdAt: new Date(user.created_at).toLocaleDateString('fr-FR'),
      };
    });

    logger.info(`✅ [getAdminGlobalSearch] Résultats: ${formattedOrders.length} commandes, ${formattedUsers.length} utilisateurs`);

    res.json({
      success: true,
      data: {
        orders: formattedOrders,
        users: formattedUsers,
      },
    });
  } catch (error: any) {
    logger.error('Erreur getAdminGlobalSearch:', error);

    if (error.message && (error.message.includes('SASL') || error.message.includes('password'))) {
      logger.warn('Erreur de connexion DB, retour de données vides');
      res.json({
        success: true,
        data: {
          orders: [],
          users: [],
        },
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: 'Erreur serveur',
      error: error.message,
    });
  }
};

/**
 * Récupère les livraisons en cours pour la page tracking
 */
export const getAdminOngoingDeliveries = async (req: Request, res: Response): Promise<void> => {
  try {
    logger.info('🚀 [getAdminOngoingDeliveries] DÉBUT');

    if (!process.env.DATABASE_URL) {
      logger.warn('DATABASE_URL non configuré pour getAdminOngoingDeliveries');
      res.json({
        success: true,
        data: [],
      });
      return;
    }

    // Récupérer les commandes en cours (pending, accepted, enroute, picked_up)
    const query = `SELECT * FROM orders 
                   WHERE status IN ('pending', 'accepted', 'enroute', 'picked_up')
                   ORDER BY created_at DESC`;

    logger.info('📝 [getAdminOngoingDeliveries] Requête SQL:', query);

    let result;
    try {
      result = await (pool as any).query(query);
      logger.info(`✅ [getAdminOngoingDeliveries] Requête réussie: ${result.rows.length} lignes récupérées`);
    } catch (queryError: any) {
      logger.error('❌ [getAdminOngoingDeliveries] Erreur lors de la requête SQL:', queryError);
      throw queryError;
    }

    // Helper pour parser JSON
    const parseJsonField = (field: any): any => {
      if (!field) return null;
      if (typeof field === 'string') {
        try {
          return JSON.parse(field);
        } catch {
          return field;
        }
      }
      return field;
    };

    // Récupérer les informations des clients et drivers en une seule requête
    const userIds = [...new Set(result.rows.map((o: any) => o.user_id).filter(Boolean))];
    const driverIds = [...new Set(result.rows.map((o: any) => o.driver_id).filter(Boolean))];

    let usersMap = new Map();
    let driversMap = new Map();

    if (userIds.length > 0) {
      try {
        const usersResult = await (pool as any).query(
          `SELECT id, email, phone, first_name, last_name, avatar_url, role FROM users WHERE id = ANY($1)`,
          [userIds]
        );
        usersResult.rows.forEach((user: any) => {
          // Construire full_name à partir de first_name et last_name
          const full_name = (user.first_name && user.last_name)
            ? `${user.first_name} ${user.last_name}`
            : (user.first_name || user.last_name || null);
          usersMap.set(user.id, {
            ...user,
            full_name,
          });
        });
      } catch (usersError) {
        logger.warn('Erreur lors de la récupération des utilisateurs:', usersError);
      }
    }

    if (driverIds.length > 0) {
      try {
        const driversResult = await (pool as any).query(
          `SELECT id, email, phone, first_name, last_name, avatar_url, role FROM users WHERE id = ANY($1)`,
          [driverIds]
        );
        driversResult.rows.forEach((driver: any) => {
          // Construire full_name à partir de first_name et last_name
          const full_name = (driver.first_name && driver.last_name)
            ? `${driver.first_name} ${driver.last_name}`
            : (driver.first_name || driver.last_name || null);
          driversMap.set(driver.id, {
            ...driver,
            full_name,
          });
        });
      } catch (driversError) {
        logger.warn('Erreur lors de la récupération des drivers:', driversError);
      }
    }

    const formatted = result.rows.map((order: any) => {
      const pickup = parseJsonField(order.pickup_address || order.pickup);
      const dropoff = parseJsonField(order.dropoff_address || order.dropoff);

      const shipmentNumber = formatDeliveryId(order.id, order.created_at);

      // Extraire les coordonnées (peuvent être dans coordinates.latitude/longitude ou directement latitude/longitude)
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

      // Récupérer les informations du client et du driver
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
        client: client ? {
          id: client.id,
          email: client.email,
          full_name: client.full_name,
          phone: client.phone,
          avatar_url: client.avatar_url,
        } : null,
        driver: driver ? {
          id: driver.id,
          email: driver.email,
          full_name: driver.full_name,
          phone: driver.phone,
          avatar_url: driver.avatar_url,
        } : null,
      };
    });

    logger.info(`✅ [getAdminOngoingDeliveries] Données formatées: ${formatted.length} livraisons en cours`);

    res.json({
      success: true,
      data: formatted,
    });
  } catch (error: any) {
    logger.error('Erreur getAdminOngoingDeliveries:', error);

    if (error.message && (error.message.includes('SASL') || error.message.includes('password'))) {
      logger.warn('Erreur de connexion DB, retour de données vides');
      res.json({
        success: true,
        data: [],
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: 'Erreur serveur',
      error: error.message,
    });
  }
};

/**
 * Récupère les commandes filtrées par statut pour la page Orders
 */
export const getAdminOrdersByStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const status = req.query.status as string | undefined;
    logger.info('🚀 [getAdminOrdersByStatus] DÉBUT, status:', status);

    if (!process.env.DATABASE_URL) {
      logger.warn('DATABASE_URL non configuré pour getAdminOrdersByStatus');
      res.json({
        success: true,
        data: [],
        counts: {
          all: 0,
          onProgress: 0,
          successful: 0,
          onHold: 0,
          canceled: 0,
          changes: {
            all: 0,
            onProgress: 0,
            successful: 0,
            onHold: 0,
            canceled: 0,
          },
        },
      });
      return;
    }

    // Définir les statuts pour chaque catégorie
    const onProgressStatuses = ['accepted', 'enroute', 'picked_up'];
    const onHoldStatuses = ['pending', 'declined'];

    const statusMap: Record<string, string[]> = {
      all: [],
      onProgress: onProgressStatuses,
      successful: ['completed'],
      onHold: onHoldStatuses,
      canceled: ['cancelled'],
    };

    const statusesToFilter = status && statusMap[status] ? statusMap[status] : [];

    let query = 'SELECT * FROM orders';
    const queryParams: any[] = [];

    if (statusesToFilter.length > 0) {
      query += ` WHERE status = ANY($1)`;
      queryParams.push(statusesToFilter);
    }

    query += ' ORDER BY created_at DESC';

    logger.info('📝 [getAdminOrdersByStatus] Requête SQL:', query);
    logger.info('📝 [getAdminOrdersByStatus] Paramètres:', queryParams);

    let result;
    try {
      result = await (pool as any).query(query, queryParams);
      logger.info(`✅ [getAdminOrdersByStatus] Requête réussie: ${result.rows.length} lignes récupérées`);
    } catch (queryError: any) {
      logger.error('❌ [getAdminOrdersByStatus] Erreur lors de la requête SQL:', queryError);
      throw queryError;
    }

    // Récupérer les compteurs pour chaque catégorie (ce mois et mois précédent)
    const now = new Date();
    const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    const formatStatusList = (statuses: string[]) =>
      statuses.map((s) => `'${s}'`).join(', ');

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
      logger.error('❌ [getAdminOrdersByStatus] Erreur lors de la requête de comptage:', countsError);
      countsResult = { rows: [{ onProgress: 0, successful: 0, onHold: 0, canceled: 0, all: 0, onProgressLastMonth: 0, successfulLastMonth: 0, onHoldLastMonth: 0, canceledLastMonth: 0, allLastMonth: 0 }] };
    }

    const row = countsResult.rows[0] || {};
    const onProgress = parseInt(row.onProgress || '0');
    const successful = parseInt(row.successful || '0');
    const onHold = parseInt(row.onHold || '0');
    const canceled = parseInt(row.canceled || '0');
    const all = parseInt(row.all || '0');
    const onProgressLastMonth = parseInt(row.onProgressLastMonth || '0');
    const successfulLastMonth = parseInt(row.successfulLastMonth || '0');
    const onHoldLastMonth = parseInt(row.onHoldLastMonth || '0');
    const canceledLastMonth = parseInt(row.canceledLastMonth || '0');
    const allLastMonth = parseInt(row.allLastMonth || '0');

    // Calculer les pourcentages de changement
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
        all: calculateChange(all, allLastMonth),
        onProgress: calculateChange(onProgress, onProgressLastMonth),
        successful: calculateChange(successful, successfulLastMonth),
        onHold: calculateChange(onHold, onHoldLastMonth),
        canceled: calculateChange(canceled, canceledLastMonth),
      },
    };

    // Helper pour parser JSON
    const parseJsonField = (field: any): any => {
      if (!field) return null;
      if (typeof field === 'string') {
        try {
          return JSON.parse(field);
        } catch {
          return field;
        }
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
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        }),
        departure: pickup?.address || pickup?.formatted_address || pickup?.name || pickup?.street || 'Adresse inconnue',
        destination: dropoff?.address || dropoff?.formatted_address || dropoff?.name || dropoff?.street || 'Adresse inconnue',
        status: order.status,
      };
    });

    logger.info(`✅ [getAdminOrdersByStatus] Données formatées: ${formatted.length} commandes`);

    res.json({
      success: true,
      data: formatted,
      counts,
    });
  } catch (error: any) {
    logger.error('Erreur getAdminOrdersByStatus:', error);

    if (error.message && (error.message.includes('SASL') || error.message.includes('password'))) {
      logger.warn('Erreur de connexion DB, retour de données vides');
      res.json({
        success: true,
        data: [],
        counts: {
          all: 0,
          onProgress: 0,
          successful: 0,
          onHold: 0,
          canceled: 0,
          changes: {
            all: 0,
            onProgress: 0,
            successful: 0,
            onHold: 0,
            canceled: 0,
          },
        },
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: 'Erreur serveur',
      error: error.message,
    });
  }
};

/**
 * Récupère tous les utilisateurs pour la page Users
 */
export const getAdminUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    logger.info('🚀 [getAdminUsers] DÉBUT');

    if (!process.env.DATABASE_URL) {
      logger.warn('DATABASE_URL non configuré pour getAdminUsers');
      res.json({
        success: true,
        data: [],
        counts: {
          client: 0,
          driver: 0,
          admin: 0,
          total: 0,
        },
      });
      return;
    }

    // Récupérer tous les utilisateurs avec leurs informations
    const query = `SELECT id, email, phone, first_name, last_name, role, created_at, avatar_url FROM users ORDER BY created_at DESC`;

    logger.info('📝 [getAdminUsers] Requête SQL:', query);

    let result;
    try {
      result = await (pool as any).query(query);
      logger.info(`✅ [getAdminUsers] Requête réussie: ${result.rows.length} utilisateurs récupérés`);
    } catch (queryError: any) {
      logger.error('❌ [getAdminUsers] Erreur lors de la requête SQL:', queryError);
      throw queryError;
    }

    // Compter les utilisateurs par rôle
    const roleCounts = {
      client: 0,
      driver: 0,
      admin: 0,
      total: result.rows.length,
    };

    const formatted = result.rows.map((user: any) => {
      // Compter les rôles
      if (user.role === 'client') roleCounts.client++;
      else if (user.role === 'driver') roleCounts.driver++;
      else if (user.role === 'admin' || user.role === 'super_admin') roleCounts.admin++;

      return {
        id: user.id,
        email: user.email,
        phone: user.phone || 'N/A',
        first_name: user.first_name || null,
        last_name: user.last_name || null,
        role: user.role,
        avatar_url: user.avatar_url || null,
        createdAt: new Date(user.created_at).toLocaleDateString('fr-FR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        }),
      };
    });

    logger.info(`✅ [getAdminUsers] Données formatées: ${formatted.length} utilisateurs`);

    res.json({
      success: true,
      data: formatted,
      counts: roleCounts,
    });
  } catch (error: any) {
    logger.error('Erreur getAdminUsers:', error);

    if (error.message && (error.message.includes('SASL') || error.message.includes('password'))) {
      logger.warn('Erreur de connexion DB, retour de données vides');
      res.json({
        success: true,
        data: [],
        counts: {
          client: 0,
          driver: 0,
          admin: 0,
          total: 0,
        },
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: 'Erreur serveur',
      error: error.message,
    });
  }
};

/**
 * Récupère les statistiques financières pour la page Finance
 */
export const getAdminFinancialStats = async (req: Request, res: Response): Promise<void> => {
  try {
    logger.info('🚀 [getAdminFinancialStats] DÉBUT');

    if (!process.env.DATABASE_URL) {
      logger.warn('DATABASE_URL non configuré pour getAdminFinancialStats');
      res.json({
        success: true,
        data: {
          totalRevenue: { today: 0, week: 0, month: 0, year: 0 },
          transactionsByMethod: { orange_money: 0, wave: 0, cash: 0, deferred: 0 },
          paymentStatus: { pending: 0, paid: 0, refused: 0, delayed: 0 },
          conversionRate: 0,
          revenueByDriver: [],
          revenueByDeliveryType: { moto: 0, vehicule: 0, cargo: 0 },
        },
      });
      return;
    }

    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - 7);
    startOfWeek.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    // Vérifier quelle colonne de prix existe
    const priceColumnsInfo = await (pool as any).query(
      `SELECT column_name FROM information_schema.columns 
       WHERE table_schema = 'public' AND table_name = 'orders' 
       AND column_name = ANY($1)`,
      [['price_cfa', 'price']]
    );
    const priceColumnSet = new Set(priceColumnsInfo.rows.map((row: any) => row.column_name));
    const priceColumn = priceColumnSet.has('price_cfa') ? 'price_cfa' : priceColumnSet.has('price') ? 'price' : null;

    if (!priceColumn) {
      logger.warn('Colonne de prix non trouvée dans orders');
      res.json({
        success: true,
        data: {
          totalRevenue: { today: 0, week: 0, month: 0, year: 0 },
          transactionsByMethod: { orange_money: 0, wave: 0, cash: 0, deferred: 0 },
          paymentStatus: { pending: 0, paid: 0, refused: 0, delayed: 0 },
          conversionRate: 0,
          revenueByDriver: [],
          revenueByDeliveryType: { moto: 0, vehicule: 0, cargo: 0 },
        },
      });
      return;
    }

    // Revenus totaux par période
    const revenueQuery = `
      SELECT 
        COALESCE(SUM(${priceColumn}) FILTER (WHERE completed_at >= $1 AND completed_at <= $2), 0) as today,
        COALESCE(SUM(${priceColumn}) FILTER (WHERE completed_at >= $3 AND completed_at <= $2), 0) as week,
        COALESCE(SUM(${priceColumn}) FILTER (WHERE completed_at >= $4 AND completed_at <= $2), 0) as month,
        COALESCE(SUM(${priceColumn}) FILTER (WHERE completed_at >= $5 AND completed_at <= $2), 0) as year
      FROM orders
      WHERE status = 'completed'
    `;

    const revenueResult = await (pool as any).query(revenueQuery, [
      startOfToday.toISOString(),
      now.toISOString(),
      startOfWeek.toISOString(),
      startOfMonth.toISOString(),
      startOfYear.toISOString(),
    ]);

    // Transactions par méthode de paiement
    const transactionsByMethodQuery = `
      SELECT 
        payment_method_type,
        COUNT(*) as count,
        COALESCE(SUM(amount), 0) as total
      FROM transactions
      WHERE created_at >= $1
      GROUP BY payment_method_type
    `;

    const transactionsByMethodResult = await (pool as any).query(transactionsByMethodQuery, [
      startOfMonth.toISOString(),
    ]);

    const transactionsByMethod: Record<string, number> = { orange_money: 0, wave: 0, cash: 0, deferred: 0 };
    transactionsByMethodResult.rows.forEach((row: any) => {
      if (row.payment_method_type) {
        transactionsByMethod[row.payment_method_type] = parseFloat(row.total || '0');
      }
    });

    // Statut des paiements
    // Compter les paiements différés séparément pour les statistiques
    const paymentStatusQuery = `
      SELECT 
        status,
        payment_method_type,
        COUNT(*) as count
      FROM transactions
      WHERE created_at >= $1
      GROUP BY status, payment_method_type
    `;

    const paymentStatusResult = await (pool as any).query(paymentStatusQuery, [
      startOfMonth.toISOString(),
    ]);

    const paymentStatus: Record<string, number> = { pending: 0, paid: 0, refused: 0, delayed: 0 };
    let deferredPendingCount = 0; // Compter les paiements différés en 'pending'
    
    paymentStatusResult.rows.forEach((row: any) => {
      if (row.status) {
        // Si c'est un paiement différé avec statut 'pending', le compter comme 'delayed'
        if (row.payment_method_type === 'deferred' && row.status === 'pending') {
          deferredPendingCount += parseInt(row.count || '0');
        } else {
          paymentStatus[row.status] = (paymentStatus[row.status] || 0) + parseInt(row.count || '0');
        }
      }
    });
    
    // Ajouter les paiements différés en 'pending' aux 'delayed'
    paymentStatus.delayed = (paymentStatus.delayed || 0) + deferredPendingCount;
    // Retirer les paiements différés en 'pending' du compteur 'pending' général
    paymentStatus.pending = Math.max(0, (paymentStatus.pending || 0) - deferredPendingCount);

    // Taux de conversion
    const totalTransactions = paymentStatus.pending + paymentStatus.paid + paymentStatus.refused + paymentStatus.delayed;
    const conversionRate = totalTransactions > 0
      ? (paymentStatus.paid / totalTransactions) * 100
      : 0;

    // Revenus par driver (top 10)
    const revenueByDriverQuery = `
      SELECT 
        o.driver_id,
        COUNT(*) as deliveries,
        COALESCE(SUM(${priceColumn}), 0) as revenue
      FROM orders o
      WHERE o.status = 'completed' 
        AND o.completed_at >= $1
        AND o.driver_id IS NOT NULL
      GROUP BY o.driver_id
      ORDER BY revenue DESC
      LIMIT 10
    `;

    const revenueByDriverResult = await (pool as any).query(revenueByDriverQuery, [
      startOfMonth.toISOString(),
    ]);

    // Revenus par type de livraison
    const revenueByDeliveryTypeQuery = `
      SELECT 
        delivery_method,
        COUNT(*) as deliveries,
        COALESCE(SUM(${priceColumn}), 0) as revenue
      FROM orders
      WHERE status = 'completed' 
        AND completed_at >= $1
      GROUP BY delivery_method
    `;

    const revenueByDeliveryTypeResult = await (pool as any).query(revenueByDeliveryTypeQuery, [
      startOfMonth.toISOString(),
    ]);

    const revenueByDeliveryType: Record<string, number> = { moto: 0, vehicule: 0, cargo: 0 };
    revenueByDeliveryTypeResult.rows.forEach((row: any) => {
      if (row.delivery_method) {
        revenueByDeliveryType[row.delivery_method] = parseFloat(row.revenue || '0');
      }
    });

    const row = revenueResult.rows[0] || {};

    res.json({
      success: true,
      data: {
        totalRevenue: {
          today: parseFloat(row.today || '0'),
          week: parseFloat(row.week || '0'),
          month: parseFloat(row.month || '0'),
          year: parseFloat(row.year || '0'),
        },
        transactionsByMethod,
        paymentStatus,
        conversionRate: Math.round(conversionRate * 10) / 10,
        revenueByDriver: revenueByDriverResult.rows.map((r: any) => ({
          driverId: r.driver_id,
          deliveries: parseInt(r.deliveries || '0'),
          revenue: parseFloat(r.revenue || '0'),
        })),
        revenueByDeliveryType,
      },
    });
  } catch (error: any) {
    logger.error('Erreur getAdminFinancialStats:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur',
      error: error.message,
    });
  }
};

/**
 * Récupère toutes les transactions pour la page Finance
 */
export const getAdminTransactions = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;
    const status = req.query.status as string | undefined;
    const method = req.query.method as string | undefined;
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;
    const search = req.query.search as string | undefined;

    logger.info('🚀 [getAdminTransactions] DÉBUT', { page, limit, status, method });

    if (!process.env.DATABASE_URL) {
      logger.warn('DATABASE_URL non configuré pour getAdminTransactions');
      res.json({
        success: true,
        data: [],
        pagination: { page, limit, total: 0, totalPages: 0 },
      });
      return;
    }

    let query = `
      SELECT 
        t.*,
        o.id as order_id_full,
        u.email as user_email,
        u.phone as user_phone,
        u.first_name as user_first_name,
        u.last_name as user_last_name,
        d.email as driver_email,
        d.phone as driver_phone
      FROM transactions t
      LEFT JOIN orders o ON t.order_id = o.id
      LEFT JOIN users u ON t.user_id = u.id
      LEFT JOIN users d ON o.driver_id = d.id
      WHERE 1=1
    `;

    const params: any[] = [];
    let paramIndex = 1;

    if (status) {
      query += ` AND t.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (method) {
      query += ` AND t.payment_method_type = $${paramIndex}`;
      params.push(method);
      paramIndex++;
    }

    if (startDate) {
      query += ` AND t.created_at >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      query += ` AND t.created_at <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }

    if (search) {
      const searchPattern = `%${search}%`;
      query += ` AND (
        t.id::text ILIKE $${paramIndex} OR
        t.order_id::text ILIKE $${paramIndex} OR
        u.email ILIKE $${paramIndex} OR
        u.phone ILIKE $${paramIndex} OR
        u.first_name ILIKE $${paramIndex} OR
        u.last_name ILIKE $${paramIndex} OR
        CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, '')) ILIKE $${paramIndex}
      )`;
      // Utiliser le même pattern pour tous les champs de recherche
      params.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
      paramIndex += 7;
    }

    const countQuery = query.replace(/SELECT[\s\S]*?FROM/, 'SELECT COUNT(*) as count FROM');

    query += ` ORDER BY t.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await (pool as any).query(query, params);
    const countResult = await (pool as any).query(countQuery, params.slice(0, -2));
    const total = parseInt(countResult.rows[0]?.count || '0');

    res.json({
      success: true,
      data: result.rows || [],
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    logger.error('Erreur getAdminTransactions:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur',
      error: error.message,
    });
  }
};

/**
 * Génère un rapport des livraisons
 */
export const getAdminReportDeliveries = async (req: Request, res: Response): Promise<void> => {
  try {
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;
    const status = req.query.status as string | undefined;
    const driverId = req.query.driverId as string | undefined;

    logger.info('🚀 [getAdminReportDeliveries] DÉBUT', { startDate, endDate, status, driverId });

    if (!process.env.DATABASE_URL) {
      res.json({ success: true, data: [] });
      return;
    }

    let query = `
      SELECT 
        o.*,
        u.first_name as user_first_name,
        u.last_name as user_last_name,
        u.email as user_email,
        u.phone as user_phone,
        d.first_name as driver_first_name,
        d.last_name as driver_last_name,
        d.email as driver_email,
        d.phone as driver_phone
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      LEFT JOIN users d ON o.driver_id = d.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (startDate) {
      query += ` AND o.created_at >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      query += ` AND o.created_at <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }

    if (status && status !== 'all') {
      query += ` AND o.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (driverId) {
      query += ` AND o.driver_id = $${paramIndex}`;
      params.push(driverId);
      paramIndex++;
    }

    query += ` ORDER BY o.created_at DESC`;

    const result = await (pool as any).query(query, params);

    res.json({
      success: true,
      data: result.rows || [],
    });
  } catch (error: any) {
    logger.error('Erreur getAdminReportDeliveries:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur', error: error.message });
  }
};

/**
 * Génère un rapport des revenus
 */
export const getAdminReportRevenues = async (req: Request, res: Response): Promise<void> => {
  try {
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;
    const driverId = req.query.driverId as string | undefined;
    const deliveryType = req.query.deliveryType as string | undefined;

    logger.info('🚀 [getAdminReportRevenues] DÉBUT');

    if (!process.env.DATABASE_URL) {
      res.json({ success: true, data: [] });
      return;
    }

    const priceColumnsInfo = await (pool as any).query(
      `SELECT column_name FROM information_schema.columns 
       WHERE table_schema = 'public' AND table_name = 'orders' 
       AND column_name = ANY($1)`,
      [['price_cfa', 'price']]
    );
    const priceColumnSet = new Set(priceColumnsInfo.rows.map((row: any) => row.column_name));
    const priceColumn = priceColumnSet.has('price_cfa') ? 'price_cfa' : priceColumnSet.has('price') ? 'price' : null;

    if (!priceColumn) {
      res.json({ success: true, data: [] });
      return;
    }

    let query = `
      SELECT 
        DATE_TRUNC('day', completed_at) as date,
        COUNT(*) as deliveries,
        COALESCE(SUM(${priceColumn}), 0) as revenue,
        delivery_method
      FROM orders
      WHERE status = 'completed' AND completed_at IS NOT NULL
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (startDate) {
      query += ` AND completed_at >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      query += ` AND completed_at <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }

    if (driverId) {
      query += ` AND driver_id = $${paramIndex}`;
      params.push(driverId);
      paramIndex++;
    }

    if (deliveryType) {
      query += ` AND delivery_method = $${paramIndex}`;
      params.push(deliveryType);
      paramIndex++;
    }

    query += ` GROUP BY DATE_TRUNC('day', completed_at), delivery_method ORDER BY date DESC`;

    const result = await (pool as any).query(query, params);

    res.json({
      success: true,
      data: result.rows || [],
    });
  } catch (error: any) {
    logger.error('Erreur getAdminReportRevenues:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur', error: error.message });
  }
};

/**
 * Génère un rapport des clients
 */
export const getAdminReportClients = async (req: Request, res: Response): Promise<void> => {
  try {
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;

    logger.info('🚀 [getAdminReportClients] DÉBUT');

    if (!process.env.DATABASE_URL) {
      res.json({ success: true, data: [] });
      return;
    }

    let query = `
      SELECT 
        u.id,
        u.email,
        u.phone,
        u.first_name,
        u.last_name,
        u.role,
        u.created_at,
        COUNT(DISTINCT o.id) as total_orders,
        COUNT(DISTINCT CASE WHEN o.status = 'completed' THEN o.id END) as completed_orders
      FROM users u
      LEFT JOIN orders o ON o.user_id = u.id
      WHERE u.role = 'client'
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (startDate) {
      query += ` AND (u.created_at >= $${paramIndex} OR o.created_at >= $${paramIndex})`;
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      query += ` AND (u.created_at <= $${paramIndex} OR o.created_at <= $${paramIndex})`;
      params.push(endDate);
      paramIndex++;
    }

    query += ` GROUP BY u.id, u.email, u.phone, u.first_name, u.last_name, u.role, u.created_at ORDER BY total_orders DESC`;

    const result = await (pool as any).query(query, params);

    res.json({
      success: true,
      data: result.rows || [],
    });
  } catch (error: any) {
    logger.error('Erreur getAdminReportClients:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur', error: error.message });
  }
};

/**
 * Génère un rapport des drivers
 */
export const getAdminReportDrivers = async (req: Request, res: Response): Promise<void> => {
  try {
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;

    logger.info('🚀 [getAdminReportDrivers] DÉBUT');

    if (!process.env.DATABASE_URL) {
      res.json({ success: true, data: [] });
      return;
    }

    const priceColumnsInfo = await (pool as any).query(
      `SELECT column_name FROM information_schema.columns 
       WHERE table_schema = 'public' AND table_name = 'orders' 
       AND column_name = ANY($1)`,
      [['price_cfa', 'price']]
    );
    const priceColumnSet = new Set(priceColumnsInfo.rows.map((row: any) => row.column_name));
    const priceColumn = priceColumnSet.has('price_cfa') ? 'price_cfa' : priceColumnSet.has('price') ? 'price' : null;

    let query = `
      SELECT 
        u.id,
        u.email,
        u.phone,
        u.first_name,
        u.last_name,
        u.created_at,
        COUNT(DISTINCT o.id) as total_deliveries,
        COUNT(DISTINCT CASE WHEN o.status = 'completed' THEN o.id END) as completed_deliveries,
        COALESCE(SUM(CASE WHEN o.status = 'completed' THEN ${priceColumn || '0'} ELSE 0 END), 0) as total_revenue
      FROM users u
      LEFT JOIN orders o ON o.driver_id = u.id
      WHERE u.role = 'driver'
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (startDate) {
      query += ` AND (u.created_at >= $${paramIndex} OR o.created_at >= $${paramIndex})`;
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      query += ` AND (u.created_at <= $${paramIndex} OR o.created_at <= $${paramIndex})`;
      params.push(endDate);
      paramIndex++;
    }

    query += ` GROUP BY u.id, u.email, u.phone, u.first_name, u.last_name, u.created_at ORDER BY total_revenue DESC`;

    const result = await (pool as any).query(query, params);

    // Ajouter les ratings pour chaque driver
    const driversWithRatings = await Promise.all(
      result.rows.map(async (driver: any) => {
        try {
          const ratingsTableCheck = await (pool as any).query(
            `SELECT EXISTS (
              SELECT 1 FROM information_schema.tables 
              WHERE table_schema = 'public' AND table_name = 'ratings'
            )`
          );
          if (ratingsTableCheck.rows[0]?.exists) {
            const ratingResult = await (pool as any).query(
              `SELECT COALESCE(AVG(rating)::numeric, 5.0) as avg_rating, COUNT(*) as count 
               FROM ratings WHERE driver_id = $1`,
              [driver.id]
            );
            if (ratingResult.rows[0]) {
              driver.averageRating = parseFloat(ratingResult.rows[0].avg_rating || '5.0');
              driver.totalRatings = parseInt(ratingResult.rows[0].count || '0');
            } else {
              driver.averageRating = 5.0;
              driver.totalRatings = 0;
            }
          } else {
            driver.averageRating = 5.0;
            driver.totalRatings = 0;
          }
        } catch {
          driver.averageRating = 5.0;
          driver.totalRatings = 0;
        }
        return driver;
      })
    );

    res.json({
      success: true,
      data: driversWithRatings,
    });
  } catch (error: any) {
    logger.error('Erreur getAdminReportDrivers:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur', error: error.message });
  }
};

/**
 * Génère un rapport des paiements
 */
export const getAdminReportPayments = async (req: Request, res: Response): Promise<void> => {
  try {
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;

    logger.info('🚀 [getAdminReportPayments] DÉBUT');

    if (!process.env.DATABASE_URL) {
      res.json({ success: true, data: [] });
      return;
    }

    let query = `
      SELECT 
        DATE_TRUNC('day', t.created_at) as date,
        t.payment_method_type,
        t.status,
        COUNT(*) as count,
        COALESCE(SUM(t.amount), 0) as total_amount
      FROM transactions t
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (startDate) {
      query += ` AND t.created_at >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      query += ` AND t.created_at <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }

    query += ` GROUP BY DATE_TRUNC('day', t.created_at), t.payment_method_type, t.status ORDER BY date DESC`;

    const result = await (pool as any).query(query, params);

    res.json({
      success: true,
      data: result.rows || [],
    });
  } catch (error: any) {
    logger.error('Erreur getAdminReportPayments:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur', error: error.message });
  }
};

/**
 * Récupère les détails complets d'un driver pour l'admin
 */
export const getAdminDriverDetails = async (req: Request, res: Response): Promise<void> => {
  try {
    const { driverId } = req.params;

    logger.info('🚀 [getAdminDriverDetails] DÉBUT', { driverId });

    if (!process.env.DATABASE_URL) {
      res.status(404).json({ success: false, message: 'Driver non trouvé' });
      return;
    }

    // Récupérer les infos utilisateur
    const userResult = await (pool as any).query(
      `SELECT id, email, phone, first_name, last_name, role, created_at, avatar_url
       FROM users
       WHERE id = $1 AND role = 'driver'`,
      [driverId]
    );

    if (userResult.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Driver non trouvé' });
      return;
    }

    const user = userResult.rows[0];

    // Récupérer le profil driver (si table existe)
    let driverProfile: any = null;
    try {
      const profileResult = await (pool as any).query(
        `SELECT * FROM driver_profiles WHERE user_id = $1`,
        [driverId]
      );
      if (profileResult.rows.length > 0) {
        driverProfile = profileResult.rows[0];
      }
    } catch (profileError) {
      logger.warn('Table driver_profiles non disponible:', profileError);
    }

    // Statistiques
    const priceColumnsInfo = await (pool as any).query(
      `SELECT column_name FROM information_schema.columns 
       WHERE table_schema = 'public' AND table_name = 'orders' 
       AND column_name = ANY($1)`,
      [['price_cfa', 'price']]
    );
    const priceColumnSet = new Set(priceColumnsInfo.rows.map((row: any) => row.column_name));
    const priceColumn = priceColumnSet.has('price_cfa') ? 'price_cfa' : priceColumnSet.has('price') ? 'price' : null;

    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - 7);
    startOfWeek.setHours(0, 0, 0, 0);

    // Statistiques des livraisons
    const statsQuery = `
      SELECT 
        COUNT(*) FILTER (WHERE status = 'completed') as total_completed,
        COUNT(*) FILTER (WHERE status = 'completed' AND completed_at >= $1) as today_completed,
        COUNT(*) FILTER (WHERE status = 'completed' AND completed_at >= $2) as week_completed,
        COALESCE(SUM(${priceColumn || '0'}) FILTER (WHERE status = 'completed'), 0) as total_revenue,
        COALESCE(AVG(EXTRACT(EPOCH FROM (completed_at - created_at)) / 60) FILTER (WHERE status = 'completed' AND completed_at IS NOT NULL), 0) as avg_delivery_time,
        COALESCE(SUM(distance) FILTER (WHERE status = 'completed'), 0) as total_distance
      FROM orders
      WHERE driver_id = $3
    `;

    const statsResult = await (pool as any).query(statsQuery, [
      startOfToday.toISOString(),
      startOfWeek.toISOString(),
      driverId,
    ]);

    const stats = statsResult.rows[0] || {};

    // Rating
    let averageRating = 5.0;
    let totalRatings = 0;
    try {
      const ratingsTableCheck = await (pool as any).query(
        `SELECT EXISTS (
          SELECT 1 FROM information_schema.tables 
          WHERE table_schema = 'public' AND table_name = 'ratings'
        )`
      );
      if (ratingsTableCheck.rows[0]?.exists) {
        const ratingResult = await (pool as any).query(
          `SELECT COALESCE(AVG(rating)::numeric, 5.0) as avg_rating, COUNT(*) as count 
           FROM ratings WHERE driver_id = $1`,
          [driverId]
        );
        if (ratingResult.rows[0]) {
          averageRating = parseFloat(ratingResult.rows[0].avg_rating || '5.0');
          totalRatings = parseInt(ratingResult.rows[0].count || '0');
        }
      }
    } catch (ratingError) {
      logger.warn('Erreur calcul rating:', ratingError);
    }

    // Taux d'acceptation (commandes acceptées / commandes assignées)
    const acceptanceQuery = `
      SELECT 
        COUNT(*) FILTER (WHERE status IN ('accepted', 'enroute', 'picked_up', 'completed')) as accepted,
        COUNT(*) as total_assigned
      FROM orders
      WHERE driver_id = $1
    `;
    const acceptanceResult = await (pool as any).query(acceptanceQuery, [driverId]);
    const acceptanceRate =
      acceptanceResult.rows[0]?.total_assigned > 0
        ? (acceptanceResult.rows[0].accepted / acceptanceResult.rows[0].total_assigned) * 100
        : 0;

    // Compter les livraisons annulées
    const cancelledQuery = `
      SELECT COUNT(*) as cancelled_count
      FROM orders
      WHERE driver_id = $1 AND status = 'cancelled'
    `;
    const cancelledResult = await (pool as any).query(cancelledQuery, [driverId]);
    const cancelledDeliveries = parseInt(cancelledResult.rows[0]?.cancelled_count || '0');

    // Récupérer les courses en attente de paiement (orders complétées avec paiement partiel/différé ou sans transaction complète)
    let pendingPaymentOrders: any[] = [];
    try {
      // D'abord, récupérer TOUTES les orders complétées du livreur (sans filtre sur les transactions)
      // Ensuite, on calculera côté application si elles sont en attente de paiement
      const allCompletedOrdersQuery = `
        SELECT 
          o.id as order_id,
          o.created_at as order_created_at,
          o.status as order_status,
          ${priceColumn || '0'} as order_amount,
          u.id as client_id,
          u.first_name as client_first_name,
          u.last_name as client_last_name,
          u.email as client_email,
          u.phone as client_phone
        FROM orders o
        LEFT JOIN users u ON o.user_id = u.id
        WHERE o.driver_id = $1
          AND o.status = 'completed'
        ORDER BY o.created_at DESC
        LIMIT 500
      `;
      const allCompletedOrdersResult = await (pool as any).query(allCompletedOrdersQuery, [driverId]);

      logger.info(`[getAdminDriverDetails] Récupéré ${allCompletedOrdersResult.rows.length} orders complétées pour driver ${driverId}`);

      // Pour chaque order, récupérer toutes ses transactions et déterminer si elle est en attente de paiement
      const pendingPaymentResult = {
        rows: [] as any[]
      };

      for (const orderRow of allCompletedOrdersResult.rows) {
        const orderId = orderRow.order_id;

        // Récupérer toutes les transactions pour cette order
        const transactionsQuery = `
          SELECT 
            id,
            amount,
            partial_amount,
            remaining_amount,
            is_partial,
            payment_method_type,
            status,
            created_at
          FROM transactions
          WHERE order_id = $1
          ORDER BY created_at DESC
        `;
        const transactionsResult = await (pool as any).query(transactionsQuery, [orderId]);
        const transactions = transactionsResult.rows || [];

        // Calculer le montant total payé
        let totalPaid = 0;
        let latestRemaining = 0;
        let latestTransaction: any = null;

        if (transactions.length > 0) {
          // Utiliser la transaction la plus récente pour les infos de statut
          latestTransaction = transactions[0];

          // Calculer le total payé en additionnant toutes les transactions
          for (const tx of transactions) {
            const paidAmount = tx.partial_amount && tx.partial_amount > 0
              ? parseFloat(tx.partial_amount)
              : parseFloat(tx.amount || '0');
            totalPaid += paidAmount;
          }

          latestRemaining = parseFloat(latestTransaction.remaining_amount || '0');
        }

        const orderAmount = parseFloat(orderRow.order_amount || '0');
        const remainingAmount = latestRemaining > 0
          ? latestRemaining
          : Math.max(0, orderAmount - totalPaid);

        // Déterminer si cette order est en attente de paiement
        const isPendingPayment =
          transactions.length === 0 || // Pas de transaction = en attente
          latestTransaction?.is_partial === true || // Paiement partiel
          latestTransaction?.payment_method_type === 'deferred' || // Paiement différé
          remainingAmount > 0 || // Montant restant > 0
          (latestTransaction?.status && latestTransaction.status !== 'paid'); // Transaction non payée

        if (isPendingPayment) {
          pendingPaymentResult.rows.push({
            order_id: orderId,
            order_created_at: orderRow.order_created_at,
            order_status: orderRow.order_status,
            order_amount: orderAmount,
            transaction_id: latestTransaction?.id || null,
            transaction_amount: latestTransaction?.amount || orderAmount,
            partial_amount: totalPaid,
            remaining_amount: remainingAmount,
            is_partial: latestTransaction?.is_partial || false,
            payment_method_type: latestTransaction?.payment_method_type || null,
            transaction_status: latestTransaction?.status || null,
            transaction_created_at: latestTransaction?.created_at || null,
            client_id: orderRow.client_id,
            client_first_name: orderRow.client_first_name,
            client_last_name: orderRow.client_last_name,
            client_email: orderRow.client_email,
            client_phone: orderRow.client_phone,
          });
        }
      }

      logger.info(`[getAdminDriverDetails] ${pendingPaymentResult.rows.length} orders en attente de paiement pour driver ${driverId}`);

      // Mapper les résultats au format attendu
      pendingPaymentOrders = pendingPaymentResult.rows.map((row: any) => ({
        orderId: row.order_id,
        orderCreatedAt: row.order_created_at,
        orderStatus: row.order_status,
        orderAmount: parseFloat(row.order_amount || '0'),
        transactionId: row.transaction_id || null,
        transactionAmount: parseFloat(row.transaction_amount || row.order_amount || '0'),
        partialAmount: parseFloat(row.partial_amount || '0'),
        remainingAmount: parseFloat(row.remaining_amount || '0'),
        isPartial: row.is_partial || false,
        paymentMethodType: row.payment_method_type || null,
        transactionStatus: row.transaction_status || null,
        transactionCreatedAt: row.transaction_created_at || null,
        client: {
          id: row.client_id,
          firstName: row.client_first_name,
          lastName: row.client_last_name,
          email: row.client_email,
          phone: row.client_phone,
        },
      }));
    } catch (pendingPaymentError) {
      logger.warn('Erreur récupération courses en attente de paiement:', pendingPaymentError);
    }

    // Récupérer l'historique des courses récentes (toutes les courses du livreur)
    let recentOrders: any[] = [];
    try {
      // Utiliser une sous-requête LATERAL pour obtenir la transaction la plus récente par order
      const recentOrdersQuery = `
        SELECT 
          o.id,
          o.status,
          o.created_at,
          o.accepted_at,
          o.completed_at,
          o.cancelled_at,
          ${priceColumn || '0'} as price,
          o.distance,
          o.delivery_method,
          u.id as client_id,
          u.first_name as client_first_name,
          u.last_name as client_last_name,
          u.email as client_email,
          t.id as transaction_id,
          COALESCE(t.amount, ${priceColumn || '0'}) as transaction_amount,
          COALESCE(t.partial_amount, 0) as partial_amount,
          COALESCE(t.remaining_amount, CASE WHEN t.id IS NULL THEN ${priceColumn || '0'} ELSE 0 END) as remaining_amount,
          COALESCE(t.is_partial, false) as is_partial,
          t.payment_method_type,
          t.status as transaction_status
        FROM orders o
        LEFT JOIN users u ON o.user_id = u.id
        LEFT JOIN LATERAL (
          SELECT * FROM transactions 
          WHERE order_id = o.id 
          ORDER BY created_at DESC 
          LIMIT 1
        ) t ON true
        WHERE o.driver_id = $1
        ORDER BY o.created_at DESC
        LIMIT 200
      `;
      const recentOrdersResult = await (pool as any).query(recentOrdersQuery, [driverId]);

      logger.info(`[getAdminDriverDetails] Récupéré ${recentOrdersResult.rows.length} orders pour l'historique du driver ${driverId}`);

      // Pour chaque order, calculer correctement le montant payé et restant en tenant compte de toutes les transactions
      recentOrders = await Promise.all(recentOrdersResult.rows.map(async (row: any) => {
        const orderId = row.id;
        const orderAmount = parseFloat(row.price || '0');

        // Récupérer toutes les transactions pour cette order
        const allTransactionsQuery = `
          SELECT 
            id,
            amount,
            partial_amount,
            remaining_amount,
            is_partial,
            payment_method_type,
            status,
            created_at
          FROM transactions
          WHERE order_id = $1
          ORDER BY created_at DESC
        `;
        const transactionsResult = await (pool as any).query(allTransactionsQuery, [orderId]);
        const transactions = transactionsResult.rows || [];

        // Calculer le montant total payé
        let totalPaid = 0;
        let latestRemaining = 0;
        let latestTransaction: any = null;

        if (transactions.length > 0) {
          latestTransaction = transactions[0];

          // Calculer le total payé en additionnant toutes les transactions
          for (const tx of transactions) {
            const paidAmount = tx.partial_amount && tx.partial_amount > 0
              ? parseFloat(tx.partial_amount)
              : parseFloat(tx.amount || '0');
            totalPaid += paidAmount;
          }

          latestRemaining = parseFloat(latestTransaction.remaining_amount || '0');
        }

        const remainingAmount = latestRemaining > 0
          ? latestRemaining
          : (row.status === 'completed' ? Math.max(0, orderAmount - totalPaid) : 0);

        // Déterminer le statut de paiement
        let paymentStatus: 'paid' | 'partial' | 'pending' | 'none' = 'none';
        if (row.status === 'completed') {
          if (transactions.length === 0) {
            paymentStatus = 'pending'; // Pas de transaction = en attente
          } else if (latestTransaction.status === 'paid' && remainingAmount === 0) {
            paymentStatus = 'paid'; // Payé complètement
          } else if (latestTransaction.is_partial === true || remainingAmount > 0) {
            paymentStatus = 'partial'; // Paiement partiel
          } else if (latestTransaction.status && latestTransaction.status !== 'paid') {
            paymentStatus = 'pending'; // Transaction non payée
          } else {
            paymentStatus = 'pending';
          }
        }

        return {
          id: row.id,
          status: row.status,
          createdAt: row.created_at,
          acceptedAt: row.accepted_at,
          completedAt: row.completed_at,
          cancelledAt: row.cancelled_at,
          price: orderAmount,
          distance: parseFloat(row.distance || '0'),
          deliveryMethod: row.delivery_method,
          client: {
            id: row.client_id,
            firstName: row.client_first_name,
            lastName: row.client_last_name,
            email: row.client_email,
          },
          payment: {
            status: paymentStatus,
            partialAmount: totalPaid,
            remainingAmount,
            transactionStatus: latestTransaction?.status || null,
          },
        };
      }));

      logger.info(`[getAdminDriverDetails] ${recentOrders.length} orders mappées pour l'historique du driver ${driverId}`);
    } catch (recentOrdersError) {
      logger.warn('Erreur récupération historique courses:', recentOrdersError);
    }

    res.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        first_name: user.first_name || null,
        last_name: user.last_name || null,
        createdAt: user.created_at,
        avatarUrl: user.avatar_url,
        // Profil driver
        profile: driverProfile
          ? {
            vehicleType: driverProfile.vehicle_type,
            vehiclePlate: driverProfile.vehicle_plate,
            vehicleBrand: driverProfile.vehicle_brand,
            vehicleModel: driverProfile.vehicle_model,
            vehicleColor: driverProfile.vehicle_color,
            licenseNumber: driverProfile.license_number,
            isOnline: driverProfile.is_online || false,
            isAvailable: driverProfile.is_available || false,
            currentLatitude: driverProfile.current_latitude,
            currentLongitude: driverProfile.current_longitude,
            lastLocationUpdate: driverProfile.last_location_update,
          }
          : null,
        // Statistiques
        statistics: {
          totalDeliveries: parseInt(stats.total_completed || '0'),
          todayDeliveries: parseInt(stats.today_completed || '0'),
          weekDeliveries: parseInt(stats.week_completed || '0'),
          cancelledDeliveries,
          totalRevenue: parseFloat(stats.total_revenue || '0'),
          averageRevenuePerDelivery:
            parseInt(stats.total_completed || '0') > 0
              ? parseFloat(stats.total_revenue || '0') / parseInt(stats.total_completed || '0')
              : 0,
          averageDeliveryTime: Math.round(parseFloat(stats.avg_delivery_time || '0')),
          totalDistance: parseFloat(stats.total_distance || '0'),
          averageRating,
          totalRatings,
          acceptanceRate: Math.round(acceptanceRate * 10) / 10,
        },
        // Courses en attente de paiement
        pendingPaymentOrders,
        // Historique des courses récentes
        recentOrders,
      },
    });
  } catch (error: any) {
    logger.error('Erreur getAdminDriverDetails:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur', error: error.message });
  }
};

/**
 * Met à jour le statut d'un driver (activer/désactiver)
 */
export const updateAdminDriverStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { driverId } = req.params;
    const { isActive } = req.body;

    logger.info('🚀 [updateAdminDriverStatus] DÉBUT', { driverId, isActive });

    if (!process.env.DATABASE_URL) {
      res.status(400).json({ success: false, message: 'Database non disponible' });
      return;
    }

    // Mettre à jour dans users (ajouter un champ is_active si nécessaire, ou utiliser un autre mécanisme)
    // Pour l'instant, on peut mettre à jour driver_profiles
    try {
      await (pool as any).query(
        `UPDATE driver_profiles SET is_online = $1, is_available = $1, updated_at = NOW() WHERE user_id = $2`,
        [isActive, driverId]
      );
    } catch (updateError) {
      logger.warn('Erreur mise à jour driver_profiles:', updateError);
      // Continuer même si la table n'existe pas
    }

    res.json({
      success: true,
      message: `Driver ${isActive ? 'activé' : 'désactivé'} avec succès`,
    });
  } catch (error: any) {
    logger.error('Erreur updateAdminDriverStatus:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur', error: error.message });
  }
};

/**
 * Récupère les détails complets d'un client pour l'admin
 */
export const getAdminClientDetails = async (req: Request, res: Response): Promise<void> => {
  try {
    const { clientId } = req.params;

    logger.info('🚀 [getAdminClientDetails] DÉBUT', { clientId });

    if (!process.env.DATABASE_URL) {
      res.status(404).json({ success: false, message: 'Client non trouvé' });
      return;
    }

    // Récupérer les infos utilisateur
    const userResult = await (pool as any).query(
      `SELECT id, email, phone, first_name, last_name, role, created_at, avatar_url
       FROM users
       WHERE id = $1 AND role = 'client'`,
      [clientId]
    );

    if (userResult.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Client non trouvé' });
      return;
    }

    const user = userResult.rows[0];

    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - 7);
    startOfWeek.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const priceColumnsInfo = await (pool as any).query(
      `SELECT column_name FROM information_schema.columns 
       WHERE table_schema = 'public' AND table_name = 'orders' 
       AND column_name = ANY($1)`,
      [['price_cfa', 'price']]
    );
    const priceColumnSet = new Set(priceColumnsInfo.rows.map((row: any) => row.column_name));
    const priceColumn = priceColumnSet.has('price_cfa') ? 'price_cfa' : priceColumnSet.has('price') ? 'price' : null;

    // Statistiques des commandes
    const statsQuery = `
      SELECT 
        COUNT(*) as total_orders,
        COUNT(*) FILTER (WHERE created_at >= $1) as week_orders,
        COUNT(*) FILTER (WHERE created_at >= $2) as month_orders,
        COUNT(*) FILTER (WHERE status = 'completed') as completed_orders,
        COALESCE(SUM(${priceColumn || '0'}) FILTER (WHERE status = 'completed'), 0) as total_spent
      FROM orders
      WHERE user_id = $3
    `;

    const statsResult = await (pool as any).query(statsQuery, [
      startOfWeek.toISOString(),
      startOfMonth.toISOString(),
      clientId,
    ]);

    const stats = statsResult.rows[0] || {};

    // Rating moyen donné par le client
    let averageRatingGiven = 0;
    let totalRatingsGiven = 0;
    try {
      const ratingsTableCheck = await (pool as any).query(
        `SELECT EXISTS (
          SELECT 1 FROM information_schema.tables 
          WHERE table_schema = 'public' AND table_name = 'ratings'
        )`
      );
      if (ratingsTableCheck.rows[0]?.exists) {
        const ratingResult = await (pool as any).query(
          `SELECT COALESCE(AVG(rating)::numeric, 0) as avg_rating, COUNT(*) as count 
           FROM ratings WHERE user_id = $1`,
          [clientId]
        );
        if (ratingResult.rows[0]) {
          averageRatingGiven = parseFloat(ratingResult.rows[0].avg_rating || '0');
          totalRatingsGiven = parseInt(ratingResult.rows[0].count || '0');
        }
      }
    } catch (ratingError) {
      logger.warn('Erreur calcul rating donné:', ratingError);
    }

    // Points de fidélité (si table existe)
    let loyaltyPoints = 0;
    try {
      const loyaltyResult = await (pool as any).query(
        `SELECT loyalty_points FROM users WHERE id = $1`,
        [clientId]
      );
      if (loyaltyResult.rows[0]?.loyalty_points) {
        loyaltyPoints = parseInt(loyaltyResult.rows[0].loyalty_points || '0');
      }
    } catch (loyaltyError) {
      // Colonne peut ne pas exister
    }

    // Récupérer les informations sur les paiements différés
    let deferredPayments = {
      totalPaid: 0,
      totalRemaining: 0,
      totalDue: 0,
      globalStatus: 'paid' as 'paid' | 'partially_paid' | 'unpaid',
      transactions: [] as any[],
    };

    try {
      // Récupérer toutes les transactions avec paiement différé ou partiel
      const deferredTransactionsQuery = `
        SELECT 
          t.id,
          t.order_id,
          t.amount,
          t.partial_amount,
          t.remaining_amount,
          t.is_partial,
          t.payment_method_type,
          t.status,
          t.created_at,
          o.id as order_id_full
        FROM transactions t
        LEFT JOIN orders o ON t.order_id = o.id
        WHERE t.user_id = $1 
          AND (t.is_partial = true OR t.payment_method_type = 'deferred' OR t.remaining_amount > 0)
        ORDER BY t.created_at DESC
      `;

      const deferredResult = await (pool as any).query(deferredTransactionsQuery, [clientId]);
      const transactions = deferredResult.rows || [];

      // Calculer les totaux
      let totalPaid = 0;
      let totalRemaining = 0;

      transactions.forEach((tx: any) => {
        const partialAmount = parseFloat(tx.partial_amount || tx.amount || '0');
        const remainingAmount = parseFloat(tx.remaining_amount || '0');

        totalPaid += partialAmount;
        totalRemaining += remainingAmount;
      });

      // Déterminer le statut global
      let globalStatus: 'paid' | 'partially_paid' | 'unpaid' = 'paid';
      if (totalRemaining > 0) {
        globalStatus = totalPaid > 0 ? 'partially_paid' : 'unpaid';
      }

      deferredPayments = {
        totalPaid,
        totalRemaining,
        totalDue: totalPaid + totalRemaining,
        globalStatus,
        transactions: transactions.map((tx: any) => ({
          id: tx.id,
          orderId: tx.order_id || tx.order_id_full,
          amount: parseFloat(tx.amount || '0'),
          partialAmount: parseFloat(tx.partial_amount || '0'),
          remainingAmount: parseFloat(tx.remaining_amount || '0'),
          isPartial: tx.is_partial || false,
          paymentMethodType: tx.payment_method_type,
          status: tx.status,
          createdAt: tx.created_at,
        })),
      };
    } catch (deferredError) {
      logger.warn('Erreur récupération paiements différés:', deferredError);
    }

    res.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        first_name: user.first_name || null,
        last_name: user.last_name || null,
        createdAt: user.created_at,
        avatarUrl: user.avatar_url,
        statistics: {
          totalOrders: parseInt(stats.total_orders || '0'),
          weekOrders: parseInt(stats.week_orders || '0'),
          monthOrders: parseInt(stats.month_orders || '0'),
          completedOrders: parseInt(stats.completed_orders || '0'),
          totalSpent: parseFloat(stats.total_spent || '0'),
          loyaltyPoints,
          averageRatingGiven,
          totalRatingsGiven,
        },
        deferredPayments,
      },
    });
  } catch (error: any) {
    logger.error('Erreur getAdminClientDetails:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur', error: error.message });
  }
};

/**
 * Récupère les statistiques d'un client
 */
export const getAdminClientStatistics = async (req: Request, res: Response): Promise<void> => {
  try {
    const { clientId } = req.params;

    logger.info('🚀 [getAdminClientStatistics] DÉBUT', { clientId });

    if (!process.env.DATABASE_URL) {
      res.json({ success: true, data: {} });
      return;
    }

    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - 7);
    startOfWeek.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const priceColumnsInfo = await (pool as any).query(
      `SELECT column_name FROM information_schema.columns 
       WHERE table_schema = 'public' AND table_name = 'orders' 
       AND column_name = ANY($1)`,
      [['price_cfa', 'price']]
    );
    const priceColumnSet = new Set(priceColumnsInfo.rows.map((row: any) => row.column_name));
    const priceColumn = priceColumnSet.has('price_cfa') ? 'price_cfa' : priceColumnSet.has('price') ? 'price' : null;

    const statsQuery = `
      SELECT 
        COUNT(*) as total_orders,
        COUNT(*) FILTER (WHERE created_at >= $1) as week_orders,
        COUNT(*) FILTER (WHERE created_at >= $2) as month_orders,
        COUNT(*) FILTER (WHERE status = 'completed') as completed_orders,
        COALESCE(SUM(${priceColumn || '0'}) FILTER (WHERE status = 'completed'), 0) as total_spent
      FROM orders
      WHERE user_id = $3
    `;

    const statsResult = await (pool as any).query(statsQuery, [
      startOfWeek.toISOString(),
      startOfMonth.toISOString(),
      clientId,
    ]);

    const stats = statsResult.rows[0] || {};

    let averageRatingGiven = 0;
    let totalRatingsGiven = 0;
    try {
      const ratingsTableCheck = await (pool as any).query(
        `SELECT EXISTS (
          SELECT 1 FROM information_schema.tables 
          WHERE table_schema = 'public' AND table_name = 'ratings'
        )`
      );
      if (ratingsTableCheck.rows[0]?.exists) {
        const ratingResult = await (pool as any).query(
          `SELECT COALESCE(AVG(rating)::numeric, 0) as avg_rating, COUNT(*) as count 
           FROM ratings WHERE user_id = $1`,
          [clientId]
        );
        if (ratingResult.rows[0]) {
          averageRatingGiven = parseFloat(ratingResult.rows[0].avg_rating || '0');
          totalRatingsGiven = parseInt(ratingResult.rows[0].count || '0');
        }
      }
    } catch (ratingError) {
      logger.warn('Erreur calcul rating donné:', ratingError);
    }

    let loyaltyPoints = 0;
    try {
      const loyaltyResult = await (pool as any).query(
        `SELECT loyalty_points FROM users WHERE id = $1`,
        [clientId]
      );
      if (loyaltyResult.rows[0]?.loyalty_points) {
        loyaltyPoints = parseInt(loyaltyResult.rows[0].loyalty_points || '0');
      }
    } catch (loyaltyError) {
      // Colonne peut ne pas exister
    }

    res.json({
      success: true,
      data: {
        totalOrders: parseInt(stats.total_orders || '0'),
        weekOrders: parseInt(stats.week_orders || '0'),
        monthOrders: parseInt(stats.month_orders || '0'),
        completedOrders: parseInt(stats.completed_orders || '0'),
        totalSpent: parseFloat(stats.total_spent || '0'),
        loyaltyPoints,
        averageRatingGiven,
        totalRatingsGiven,
      },
    });
  } catch (error: any) {
    logger.error('Erreur getAdminClientStatistics:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur', error: error.message });
  }
};

/**
 * Récupère toutes les évaluations pour l'admin
 */
export const getAdminRatings = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;
    const driverId = req.query.driverId as string | undefined;
    const clientId = req.query.clientId as string | undefined;
    const minRating = req.query.minRating ? parseInt(req.query.minRating as string) : undefined;
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;

    logger.info('🚀 [getAdminRatings] DÉBUT', { page, limit, driverId, clientId });

    if (!process.env.DATABASE_URL) {
      res.json({
        success: true,
        data: [],
        pagination: { page, limit, total: 0, totalPages: 0 },
      });
      return;
    }

    // Vérifier si la table ratings existe
    const ratingsTableCheck = await (pool as any).query(
      `SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'ratings'
      )`
    );

    if (!ratingsTableCheck.rows[0]?.exists) {
      res.json({
        success: true,
        data: [],
        pagination: { page, limit, total: 0, totalPages: 0 },
      });
      return;
    }

    let query = `
      SELECT 
        r.*,
        u.email as user_email,
        u.phone as user_phone,
        u.first_name as user_first_name,
        u.last_name as user_last_name,
        d.email as driver_email,
        d.phone as driver_phone,
        d.first_name as driver_first_name,
        d.last_name as driver_last_name,
        o.id as order_id_full
      FROM ratings r
      LEFT JOIN users u ON r.user_id = u.id
      LEFT JOIN users d ON r.driver_id = d.id
      LEFT JOIN orders o ON r.order_id = o.id
      WHERE 1=1
    `;

    const params: any[] = [];
    let paramIndex = 1;

    if (driverId) {
      query += ` AND r.driver_id = $${paramIndex}`;
      params.push(driverId);
      paramIndex++;
    }

    if (clientId) {
      query += ` AND r.user_id = $${paramIndex}`;
      params.push(clientId);
      paramIndex++;
    }

    if (minRating) {
      query += ` AND r.rating >= $${paramIndex}`;
      params.push(minRating);
      paramIndex++;
    }

    if (startDate) {
      query += ` AND r.created_at >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      query += ` AND r.created_at <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }

    const countQuery = query.replace(/SELECT[\s\S]*?FROM/, 'SELECT COUNT(*) as count FROM');

    query += ` ORDER BY r.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await (pool as any).query(query, params);
    const countResult = await (pool as any).query(countQuery, params.slice(0, -2));
    const total = parseInt(countResult.rows[0]?.count || '0');

    res.json({
      success: true,
      data: result.rows || [],
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    logger.error('Erreur getAdminRatings:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur', error: error.message });
  }
};

/**
 * Supprime une évaluation (modération)
 */
export const deleteAdminRating = async (req: Request, res: Response): Promise<void> => {
  try {
    const { ratingId } = req.params;

    logger.info('🚀 [deleteAdminRating] DÉBUT', { ratingId });

    if (!process.env.DATABASE_URL) {
      res.status(400).json({ success: false, message: 'Database non disponible' });
      return;
    }

    const ratingsTableCheck = await (pool as any).query(
      `SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'ratings'
      )`
    );

    if (!ratingsTableCheck.rows[0]?.exists) {
      res.status(404).json({ success: false, message: 'Évaluation non trouvée' });
      return;
    }

    const deleteResult = await (pool as any).query(`DELETE FROM ratings WHERE id = $1 RETURNING *`, [
      ratingId,
    ]);

    if (deleteResult.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Évaluation non trouvée' });
      return;
    }

    res.json({
      success: true,
      message: 'Évaluation supprimée avec succès',
    });
  } catch (error: any) {
    logger.error('Erreur deleteAdminRating:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur', error: error.message });
  }
};

/**
 * Récupère tous les codes promo
 */
export const getAdminPromoCodes = async (req: Request, res: Response): Promise<void> => {
  try {
    logger.info('🚀 [getAdminPromoCodes] DÉBUT');

    if (!process.env.DATABASE_URL) {
      res.json({ success: true, data: [] });
      return;
    }

    // Vérifier si la table existe
    const tableCheck = await (pool as any).query(
      `SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'promo_codes'
      )`
    );

    if (!tableCheck.rows[0]?.exists) {
      res.json({ success: true, data: [] });
      return;
    }

    const result = await (pool as any).query(
      `SELECT * FROM promo_codes ORDER BY created_at DESC`
    );

    res.json({
      success: true,
      data: result.rows || [],
    });
  } catch (error: any) {
    logger.error('Erreur getAdminPromoCodes:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur', error: error.message });
  }
};

/**
 * Crée un nouveau code promo
 */
export const createAdminPromoCode = async (req: Request, res: Response): Promise<void> => {
  try {
    const { code, discountType, discountValue, maxUses, validFrom, validUntil, isActive } = req.body;

    logger.info('🚀 [createAdminPromoCode] DÉBUT', { code });

    if (!process.env.DATABASE_URL) {
      res.status(400).json({ success: false, message: 'Database non disponible' });
      return;
    }

    // Vérifier si la table existe, sinon créer une structure simple
    const tableCheck = await (pool as any).query(
      `SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'promo_codes'
      )`
    );

    if (!tableCheck.rows[0]?.exists) {
      // Créer la table si elle n'existe pas
      await (pool as any).query(`
        CREATE TABLE IF NOT EXISTS promo_codes (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          code VARCHAR(50) UNIQUE NOT NULL,
          discount_type VARCHAR(20) NOT NULL,
          discount_value NUMERIC NOT NULL,
          max_uses INTEGER,
          current_uses INTEGER DEFAULT 0,
          valid_from TIMESTAMP,
          valid_until TIMESTAMP,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `);
    }

    const result = await (pool as any).query(
      `INSERT INTO promo_codes (code, discount_type, discount_value, max_uses, valid_from, valid_until, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [code, discountType, discountValue, maxUses || null, validFrom || null, validUntil || null, isActive !== false]
    );

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error: any) {
    logger.error('Erreur createAdminPromoCode:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur', error: error.message });
  }
};

/**
 * Récupère toutes les disputes
 */
export const getAdminDisputes = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;
    const status = req.query.status as string | undefined;

    logger.info('🚀 [getAdminDisputes] DÉBUT', { page, limit, status });

    if (!process.env.DATABASE_URL) {
      res.json({
        success: true,
        data: [],
        pagination: { page, limit, total: 0, totalPages: 0 },
      });
      return;
    }

    // Vérifier si la table existe
    const tableCheck = await (pool as any).query(
      `SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'payment_disputes'
      )`
    );

    if (!tableCheck.rows[0]?.exists) {
      res.json({
        success: true,
        data: [],
        pagination: { page, limit, total: 0, totalPages: 0 },
      });
      return;
    }

    let query = `
      SELECT 
        d.*,
        t.amount,
        t.payment_method_type,
        u.email as user_email,
        u.phone as user_phone,
        o.id as order_id_full
      FROM payment_disputes d
      LEFT JOIN transactions t ON d.transaction_id = t.id
      LEFT JOIN users u ON d.user_id = u.id
      LEFT JOIN orders o ON d.order_id = o.id
      WHERE 1=1
    `;

    const params: any[] = [];
    let paramIndex = 1;

    if (status) {
      query += ` AND d.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    const countQuery = query.replace(/SELECT[\s\S]*?FROM/, 'SELECT COUNT(*) as count FROM');

    query += ` ORDER BY d.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await (pool as any).query(query, params);
    const countResult = await (pool as any).query(countQuery, params.slice(0, -2));
    const total = parseInt(countResult.rows[0]?.count || '0');

    res.json({
      success: true,
      data: result.rows || [],
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    logger.error('Erreur getAdminDisputes:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur', error: error.message });
  }
};

/**
 * Met à jour le statut d'une dispute
 */
export const updateAdminDispute = async (req: Request, res: Response): Promise<void> => {
  try {
    const { disputeId } = req.params;
    const { status, adminNotes } = req.body;

    logger.info('🚀 [updateAdminDispute] DÉBUT', { disputeId, status });

    if (!process.env.DATABASE_URL) {
      res.status(400).json({ success: false, message: 'Database non disponible' });
      return;
    }

    const tableCheck = await (pool as any).query(
      `SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'payment_disputes'
      )`
    );

    if (!tableCheck.rows[0]?.exists) {
      res.status(404).json({ success: false, message: 'Dispute non trouvée' });
      return;
    }

    const updateFields: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (status) {
      updateFields.push(`status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }

    if (adminNotes) {
      updateFields.push(`admin_notes = $${paramIndex}`);
      params.push(adminNotes);
      paramIndex++;
    }

    if (updateFields.length === 0) {
      res.status(400).json({ success: false, message: 'Aucun champ à mettre à jour' });
      return;
    }

    updateFields.push(`updated_at = NOW()`);
    params.push(disputeId);

    const result = await (pool as any).query(
      `UPDATE payment_disputes SET ${updateFields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      params
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Dispute non trouvée' });
      return;
    }

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error: any) {
    logger.error('Erreur updateAdminDispute:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur', error: error.message });
  }
};

/**
 * Récupère les détails complets d'un admin pour le monitoring
 */
export const getAdminAdminDetails = async (req: Request, res: Response): Promise<void> => {
  try {
    const { adminId } = req.params;

    logger.info('🚀 [getAdminAdminDetails] DÉBUT', { adminId });

    if (!process.env.DATABASE_URL) {
      res.status(404).json({ success: false, message: 'Admin non trouvé' });
      return;
    }

    // Récupérer les infos utilisateur
    const userResult = await (pool as any).query(
      `SELECT id, email, phone, first_name, last_name, role, created_at, avatar_url
       FROM users
       WHERE id = $1 AND (role = 'admin' OR role = 'super_admin')`,
      [adminId]
    );

    if (userResult.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Admin non trouvé' });
      return;
    }

    const user = userResult.rows[0];

    // Activité administrative (pour l'instant vide, peut être enrichi plus tard)
    const adminActivity = {
      lastLogin: null, // TODO: Ajouter un champ last_login dans la table users
      recentActions: [], // TODO: Créer une table admin_actions pour tracker les actions
      recentTickets: [], // TODO: Créer une table tickets pour tracker les interventions
    };

    // Monitoring : Clients en paiement partiel
    let clientsWithPartialPayments: any[] = [];
    try {
      const partialPaymentsQuery = `
        SELECT 
          u.id as client_id,
          u.first_name,
          u.last_name,
          u.email,
          u.phone,
          COALESCE(SUM(t.remaining_amount) FILTER (WHERE t.remaining_amount > 0), 0) as total_remaining,
          MAX(o.created_at) as last_order_date,
          MAX(o.driver_id) as last_driver_id,
          MAX(d.first_name) as last_driver_first_name,
          MAX(d.last_name) as last_driver_last_name
        FROM users u
        INNER JOIN transactions t ON t.user_id = u.id
        LEFT JOIN orders o ON t.order_id = o.id
        LEFT JOIN users d ON o.driver_id = d.id
        WHERE u.role = 'client'
          AND (t.is_partial = true OR t.payment_method_type = 'deferred' OR t.remaining_amount > 0)
          AND t.status != 'paid'
        GROUP BY u.id, u.first_name, u.last_name, u.email, u.phone
        HAVING COALESCE(SUM(t.remaining_amount) FILTER (WHERE t.remaining_amount > 0), 0) > 0
        ORDER BY MAX(o.created_at) DESC
        LIMIT 50
      `;

      const partialPaymentsResult = await (pool as any).query(partialPaymentsQuery);
      clientsWithPartialPayments = partialPaymentsResult.rows.map((row: any) => ({
        clientId: row.client_id,
        firstName: row.first_name,
        lastName: row.last_name,
        email: row.email,
        phone: row.phone,
        totalRemaining: parseFloat(row.total_remaining || '0'),
        lastOrderDate: row.last_order_date,
        lastDriverId: row.last_driver_id,
        lastDriverName: row.last_driver_first_name && row.last_driver_last_name
          ? `${row.last_driver_first_name} ${row.last_driver_last_name}`
          : null,
      }));

      logger.info(`[getAdminAdminDetails] ${clientsWithPartialPayments.length} clients en paiement partiel`);
    } catch (partialPaymentsError) {
      logger.warn('Erreur récupération clients en paiement partiel:', partialPaymentsError);
    }


    res.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        first_name: user.first_name || null,
        last_name: user.last_name || null,
        role: user.role,
        createdAt: user.created_at,
        avatarUrl: user.avatar_url,
        // Activité administrative
        adminActivity,
        // Monitoring
        monitoring: {
          clientsWithPartialPayments,
        },
      },
    });
  } catch (error: any) {
    logger.error('Erreur getAdminAdminDetails:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur', error: error.message });
  }
};

/**
 * Crée une nouvelle commande (admin uniquement)
 */
export const createAdminOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const adminUser = (req as any).user;
    if (!adminUser || (adminUser.role !== 'admin' && adminUser.role !== 'super_admin')) {
      res.status(403).json({ success: false, message: 'Accès refusé - Rôle admin requis' });
      return;
    }

    const {
      userId,
      pickup,
      dropoff,
      deliveryMethod,
      paymentMethodType,
      distance,
      price,
      notes,
      isPhoneOrder,
      isB2BOrder,
      driverNotes,
    } = req.body;

    // Validation des champs obligatoires
    if (!userId || !pickup || !dropoff || !deliveryMethod || !distance || !price) {
      res.status(400).json({
        success: false,
        message: 'Champs obligatoires manquants: userId, pickup, dropoff, deliveryMethod, distance, price',
      });
      return;
    }

    // Pour les commandes téléphoniques, les coordonnées GPS sont optionnelles
    const isPhoneOrderBool = isPhoneOrder === true;
    
    if (!isPhoneOrderBool) {
      // Pour les commandes normales, les coordonnées GPS sont obligatoires
      if (!pickup.coordinates || !pickup.coordinates.latitude || !pickup.coordinates.longitude) {
        res.status(400).json({
          success: false,
          message: 'Coordonnées de pickup manquantes',
        });
        return;
      }

      if (!dropoff.coordinates || !dropoff.coordinates.latitude || !dropoff.coordinates.longitude) {
        res.status(400).json({
          success: false,
          message: 'Coordonnées de dropoff manquantes',
        });
        return;
      }
    }

    // Récupérer les informations du client
    const clientResult = await (pool as any).query(
      'SELECT id, email, phone, first_name, last_name FROM users WHERE id = $1 AND role = $2',
      [userId, 'client']
    );

    if (clientResult.rows.length === 0) {
      res.status(404).json({
        success: false,
        message: 'Client non trouvé',
      });
      return;
    }

    const client = clientResult.rows[0];
    const clientName = client.first_name && client.last_name
      ? `${client.first_name} ${client.last_name}`
      : client.email;

    // Géocoder les adresses si les coordonnées ne sont pas fournies
    let pickupCoords = pickup.coordinates && pickup.coordinates.latitude && pickup.coordinates.longitude
      ? { latitude: pickup.coordinates.latitude, longitude: pickup.coordinates.longitude }
      : null;
    
    let dropoffCoords = dropoff.coordinates && dropoff.coordinates.latitude && dropoff.coordinates.longitude
      ? { latitude: dropoff.coordinates.latitude, longitude: dropoff.coordinates.longitude }
      : null;

    // Géocoder l'adresse de pickup si nécessaire
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

    // Géocoder l'adresse de dropoff si nécessaire
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

    // Calculer la durée estimée
    const avgSpeeds: { [key: string]: number } = {
      moto: 25,
      vehicule: 20,
      cargo: 18,
    };
    const speed = avgSpeeds[deliveryMethod] || avgSpeeds.vehicule;
    const durationHours = distance / speed;
    const minutes = Math.round(durationHours * 60);
    const estimatedDuration = minutes < 60
      ? `${minutes} min`
      : `${Math.floor(minutes / 60)}h ${minutes % 60}min`;

    // Créer l'objet order
    const orderId = uuidv4();
    const order = {
      id: orderId,
      user: {
        id: client.id,
        name: clientName,
        phone: client.phone || undefined,
        email: client.email,
      },
      pickup: {
        address: pickup.address,
        coordinates: pickupCoords || undefined,
      },
      dropoff: {
        address: dropoff.address,
        coordinates: dropoffCoords || undefined,
        details: dropoff.details || undefined,
      },
      recipient: dropoff.details?.phone ? { phone: dropoff.details.phone } : null,
      packageImages: [],
      price: Math.round(price),
      deliveryMethod,
      distance: Math.round(distance * 100) / 100,
      estimatedDuration,
      status: 'pending',
      createdAt: new Date(),
    };

    // Ajouter les informations de paiement si fournies
    (order as any).payment_method_type = paymentMethodType || 'cash';
    (order as any).payment_status = paymentMethodType === 'deferred' ? 'delayed' : 'pending';
    (order as any).payment_payer = 'client';
    
    // Ajouter les informations pour les commandes téléphoniques
    if (isPhoneOrderBool) {
      (order as any).is_phone_order = true;
    }
    // Marquer comme B2B si spécifié (commandes créées depuis le planning)
    if (isB2BOrder === true) {
      (order as any).is_b2b_order = true;
    }
    if (driverNotes) {
      (order as any).driver_notes = driverNotes;
    }

    // Sauvegarder la commande en base de données
    try {
      await saveOrder(order);
      logger.info(`[createAdminOrder] Commande ${orderId} créée par admin ${adminUser.id}`);

      // Diffuser la nouvelle commande aux admins via Socket.IO
      const io = (req.app as any).get('io') as SocketIOServer | undefined;
      if (io) {
        broadcastOrderUpdateToAdmins(io, 'order:created', { order });
        
        // Rechercher et notifier les livreurs
        // Pour les commandes B2B, notifier même sans coordonnées GPS précises
        const finalPickupCoords = order.pickup.coordinates;
        const isB2BOrderValue = isB2BOrder === true;
        
        if (isB2BOrderValue) {
          // Pour les commandes B2B, toujours notifier les livreurs (même sans coordonnées GPS)
          logger.info(`[createAdminOrder] Commande B2B ${orderId} - notification de tous les livreurs disponibles`, {
            orderId,
            isB2BOrder: (order as any).is_b2b_order,
            isPhoneOrder: (order as any).is_phone_order,
            hasCoordinates: !!(finalPickupCoords && finalPickupCoords.latitude && finalPickupCoords.longitude),
          });
          notifyDriversForOrder(io, order, finalPickupCoords, deliveryMethod).catch((error) => {
            logger.warn(`[createAdminOrder] Erreur notification livreurs pour commande B2B ${orderId}:`, error);
          });
        } else if (isPhoneOrderBool) {
          // Pour les commandes téléphoniques normales (hors-ligne), notifier aussi les livreurs
          logger.info(`[createAdminOrder] Commande téléphonique ${orderId} - notification de tous les livreurs disponibles`);
          notifyDriversForOrder(io, order, finalPickupCoords, deliveryMethod).catch((error) => {
            logger.warn(`[createAdminOrder] Erreur notification livreurs pour commande téléphonique ${orderId}:`, error);
          });
        } else if (finalPickupCoords && finalPickupCoords.latitude && finalPickupCoords.longitude) {
          // Pour les commandes normales, notifier seulement si coordonnées GPS disponibles
          logger.info(`[createAdminOrder] Notification des livreurs pour commande ${orderId} avec coordonnées: ${finalPickupCoords.latitude}, ${finalPickupCoords.longitude}`);
          notifyDriversForOrder(io, order, finalPickupCoords, deliveryMethod).catch((error) => {
            logger.warn(`[createAdminOrder] Erreur notification livreurs pour commande ${orderId}:`, error);
          });
        } else {
          logger.info(`[createAdminOrder] Commande ${orderId} créée sans coordonnées GPS - pas de recherche de livreurs (géocodage échoué)`);
        }
      }

      // Optionnel: créer une transaction si paymentMethodType est fourni
      if (paymentMethodType && price) {
        try {
          const { createTransactionAndInvoiceForOrder } = await import('../utils/createTransactionForOrder.js');
          await createTransactionAndInvoiceForOrder(
            orderId,
            userId,
            paymentMethodType,
            price,
            distance,
            null,
            0,
            null,
            false,
            undefined,
            undefined,
            'client',
            undefined,
            null
          );
        } catch (transactionError: any) {
          logger.warn(`[createAdminOrder] Échec création transaction pour ${orderId}:`, transactionError.message);
        }
      }

      res.status(201).json({
        success: true,
        data: { id: orderId },
        message: 'Commande créée avec succès',
      });
    } catch (dbError: any) {
      logger.error('[createAdminOrder] Erreur sauvegarde DB:', dbError);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la sauvegarde de la commande',
        error: dbError.message,
      });
    }
  } catch (error: any) {
    logger.error('Erreur createAdminOrder:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur',
      error: error.message,
    });
  }
};

/**
 * Annule une commande depuis l'admin (pour les commandes orphelines ou bloquées)
 */
export const cancelAdminOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const { orderId } = req.params;
    const { reason } = req.body;

    if (!orderId) {
      res.status(400).json({
        success: false,
        message: 'orderId est requis'
      });
      return;
    }

    logger.info(`🔧 [cancelAdminOrder] Tentative d'annulation de la commande ${orderId} par l'admin`);

    // Vérifier si la commande existe dans la base de données
    const dbResult = await (pool as any).query(
      'SELECT * FROM orders WHERE id = $1',
      [orderId]
    );

    if (!dbResult.rows || dbResult.rows.length === 0) {
      res.status(404).json({
        success: false,
        message: 'Commande non trouvée'
      });
      return;
    }

    const dbOrder = dbResult.rows[0];
    const currentStatus = dbOrder.status;

    // Permettre l'annulation pour les statuts pending, accepted, enroute, picked_up
    const cancellableStatuses = ['pending', 'accepted', 'enroute', 'picked_up'];
    if (!cancellableStatuses.includes(currentStatus)) {
      res.status(400).json({
        success: false,
        message: `Impossible d'annuler une commande avec le statut: ${currentStatus}`,
      });
      return;
    }

    // Mettre à jour le statut dans la base de données
    await (pool as any).query(
      'UPDATE orders SET status = $1, cancelled_at = NOW() WHERE id = $2',
      ['cancelled', orderId]
    );

    logger.info(`✅ [cancelAdminOrder] Commande ${orderId} annulée avec succès par l'admin`);

    // Notifier via WebSocket si disponible
    try {
      const io = req.app.get('io') as SocketIOServer | undefined;
      if (io) {
        // Notifier le client si connecté
        if (dbOrder.user_id) {
          const { connectedUsers } = await import('../sockets/orderSocket.js');
          const userSocketId = connectedUsers.get(dbOrder.user_id);
          if (userSocketId) {
            io.to(userSocketId).emit('order:cancelled', {
              orderId,
              reason: reason || 'admin_cancelled',
            });
          }
        }

        // Notifier le livreur si assigné et connecté
        if (dbOrder.driver_id) {
          const { connectedUsers } = await import('../sockets/orderSocket.js');
          const driverSocketId = connectedUsers.get(dbOrder.driver_id);
          if (driverSocketId) {
            io.to(driverSocketId).emit('order:cancelled', {
              orderId,
              reason: reason || 'admin_cancelled',
            });
          }
        }

        // Notifier les admins
        broadcastOrderUpdateToAdmins(io, 'order:cancelled', {
          orderId,
          status: 'cancelled',
          reason: reason || 'admin_cancelled',
        });
      }
    } catch (socketError: any) {
      logger.warn('⚠️ [cancelAdminOrder] Erreur lors de la notification WebSocket:', socketError.message);
    }

    res.json({
      success: true,
      message: 'Commande annulée avec succès',
      order: { ...dbOrder, status: 'cancelled' },
    });
  } catch (error: any) {
    logger.error('❌ [cancelAdminOrder] Erreur lors de l\'annulation:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur',
      error: error.message,
    });
  }
};

