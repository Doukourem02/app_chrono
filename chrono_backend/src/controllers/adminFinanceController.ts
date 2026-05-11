import { Request, Response } from 'express';
import pool from '../config/db.js';
import logger from '../utils/logger.js';
import {
  activeOrderCondition,
  inactiveOrderCondition,
  liveOrderCondition,
  staleLiveOrderCondition,
  orderLossDateExpression,
  effectiveOrderStatusExpression,
  effectivePaymentStatusExpression,
  getDateRange,
  normalizeDate,
} from './adminControllerUtils.js';

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

    const customStart = req.query.startDate as string | undefined;
    const customEnd = req.query.endDate as string | undefined;
    const hasCustomRange = !!(customStart && customEnd);
    const financialStatsWarnings: string[] = [];

    const orderColumnsInfo = await (pool as any).query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'orders'
       AND column_name = ANY($1)`,
      [['price_cfa', 'price', 'payment_method_type']]
    );
    const orderColumnSet = new Set(orderColumnsInfo.rows.map((row: any) => row.column_name));
    const priceColumn = orderColumnSet.has('price_cfa') ? 'price_cfa' : orderColumnSet.has('price') ? 'price' : null;
    const orderPriceExpression =
      orderColumnSet.has('price_cfa') && orderColumnSet.has('price')
        ? 'COALESCE(o.price_cfa, o.price, 0)'
        : priceColumn
          ? `COALESCE(o.${priceColumn}, 0)`
          : '0';
    const orderPriceGroupByColumns = [
      orderColumnSet.has('price_cfa') ? 'o.price_cfa' : null,
      orderColumnSet.has('price') ? 'o.price' : null,
    ].filter(Boolean).join(', ');
    const hasOrderPaymentMethodType = orderColumnSet.has('payment_method_type');
    const orderPaymentMethodExpression = hasOrderPaymentMethodType ? 'o.payment_method_type' : 'NULL';
    const deferredOrderCondition = hasOrderPaymentMethodType ? "o.payment_method_type = 'deferred'" : 'FALSE';
    const deferredGroupByColumns = [
      'o.id', 'o.status', 'o.created_at', 'o.cancelled_at',
      hasOrderPaymentMethodType ? 'o.payment_method_type' : null,
      orderPriceGroupByColumns || null,
    ].filter(Boolean).join(', ');

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

    const revenueQuery = `
      SELECT
        COALESCE(SUM(t.amount) FILTER (WHERE t.created_at >= $1 AND t.created_at <= $2), 0) as today,
        COALESCE(SUM(t.amount) FILTER (WHERE t.created_at >= $3 AND t.created_at <= $2), 0) as week,
        COALESCE(SUM(t.amount) FILTER (WHERE t.created_at >= $4 AND t.created_at <= $2), 0) as month,
        COALESCE(SUM(t.amount) FILTER (WHERE t.created_at >= $5 AND t.created_at <= $2), 0) as year
        ${hasCustomRange ? `,COALESCE(SUM(t.amount) FILTER (WHERE t.created_at >= $6 AND t.created_at <= $7), 0) as custom` : ''}
      FROM transactions t
      LEFT JOIN orders o ON t.order_id = o.id
      WHERE t.status = 'paid'
        AND ${activeOrderCondition}
    `;

    const revenueParams = [
      startOfToday.toISOString(), now.toISOString(),
      startOfWeek.toISOString(), startOfMonth.toISOString(), startOfYear.toISOString(),
      ...(hasCustomRange ? [customStart!, customEnd!] : []),
    ];

    let revenueResult: any = { rows: [{}] };
    try {
      revenueResult = await (pool as any).query(revenueQuery, revenueParams);
    } catch (err: any) {
      logger.error('[financial-stats] Erreur revenueQuery:', err.message);
      financialStatsWarnings.push('revenue');
    }

    const transactionsByMethod: Record<string, number> = { orange_money: 0, wave: 0, cash: 0, deferred: 0 };
    try {
      const transactionsByMethodResult = await (pool as any).query(`
        SELECT t.payment_method_type, COALESCE(SUM(t.amount), 0) as total
        FROM transactions t
        LEFT JOIN orders o ON t.order_id = o.id
        WHERE t.created_at >= $1 AND ${activeOrderCondition} AND t.status NOT IN ('cancelled', 'refunded')
        GROUP BY t.payment_method_type
      `, [startOfMonth.toISOString()]);
      transactionsByMethodResult.rows.forEach((row: any) => {
        if (row.payment_method_type) {
          transactionsByMethod[row.payment_method_type] = parseFloat(row.total || '0');
        }
      });
    } catch (err: any) {
      logger.error('[financial-stats] Erreur transactionsByMethodQuery:', err.message);
      financialStatsWarnings.push('transactionsByMethod');
    }

    const paymentStatus: Record<string, number> = { pending: 0, paid: 0, refused: 0, delayed: 0 };
    try {
      const paymentStatusResult = await (pool as any).query(`
        SELECT t.status, t.payment_method_type, COUNT(*) as count
        FROM transactions t
        LEFT JOIN orders o ON t.order_id = o.id
        WHERE t.created_at >= $1 AND ${activeOrderCondition} AND t.status NOT IN ('cancelled', 'refunded')
        GROUP BY t.status, t.payment_method_type
      `, [startOfMonth.toISOString()]);
      let deferredPendingCount = 0;
      paymentStatusResult.rows.forEach((row: any) => {
        if (row.status) {
          if (row.payment_method_type === 'deferred' && row.status === 'pending') {
            deferredPendingCount += parseInt(row.count || '0');
          } else {
            paymentStatus[row.status] = (paymentStatus[row.status] || 0) + parseInt(row.count || '0');
          }
        }
      });
      paymentStatus.delayed = (paymentStatus.delayed || 0) + deferredPendingCount;
      paymentStatus.pending = Math.max(0, (paymentStatus.pending || 0) - deferredPendingCount);
    } catch (err: any) {
      logger.error('[financial-stats] Erreur paymentStatusQuery:', err.message);
      financialStatsWarnings.push('paymentStatus');
    }

    const periodParams: string[] = [
      startOfToday.toISOString(), startOfWeek.toISOString(),
      startOfMonth.toISOString(), startOfYear.toISOString(),
      ...(hasCustomRange ? [customStart!, customEnd!] : []),
    ];
    const emptyQrPeriod = { scanned: 0, total: 0, cancelled: 0 };
    let qrScanned: Record<string, { scanned: number; total: number; cancelled: number }> = {
      today: { ...emptyQrPeriod }, week: { ...emptyQrPeriod },
      month: { ...emptyQrPeriod }, year: { ...emptyQrPeriod },
      ...(hasCustomRange ? { custom: { ...emptyQrPeriod } } : {}),
    };
    try {
      const qrScannedQuery = `
        SELECT
          COUNT(*) FILTER (WHERE ${activeOrderCondition} AND o.delivery_qr_scanned_at IS NOT NULL AND o.created_at >= $1) as scanned_today,
          COUNT(*) FILTER (WHERE ${activeOrderCondition} AND o.delivery_qr_scanned_at IS NOT NULL AND o.created_at >= $2) as scanned_week,
          COUNT(*) FILTER (WHERE ${activeOrderCondition} AND o.delivery_qr_scanned_at IS NOT NULL AND o.created_at >= $3) as scanned_month,
          COUNT(*) FILTER (WHERE ${activeOrderCondition} AND o.delivery_qr_scanned_at IS NOT NULL AND o.created_at >= $4) as scanned_year,
          COUNT(*) FILTER (WHERE ${activeOrderCondition} AND (o.delivery_qr_scanned_at IS NOT NULL OR ${liveOrderCondition}) AND o.created_at >= $1) as total_today,
          COUNT(*) FILTER (WHERE ${activeOrderCondition} AND (o.delivery_qr_scanned_at IS NOT NULL OR ${liveOrderCondition}) AND o.created_at >= $2) as total_week,
          COUNT(*) FILTER (WHERE ${activeOrderCondition} AND (o.delivery_qr_scanned_at IS NOT NULL OR ${liveOrderCondition}) AND o.created_at >= $3) as total_month,
          COUNT(*) FILTER (WHERE ${activeOrderCondition} AND (o.delivery_qr_scanned_at IS NOT NULL OR ${liveOrderCondition}) AND o.created_at >= $4) as total_year,
          COUNT(*) FILTER (WHERE ${inactiveOrderCondition} AND ${orderLossDateExpression} >= $1) as cancelled_today,
          COUNT(*) FILTER (WHERE ${inactiveOrderCondition} AND ${orderLossDateExpression} >= $2) as cancelled_week,
          COUNT(*) FILTER (WHERE ${inactiveOrderCondition} AND ${orderLossDateExpression} >= $3) as cancelled_month,
          COUNT(*) FILTER (WHERE ${inactiveOrderCondition} AND ${orderLossDateExpression} >= $4) as cancelled_year
          ${hasCustomRange ? `,
          COUNT(*) FILTER (WHERE ${activeOrderCondition} AND o.delivery_qr_scanned_at IS NOT NULL AND o.created_at >= $5 AND o.created_at <= $6) as scanned_custom,
          COUNT(*) FILTER (WHERE ${activeOrderCondition} AND (o.delivery_qr_scanned_at IS NOT NULL OR ${liveOrderCondition}) AND o.created_at >= $5 AND o.created_at <= $6) as total_custom,
          COUNT(*) FILTER (WHERE ${inactiveOrderCondition} AND ${orderLossDateExpression} >= $5 AND ${orderLossDateExpression} <= $6) as cancelled_custom` : ''}
        FROM orders o
        WHERE (o.delivery_qr_code IS NOT NULL OR o.delivery_verification_code IS NOT NULL)
          AND (o.created_at >= $4 OR ${orderLossDateExpression} >= $4)
      `;
      const qrScannedResult = await (pool as any).query(qrScannedQuery, periodParams);
      const qr = qrScannedResult.rows[0] || {};
      const makeQrPeriod = (suffix: string) => ({
        scanned: parseInt(qr[`scanned_${suffix}`] || '0'),
        total: parseInt(qr[`total_${suffix}`] || '0'),
        cancelled: parseInt(qr[`cancelled_${suffix}`] || '0'),
      });
      qrScanned = {
        today: makeQrPeriod('today'), week: makeQrPeriod('week'),
        month: makeQrPeriod('month'), year: makeQrPeriod('year'),
        ...(hasCustomRange ? { custom: makeQrPeriod('custom') } : {}),
      };
    } catch (err: any) {
      logger.error('[financial-stats] Erreur qrScannedQuery:', err.message);
      financialStatsWarnings.push('qrScanned');
    }

    const emptyCancelledPeriod = { count: 0, totalValue: 0, deferredAmount: 0 };
    let cancelledStats: Record<string, { count: number; totalValue: number; deferredAmount: number }> = {
      today: { ...emptyCancelledPeriod }, week: { ...emptyCancelledPeriod },
      month: { ...emptyCancelledPeriod }, year: { ...emptyCancelledPeriod },
      ...(hasCustomRange ? { custom: { ...emptyCancelledPeriod } } : {}),
    };
    try {
      const cancelledStatsQuery = `
        SELECT
          COUNT(*) FILTER (WHERE ${orderLossDateExpression} >= $1) as count_today,
          COUNT(*) FILTER (WHERE ${orderLossDateExpression} >= $2) as count_week,
          COUNT(*) FILTER (WHERE ${orderLossDateExpression} >= $3) as count_month,
          COUNT(*) FILTER (WHERE ${orderLossDateExpression} >= $4) as count_year,
          COALESCE(SUM(${orderPriceExpression}) FILTER (WHERE ${orderLossDateExpression} >= $1), 0) as value_today,
          COALESCE(SUM(${orderPriceExpression}) FILTER (WHERE ${orderLossDateExpression} >= $2), 0) as value_week,
          COALESCE(SUM(${orderPriceExpression}) FILTER (WHERE ${orderLossDateExpression} >= $3), 0) as value_month,
          COALESCE(SUM(${orderPriceExpression}) FILTER (WHERE ${orderLossDateExpression} >= $4), 0) as value_year
          ${hasCustomRange ? `,
          COUNT(*) FILTER (WHERE ${orderLossDateExpression} >= $5 AND ${orderLossDateExpression} <= $6) as count_custom,
          COALESCE(SUM(${orderPriceExpression}) FILTER (WHERE ${orderLossDateExpression} >= $5 AND ${orderLossDateExpression} <= $6), 0) as value_custom` : ''}
        FROM orders o
        WHERE ${inactiveOrderCondition} AND ${orderLossDateExpression} >= $4
      `;
      const cancelledDeferredQuery = `
        SELECT
          COALESCE(SUM(deferred_amount) FILTER (WHERE loss_date >= $1), 0) as deferred_today,
          COALESCE(SUM(deferred_amount) FILTER (WHERE loss_date >= $2), 0) as deferred_week,
          COALESCE(SUM(deferred_amount) FILTER (WHERE loss_date >= $3), 0) as deferred_month,
          COALESCE(SUM(deferred_amount) FILTER (WHERE loss_date >= $4), 0) as deferred_year
          ${hasCustomRange ? `,
          COALESCE(SUM(deferred_amount) FILTER (WHERE loss_date >= $5 AND loss_date <= $6), 0) as deferred_custom` : ''}
        FROM (
          SELECT
            o.id,
            ${orderLossDateExpression} as loss_date,
            CASE
              WHEN ${orderPaymentMethodExpression} = 'deferred' THEN ${orderPriceExpression}
              ELSE COALESCE(SUM(t.amount) FILTER (WHERE t.payment_method_type = 'deferred'), 0)
            END as deferred_amount
          FROM orders o
          LEFT JOIN transactions t ON t.order_id = o.id
          WHERE ${inactiveOrderCondition}
            AND (${deferredOrderCondition} OR t.payment_method_type = 'deferred')
            AND ${orderLossDateExpression} >= $4
          GROUP BY ${deferredGroupByColumns}
        ) deferred_losses
      `;
      const [cancelledStatsResult, cancelledDeferredResult] = await Promise.all([
        (pool as any).query(cancelledStatsQuery, periodParams),
        (pool as any).query(cancelledDeferredQuery, periodParams),
      ]);
      const cs = cancelledStatsResult.rows[0] || {};
      const cd = cancelledDeferredResult.rows[0] || {};
      const makeCancelledPeriod = (suffix: string) => ({
        count: parseInt(cs[`count_${suffix}`] || '0'),
        totalValue: parseFloat(cs[`value_${suffix}`] || '0'),
        deferredAmount: parseFloat(cd[`deferred_${suffix}`] || '0'),
      });
      cancelledStats = {
        today: makeCancelledPeriod('today'), week: makeCancelledPeriod('week'),
        month: makeCancelledPeriod('month'), year: makeCancelledPeriod('year'),
        ...(hasCustomRange ? { custom: makeCancelledPeriod('custom') } : {}),
      };
    } catch (err: any) {
      logger.error('[financial-stats] Erreur cancelledStats:', err.message);
      financialStatsWarnings.push('cancelledStats');
    }

    const totalTransactions = paymentStatus.pending + paymentStatus.paid + paymentStatus.refused + paymentStatus.delayed;
    const conversionRate = totalTransactions > 0 ? (paymentStatus.paid / totalTransactions) * 100 : 0;

    let revenueByDriverRows: any[] = [];
    try {
      const revenueByDriverResult = await (pool as any).query(`
        SELECT o.driver_id, COUNT(*) as deliveries, COALESCE(SUM(${priceColumn}), 0) as revenue
        FROM orders o
        WHERE o.status = 'completed' AND o.completed_at >= $1 AND o.driver_id IS NOT NULL
        GROUP BY o.driver_id ORDER BY revenue DESC LIMIT 10
      `, [startOfMonth.toISOString()]);
      revenueByDriverRows = revenueByDriverResult.rows;
    } catch (err: any) {
      logger.error('[financial-stats] Erreur revenueByDriverQuery:', err.message);
    }

    const revenueByDeliveryType: Record<string, number> = { moto: 0, vehicule: 0, cargo: 0 };
    try {
      const revenueByDeliveryTypeResult = await (pool as any).query(`
        SELECT delivery_method, COALESCE(SUM(${priceColumn}), 0) as revenue
        FROM orders WHERE status = 'completed' AND completed_at >= $1
        GROUP BY delivery_method
      `, [startOfMonth.toISOString()]);
      revenueByDeliveryTypeResult.rows.forEach((row: any) => {
        if (row.delivery_method) {
          revenueByDeliveryType[row.delivery_method] = parseFloat(row.revenue || '0');
        }
      });
    } catch (err: any) {
      logger.error('[financial-stats] Erreur revenueByDeliveryTypeQuery:', err.message);
    }

    const row = revenueResult.rows[0] || {};

    res.json({
      success: true,
      data: {
        totalRevenue: {
          today: parseFloat(row.today || '0'),
          week: parseFloat(row.week || '0'),
          month: parseFloat(row.month || '0'),
          year: parseFloat(row.year || '0'),
          ...(hasCustomRange ? { custom: parseFloat(row.custom || '0') } : {}),
        },
        transactionsByMethod,
        paymentStatus,
        qrScanned,
        cancelledStats,
        diagnostics: { hasWarnings: financialStatsWarnings.length > 0, warnings: financialStatsWarnings },
        conversionRate: Math.round(conversionRate * 10) / 10,
        revenueByDriver: revenueByDriverRows.map((r: any) => ({
          driverId: r.driver_id,
          deliveries: parseInt(r.deliveries || '0'),
          revenue: parseFloat(r.revenue || '0'),
        })),
        revenueByDeliveryType,
      },
    });
  } catch (error: any) {
    logger.error('Erreur getAdminFinancialStats:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur', error: error.message });
  }
};

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
    const view = req.query.view as 'active' | 'cancelled' | undefined;

    logger.info('🚀 [getAdminTransactions] DÉBUT', { page, limit, status, method, view });

    if (!process.env.DATABASE_URL) {
      logger.warn('DATABASE_URL non configuré pour getAdminTransactions');
      res.json({ success: true, data: [], pagination: { page, limit, total: 0, totalPages: 0 } });
      return;
    }

    let query = `
      SELECT
        t.*,
        o.id as order_id_full,
        u.email as user_email, u.phone as user_phone,
        u.first_name as user_first_name, u.last_name as user_last_name,
        d.email as driver_email, d.phone as driver_phone
      FROM transactions t
      LEFT JOIN orders o ON t.order_id = o.id
      LEFT JOIN users u ON t.user_id = u.id
      LEFT JOIN users d ON o.driver_id = d.id
      WHERE 1=1
    `;

    const params: any[] = [];
    let paramIndex = 1;

    if (status) { query += ` AND t.status = $${paramIndex}`; params.push(status); paramIndex++; }
    if (method) { query += ` AND t.payment_method_type = $${paramIndex}`; params.push(method); paramIndex++; }
    if (startDate) { query += ` AND t.created_at >= $${paramIndex}`; params.push(startDate); paramIndex++; }
    if (endDate) { query += ` AND t.created_at <= $${paramIndex}`; params.push(endDate); paramIndex++; }

    if (search) {
      const searchPattern = `%${search}%`;
      query += ` AND (
        t.id::text ILIKE $${paramIndex} OR t.order_id::text ILIKE $${paramIndex} OR
        u.email ILIKE $${paramIndex} OR u.phone ILIKE $${paramIndex} OR
        u.first_name ILIKE $${paramIndex} OR u.last_name ILIKE $${paramIndex} OR
        CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, '')) ILIKE $${paramIndex}
      )`;
      params.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
      paramIndex += 7;
    }

    if (view === 'active') {
      query += ` AND ${activeOrderCondition}`;
      query += ` AND t.status NOT IN ('cancelled', 'refunded')`;
    } else if (view === 'cancelled') {
      query += ` AND (${inactiveOrderCondition} OR t.status IN ('cancelled', 'refunded'))`;
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
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error: any) {
    logger.error('Erreur getAdminTransactions:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur', error: error.message });
  }
};

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
        ${effectiveOrderStatusExpression} as effective_status,
        u.first_name as user_first_name, u.last_name as user_last_name,
        u.email as user_email, u.phone as user_phone,
        d.first_name as driver_first_name, d.last_name as driver_last_name,
        d.email as driver_email, d.phone as driver_phone
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      LEFT JOIN users d ON o.driver_id = d.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (startDate) { query += ` AND o.created_at >= $${paramIndex}`; params.push(startDate); paramIndex++; }
    if (endDate) { query += ` AND o.created_at <= $${paramIndex}`; params.push(endDate); paramIndex++; }

    if (status && status !== 'all') {
      if (status === 'cancelled') {
        query += ` AND ${inactiveOrderCondition}`;
      } else if (status === 'pending') {
        query += ` AND o.status = $${paramIndex} AND NOT ${staleLiveOrderCondition}`;
        params.push(status);
        paramIndex++;
      } else {
        query += ` AND o.status = $${paramIndex}`;
        params.push(status);
        paramIndex++;
      }
    }

    if (driverId) { query += ` AND o.driver_id = $${paramIndex}`; params.push(driverId); paramIndex++; }

    query += ` ORDER BY o.created_at DESC`;

    const result = await (pool as any).query(query, params);
    res.json({ success: true, data: result.rows || [] });
  } catch (error: any) {
    logger.error('Erreur getAdminReportDeliveries:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur', error: error.message });
  }
};

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

    if (startDate) { query += ` AND completed_at >= $${paramIndex}`; params.push(startDate); paramIndex++; }
    if (endDate) { query += ` AND completed_at <= $${paramIndex}`; params.push(endDate); paramIndex++; }
    if (driverId) { query += ` AND driver_id = $${paramIndex}`; params.push(driverId); paramIndex++; }
    if (deliveryType) { query += ` AND delivery_method = $${paramIndex}`; params.push(deliveryType); paramIndex++; }

    query += ` GROUP BY DATE_TRUNC('day', completed_at), delivery_method ORDER BY date DESC`;

    const result = await (pool as any).query(query, params);
    res.json({ success: true, data: result.rows || [] });
  } catch (error: any) {
    logger.error('Erreur getAdminReportRevenues:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur', error: error.message });
  }
};

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
        u.id, u.email, u.phone, u.first_name, u.last_name, u.role, u.created_at,
        COUNT(DISTINCT o.id) as total_orders,
        COUNT(DISTINCT CASE WHEN o.status = 'completed' THEN o.id END) as completed_orders
      FROM users u
      LEFT JOIN orders o ON o.user_id = u.id
      WHERE u.role = 'client'
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (startDate) { query += ` AND (u.created_at >= $${paramIndex} OR o.created_at >= $${paramIndex})`; params.push(startDate); paramIndex++; }
    if (endDate) { query += ` AND (u.created_at <= $${paramIndex} OR o.created_at <= $${paramIndex})`; params.push(endDate); paramIndex++; }

    query += ` GROUP BY u.id, u.email, u.phone, u.first_name, u.last_name, u.role, u.created_at ORDER BY total_orders DESC`;

    const result = await (pool as any).query(query, params);
    res.json({ success: true, data: result.rows || [] });
  } catch (error: any) {
    logger.error('Erreur getAdminReportClients:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur', error: error.message });
  }
};

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
        u.id, u.email, u.phone, u.first_name, u.last_name, u.created_at,
        COUNT(DISTINCT o.id) as total_deliveries,
        COUNT(DISTINCT CASE WHEN o.status = 'completed' THEN o.id END) as completed_deliveries,
        COALESCE(SUM(CASE WHEN o.status = 'completed' THEN ${priceColumn || '0'} ELSE 0 END), 0) as total_revenue
      FROM users u
      LEFT JOIN orders o ON o.driver_id = u.id
      WHERE u.role = 'driver'
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (startDate) { query += ` AND (u.created_at >= $${paramIndex} OR o.created_at >= $${paramIndex})`; params.push(startDate); paramIndex++; }
    if (endDate) { query += ` AND (u.created_at <= $${paramIndex} OR o.created_at <= $${paramIndex})`; params.push(endDate); paramIndex++; }

    query += ` GROUP BY u.id, u.email, u.phone, u.first_name, u.last_name, u.created_at ORDER BY total_revenue DESC`;

    const result = await (pool as any).query(query, params);

    const driversWithRatings = await Promise.all(
      result.rows.map(async (driver: any) => {
        try {
          const ratingsTableCheck = await (pool as any).query(
            `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ratings')`
          );
          if (ratingsTableCheck.rows[0]?.exists) {
            const ratingResult = await (pool as any).query(
              `SELECT COALESCE(AVG(rating)::numeric, 5.0) as avg_rating, COUNT(*) as count FROM ratings WHERE driver_id = $1`,
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

    res.json({ success: true, data: driversWithRatings });
  } catch (error: any) {
    logger.error('Erreur getAdminReportDrivers:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur', error: error.message });
  }
};

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
        normalized.date,
        normalized.payment_method_type,
        normalized.status,
        COUNT(*) as count,
        COALESCE(SUM(normalized.amount), 0) as total_amount
      FROM (
        SELECT
          DATE_TRUNC('day', t.created_at) as date,
          t.payment_method_type,
          ${effectivePaymentStatusExpression} as status,
          t.amount,
          t.created_at
        FROM transactions t
        LEFT JOIN orders o ON t.order_id = o.id
        WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (startDate) { query += ` AND t.created_at >= $${paramIndex}`; params.push(startDate); paramIndex++; }
    if (endDate) { query += ` AND t.created_at <= $${paramIndex}`; params.push(endDate); paramIndex++; }

    query += `
      ) normalized
      GROUP BY normalized.date, normalized.payment_method_type, normalized.status
      ORDER BY normalized.date DESC
    `;

    const result = await (pool as any).query(query, params);
    res.json({ success: true, data: result.rows || [] });
  } catch (error: any) {
    logger.error('Erreur getAdminReportPayments:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur', error: error.message });
  }
};
