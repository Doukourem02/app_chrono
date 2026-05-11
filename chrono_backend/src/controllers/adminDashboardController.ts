import { Request, Response } from 'express';
import pool from '../config/db.js';
import { formatDeliveryId } from '../utils/formatDeliveryId.js';
import logger from '../utils/logger.js';
import { getDateRange, normalizeDate } from './adminControllerUtils.js';

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

    const activeOrdersResult = await (pool as any).query(
      `SELECT COUNT(*) as count FROM orders
       WHERE status IN ('pending', 'accepted', 'enroute', 'picked_up')
       AND created_at <= $2
       AND (completed_at IS NULL OR completed_at >= $1)`,
      [rangeStart.toISOString(), rangeEnd.toISOString()]
    );
    const onDelivery = parseInt(activeOrdersResult.rows[0]?.count || '0');

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

    const onDeliveryChange = onDeliveryLastWeek > 0
      ? ((onDelivery - onDeliveryLastWeek) / onDeliveryLastWeek) * 100
      : onDelivery > 0 ? 100 : 0;

    const successDeliveriesChange = successDeliveriesLastWeek > 0
      ? ((successDeliveries - successDeliveriesLastWeek) / successDeliveriesLastWeek) * 100
      : successDeliveries > 0 ? 100 : 0;

    const revenueChange = revenueLastWeek > 0
      ? ((revenue - revenueLastWeek) / revenueLastWeek) * 100
      : revenue > 0 ? 100 : 0;

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

    const activeClientsResult = await (pool as any).query(
      `SELECT COUNT(DISTINCT user_id) as count FROM orders
       WHERE created_at >= $1`,
      [rangeStart.toISOString()]
    );
    const activeClients = parseInt(activeClientsResult.rows[0]?.count || '0');

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

export const getAdminDeliveryAnalytics = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!process.env.DATABASE_URL) {
      logger.warn('DATABASE_URL non configuré pour getAdminDeliveryAnalytics');
      res.json({ success: true, data: [] });
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

    const sorted = monthlyData.sort((a: any, b: any) => a.sortDate.getTime() - b.sortDate.getTime());
    const trimmed = (startDate || endDate ? sorted : sorted.slice(-4)).map(({ sortDate, ...rest }: any) => rest);

    res.json({ success: true, data: trimmed });
  } catch (error: any) {
    logger.error('Erreur getAdminDeliveryAnalytics:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur', error: error.message });
  }
};

export const getAdminRecentActivities = async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = parseInt(req.query.limit as string) || 5;
    const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };
    const hasFilters = Boolean(startDate || endDate);
    const range = hasFilters ? getDateRange(startDate, endDate) : null;

    logger.info('🚀 [getAdminRecentActivities] DÉBUT, limit:', limit);
    logger.debug('🔍 [getAdminRecentActivities] User from middleware:', (req as any).user);

    if (!process.env.DATABASE_URL) {
      logger.warn('DATABASE_URL non configuré pour getAdminRecentActivities');
      res.json({ success: true, data: [] });
      return;
    }

    const countResult = await (pool as any).query(`SELECT COUNT(*) as count FROM orders`);
    const totalOrders = parseInt(countResult.rows[0]?.count || '0');
    logger.debug(`Total de commandes dans la table orders: ${totalOrders}`);

    if (totalOrders === 0) {
      logger.warn('La table orders est vide');
      res.json({ success: true, data: [] });
      return;
    }

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

    let result;
    try {
      result = await (pool as any).query(query, params);
      logger.info(`[getAdminRecentActivities] Requête réussie: ${result.rows.length} lignes récupérées`);
    } catch (queryError: any) {
      logger.error('[getAdminRecentActivities] Erreur lors de la requête SQL:', queryError);
      throw queryError;
    }

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

    res.json({ success: true, data: formatted });
  } catch (error: any) {
    logger.error('Erreur getAdminRecentActivities:', error);

    if (error.message && (error.message.includes('SASL') || error.message.includes('password'))) {
      logger.warn('Erreur de connexion DB, retour de données vides');
      res.json({ success: true, data: [] });
      return;
    }

    res.status(500).json({ success: false, message: 'Erreur serveur', error: error.message });
  }
};

