import { Request, Response } from 'express';
import pool from '../config/db.js';
import logger from '../utils/logger.js';

export const getAdminUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    logger.info('🚀 [getAdminUsers] DÉBUT');

    if (!process.env.DATABASE_URL) {
      logger.warn('DATABASE_URL non configuré pour getAdminUsers');
      res.json({ success: true, data: [], counts: { client: 0, driver: 0, admin: 0, total: 0 } });
      return;
    }

    const query = `
      SELECT id, email, phone, first_name, last_name, role, created_at, avatar_url
      FROM users
      WHERE role IN ('client', 'driver', 'admin', 'super_admin')
      ORDER BY created_at DESC
      LIMIT 2000
    `;

    let result;
    try {
      result = await (pool as any).query(query);
      logger.info(`[getAdminUsers] Requête réussie: ${result.rows.length} utilisateurs récupérés`);
    } catch (queryError: any) {
      logger.error('[getAdminUsers] Erreur lors de la requête SQL:', queryError);
      throw queryError;
    }

    const roleCounts = { client: 0, driver: 0, admin: 0, total: result.rows.length };

    const formatted = result.rows.map((user: any) => {
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

    res.json({ success: true, data: formatted, counts: roleCounts });
  } catch (error: any) {
    logger.error('Erreur getAdminUsers:', error);

    if (error.message && (error.message.includes('SASL') || error.message.includes('password'))) {
      logger.warn('Erreur de connexion DB, retour de données vides');
      res.json({ success: true, data: [], counts: { client: 0, driver: 0, admin: 0, total: 0 } });
      return;
    }

    res.status(500).json({ success: false, message: 'Erreur serveur', error: error.message });
  }
};

export const getAdminClientDetails = async (req: Request, res: Response): Promise<void> => {
  try {
    const { clientId } = req.params;
    logger.info('🚀 [getAdminClientDetails] DÉBUT', { clientId });

    if (!process.env.DATABASE_URL) {
      res.status(404).json({ success: false, message: 'Client non trouvé' });
      return;
    }

    const userResult = await (pool as any).query(
      `SELECT id, email, phone, first_name, last_name, role, created_at, avatar_url
       FROM users WHERE id = $1 AND role = 'client'`,
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

    const statsQuery = `
      SELECT
        COUNT(*) as total_orders,
        COUNT(*) FILTER (WHERE created_at >= $1) as week_orders,
        COUNT(*) FILTER (WHERE created_at >= $2) as month_orders,
        COUNT(*) FILTER (WHERE status = 'completed') as completed_orders,
        COALESCE(SUM(${priceColumn || '0'}) FILTER (WHERE status = 'completed'), 0) as total_spent
      FROM orders WHERE user_id = $3
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
        `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ratings')`
      );
      if (ratingsTableCheck.rows[0]?.exists) {
        const ratingResult = await (pool as any).query(
          `SELECT COALESCE(AVG(rating)::numeric, 0) as avg_rating, COUNT(*) as count FROM ratings WHERE user_id = $1`,
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
      const loyaltyResult = await (pool as any).query(`SELECT loyalty_points FROM users WHERE id = $1`, [clientId]);
      if (loyaltyResult.rows[0]?.loyalty_points) {
        loyaltyPoints = parseInt(loyaltyResult.rows[0].loyalty_points || '0');
      }
    } catch {
      // Colonne peut ne pas exister
    }

    let deferredPayments = {
      totalPaid: 0, totalRemaining: 0, totalDue: 0,
      globalStatus: 'paid' as 'paid' | 'partially_paid' | 'unpaid',
      transactions: [] as any[],
    };

    try {
      const deferredTransactionsQuery = `
        SELECT
          t.id, t.order_id, t.amount, t.partial_amount, t.remaining_amount,
          t.is_partial, t.payment_method_type, t.status, t.created_at, o.id as order_id_full
        FROM transactions t
        INNER JOIN orders o ON t.order_id = o.id
        WHERE t.user_id = $1
          AND (t.is_partial = true OR t.payment_method_type = 'deferred' OR t.remaining_amount > 0)
          AND t.status NOT IN ('cancelled', 'refunded')
          AND o.status = 'completed'
        ORDER BY t.created_at DESC
      `;
      const deferredResult = await (pool as any).query(deferredTransactionsQuery, [clientId]);
      const transactions = deferredResult.rows || [];

      let totalPaid = 0;
      let totalRemaining = 0;
      transactions.forEach((tx: any) => {
        totalPaid += parseFloat(tx.partial_amount || tx.amount || '0');
        totalRemaining += parseFloat(tx.remaining_amount || '0');
      });

      let globalStatus: 'paid' | 'partially_paid' | 'unpaid' = 'paid';
      if (totalRemaining > 0) {
        globalStatus = totalPaid > 0 ? 'partially_paid' : 'unpaid';
      }

      deferredPayments = {
        totalPaid, totalRemaining, totalDue: totalPaid + totalRemaining, globalStatus,
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
      FROM orders WHERE user_id = $3
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
        `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ratings')`
      );
      if (ratingsTableCheck.rows[0]?.exists) {
        const ratingResult = await (pool as any).query(
          `SELECT COALESCE(AVG(rating)::numeric, 0) as avg_rating, COUNT(*) as count FROM ratings WHERE user_id = $1`,
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
      const loyaltyResult = await (pool as any).query(`SELECT loyalty_points FROM users WHERE id = $1`, [clientId]);
      if (loyaltyResult.rows[0]?.loyalty_points) {
        loyaltyPoints = parseInt(loyaltyResult.rows[0].loyalty_points || '0');
      }
    } catch {
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

export const getAdminAdminDetails = async (req: Request, res: Response): Promise<void> => {
  try {
    const { adminId } = req.params;
    logger.info('🚀 [getAdminAdminDetails] DÉBUT', { adminId });

    if (!process.env.DATABASE_URL) {
      res.status(404).json({ success: false, message: 'Admin non trouvé' });
      return;
    }

    const userResult = await (pool as any).query(
      `SELECT id, email, phone, first_name, last_name, role, created_at, avatar_url
       FROM users WHERE id = $1 AND (role = 'admin' OR role = 'super_admin')`,
      [adminId]
    );

    if (userResult.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Admin non trouvé' });
      return;
    }

    const user = userResult.rows[0];

    const adminActivity = {
      lastLogin: null,
      recentActions: [],
      recentTickets: [],
    };

    let clientsWithPartialPayments: any[] = [];
    try {
      const partialPaymentsQuery = `
        SELECT
          u.id as client_id, u.first_name, u.last_name, u.email, u.phone,
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
          AND t.status NOT IN ('paid', 'cancelled', 'refunded')
          AND o.status = 'completed'
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
        adminActivity,
        monitoring: { clientsWithPartialPayments },
      },
    });
  } catch (error: any) {
    logger.error('Erreur getAdminAdminDetails:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur', error: error.message });
  }
};
