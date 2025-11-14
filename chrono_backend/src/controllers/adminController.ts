import { Request, Response } from 'express';
import pool from '../config/db.js';
import logger from '../utils/logger.js';

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

    const now = new Date();
    
    // Commandes en cours (toutes les commandes actives)
    const activeOrdersResult = await (pool as any).query(
      `SELECT COUNT(*) as count FROM orders 
       WHERE status IN ('pending', 'accepted', 'enroute', 'picked_up')`
    );
    const onDelivery = parseInt(activeOrdersResult.rows[0]?.count || '0');

    // Calculer les dates pour cette semaine (7 derniers jours)
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - 7);
    startOfWeek.setHours(0, 0, 0, 0);

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
    const completedThisWeekResult = await (pool as any).query(
      `SELECT COUNT(*) as count, COALESCE(SUM(${priceColumn}), 0) as total_revenue
       FROM orders 
       WHERE status = 'completed' 
       AND completed_at >= $1 
       AND completed_at <= $2`,
      [startOfWeek.toISOString(), now.toISOString()]
    );
    const successDeliveries = parseInt(completedThisWeekResult.rows[0]?.count || '0');
    const revenue = parseFloat(completedThisWeekResult.rows[0]?.total_revenue || '0');

    // Calculer les dates pour la semaine dernière
    const startOfLastWeek = new Date(startOfWeek);
    startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);
    const endOfLastWeek = new Date(startOfWeek);

    // Livraisons complétées la semaine dernière
    const completedLastWeekResult = await (pool as any).query(
      `SELECT COUNT(*) as count, COALESCE(SUM(${priceColumn}), 0) as total_revenue
       FROM orders 
       WHERE status = 'completed' 
       AND completed_at >= $1 
       AND completed_at < $2`,
      [startOfLastWeek.toISOString(), endOfLastWeek.toISOString()]
    );
    const successDeliveriesLastWeek = parseInt(completedLastWeekResult.rows[0]?.count || '0');
    const revenueLastWeek = parseFloat(completedLastWeekResult.rows[0]?.total_revenue || '0');

    // Commandes en cours il y a 7 jours (pour comparer)
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);
    const eightDaysAgo = new Date(sevenDaysAgo);
    eightDaysAgo.setDate(eightDaysAgo.getDate() - 1);

    const activeOrdersLastWeekResult = await (pool as any).query(
      `SELECT COUNT(*) as count FROM orders 
       WHERE status IN ('pending', 'accepted', 'enroute', 'picked_up')
       AND created_at >= $1 
       AND created_at <= $2`,
      [eightDaysAgo.toISOString(), sevenDaysAgo.toISOString()]
    );
    const onDeliveryLastWeek = parseInt(activeOrdersLastWeekResult.rows[0]?.count || '0');

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

    res.json({
      success: true,
      data: {
        onDelivery,
        onDeliveryChange: Math.round(onDeliveryChange * 10) / 10,
        successDeliveries,
        successDeliveriesChange: Math.round(successDeliveriesChange * 10) / 10,
        revenue,
        revenueChange: Math.round(revenueChange * 10) / 10,
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

    // Récupérer les données des 4 derniers mois
    const fourMonthsAgo = new Date();
    fourMonthsAgo.setMonth(fourMonthsAgo.getMonth() - 4);
    fourMonthsAgo.setHours(0, 0, 0, 0);

    const result = await (pool as any).query(
      `SELECT 
        DATE_TRUNC('month', created_at) as month,
        COUNT(*) FILTER (WHERE status = 'completed') as delivered,
        COUNT(*) FILTER (WHERE status IN ('cancelled', 'declined')) as reported
       FROM orders 
       WHERE created_at >= $1
       GROUP BY DATE_TRUNC('month', created_at)
       ORDER BY month ASC`,
      [fourMonthsAgo.toISOString()]
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

    // Trier et garder les 4 derniers mois
    const sorted = monthlyData
      .sort((a, b) => a.sortDate.getTime() - b.sortDate.getTime())
      .slice(-4)
      .map(({ sortDate, ...rest }) => rest);

    res.json({
      success: true,
      data: sorted,
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
    const query = `SELECT * FROM orders ORDER BY created_at DESC LIMIT $1`;
    logger.info('📝 [getAdminRecentActivities] Requête SQL:', query);
    logger.info('📝 [getAdminRecentActivities] Paramètres:', [limit]);

    let result;
    try {
      result = await (pool as any).query(query, [limit]);
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

      // Générer un ID de livraison formaté
      const idParts = order.id.replace(/-/g, '').substring(0, 9);
      const deliveryId = `${idParts.substring(0, 2)}-${idParts.substring(2, 7)}-${idParts.substring(7, 9)}`.toUpperCase();

      return {
        id: order.id,
        deliveryId,
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

    // Rechercher dans les commandes
    const ordersQuery = `
      SELECT id, status, created_at, pickup_address, dropoff_address
      FROM orders
      WHERE 
        id::text ILIKE $1 OR
        status::text ILIKE $1 OR
        pickup_address::text ILIKE $1 OR
        dropoff_address::text ILIKE $1
      ORDER BY created_at DESC
      LIMIT 10
    `;

    // Rechercher dans les utilisateurs
    const usersQuery = `
      SELECT id, email, phone, role, created_at
      FROM users
      WHERE 
        email ILIKE $1 OR
        phone ILIKE $1 OR
        role ILIKE $1
      ORDER BY created_at DESC
      LIMIT 10
    `;

    let ordersResult, usersResult;
    try {
      ordersResult = await (pool as any).query(ordersQuery, [searchTerm]);
      usersResult = await (pool as any).query(usersQuery, [searchTerm]);
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
      const idParts = order.id.replace(/-/g, '').substring(0, 9);
      const deliveryId = `${idParts.substring(0, 2)}-${idParts.substring(2, 7)}-${idParts.substring(7, 9)}`.toUpperCase();

      return {
        id: order.id,
        deliveryId,
        status: order.status,
        pickup: pickup?.address || pickup?.formatted_address || pickup?.name || 'Adresse inconnue',
        dropoff: dropoff?.address || dropoff?.formatted_address || dropoff?.name || 'Adresse inconnue',
        createdAt: new Date(order.created_at).toLocaleDateString('fr-FR'),
      };
    });

    const formattedUsers = usersResult.rows.map((user: any) => ({
      id: user.id,
      email: user.email,
      phone: user.phone || 'N/A',
      role: user.role,
      createdAt: new Date(user.created_at).toLocaleDateString('fr-FR'),
    }));

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

    const formatted = result.rows.map((order: any) => {
      const pickup = parseJsonField(order.pickup_address || order.pickup);
      const dropoff = parseJsonField(order.dropoff_address || order.dropoff);

      // Générer un ID de shipment formaté (EV-2017002346)
      const idParts = order.id.replace(/-/g, '').substring(0, 10);
      const shipmentNumber = `EV-${idParts}`;

      // Extraire les coordonnées (peuvent être dans coordinates.latitude/longitude ou directement latitude/longitude)
      let pickupCoords = null;
      if (pickup?.coordinates) {
        if (pickup.coordinates.latitude && pickup.coordinates.longitude) {
          pickupCoords = { lat: pickup.coordinates.latitude, lng: pickup.coordinates.longitude };
        } else if (pickup.coordinates.lat && pickup.coordinates.lng) {
          pickupCoords = { lat: pickup.coordinates.lat, lng: pickup.coordinates.lng };
        }
      } else if (pickup?.latitude && pickup?.longitude) {
        pickupCoords = { lat: pickup.latitude, lng: pickup.longitude };
      }

      let dropoffCoords = null;
      if (dropoff?.coordinates) {
        if (dropoff.coordinates.latitude && dropoff.coordinates.longitude) {
          dropoffCoords = { lat: dropoff.coordinates.latitude, lng: dropoff.coordinates.longitude };
        } else if (dropoff.coordinates.lat && dropoff.coordinates.lng) {
          dropoffCoords = { lat: dropoff.coordinates.lat, lng: dropoff.coordinates.lng };
        }
      } else if (dropoff?.latitude && dropoff?.longitude) {
        dropoffCoords = { lat: dropoff.latitude, lng: dropoff.longitude };
      }

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
    const statusMap: Record<string, string[]> = {
      all: [],
      onProgress: ['pending', 'accepted', 'enroute', 'picked_up'],
      successful: ['completed'],
      onHold: ['declined'],
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

    const countsQuery = `
      SELECT 
        COUNT(*) FILTER (WHERE status IN ('pending', 'accepted', 'enroute', 'picked_up') AND created_at >= $1) as onProgress,
        COUNT(*) FILTER (WHERE status = 'completed' AND created_at >= $1) as successful,
        COUNT(*) FILTER (WHERE status = 'declined' AND created_at >= $1) as onHold,
        COUNT(*) FILTER (WHERE status = 'cancelled' AND created_at >= $1) as canceled,
        COUNT(*) FILTER (WHERE created_at >= $1) as all,
        COUNT(*) FILTER (WHERE status IN ('pending', 'accepted', 'enroute', 'picked_up') AND created_at >= $2 AND created_at < $3) as onProgressLastMonth,
        COUNT(*) FILTER (WHERE status = 'completed' AND created_at >= $2 AND created_at < $3) as successfulLastMonth,
        COUNT(*) FILTER (WHERE status = 'declined' AND created_at >= $2 AND created_at < $3) as onHoldLastMonth,
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

      // Générer un ID de livraison formaté
      const idParts = order.id.replace(/-/g, '').substring(0, 9);
      const deliveryId = `${idParts.substring(0, 2)}-${idParts.substring(2, 7)}-${idParts.substring(7, 9)}`.toUpperCase();

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
    const query = `SELECT id, email, phone, role, created_at FROM users ORDER BY created_at DESC`;

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
        role: user.role,
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

