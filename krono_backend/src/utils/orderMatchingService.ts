import pool from '../config/db.js';
import logger from './logger.js';
import { maskUserId, maskOrderId } from './maskSensitiveData.js';
import { calculateDriverRating } from './calculateDriverRating.js';

/**
 * Interface pour les données d'un livreur avec score
 */
export interface ScoredDriver {
  driverId: string;
  distance: number;
  score: number;
  details: {
    distanceScore: number;
    acceptanceScore: number;
    ratingScore: number;
    loadScore: number;
    fairnessScore?: number; // Score d'équité (optionnel pour compatibilité)
  };
  // Données supplémentaires pour debug
  acceptanceRate?: number;
  avgRating?: number;
  currentLoad?: number;
  driverType?: 'internal' | 'partner'; // Type de livreur
}

/**
 * Interface pour les stats d'un livreur
 */
interface DriverStats {
  acceptanceRate: number; // 0-1 (0% à 100%)
  avgRating: number; // 0-5
  currentLoad: number; // Nombre de commandes actives
}

/**
 * Service de matching ÉQUITABLE pour les commandes
 * 
 * Principe d'équité : TOUS les livreurs disponibles reçoivent des commandes de manière équitable.
 * La priorité d'envoi est basée UNIQUEMENT sur les notes (ratings) des livreurs.
 * 
 * Système simple et équitable :
 * 1. Tous les livreurs disponibles reçoivent la commande
 * 2. L'ordre d'envoi est déterminé par les notes (meilleure note = envoyé en premier)
 * 3. Rotation équitable : Les livreurs moins sollicités récemment sont prioritaires
 */
class OrderMatchingService {
  private readonly DEBUG = process.env.DEBUG_SOCKETS === 'true';
  
  // Période pour calculer l'équité (en heures)
  private readonly FAIRNESS_PERIOD_HOURS = 24;

  /**
   * Récupère les statistiques d'un livreur depuis la base de données
   */
  private async getDriverStats(driverId: string, activeOrdersCount: number): Promise<DriverStats & { recentOrdersCount: number; driverType: 'internal' | 'partner' }> {
    try {
      const driverTypeQuery = `
        SELECT COALESCE(driver_type, 'partner') as driver_type
        FROM driver_profiles
        WHERE user_id = $1
      `;
      const driverTypeResult = await pool.query(driverTypeQuery, [driverId]);
      const driverType = (driverTypeResult.rows[0]?.driver_type || 'partner') as 'internal' | 'partner';

      const acceptanceQuery = `
        SELECT
          COUNT(*) FILTER (WHERE accepted_at IS NOT NULL) as accepted,
          COUNT(*) as total_assigned
        FROM order_assignments
        WHERE driver_id = $1
      `;

      const acceptanceResult = await pool.query(acceptanceQuery, [driverId]);
      const acceptanceRate =
        acceptanceResult.rows[0]?.total_assigned > 0
          ? (acceptanceResult.rows[0].accepted / acceptanceResult.rows[0].total_assigned)
          : 0.8; // Par défaut 80% si pas d'historique

      const avgRating = await calculateDriverRating(driverId);

      const recentOrdersQuery = `
        SELECT COUNT(*) as count
        FROM order_assignments
        WHERE driver_id = $1
          AND assigned_at >= NOW() - INTERVAL '${this.FAIRNESS_PERIOD_HOURS} hours'
      `;

      const recentOrdersResult = await pool.query(recentOrdersQuery, [driverId]);
      const recentOrdersCount = parseInt(recentOrdersResult.rows[0]?.count || '0', 10);

      return {
        acceptanceRate: Math.max(0, Math.min(1, acceptanceRate)),
        avgRating: Math.max(0, Math.min(5, avgRating)),
        currentLoad: activeOrdersCount,
        recentOrdersCount,
        driverType,
      };
    } catch (error: any) {
      logger.warn(
        `[OrderMatchingService] Erreur récupération stats pour ${maskUserId(driverId)}:`,
        error.message
      );
      return {
        acceptanceRate: 0.8,
        avgRating: 5.0,
        currentLoad: activeOrdersCount,
        recentOrdersCount: 0,
        driverType: 'partner',
      };
    }
  }

  /**
   * Calcule le score de priorité basé UNIQUEMENT sur :
   * 1. La note moyenne (rating) - 70%
   * 2. L'équité (livreurs moins sollicités) - 30%
   */
  private calculatePriorityScore(
    rating: number,
    recentOrdersCount: number,
    averageRecentOrders: number
  ): number {
    const ratingScore = (rating / 5) * 0.7;

    let fairnessScore = 1.0;
    if (averageRecentOrders > 0) {
      const ratio = recentOrdersCount / Math.max(1, averageRecentOrders);
      if (ratio <= 0.5) {
        fairnessScore = 1.0;
      } else if (ratio >= 2.0) {
        fairnessScore = 0.0;
      } else {
        fairnessScore = 1 - ((ratio - 0.5) / 1.5);
      }
    }
    const fairnessScoreWeighted = fairnessScore * 0.3;
    
    return ratingScore + fairnessScoreWeighted;
  }