export const getAdminGlobalSearch = async (req: Request, res: Response): Promise<void> => {
  try {
    const query = req.query.q as string | undefined;
    logger.info('🚀 [getAdminGlobalSearch] DÉBUT, query:', query);

    if (!query || query.trim().length === 0) {
      res.json({ success: true, data: { orders: [], drivers: [], clients: [] } });
      return;
    }

    if (!process.env.DATABASE_URL) {
      logger.warn('DATABASE_URL non configuré pour getAdminGlobalSearch');
      res.json({ success: true, data: { orders: [], drivers: [], clients: [] } });
      return;
    }

    const searchTerm = `%${query.trim()}%`;
    const exactSearchTerm = query.trim();
    const upperQuery = query.trim().toUpperCase();
    const trimmedQuery = query.trim().toLowerCase();

    const isOrderSearch = upperQuery.startsWith('KRLV');
    const isPhoneSearch = /^[\d\s\+\-\(\)]+$/.test(query.trim());
    const isEmailSearch = trimmedQuery.includes('@');
    const isVehicleTypeSearch = ['moto', 'vehicule', 'cargo', 'véhicule'].includes(trimmedQuery);
    const isDriverTypeSearch = ['interne', 'internal', 'partenaire', 'partner'].includes(trimmedQuery);

    let deliveryIdCondition = '';
    if (isOrderSearch) {
      deliveryIdCondition = `
        OR (
          'KRLV' || '–' ||
          TO_CHAR(o.created_at, 'YYMMDD') || '-' ||
          UPPER(SUBSTRING(REPLACE(o.id::text, '-', ''), -4))
        ) ILIKE $1
        OR (
          'KRLV' || '–' ||
          TO_CHAR(o.created_at, 'YYMMDD') || '-' ||
          UPPER(SUBSTRING(REPLACE(o.id::text, '-', ''), -4))
        ) ILIKE $4
        OR UPPER(SUBSTRING(REPLACE(o.id::text, '-', ''), 1, LENGTH($5))) = $5
      `;
    }

    const priceColumnsInfo = await (pool as any).query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'orders'
       AND column_name = ANY($1)`,
      [['price_cfa', 'price']]
    );
    const priceColumnSet = new Set(priceColumnsInfo.rows.map((row: any) => row.column_name));
    const priceColumn = priceColumnSet.has('price_cfa') ? 'price_cfa' : priceColumnSet.has('price') ? 'price' : null;
    const priceSearchCondition = priceColumn ? `OR CAST(COALESCE(o.${priceColumn}, 0) AS TEXT) ILIKE LOWER($1)` : '';

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
      ${deliveryIdCondition}
      ${priceSearchCondition})
    `;

    const ordersQuery = `
      SELECT
        o.id, o.status, o.created_at, o.pickup_address, o.dropoff_address,
        o.user_id, o.driver_id,
        ${priceColumn ? `o.${priceColumn} as price,` : 'NULL as price,'}
        u.first_name as user_first_name, u.last_name as user_last_name, u.email as user_email,
        d.first_name as driver_first_name, d.last_name as driver_last_name, d.email as driver_email
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      LEFT JOIN users d ON o.driver_id = d.id
      WHERE ${ordersWhereClause}
      ORDER BY
        CASE
          WHEN LOWER(o.id::text) = LOWER($2) THEN 1
          WHEN LOWER(REPLACE(o.id::text, '-', '')) LIKE LOWER($3) THEN 2
          ${isOrderSearch ? `WHEN (
            'KRLV' || '–' ||
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

    const driversQuery = `
      SELECT
        u.id, u.email, u.phone, u.first_name, u.last_name, u.created_at, u.avatar_url,
        dp.driver_type, dp.vehicle_type, dp.license_number, dp.rating, dp.total_deliveries,
        dp.is_online, dp.is_available,
        COALESCE(cb.balance, 0) as commission_balance,
        COALESCE(cb.commission_rate, 10) as commission_rate,
        COALESCE(cb.is_suspended, false) as is_suspended
      FROM users u
      INNER JOIN driver_profiles dp ON dp.user_id = u.id
      LEFT JOIN commission_balance cb ON cb.driver_id = u.id
      WHERE u.role = 'driver' AND (
        u.email ILIKE $1 OR u.phone ILIKE $1 OR u.first_name ILIKE $1 OR u.last_name ILIKE $1 OR
        (u.first_name IS NOT NULL AND u.last_name IS NOT NULL AND CONCAT(u.first_name, ' ', u.last_name) ILIKE $1) OR
        (u.first_name IS NOT NULL AND u.last_name IS NOT NULL AND CONCAT(u.last_name, ' ', u.first_name) ILIKE $1) OR
        LOWER(COALESCE(dp.vehicle_type, '')) ILIKE LOWER($1) OR
        LOWER(COALESCE(dp.license_number, '')) ILIKE LOWER($1) OR
        LOWER(COALESCE(dp.driver_type, '')) ILIKE LOWER($1) OR
        CAST(COALESCE(dp.rating, 0) AS TEXT) ILIKE LOWER($1) OR
        CAST(COALESCE(dp.total_deliveries, 0) AS TEXT) ILIKE LOWER($1) OR
        CAST(COALESCE(cb.balance, 0) AS TEXT) ILIKE LOWER($1) OR
        CAST(COALESCE(cb.commission_rate, 10) AS TEXT) ILIKE LOWER($1)
      )
      ORDER BY
        CASE
          WHEN u.email = $2 THEN 1
          WHEN u.email ILIKE $3 THEN 2
          ${isPhoneSearch ? 'WHEN u.phone ILIKE $1 THEN 3' : ''}
          ${isVehicleTypeSearch ? 'WHEN LOWER(dp.vehicle_type) = LOWER($2) THEN 4' : ''}
          ${isDriverTypeSearch ? 'WHEN LOWER(dp.driver_type) = LOWER($2) THEN 5' : ''}
          WHEN u.first_name IS NOT NULL AND u.last_name IS NOT NULL AND CONCAT(u.first_name, ' ', u.last_name) ILIKE $1 THEN 6
          WHEN u.first_name ILIKE $1 THEN 7
          WHEN u.last_name ILIKE $1 THEN 8
          WHEN LOWER(dp.license_number) ILIKE LOWER($1) THEN 9
          ELSE 10
        END,
        u.created_at DESC
      LIMIT 10
    `;

    const clientsQuery = `
      SELECT id, email, phone, role, first_name, last_name, created_at, avatar_url
      FROM users
      WHERE role = 'client' AND (
        email ILIKE $1 OR phone ILIKE $1 OR first_name ILIKE $1 OR last_name ILIKE $1 OR
        (first_name IS NOT NULL AND last_name IS NOT NULL AND CONCAT(first_name, ' ', last_name) ILIKE $1) OR
        (first_name IS NOT NULL AND last_name IS NOT NULL AND CONCAT(last_name, ' ', first_name) ILIKE $1)
      )
      ORDER BY
        CASE
          WHEN email = $2 THEN 1
          WHEN email ILIKE $3 THEN 2
          ${isPhoneSearch ? 'WHEN phone ILIKE $1 THEN 3' : ''}
          ${isEmailSearch ? 'WHEN email ILIKE $1 THEN 4' : ''}
          WHEN first_name IS NOT NULL AND last_name IS NOT NULL AND CONCAT(first_name, ' ', last_name) ILIKE $1 THEN 5
          WHEN first_name ILIKE $1 THEN 6
          WHEN last_name ILIKE $1 THEN 7
          WHEN phone ILIKE $1 THEN 8
          ELSE 9
        END,
        created_at DESC
      LIMIT 10
    `;

    let ordersResult, driversResult, clientsResult;
    try {
      const ordersParams: any[] = [searchTerm, exactSearchTerm, `${exactSearchTerm}%`];
      if (isOrderSearch) {
        ordersParams.push(`${upperQuery}%`, upperQuery);
      }
      ordersResult = await (pool as any).query(ordersQuery, ordersParams);

      const driversParams = [searchTerm, exactSearchTerm, `${exactSearchTerm}%`];
      driversResult = await (pool as any).query(driversQuery, driversParams);

      const clientsParams = [searchTerm, exactSearchTerm, `${exactSearchTerm}%`];
      clientsResult = await (pool as any).query(clientsQuery, clientsParams);
    } catch (queryError: any) {
      logger.error('[getAdminGlobalSearch] Erreur lors de la requête SQL:', queryError);
      throw queryError;
    }

    const parseJsonField = (field: any): any => {
      if (!field) return null;
      if (typeof field === 'string') {
        try { return JSON.parse(field); } catch { return field; }
      }
      return field;
    };

    const formatCurrency = (amount: number | null | undefined): string => {
      if (!amount) return 'N/A';
      return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount) + ' FCFA';
    };

    const formattedOrders = ordersResult.rows.map((order: any) => {
      const pickup = parseJsonField(order.pickup_address);
      const dropoff = parseJsonField(order.dropoff_address);
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
        price: order.price ? formatCurrency(order.price) : null,
        createdAt: new Date(order.created_at).toLocaleDateString('fr-FR'),
      };
    });

    const formattedDrivers = driversResult.rows.map((driver: any) => {
      const fullName = (driver.first_name && driver.last_name) ? `${driver.first_name} ${driver.last_name}` : null;
      const vehicleTypeLabels: { [key: string]: string } = { moto: 'Moto', vehicule: 'Véhicule', cargo: 'Cargo' };
      const driverTypeLabels: { [key: string]: string } = { internal: 'Interne', partner: 'Partenaire' };

      return {
        id: driver.id,
        email: driver.email,
        phone: driver.phone || 'N/A',
        first_name: driver.first_name || null,
        last_name: driver.last_name || null,
        fullName,
        avatar_url: driver.avatar_url || null,
        driver_type: driver.driver_type || 'partner',
        driver_type_label: driverTypeLabels[driver.driver_type] || 'Partenaire',
        vehicle_type: driver.vehicle_type || 'moto',
        vehicle_type_label: vehicleTypeLabels[driver.vehicle_type] || 'Moto',
        license_number: driver.license_number || null,
        rating: driver.rating ? parseFloat(driver.rating).toFixed(1) : '5.0',
        total_deliveries: driver.total_deliveries || 0,
        is_online: driver.is_online || false,
        is_available: driver.is_available || false,
        commission_balance: driver.driver_type === 'partner' ? formatCurrency(parseFloat(driver.commission_balance || 0)) : null,
        commission_rate: driver.driver_type === 'partner' ? `${driver.commission_rate}%` : null,
        is_suspended: driver.is_suspended || false,
        createdAt: new Date(driver.created_at).toLocaleDateString('fr-FR'),
      };
    });

    const formattedClients = clientsResult.rows.map((client: any) => {
      const fullName = (client.first_name && client.last_name) ? `${client.first_name} ${client.last_name}` : null;
      return {
        id: client.id,
        email: client.email,
        phone: client.phone || 'N/A',
        first_name: client.first_name || null,
        last_name: client.last_name || null,
        fullName,
        avatar_url: client.avatar_url || null,
        createdAt: new Date(client.created_at).toLocaleDateString('fr-FR'),
      };
    });

    res.json({
      success: true,
      data: { orders: formattedOrders, drivers: formattedDrivers, clients: formattedClients },
    });
  } catch (error: any) {
    logger.error('Erreur getAdminGlobalSearch:', error);

    if (error.message && (error.message.includes('SASL') || error.message.includes('password') || error.message.includes('ENOTFOUND'))) {
      logger.warn('Erreur de connexion DB, retour de données vides');
      res.json({ success: true, data: { orders: [], drivers: [], clients: [] } });
      return;
    }

    res.status(500).json({ success: false, message: 'Erreur serveur', error: error.message });
  }
};
