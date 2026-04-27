/**
 * Service de gamification
 * Gestion des badges, classements et récompenses
 */

import pool from '../config/db.js';
import logger from '../utils/logger.js';

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  condition: string;
  unlockedAt?: Date;
}

export interface LeaderboardEntry {
  driverId: string;
  driverName: string;
  score: number;
  rank: number;
  deliveries: number;
  totalOrders: number;
  successRate: number;
  rating: number;
}

export interface PerformanceKPIs {
  totalCompleted: number;
  totalOrders: number;
  successRate: number;
  avgRating: number;
  activeDrivers: number;
}

/**
 * Vérifie et débloque les badges pour un livreur
 */
export async function checkAndUnlockBadges(driverId: string): Promise<Badge[]> {
  try {
    // Récupérer les statistiques du livreur
    const statsResult = await pool.query(
      `SELECT 
        COUNT(*) FILTER (WHERE status = 'completed') as total_deliveries,
        AVG(rating) as avg_rating,
        COUNT(*) FILTER (WHERE status = 'completed' AND created_at >= CURRENT_DATE - INTERVAL '7 days') as week_deliveries,
        COUNT(*) FILTER (WHERE status = 'completed' AND created_at >= CURRENT_DATE - INTERVAL '30 days') as month_deliveries
      FROM orders
      WHERE driver_id = $1`,
      [driverId]
    );

    const stats = statsResult.rows[0];
    const totalDeliveries = parseInt(stats.total_deliveries || '0');
    const avgRating = parseFloat(stats.avg_rating || '0');
    const weekDeliveries = parseInt(stats.week_deliveries || '0');
    const monthDeliveries = parseInt(stats.month_deliveries || '0');

    const unlockedBadges: Badge[] = [];

    // Badge "Première livraison"
    if (totalDeliveries >= 1) {
      unlockedBadges.push({
        id: 'first_delivery',
        name: 'Première livraison',
        description: 'Vous avez complété votre première livraison !',
        icon: '🎯',
        condition: '1 livraison',
        unlockedAt: new Date(),
      });
    }

    // Badge "10 livraisons"
    if (totalDeliveries >= 10) {
      unlockedBadges.push({
        id: '10_deliveries',
        name: 'Débutant confirmé',
        description: '10 livraisons complétées',
        icon: '⭐',
        condition: '10 livraisons',
        unlockedAt: new Date(),
      });
    }

    // Badge "100 livraisons"
    if (totalDeliveries >= 100) {
      unlockedBadges.push({
        id: '100_deliveries',
        name: 'Expert',
        description: '100 livraisons complétées',
        icon: '🏆',
        condition: '100 livraisons',
        unlockedAt: new Date(),
      });
    }

    // Badge "Livreur du mois"
    if (monthDeliveries >= 50) {
      unlockedBadges.push({
        id: 'monthly_champion',
        name: 'Livreur du mois',
        description: '50+ livraisons ce mois',
        icon: '👑',
        condition: '50 livraisons/mois',
        unlockedAt: new Date(),
      });
    }

    // Badge "5 étoiles"
    if (avgRating >= 4.8) {
      unlockedBadges.push({
        id: '5_stars',
        name: 'Excellence',
        description: 'Note moyenne ≥ 4.8/5',
        icon: '🌟',
        condition: 'Note ≥ 4.8/5',
        unlockedAt: new Date(),
      });
    }

    // Enregistrer les badges débloqués
    for (const badge of unlockedBadges) {
      await pool.query(
        `INSERT INTO driver_badges (driver_id, badge_id, unlocked_at)
         VALUES ($1, $2, $3)
         ON CONFLICT (driver_id, badge_id) DO NOTHING`,
        [driverId, badge.id, badge.unlockedAt]
      );
    }

    return unlockedBadges;
  } catch (error: any) {
    logger.error('Error checking badges:', error);
    return [];
  }
}

/**
 * Récupère le classement des livreurs
 */
