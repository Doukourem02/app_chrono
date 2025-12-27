import { Request, Response } from 'express';
import pool from '../config/db.js';
import logger from '../utils/logger.js';

/**
 * GET /api/analytics/kpis
 * Récupère les KPIs en temps réel
 */
export const getRealTimeKPIs = async (req: Request, res: Response): Promise<void> => {
  try {
    const now = new Date();
    const todayStart = new Date(now.setHours(0, 0, 0, 0));
    const weekStart = new Date(now.setDate(now.getDate() - 7));

    // Commandes en cours
    const activeOrdersResult = await pool.query(
      `SELECT COUNT(*) as count
       FROM orders
       WHERE status IN ('pending', 'accepted', 'enroute', 'picked_up')`,
      []
    );

    // Commandes complétées aujourd'hui
    const completedTodayResult = await pool.query(
      `SELECT COUNT(*) as count, COALESCE(SUM(price), 0) as revenue
       FROM orders
       WHERE status = 'completed' AND completed_at >= $1`,
      [todayStart]
    );

    // Temps moyen de livraison
    const avgDeliveryTimeResult = await pool.query(
      `SELECT AVG(EXTRACT(EPOCH FROM (completed_at - created_at)) / 60) as avg_minutes
       FROM orders
       WHERE status = 'completed' AND completed_at >= $1`,
      [todayStart]
    );

    // Taux d'acceptation
    const acceptanceRateResult = await pool.query(
      `SELECT 
        COUNT(*) FILTER (WHERE status IN ('accepted', 'enroute', 'picked_up', 'completed')) as accepted,
        COUNT(*) FILTER (WHERE status = 'declined') as declined,
        COUNT(*) as total
       FROM orders
       WHERE created_at >= $1`,
      [weekStart]
    );

    const kpis = {
      activeOrders: parseInt(activeOrdersResult.rows[0]?.count || '0'),
      completedToday: parseInt(completedTodayResult.rows[0]?.count || '0'),
      revenueToday: parseFloat(completedTodayResult.rows[0]?.revenue || '0'),
      avgDeliveryTime: parseFloat(avgDeliveryTimeResult.rows[0]?.avg_minutes || '0'),
      acceptanceRate: acceptanceRateResult.rows[0]?.total > 0
        ? (parseInt(acceptanceRateResult.rows[0]?.accepted || '0') / parseInt(acceptanceRateResult.rows[0]?.total || '1')) * 100
        : 0,
      timestamp: new Date().toISOString(),
    };

    res.json(kpis);
  } catch (error: any) {
    logger.error('Error getting KPIs:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

/**
 * GET /api/analytics/performance
 * Graphiques de performance
 */
export const getPerformanceData = async (req: Request, res: Response): Promise<void> => {
  try {
    const days = parseInt(req.query.days as string) || 7;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Données par jour
    const dailyDataResult = await pool.query(
      `SELECT 
        DATE(created_at) as date,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled,
        COALESCE(SUM(price) FILTER (WHERE status = 'completed'), 0) as revenue
       FROM orders
       WHERE created_at >= $1
       GROUP BY DATE(created_at)
       ORDER BY date ASC`,
      [startDate]
    );

    // Données par zone
    const zoneDataResult = await pool.query(
      `SELECT 
        CASE 
          WHEN pickup_address LIKE '%Cocody%' THEN 'Cocody'
          WHEN pickup_address LIKE '%Marcory%' THEN 'Marcory'
          WHEN pickup_address LIKE '%Yopougon%' THEN 'Yopougon'
          WHEN pickup_address LIKE '%Abobo%' THEN 'Abobo'
          WHEN pickup_address LIKE '%Plateau%' THEN 'Plateau'
          WHEN pickup_address LIKE '%Adjamé%' THEN 'Adjamé'
          ELSE 'Autre'
        END as zone,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COALESCE(SUM(price) FILTER (WHERE status = 'completed'), 0) as revenue
       FROM orders
       WHERE created_at >= $1
       GROUP BY zone
       ORDER BY completed DESC`,
      [startDate]
    );

    res.json({
      daily: dailyDataResult.rows,
      byZone: zoneDataResult.rows,
    });
  } catch (error: any) {
    logger.error('Error getting performance data:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

/**
 * GET /api/analytics/export
 * Export des données en CSV/Excel
 */
export const exportAnalytics = async (req: Request, res: Response): Promise<void> => {
  try {
    const format = req.query.format as 'csv' | 'json' || 'json';
    const days = parseInt(req.query.days as string) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const result = await pool.query(
      `SELECT 
        o.id,
        o.order_number,
        o.status,
        o.price,
        o.created_at,
        o.completed_at,
        u.email as client_email,
        d.user_id as driver_id
       FROM orders o
       LEFT JOIN users u ON u.id = o.user_id
       LEFT JOIN driver_profiles d ON d.user_id = o.driver_id
       WHERE o.created_at >= $1
       ORDER BY o.created_at DESC`,
      [startDate]
    );

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=analytics-${Date.now()}.csv`);
      
      // En-têtes CSV
      const headers = ['ID', 'Numéro', 'Statut', 'Prix', 'Créé le', 'Complété le', 'Client', 'Livreur'];
      res.write(headers.join(',') + '\n');
      
      // Données CSV
      result.rows.forEach(row => {
        const values = [
          row.id,
          row.order_number || '',
          row.status || '',
          row.price || 0,
          row.created_at || '',
          row.completed_at || '',
          row.client_email || '',
          row.driver_id || '',
        ];
        res.write(values.join(',') + '\n');
      });
      
      res.end();
    } else {
      res.json({ data: result.rows });
    }
  } catch (error: any) {
    logger.error('Error exporting analytics:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