  /**
   * Trouve TOUS les livreurs disponibles et les trie par priorité (notes + équité)
   * 
   * Principe d'ÉQUITÉ TOTALE avec PRIORISATION INTERNES :
   * - TOUS les livreurs disponibles reçoivent la commande
   * - PRIORITÉ INTERNES : Les livreurs internes sont TOUJOURS prioritaires sur B2B/planifiées
   * - L'ordre d'envoi est déterminé par : Notes (70%) + Équité (30%)
   * - Les livreurs avec meilleures notes sont envoyés en premier
   * - Les livreurs moins sollicités reçoivent un bonus
   * 
   * @param nearbyDrivers Liste des livreurs proches (depuis findNearbyDrivers)
   * @param activeOrdersCount Fonction pour obtenir le nombre de commandes actives d'un livreur
   * @param orderInfo Informations sur la commande (isB2B, isScheduled, etc.)
   * @returns Liste de TOUS les livreurs triés par priorité (internes d'abord si B2B/planifiée, puis notes + équité)
   */
  async findBestDrivers(
    nearbyDrivers: Array<{ driverId: string; distance: number; [key: string]: any }>,
    activeOrdersCount: (driverId: string) => number,
    orderInfo?: { isB2B?: boolean; isScheduled?: boolean; isSensitive?: boolean }
  ): Promise<ScoredDriver[]> {
    if (nearbyDrivers.length === 0) {
      return [];
    }

    if (this.DEBUG) {
      logger.info(
        `[OrderMatchingService] Calcul priorité équitable pour ${nearbyDrivers.length} livreurs`
      );
    }

    const scoredDrivers: Array<ScoredDriver & { recentOrdersCount: number; priorityScore: number }> = [];
    const recentOrdersCounts: number[] = [];

    for (const driver of nearbyDrivers) {
      try {
        const currentLoad = activeOrdersCount(driver.driverId);
        const stats = await this.getDriverStats(driver.driverId, currentLoad);
        recentOrdersCounts.push(stats.recentOrdersCount);
      } catch (error: any) {
        recentOrdersCounts.push(0);
      }
    }

    const averageRecentOrders = recentOrdersCounts.length > 0
      ? recentOrdersCounts.reduce((a, b) => a + b, 0) / recentOrdersCounts.length
      : 0;

    // Les internes sont toujours prioritaires sur les commandes B2B/planifiées/sensibles
    const isPriorityOrder = orderInfo?.isB2B || orderInfo?.isScheduled || orderInfo?.isSensitive;

    for (const driver of nearbyDrivers) {
      try {
        const currentLoad = activeOrdersCount(driver.driverId);
        const stats = await this.getDriverStats(driver.driverId, currentLoad);

        let priorityScore = this.calculatePriorityScore(
          stats.avgRating,
          stats.recentOrdersCount,
          averageRecentOrders
        );

        if (isPriorityOrder && stats.driverType === 'internal') {
          priorityScore += 1000; // Bonus suffisant pour garantir la priorité
          if (this.DEBUG) {
            logger.debug(
              `[OrderMatchingService] ${maskUserId(driver.driverId)}: INTERNE - Bonus priorité B2B/planifiée`
            );
          }
        }

        scoredDrivers.push({
          driverId: driver.driverId,
          distance: driver.distance,
          score: priorityScore,
          details: {
            distanceScore: 0,
            acceptanceScore: 0,
            ratingScore: stats.avgRating / 5,
            loadScore: 0,
          },
          acceptanceRate: stats.acceptanceRate,
          avgRating: stats.avgRating,
          currentLoad: stats.currentLoad,
          driverType: stats.driverType,
          recentOrdersCount: stats.recentOrdersCount,
          priorityScore,
        });

        if (this.DEBUG) {
          logger.debug(
            `[OrderMatchingService] ${maskUserId(driver.driverId)}: ` +
            `priority=${priorityScore.toFixed(3)}, ` +
            `rating=${stats.avgRating.toFixed(1)}/5, ` +
            `recent=${stats.recentOrdersCount} commandes, ` +
            `distance=${driver.distance.toFixed(2)}km`
          );
        }
      } catch (error: any) {
        logger.warn(
          `[OrderMatchingService] Erreur calcul priorité pour ${maskUserId(driver.driverId)}:`,
          error.message
        );
        let priorityScore = this.calculatePriorityScore(5.0, 0, averageRecentOrders);

        // Même en cas d'erreur, on essaie de récupérer le type pour le bonus interne
        if (isPriorityOrder) {
          try {
            const driverTypeQuery = `
              SELECT COALESCE(driver_type, 'partner') as driver_type
              FROM driver_profiles
              WHERE user_id = $1
            `;
            const driverTypeResult = await pool.query(driverTypeQuery, [driver.driverId]);
            const driverType = (driverTypeResult.rows[0]?.driver_type || 'partner') as 'internal' | 'partner';
            if (driverType === 'internal') {
              priorityScore += 1000;
            }
          } catch {
            // score par défaut conservé
          }
        }

        scoredDrivers.push({
          driverId: driver.driverId,
          distance: driver.distance,
          score: priorityScore,
          details: {
            distanceScore: 0,
            acceptanceScore: 0,
            ratingScore: 1.0,
            loadScore: 0,
          },
          driverType: 'partner',
          recentOrdersCount: 0,
          priorityScore,
        });
      }
    }

    // Tous les livreurs sont retournés, triés par priorité décroissante
    const sortedDrivers = scoredDrivers.sort((a, b) => b.score - a.score);

    if (this.DEBUG) {
      logger.info(
        `[OrderMatchingService] ${sortedDrivers.length} livreurs recevront la commande (triés par priorité)`
      );
      sortedDrivers.forEach((driver, index) => {
        logger.info(
          `  ${index + 1}. ${maskUserId(driver.driverId)}: ` +
          `priority=${driver.score.toFixed(3)}, ` +
          `rating=${driver.avgRating?.toFixed(1) || 'N/A'}/5, ` +
          `recent=${driver.recentOrdersCount} commandes`
        );
      });
    }

    return sortedDrivers.map(({ recentOrdersCount, ...rest }) => rest);
  }
}

export const orderMatchingService = new OrderMatchingService();