export async function getLeaderboard(
  period: 'week' | 'month' | 'all' = 'week',
  zone?: string
): Promise<LeaderboardEntry[]> {
  try {
    let dateFilter = '';
    if (period === 'week') {
      dateFilter = "AND o.created_at >= CURRENT_DATE - INTERVAL '7 days'";
    } else if (period === 'month') {
      dateFilter = "AND o.created_at >= CURRENT_DATE - INTERVAL '30 days'";
    }

    let zoneFilter = '';
    if (zone) {
      zoneFilter = `AND o.pickup_address LIKE '%${zone}%'`;
    }

    const result = await pool.query(
      `SELECT
        d.user_id as driver_id,
        u.first_name || ' ' || u.last_name as driver_name,
        COUNT(o.id) FILTER (WHERE o.status = 'completed') as deliveries,
        COUNT(o.id) FILTER (WHERE o.status NOT IN ('pending', 'searching')) as total_orders,
        AVG(r.rating) as rating,
        COUNT(o.id) FILTER (WHERE o.status = 'completed') * COALESCE(AVG(r.rating), 4.0) as score
      FROM driver_profiles d
      JOIN users u ON u.id = d.user_id
      LEFT JOIN orders o ON o.driver_id = d.user_id ${dateFilter} ${zoneFilter}
      LEFT JOIN ratings r ON r.order_id = o.id
      GROUP BY d.user_id, u.first_name, u.last_name
      HAVING COUNT(o.id) FILTER (WHERE o.status = 'completed') > 0
      ORDER BY score DESC
      LIMIT 50`,
      []
    );

    return result.rows.map((row, index) => {
      const deliveries = parseInt(row.deliveries || '0');
      const totalOrders = parseInt(row.total_orders || '0');
      return {
        driverId: row.driver_id,
        driverName: row.driver_name || 'Livreur',
        score: parseFloat(row.score || '0'),
        rank: index + 1,
        deliveries,
        totalOrders,
        successRate: totalOrders > 0 ? Math.round((deliveries / totalOrders) * 100) : 100,
        rating: parseFloat(row.rating || '0'),
      };
    });
  } catch (error: any) {
    logger.error('Error getting leaderboard:', error);
    return [];
  }
}

/**
 * Récupère les KPIs globaux de performance pour la période
 */
export async function getPerformanceKPIs(
  period: 'week' | 'month' | 'all' = 'week'
): Promise<PerformanceKPIs> {
  try {
    let dateFilter = '';
    if (period === 'week') {
      dateFilter = "WHERE o.created_at >= CURRENT_DATE - INTERVAL '7 days'";
    } else if (period === 'month') {
      dateFilter = "WHERE o.created_at >= CURRENT_DATE - INTERVAL '30 days'";
    } else {
      dateFilter = 'WHERE TRUE';
    }

    const result = await pool.query(
      `SELECT
        COUNT(o.id) FILTER (WHERE o.status = 'completed') as total_completed,
        COUNT(o.id) FILTER (WHERE o.status NOT IN ('pending', 'searching')) as total_orders,
        COALESCE(AVG(r.rating), 0) as avg_rating,
        COUNT(DISTINCT o.driver_id) FILTER (WHERE o.status = 'completed') as active_drivers
      FROM orders o
      LEFT JOIN ratings r ON r.order_id = o.id
      ${dateFilter}`,
      []
    );

    const row = result.rows[0];
    const totalCompleted = parseInt(row.total_completed || '0');
    const totalOrders = parseInt(row.total_orders || '0');

    return {
      totalCompleted,
      totalOrders,
      successRate: totalOrders > 0 ? Math.round((totalCompleted / totalOrders) * 100) : 0,
      avgRating: parseFloat(parseFloat(row.avg_rating || '0').toFixed(1)),
      activeDrivers: parseInt(row.active_drivers || '0'),
    };
  } catch (error: any) {
    logger.error('Error getting performance KPIs:', error);
    return { totalCompleted: 0, totalOrders: 0, successRate: 0, avgRating: 0, activeDrivers: 0 };
  }
}

/**
 * Calcule le score d'un livreur
 */
export async function calculateDriverScore(driverId: string): Promise<number> {
  try {
    const result = await pool.query(
      `SELECT 
        COUNT(*) FILTER (WHERE status = 'completed') as deliveries,
        AVG(rating) as avg_rating
      FROM orders o
      LEFT JOIN ratings r ON r.order_id = o.id
      WHERE o.driver_id = $1
        AND o.created_at >= CURRENT_DATE - INTERVAL '30 days'`,
      [driverId]
    );

    const row = result.rows[0];
    const deliveries = parseInt(row.deliveries || '0');
    const avgRating = parseFloat(row.avg_rating || '4.0');

    // Score = nombre de livraisons * note moyenne
    return deliveries * avgRating;
  } catch (error: any) {
    logger.error('Error calculating driver score:', error);
    return 0;
  }
}

