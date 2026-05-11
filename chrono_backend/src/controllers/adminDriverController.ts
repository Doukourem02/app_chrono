import { Request, Response } from 'express';
import pool from '../config/db.js';
import logger from '../utils/logger.js';

export const getAdminDriverDetails = async (req: Request, res: Response): Promise<void> => {
  try {
    const { driverId } = req.params;
    logger.info('🚀 [getAdminDriverDetails] DÉBUT', { driverId });

    if (!process.env.DATABASE_URL) {
      res.status(404).json({ success: false, message: 'Driver non trouvé' });
      return;
    }

    const userResult = await (pool as any).query(
      `SELECT id, email, phone, first_name, last_name, role, created_at, avatar_url
       FROM users WHERE id = $1 AND role = 'driver'`,
      [driverId]
    );

    if (userResult.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Driver non trouvé' });
      return;
    }

    const user = userResult.rows[0];

    let driverProfile: any = null;
    try {
      const profileResult = await (pool as any).query(
        `SELECT * FROM driver_profiles WHERE user_id = $1`, [driverId]
      );
      if (profileResult.rows.length > 0) {
        driverProfile = profileResult.rows[0];
      }
    } catch (profileError) {
      logger.warn('Table driver_profiles non disponible:', profileError);
    }

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

    const statsQuery = `
      SELECT
        COUNT(*) FILTER (WHERE status = 'completed') as total_completed,
        COUNT(*) FILTER (WHERE status = 'completed' AND completed_at >= $1) as today_completed,
        COUNT(*) FILTER (WHERE status = 'completed' AND completed_at >= $2) as week_completed,
        COALESCE(SUM(${priceColumn || '0'}) FILTER (WHERE status = 'completed'), 0) as total_revenue,
        COALESCE(AVG(EXTRACT(EPOCH FROM (completed_at - created_at)) / 60) FILTER (WHERE status = 'completed' AND completed_at IS NOT NULL), 0) as avg_delivery_time,
        COALESCE(SUM(distance) FILTER (WHERE status = 'completed'), 0) as total_distance
      FROM orders WHERE driver_id = $3
    `;

    const statsResult = await (pool as any).query(statsQuery, [
      startOfToday.toISOString(), startOfWeek.toISOString(), driverId,
    ]);
    const stats = statsResult.rows[0] || {};

    let averageRating = 5.0;
    let totalRatings = 0;
    try {
      const ratingsTableCheck = await (pool as any).query(
        `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ratings')`
      );
      if (ratingsTableCheck.rows[0]?.exists) {
        const ratingResult = await (pool as any).query(
          `SELECT COALESCE(AVG(rating)::numeric, 5.0) as avg_rating, COUNT(*) as count FROM ratings WHERE driver_id = $1`,
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

    const acceptanceResult = await (pool as any).query(
      `SELECT
        COUNT(*) FILTER (WHERE status IN ('accepted', 'enroute', 'picked_up', 'completed')) as accepted,
        COUNT(*) as total_assigned
       FROM orders WHERE driver_id = $1`,
      [driverId]
    );
    const acceptanceRate = acceptanceResult.rows[0]?.total_assigned > 0
      ? (acceptanceResult.rows[0].accepted / acceptanceResult.rows[0].total_assigned) * 100
      : 0;

    const cancelledResult = await (pool as any).query(
      `SELECT COUNT(*) as cancelled_count FROM orders WHERE driver_id = $1 AND status = 'cancelled'`,
      [driverId]
    );
    const cancelledDeliveries = parseInt(cancelledResult.rows[0]?.cancelled_count || '0');

    let pendingPaymentOrders: any[] = [];
    try {
      const allCompletedOrdersResult = await (pool as any).query(`
        SELECT
          o.id as order_id, o.created_at as order_created_at, o.status as order_status,
          ${priceColumn || '0'} as order_amount,
          u.id as client_id, u.first_name as client_first_name, u.last_name as client_last_name,
          u.email as client_email, u.phone as client_phone
        FROM orders o
        LEFT JOIN users u ON o.user_id = u.id
        WHERE o.driver_id = $1 AND o.status = 'completed'
        ORDER BY o.created_at DESC LIMIT 500
      `, [driverId]);

      const pendingPaymentResult = { rows: [] as any[] };

      for (const orderRow of allCompletedOrdersResult.rows) {
        const orderId = orderRow.order_id;
        const transactionsResult = await (pool as any).query(
          `SELECT id, amount, partial_amount, remaining_amount, is_partial, payment_method_type, status, created_at
           FROM transactions WHERE order_id = $1 ORDER BY created_at DESC`,
          [orderId]
        );
        const transactions = transactionsResult.rows || [];

        let totalPaid = 0;
        let latestRemaining = 0;
        let latestTransaction: any = null;

        if (transactions.length > 0) {
          latestTransaction = transactions[0];
          for (const tx of transactions) {
            const paidAmount = tx.partial_amount && tx.partial_amount > 0
              ? parseFloat(tx.partial_amount)
              : parseFloat(tx.amount || '0');
            totalPaid += paidAmount;
          }
          latestRemaining = parseFloat(latestTransaction.remaining_amount || '0');
        }

        const orderAmount = parseFloat(orderRow.order_amount || '0');
        const remainingAmount = latestRemaining > 0 ? latestRemaining : Math.max(0, orderAmount - totalPaid);

        const isPendingPayment =
          transactions.length === 0 ||
          latestTransaction?.is_partial === true ||
          latestTransaction?.payment_method_type === 'deferred' ||
          remainingAmount > 0 ||
          (latestTransaction?.status && latestTransaction.status !== 'paid');

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

    let recentOrders: any[] = [];
    try {
      const recentOrdersResult = await (pool as any).query(`
        SELECT
          o.id, o.status, o.created_at, o.accepted_at, o.completed_at, o.cancelled_at,
          ${priceColumn || '0'} as price, o.distance, o.delivery_method,
          u.id as client_id, u.first_name as client_first_name, u.last_name as client_last_name, u.email as client_email,
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
          SELECT * FROM transactions WHERE order_id = o.id ORDER BY created_at DESC LIMIT 1
        ) t ON true
        WHERE o.driver_id = $1
        ORDER BY o.created_at DESC LIMIT 200
      `, [driverId]);

      recentOrders = await Promise.all(recentOrdersResult.rows.map(async (row: any) => {
        const orderId = row.id;
        const orderAmount = parseFloat(row.price || '0');

        const transactionsResult = await (pool as any).query(
          `SELECT id, amount, partial_amount, remaining_amount, is_partial, payment_method_type, status, created_at
           FROM transactions WHERE order_id = $1 ORDER BY created_at DESC`,
          [orderId]
        );
        const transactions = transactionsResult.rows || [];

        let totalPaid = 0;
        let latestRemaining = 0;
        let latestTransaction: any = null;

        if (transactions.length > 0) {
          latestTransaction = transactions[0];
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

        let paymentStatus: 'paid' | 'partial' | 'pending' | 'none' = 'none';
        if (row.status === 'completed') {
          if (transactions.length === 0) {
            paymentStatus = 'pending';
          } else if (latestTransaction.status === 'paid' && remainingAmount === 0) {
            paymentStatus = 'paid';
          } else if (latestTransaction.is_partial === true || remainingAmount > 0) {
            paymentStatus = 'partial';
          } else if (latestTransaction.status && latestTransaction.status !== 'paid') {
            paymentStatus = 'pending';
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
        pendingPaymentOrders,
        recentOrders,
      },
    });
  } catch (error: any) {
    logger.error('Erreur getAdminDriverDetails:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur', error: error.message });
  }
};

export const updateAdminDriverStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { driverId } = req.params;
    const { isActive } = req.body;

    logger.info('🚀 [updateAdminDriverStatus] DÉBUT', { driverId, isActive });

    if (!process.env.DATABASE_URL) {
      res.status(400).json({ success: false, message: 'Database non disponible' });
      return;
    }

    try {
      await (pool as any).query(
        `UPDATE driver_profiles SET is_online = $1, is_available = $1, updated_at = NOW() WHERE user_id = $2`,
        [isActive, driverId]
      );
    } catch (updateError) {
      logger.warn('Erreur mise à jour driver_profiles:', updateError);
    }

    res.json({ success: true, message: `Driver ${isActive ? 'activé' : 'désactivé'} avec succès` });
  } catch (error: any) {
    logger.error('Erreur updateAdminDriverStatus:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur', error: error.message });
  }
};

export const getAdminDrivers = async (req: Request, res: Response): Promise<void> => {
  try {
    const type = req.query.type as string | undefined;
    const status = req.query.status as string | undefined;
    const search = req.query.search as string | undefined;

    logger.info('🚀 [getAdminDrivers] DÉBUT', { type, status, search });

    if (!process.env.DATABASE_URL) {
      res.json({ success: true, data: [], counts: { total: 0, partners: 0, internals: 0, active: 0, suspended: 0 } });
      return;
    }

    let query = `
      SELECT
        u.id, u.email, u.phone, u.first_name, u.last_name, u.role, u.created_at, u.avatar_url,
        dp.driver_type, dp.is_online, dp.is_available, dp.accepts_b2b_orders,
        cb.balance as commission_balance, cb.commission_rate, cb.is_suspended,
        COUNT(DISTINCT o.id) as total_deliveries,
        COUNT(DISTINCT CASE WHEN o.status = 'completed' THEN o.id END) as completed_deliveries
      FROM users u
      LEFT JOIN driver_profiles dp ON dp.user_id = u.id
      LEFT JOIN commission_balance cb ON cb.driver_id = u.id
      LEFT JOIN orders o ON o.driver_id = u.id
      WHERE u.role = 'driver'
    `;

    const params: any[] = [];
    let paramIndex = 1;

    if (type && type !== 'all') {
      query += ` AND dp.driver_type = $${paramIndex}`;
      params.push(type);
      paramIndex++;
    }

    if (search) {
      query += ` AND (
        u.email ILIKE $${paramIndex} OR u.phone ILIKE $${paramIndex} OR
        u.first_name ILIKE $${paramIndex} OR u.last_name ILIKE $${paramIndex}
      )`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    query += ` GROUP BY u.id, u.email, u.phone, u.first_name, u.last_name, u.role, u.created_at, u.avatar_url,
               dp.driver_type, dp.is_online, dp.is_available, dp.accepts_b2b_orders, cb.balance, cb.commission_rate, cb.is_suspended
               ORDER BY u.created_at DESC`;

    const result = await (pool as any).query(query, params);

    const counts = { total: result.rows.length, partners: 0, internals: 0, active: 0, suspended: 0 };

    const formatted = result.rows
      .map((row: any) => {
        const driverType = row.driver_type || 'partner';
        const balance = parseFloat(row.commission_balance || 0);
        const isManuallySuspended = row.is_suspended || false;
        const hasNoBalance = balance <= 0;

        const isSuspended = driverType === 'partner' && isManuallySuspended;
        const isInactive = driverType === 'partner' && hasNoBalance && !isManuallySuspended;

        if (driverType === 'partner') counts.partners++;
        if (driverType === 'internal') counts.internals++;
        if (driverType === 'partner' && !isSuspended && !isInactive && balance > 0) counts.active++;
        if (isSuspended) counts.suspended++;

        if (status && status !== 'all') {
          if (driverType === 'internal') {
            if (status === 'suspended') return null;
          } else {
            if (status === 'active' && (isSuspended || isInactive || balance <= 0)) return null;
            if (status === 'suspended' && !isSuspended) return null;
            if (status === 'low_balance' && (balance >= 3000 || isSuspended || isInactive)) return null;
          }
        }

        return {
          id: row.id,
          email: row.email,
          phone: row.phone || null,
          first_name: row.first_name || null,
          last_name: row.last_name || null,
          role: row.role,
          created_at: row.created_at,
          avatar_url: row.avatar_url || null,
          driver_type: driverType,
          is_online: row.is_online || false,
          is_available: row.is_available || false,
          accepts_b2b_orders: row.accepts_b2b_orders === true,
          commission_balance: balance,
          commission_rate: parseFloat(row.commission_rate || 10),
          is_suspended: isSuspended,
          is_inactive: isInactive,
          has_balance: balance > 0,
          total_deliveries: parseInt(row.total_deliveries || 0),
          completed_deliveries: parseInt(row.completed_deliveries || 0),
        };
      })
      .filter((driver: any) => driver !== null);

    for (const driver of formatted) {
      try {
        const ratingResult = await (pool as any).query(
          `SELECT AVG(rating) as avg_rating, COUNT(*) as total_ratings FROM ratings WHERE driver_id = $1`,
          [driver.id]
        );
        if (ratingResult.rows.length > 0) {
          driver.average_rating = parseFloat(ratingResult.rows[0].avg_rating || 0);
          driver.totalRatings = parseInt(ratingResult.rows[0].total_ratings || 0);
        } else {
          driver.average_rating = null;
          driver.totalRatings = 0;
        }
      } catch (ratingError) {
        logger.warn('Erreur récupération rating:', ratingError);
        driver.average_rating = null;
        driver.totalRatings = 0;
      }
    }

    res.json({ success: true, data: formatted, counts });
  } catch (error: any) {
    logger.error('Erreur getAdminDrivers:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur', error: error.message });
  }
};

export const getAdminDriverFullDetails = async (req: Request, res: Response): Promise<void> => {
  try {
    const { driverId } = req.params;
    logger.info('🚀 [getAdminDriverFullDetails] DÉBUT', { driverId });

    if (!process.env.DATABASE_URL) {
      res.status(404).json({ success: false, message: 'Driver non trouvé' });
      return;
    }

    const userResult = await (pool as any).query(
      `SELECT id, email, phone, first_name, last_name, role, created_at, avatar_url
       FROM users WHERE id = $1 AND role = 'driver'`,
      [driverId]
    );

    if (userResult.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Driver non trouvé' });
      return;
    }

    const user = userResult.rows[0];

    let driverProfile: any = null;
    try {
      const profileResult = await (pool as any).query(
        `SELECT * FROM driver_profiles WHERE user_id = $1`, [driverId]
      );
      if (profileResult.rows.length > 0) {
        driverProfile = profileResult.rows[0];
      }
    } catch (profileError) {
      logger.warn('Table driver_profiles non disponible:', profileError);
    }

    let commissionAccount: any = null;
    if (driverProfile?.driver_type === 'partner') {
      try {
        const commissionResult = await (pool as any).query(
          `SELECT balance, commission_rate, is_suspended, updated_at FROM commission_balance WHERE driver_id = $1`,
          [driverId]
        );
        if (commissionResult.rows.length > 0) {
          commissionAccount = {
            balance: parseFloat(commissionResult.rows[0].balance || 0),
            commission_rate: parseFloat(commissionResult.rows[0].commission_rate || 10),
            is_suspended: commissionResult.rows[0].is_suspended || false,
            last_updated: commissionResult.rows[0].updated_at,
          };
        }
      } catch (commissionError) {
        logger.warn('Erreur récupération commission:', commissionError);
      }
    }

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
        COUNT(*) FILTER (WHERE status = 'completed') as total_completed,
        COALESCE(SUM(${priceColumn || '0'}) FILTER (WHERE status = 'completed'), 0) as total_revenue
      FROM orders WHERE driver_id = $1
    `;
    const statsResult = await (pool as any).query(statsQuery, [driverId]);
    const stats = statsResult.rows[0] || {};

    let averageRating: number | null = null;
    let totalRatings = 0;
    try {
      const ratingResult = await (pool as any).query(
        `SELECT AVG(rating) as avg_rating, COUNT(*) as total_ratings FROM ratings WHERE driver_id = $1`,
        [driverId]
      );
      if (ratingResult.rows.length > 0 && ratingResult.rows[0].avg_rating) {
        averageRating = parseFloat(ratingResult.rows[0].avg_rating);
        totalRatings = parseInt(ratingResult.rows[0].total_ratings || 0);
      }
    } catch (ratingError) {
      logger.warn('Erreur récupération rating:', ratingError);
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
        created_at: user.created_at,
        avatar_url: user.avatar_url,
        driver_type: driverProfile?.driver_type || 'partner',
        is_online: driverProfile?.is_online || false,
        total_deliveries: parseInt(stats.total_completed || 0),
        completed_deliveries: parseInt(stats.total_completed || 0),
        total_revenue: parseFloat(stats.total_revenue || 0),
        average_rating: averageRating,
        totalRatings,
        commission_account: commissionAccount,
      },
    });
  } catch (error: any) {
    logger.error('Erreur getAdminDriverFullDetails:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur', error: error.message });
  }
};

export const rechargeAdminDriverCommission = async (req: Request, res: Response): Promise<void> => {
  try {
    const { driverId } = req.params;
    const { amount, method = 'admin_manual', notes } = req.body;

    logger.info('🚀 [rechargeAdminDriverCommission] DÉBUT', { driverId, amount, method });

    if (!amount || amount < 10000) {
      res.status(400).json({ success: false, message: 'Le montant minimum de recharge est de 10 000 FCFA' });
      return;
    }

    const driverCheck = await (pool as any).query(
      `SELECT driver_type FROM driver_profiles WHERE user_id = $1`, [driverId]
    );

    if (!driverCheck.rows || driverCheck.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Profil livreur non trouvé' });
      return;
    }

    if (driverCheck.rows[0].driver_type !== 'partner') {
      res.status(400).json({ success: false, message: 'Cette fonctionnalité est réservée aux livreurs partenaires' });
      return;
    }

    const rechargeResult = await (pool as any).query(
      `SELECT recharge_commission_balance($1, $2, $3, NULL, NULL, $4) as transaction_id`,
      [driverId, amount, method, notes || `Recharge manuelle par admin`]
    );

    const transactionId = rechargeResult.rows[0].transaction_id;
    logger.info(`Recharge commission pour ${driverId}: ${amount} FCFA`);

    res.json({ success: true, message: 'Recharge effectuée avec succès', data: { transactionId } });
  } catch (error: any) {
    logger.error('Erreur rechargeAdminDriverCommission:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la recharge', error: error.message });
  }
};

export const suspendAdminDriverCommission = async (req: Request, res: Response): Promise<void> => {
  try {
    const { driverId } = req.params;
    const { is_suspended, reason } = req.body;

    logger.info('🚀 [suspendAdminDriverCommission] DÉBUT', { driverId, is_suspended });

    const driverCheck = await (pool as any).query(
      `SELECT driver_type FROM driver_profiles WHERE user_id = $1`, [driverId]
    );

    if (!driverCheck.rows || driverCheck.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Profil livreur non trouvé' });
      return;
    }

    if (driverCheck.rows[0].driver_type !== 'partner') {
      res.status(400).json({ success: false, message: 'Cette fonctionnalité est réservée aux livreurs partenaires' });
      return;
    }

    await (pool as any).query(
      `UPDATE commission_balance
       SET is_suspended = $1,
           suspended_at = CASE WHEN $1 = true THEN NOW() ELSE NULL END,
           suspended_reason = $2,
           updated_at = NOW()
       WHERE driver_id = $3`,
      [is_suspended, reason || null, driverId]
    );

    logger.info(`Statut commission mis à jour pour ${driverId}: ${is_suspended ? 'suspendu' : 'réactivé'}`);
    res.json({ success: true, message: `Compte ${is_suspended ? 'suspendu' : 'réactivé'} avec succès` });
  } catch (error: any) {
    logger.error('Erreur suspendAdminDriverCommission:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la mise à jour', error: error.message });
  }
};

export const updateAdminDriverCommissionRate = async (req: Request, res: Response): Promise<void> => {
  try {
    const { driverId } = req.params;
    const { commission_rate } = req.body;

    logger.info('🚀 [updateAdminDriverCommissionRate] DÉBUT', { driverId, commission_rate });

    if (!commission_rate || ![10, 20].includes(commission_rate)) {
      res.status(400).json({ success: false, message: 'Le taux de commission doit être 10 ou 20' });
      return;
    }

    const driverCheck = await (pool as any).query(
      `SELECT driver_type FROM driver_profiles WHERE user_id = $1`, [driverId]
    );

    if (!driverCheck.rows || driverCheck.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Profil livreur non trouvé' });
      return;
    }

    if (driverCheck.rows[0].driver_type !== 'partner') {
      res.status(400).json({ success: false, message: 'Cette fonctionnalité est réservée aux livreurs partenaires' });
      return;
    }

    await (pool as any).query(
      `UPDATE commission_balance SET commission_rate = $1, updated_at = NOW() WHERE driver_id = $2`,
      [commission_rate, driverId]
    );

    logger.info(`Taux commission mis à jour pour ${driverId}: ${commission_rate}%`);
    res.json({ success: true, message: 'Taux de commission mis à jour avec succès' });
  } catch (error: any) {
    logger.error('Erreur updateAdminDriverCommissionRate:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la mise à jour', error: error.message });
  }
};

export const getAdminDriverCommissionTransactions = async (req: Request, res: Response): Promise<void> => {
  try {
    const { driverId } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    const type = req.query.type as string | undefined;
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;

    logger.info('🚀 [getAdminDriverCommissionTransactions] DÉBUT', { driverId, limit, offset, type });

    let query = `
      SELECT
        id, transaction_type, amount, balance_before, balance_after,
        order_id, payment_method, payment_provider, description, created_at
      FROM commission_transactions
      WHERE driver_id = $1
    `;

    const params: any[] = [driverId];
    let paramIndex = 2;

    if (type && type !== 'all') { query += ` AND transaction_type = $${paramIndex}`; params.push(type); paramIndex++; }
    if (startDate) { query += ` AND created_at >= $${paramIndex}`; params.push(startDate); paramIndex++; }
    if (endDate) { query += ` AND created_at <= $${paramIndex}`; params.push(endDate); paramIndex++; }

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await (pool as any).query(query, params);

    const transactions = result.rows.map((tx: any) => ({
      id: tx.id,
      type: tx.transaction_type,
      amount: parseFloat(tx.amount),
      balance_before: parseFloat(tx.balance_before),
      balance_after: parseFloat(tx.balance_after),
      order_id: tx.order_id,
      payment_method: tx.payment_method,
      payment_provider: tx.payment_provider,
      status: 'completed',
      created_at: tx.created_at,
    }));

    res.json({ success: true, data: transactions });
  } catch (error: any) {
    logger.error('Erreur getAdminDriverCommissionTransactions:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des transactions',
      error: error.message,
    });
  }
};
