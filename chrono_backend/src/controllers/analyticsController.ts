import { Request, Response } from 'express';
import pool from '../config/db.js';
import logger from '../utils/logger.js';

/**
 * GET /api/analytics/kpis
 * Récupère les KPIs en temps réel
 */
export const getRealTimeKPIs = async (req: Request, res: Response): Promise<void> => {
  try {
    logger.debug('getRealTimeKPIs appelé');
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - 7);

    // Helper pour gérer les erreurs de connexion DB
    const safeQuery = async (query: string, params: any[] = []) => {
      try {
        logger.debug('Exécution requête SQL:', { query: query.substring(0, 100), paramsCount: params.length });
        const result = await pool.query(query, params);
        logger.debug('Requête SQL réussie, rows:', result.rows.length);
        return result;
      } catch (dbError: any) {
        logger.error('Erreur requête SQL:', {
          code: dbError.code,
          message: dbError.message,
          query: query.substring(0, 100)
        });
        if (dbError.code === 'ENOTFOUND' || dbError.message?.includes('getaddrinfo') || dbError.code === 'ECONNREFUSED') {
          logger.warn('Erreur connexion base de données, retour de données vides:', dbError.message);
          return { rows: [] };
        }
        throw dbError;
      }
    };

    // Détecter la colonne de prix (price_cfa ou price)
    const priceColumnsInfo = await safeQuery(
      `SELECT column_name FROM information_schema.columns 
       WHERE table_schema = 'public' AND table_name = 'orders' 
       AND column_name = ANY($1)`,
      [['price_cfa', 'price']]
    );
    const priceColumnSet = new Set(priceColumnsInfo.rows.map((row: any) => row.column_name));
    const priceColumn = priceColumnSet.has('price_cfa') ? 'price_cfa' : priceColumnSet.has('price') ? 'price' : null;
    
    if (!priceColumn) {
      logger.warn('Colonne de prix non trouvée dans orders, utilisation de 0 pour les revenus');
    }

    // Commandes en cours
    const activeOrdersResult = await safeQuery(
      `SELECT COUNT(*) as count
       FROM orders
       WHERE status IN ('pending', 'accepted', 'enroute', 'picked_up')`,
      []
    );

    // Commandes complétées aujourd'hui
    const completedTodayResult = await safeQuery(
      `SELECT COUNT(*) as count, COALESCE(SUM(${priceColumn || '0'}), 0) as revenue
       FROM orders
       WHERE status = 'completed' AND completed_at >= $1`,
      [todayStart]
    );

    // Temps moyen de livraison
    const avgDeliveryTimeResult = await safeQuery(
      `SELECT AVG(EXTRACT(EPOCH FROM (completed_at - created_at)) / 60) as avg_minutes
       FROM orders
       WHERE status = 'completed' AND completed_at >= $1`,
      [todayStart]
    );

    // Taux d'acceptation
    const acceptanceRateResult = await safeQuery(
      `SELECT 
        COUNT(*) FILTER (WHERE status IN ('accepted', 'enroute', 'picked_up', 'completed')) as accepted,
        COUNT(*) FILTER (WHERE status = 'declined') as declined,
        COUNT(*) as total
       FROM orders
       WHERE created_at >= $1`,
      [weekStart]
    );

    // Statistiques de ratings
    let averageRating: number | null = null;
    let totalRatings = 0;
    let ratingDistribution = { '5': 0, '4': 0, '3': 0, '2': 0, '1': 0 };
    
    try {
      const ratingsTableCheck = await safeQuery(
        `SELECT EXISTS (
          SELECT 1 FROM information_schema.tables 
          WHERE table_schema = 'public' AND table_name = 'ratings'
        )`
      );
      
      if (ratingsTableCheck.rows[0]?.exists) {
        const ratingsResult = await safeQuery(
          `SELECT 
            CASE 
              WHEN COUNT(*) > 0 THEN AVG(CAST(rating AS NUMERIC))
              ELSE NULL
            END as avg_rating,
            COUNT(*) as total_count
           FROM ratings
           WHERE rating IS NOT NULL`
        );
        
        logger.debug('Résultat requête ratings:', {
          rows: ratingsResult.rows,
          rowCount: ratingsResult.rows.length,
          firstRow: ratingsResult.rows[0]
        });
        
        if (ratingsResult.rows[0]) {
          const avgRatingValue = ratingsResult.rows[0].avg_rating;
          totalRatings = parseInt(ratingsResult.rows[0].total_count || '0');
          
          logger.debug('Valeurs extraites:', {
            avgRatingValue,
            totalRatings,
            typeAvgRating: typeof avgRatingValue,
            avgRatingValueString: String(avgRatingValue)
          });
          
          // Ne définir averageRating que s'il y a des ratings
          if (totalRatings > 0) {
            // Convertir en nombre, gérer les cas où c'est une chaîne ou un Decimal
            const ratingNum = typeof avgRatingValue === 'string' 
              ? parseFloat(avgRatingValue) 
              : typeof avgRatingValue === 'number' 
                ? avgRatingValue 
                : avgRatingValue != null
                  ? parseFloat(String(avgRatingValue))
                  : 0;
            
            if (!isNaN(ratingNum) && ratingNum >= 0) {
              averageRating = ratingNum;
              logger.info(`Note moyenne calculée: ${averageRating} (${totalRatings} évaluations)`);
            } else {
              logger.warn(`Note moyenne invalide: ${avgRatingValue} (type: ${typeof avgRatingValue}), totalRatings: ${totalRatings}`);
            }
          } else {
            logger.debug(`Aucune évaluation trouvée (totalRatings: ${totalRatings})`);
          }
        }
        
        // Récupérer la distribution seulement s'il y a des ratings
        if (totalRatings > 0) {
          const distributionResult = await safeQuery(
            `SELECT 
              rating::text,
              COUNT(*) as count
             FROM ratings
             GROUP BY rating
             ORDER BY rating DESC`
          );
          
          distributionResult.rows.forEach((row: any) => {
            const ratingKey = String(row.rating);
            if (ratingKey in ratingDistribution) {
              ratingDistribution[ratingKey as keyof typeof ratingDistribution] = parseInt(row.count || '0');
            }
          });
        }
      } else {
        logger.debug('Table ratings n\'existe pas encore');
      }
    } catch (ratingError: any) {
      logger.warn('Erreur calcul statistiques ratings:', ratingError);
      // En cas d'erreur, on garde averageRating à null pour afficher N/A
    }

    const kpis = {
      activeOrders: parseInt(activeOrdersResult.rows[0]?.count || '0'),
      completedToday: parseInt(completedTodayResult.rows[0]?.count || '0'),
      revenueToday: parseFloat(completedTodayResult.rows[0]?.revenue || '0'),
      avgDeliveryTime: parseFloat(avgDeliveryTimeResult.rows[0]?.avg_minutes || '0'),
      acceptanceRate: acceptanceRateResult.rows[0]?.total > 0
        ? (parseInt(acceptanceRateResult.rows[0]?.accepted || '0') / parseInt(acceptanceRateResult.rows[0]?.total || '1')) * 100
        : 0,
      // Retourner null si pas de ratings, sinon le nombre
      averageRating: averageRating !== null ? averageRating : null,
      totalRatings,
      ratingDistribution,
      timestamp: new Date().toISOString(),
    };
    
    logger.info('KPIs calculés avec succès:', {
      activeOrders: kpis.activeOrders,
      completedToday: kpis.completedToday,
      averageRating: kpis.averageRating,
      totalRatings: kpis.totalRatings
    });
    
    logger.debug('KPIs calculés:', {
      averageRating: kpis.averageRating,
      totalRatings: kpis.totalRatings,
      hasRatingDistribution: !!kpis.ratingDistribution
    });

    res.json(kpis);
  } catch (error: any) {
    logger.error('Error getting KPIs:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
      name: error.name
    });
    res.status(500).json({ 
      error: 'Erreur serveur',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
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

    // Détecter la colonne de prix (price_cfa ou price)
    const priceColumnsInfo = await pool.query(
      `SELECT column_name FROM information_schema.columns 
       WHERE table_schema = 'public' AND table_name = 'orders' 
       AND column_name = ANY($1)`,
      [['price_cfa', 'price']]
    );
    const priceColumnSet = new Set(priceColumnsInfo.rows.map((row: any) => row.column_name));
    const priceColumn = priceColumnSet.has('price_cfa') ? 'price_cfa' : priceColumnSet.has('price') ? 'price' : null;
    
    if (!priceColumn) {
      logger.warn('Colonne de prix non trouvée dans orders, utilisation de 0 pour les revenus');
    }

    // Données par jour
    const dailyDataResult = await pool.query(
      `SELECT 
        DATE(created_at) as date,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled,
        COALESCE(SUM(${priceColumn || '0'}) FILTER (WHERE status = 'completed'), 0) as revenue
       FROM orders
       WHERE created_at >= $1
       GROUP BY DATE(created_at)
       ORDER BY date ASC`,
      [startDate]
    );

    // Détecter la colonne pickup (pickup_address ou pickup JSON)
    const pickupColumnsInfo = await pool.query(
      `SELECT column_name FROM information_schema.columns 
       WHERE table_schema = 'public' AND table_name = 'orders' 
       AND column_name = ANY($1)`,
      [['pickup_address', 'pickup']]
    );
    const pickupColumnSet = new Set(pickupColumnsInfo.rows.map((row: any) => row.column_name));
    const hasPickupAddress = pickupColumnSet.has('pickup_address');
    const hasPickupJson = pickupColumnSet.has('pickup');
    
    // Construire la condition de zone selon le type de colonne
    let zoneCondition = '';
    if (hasPickupAddress) {
      // Si pickup_address est une colonne texte
      zoneCondition = `
        CASE 
          WHEN pickup_address LIKE '%Cocody%' THEN 'Cocody'
          WHEN pickup_address LIKE '%Marcory%' THEN 'Marcory'
          WHEN pickup_address LIKE '%Yopougon%' THEN 'Yopougon'
          WHEN pickup_address LIKE '%Abobo%' THEN 'Abobo'
          WHEN pickup_address LIKE '%Plateau%' THEN 'Plateau'
          WHEN pickup_address LIKE '%Adjamé%' THEN 'Adjamé'
          ELSE 'Autre'
        END
      `;
    } else if (hasPickupJson) {
      // Si pickup est un JSON, extraire l'adresse
      zoneCondition = `
        CASE 
          WHEN pickup::text LIKE '%Cocody%' OR (pickup->>'address')::text LIKE '%Cocody%' OR (pickup->>'formatted_address')::text LIKE '%Cocody%' THEN 'Cocody'
          WHEN pickup::text LIKE '%Marcory%' OR (pickup->>'address')::text LIKE '%Marcory%' OR (pickup->>'formatted_address')::text LIKE '%Marcory%' THEN 'Marcory'
          WHEN pickup::text LIKE '%Yopougon%' OR (pickup->>'address')::text LIKE '%Yopougon%' OR (pickup->>'formatted_address')::text LIKE '%Yopougon%' THEN 'Yopougon'
          WHEN pickup::text LIKE '%Abobo%' OR (pickup->>'address')::text LIKE '%Abobo%' OR (pickup->>'formatted_address')::text LIKE '%Abobo%' THEN 'Abobo'
          WHEN pickup::text LIKE '%Plateau%' OR (pickup->>'address')::text LIKE '%Plateau%' OR (pickup->>'formatted_address')::text LIKE '%Plateau%' THEN 'Plateau'
          WHEN pickup::text LIKE '%Adjamé%' OR (pickup->>'address')::text LIKE '%Adjamé%' OR (pickup->>'formatted_address')::text LIKE '%Adjamé%' THEN 'Adjamé'
          ELSE 'Autre'
        END
      `;
    } else {
      // Fallback si aucune colonne n'est trouvée
      zoneCondition = `'Autre'`;
    }

    // Données par zone
    const zoneDataResult = await pool.query(
      `SELECT 
        ${zoneCondition} as zone,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COALESCE(SUM(${priceColumn || '0'}) FILTER (WHERE status = 'completed'), 0) as revenue
       FROM orders
       WHERE created_at >= $1
       GROUP BY zone
       ORDER BY completed DESC`,
      [startDate]
    );

    // Évolution des ratings dans le temps
    let ratingTrend: Array<{ date: string; average: number; count: number }> = [];
    try {
      const ratingsTableCheck = await pool.query(
        `SELECT EXISTS (
          SELECT 1 FROM information_schema.tables 
          WHERE table_schema = 'public' AND table_name = 'ratings'
        )`
      );
      
      if (ratingsTableCheck.rows[0]?.exists) {
        const ratingTrendResult = await pool.query(
          `SELECT 
            DATE(created_at) as date,
            COALESCE(AVG(rating::numeric), 0) as average,
            COUNT(*) as count
           FROM ratings
           WHERE created_at >= $1
           GROUP BY DATE(created_at)
           ORDER BY date ASC`,
          [startDate]
        );
        
        ratingTrend = ratingTrendResult.rows.map((row: any) => ({
          date: row.date,
          average: parseFloat(row.average || '0'),
          count: parseInt(row.count || '0'),
        }));
      }
    } catch (ratingError: any) {
      logger.warn('Erreur calcul évolution ratings:', ratingError);
    }

    res.json({
      daily: dailyDataResult.rows,
      byZone: zoneDataResult.rows,
      ratingTrend,
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

    // Détecter la colonne de prix (price_cfa ou price)
    const priceColumnsInfo = await pool.query(
      `SELECT column_name FROM information_schema.columns 
       WHERE table_schema = 'public' AND table_name = 'orders' 
       AND column_name = ANY($1)`,
      [['price_cfa', 'price']]
    );
    const priceColumnSet = new Set(priceColumnsInfo.rows.map((row: any) => row.column_name));
    const priceColumn = priceColumnSet.has('price_cfa') ? 'price_cfa' : priceColumnSet.has('price') ? 'price' : null;

    const result = await pool.query(
      `SELECT 
        o.id,
        o.order_number,
        o.status,
        ${priceColumn ? `o.${priceColumn}` : '0'} as price,
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

