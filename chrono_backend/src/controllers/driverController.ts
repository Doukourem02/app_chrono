import { Request, Response } from 'express';
import { supabase, supabaseAdmin } from '../config/supabase.js';
import pool from '../config/db.js';
import logger from '../utils/logger.js';
import { maskUserId, maskAmount, maskOrderId, maskFinancialStats } from '../utils/maskSensitiveData.js';
import { calculateDriverRating } from '../utils/calculateDriverRating.js';

interface DriverStatus {
  user_id: string;
  is_online?: boolean;
  is_available?: boolean;
  current_latitude?: number;
  current_longitude?: number;
  updated_at?: string;
  [key: string]: any;
}

interface RequestWithUser extends Request {
  user?: {
    id: string;
  };
}

export const realDriverStatuses = new Map<string, DriverStatus>();

const mockDrivers: any[] = [];

export const updateDriverStatus = async (req: RequestWithUser, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    
    if (req.user && req.user.id !== userId) {
      res.status(403).json({
        success: false,
        message: 'Vous ne pouvez modifier que votre propre statut'
      });
      return;
    }

    const { 
      is_online, 
      is_available, 
      current_latitude, 
      current_longitude 
    } = req.body;

    logger.info(`Mise à jour statut chauffeur ${maskUserId(userId)}:`, {
      is_online,
      is_available,
      position: current_latitude && current_longitude ? `${current_latitude}, ${current_longitude}` : 'Non fournie'
    });

    const existingDriver = realDriverStatuses.get(userId) || {} as DriverStatus;
    const wasOffline = existingDriver.is_online === false || !existingDriver.is_online;
    const updatedDriver: DriverStatus = {
      ...existingDriver,
      user_id: userId,
      updated_at: new Date().toISOString()
    };

    if (typeof is_online === 'boolean') {
      updatedDriver.is_online = is_online;
      
      if (!is_online) {
        updatedDriver.is_available = false;
        logger.info(`Chauffeur ${maskUserId(userId)} passé offline - sera retiré de la liste`);
        
        setTimeout(() => {
          const driver = realDriverStatuses.get(userId);
          if (driver && driver.is_online === false) {
            realDriverStatuses.delete(userId);
            logger.info(`Chauffeur ${maskUserId(userId)} retiré de la Map (offline)`);
          }
        }, 5000);
      } else {
        // Driver repasse en ligne
        if (typeof is_available !== 'boolean') {
          updatedDriver.is_available = true;
        } else {
          updatedDriver.is_available = is_available;
        }
      }
    } else if (typeof is_available === 'boolean' && updatedDriver.is_online !== false) {
      updatedDriver.is_available = is_available;
    }

    if (current_latitude && current_longitude) {
      updatedDriver.current_latitude = parseFloat(current_latitude);
      updatedDriver.current_longitude = parseFloat(current_longitude);
    }

    realDriverStatuses.set(userId, updatedDriver);

    // Émettre immédiatement l'événement si le driver repasse en ligne
    if (typeof is_online === 'boolean' && is_online === true && wasOffline) {
      // Récupérer l'instance io depuis app
      const app = req.app;
      const io = app.get('io');
      if (io) {
        // Importer dynamiquement pour éviter les dépendances circulaires
        import('../sockets/adminSocket.js').then((module) => {
          if (module.broadcastDriverStatusToAdmins) {
            module.broadcastDriverStatusToAdmins(io, 'driver:online', {
              userId,
              is_online: true,
              is_available: updatedDriver.is_available,
              current_latitude: updatedDriver.current_latitude,
              current_longitude: updatedDriver.current_longitude,
              updated_at: updatedDriver.updated_at,
            });
            if (process.env.DEBUG_SOCKETS === 'true') {
              logger.info(`[updateDriverStatus] Événement driver:online émis immédiatement pour ${maskUserId(userId)}`);
            }
          }
        }).catch((err) => {
          // Si l'import échoue, l'intervalle le détectera dans 2 secondes
          logger.debug('Impossible d\'émettre immédiatement driver:online, l\'intervalle le détectera:', err);
        });
      }
    }
    
    try {
      await pool.query(
        `UPDATE driver_profiles 
         SET is_online = $1, is_available = $2, 
           current_latitude = $3, current_longitude = $4,
           updated_at = NOW()
         WHERE user_id = $5`,
        [is_online, is_available, current_latitude, current_longitude, userId]
      );
    } catch (dbError: any) {
      logger.warn(`Échec mise à jour DB pour chauffeur ${maskUserId(userId)}:`, dbError.message);
    }

    if (updatedDriver.is_online) {
      logger.info(`Chauffeur connecté`);
    } else {
      logger.info(`Chauffeur déconnecté`);
    }

    res.json({
      success: true,
      message: 'Statut mis à jour avec succès',
      data: updatedDriver
    });
  } catch (error: any) {
    logger.error('Erreur updateDriverStatus:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la mise à jour du statut',
      error: error.message
    });
  }
};

export const getDriverRevenues = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const period = (req.query.period as string) || 'today';
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;

    logger.debug('DÉBUT getDriverRevenues pour userId:', maskUserId(userId), 'period:', period);

    if (!userId) {
      res.status(400).json({
        success: false,
        message: 'userId est requis'
      });
      return;
    }

    if (!process.env.DATABASE_URL) {
      logger.warn('DATABASE_URL non configuré pour getDriverRevenues');
      res.json({
        success: true,
        data: {
          period,
          totalEarnings: 0,
          totalDeliveries: 0,
          totalDistance: 0,
          averageEarningPerDelivery: 0,
          averageDistance: 0,
          earningsByMethod: { moto: 0, vehicule: 0, cargo: 0 },
          deliveriesByMethod: { moto: 0, vehicule: 0, cargo: 0 },
          earningsByDay: {},
          orders: []
        }
      });
      return;
    }
    
    const allCompletedQuery = await (pool as any).query(
      `SELECT COUNT(*) as count FROM orders WHERE status = 'completed'`
    );
    const allCompletedCount = parseInt(allCompletedQuery.rows[0]?.count || 0);
    logger.debug('Total commandes completed (sans filtre):', allCompletedCount);

    let queryDate = '';
    let dateParams: any[] = [];
    logger.debug('Calcul des dates - period:', period, 'startDate:', startDate, 'endDate:', endDate);

    if (startDate && endDate) {
      queryDate = 'AND completed_at >= $2 AND completed_at <= $3';
      dateParams = [userId, startDate, endDate];
      logger.debug('Utilisation dates personnalisées:', startDate, 'à', endDate);
    } else {
      const now = new Date();
      let start = new Date();
      
      switch (period) {
        case 'today':
          start.setHours(0, 0, 0, 0);
          break;
        case 'week':
          start.setDate(now.getDate() - 7);
          break;
        case 'month':
          start.setMonth(now.getMonth() - 1);
          break;
        case 'all':
        default:
          queryDate = 'AND completed_at IS NOT NULL';
          dateParams = [userId];
          logger.debug('Période: all - pas de filtre de date');
          break;
      }

      if (period !== 'all') {
        queryDate = 'AND completed_at >= $2 AND completed_at <= $3';
        dateParams = [userId, start.toISOString(), now.toISOString()];
        logger.debug('Filtre date:', start.toISOString(), 'à', now.toISOString());
      }
    }

    logger.debug('queryDate:', queryDate);

    const allColumnsResult = await (pool as any).query(
      `SELECT column_name FROM information_schema.columns 
       WHERE table_schema = 'public' AND table_name = 'orders' 
       ORDER BY ordinal_position`
    );
    const allColumns = allColumnsResult.rows.map(row => row.column_name);
    logger.debug('Colonnes disponibles dans orders:', allColumns.join(', '));

    const columnsInfo = await (pool as any).query(
      `SELECT column_name FROM information_schema.columns 
       WHERE table_schema = 'public' AND table_name = 'orders' 
       AND column_name = ANY($1)`,
      [['price', 'price_cfa', 'distance', 'distance_km', 'driver_id', 'driver_uuid']]
    );
    const columnSet = new Set(columnsInfo.rows.map((row) => row.column_name));
    const priceColumn = columnSet.has('price_cfa') ? 'price_cfa' : columnSet.has('price') ? 'price' : null;
    logger.debug('Colonne de prix trouvée:', priceColumn);

    if (!priceColumn) {
      throw new Error("La colonne 'price' (ou 'price_cfa') est absente de la table orders. Exécutez les migrations.");
    }

    const distanceColumn = columnSet.has('distance_km') ? 'distance_km' : columnSet.has('distance') ? 'distance' : null;
    const distanceSelect = distanceColumn ? distanceColumn : 'NULL::numeric';
    logger.debug('Colonne de distance trouvée:', distanceColumn);

    const driverColumn = columnSet.has('driver_id') ? 'driver_id' : columnSet.has('driver_uuid') ? 'driver_uuid' : null;
    logger.debug('Colonne driver trouvée:', driverColumn);

    let hasOrderAssignments = false;
    if (!driverColumn) {
      try {
        const tableCheck = await (pool as any).query(
          `SELECT EXISTS (
             SELECT FROM information_schema.tables 
             WHERE table_schema = 'public' AND table_name = 'order_assignments'
           )`
        );
        hasOrderAssignments = tableCheck.rows[0]?.exists === true;
        logger.debug('Table order_assignments existe:', hasOrderAssignments);
      } catch (err: any) {
        logger.warn('Erreur vérification order_assignments:', err.message);
      }
    }

    let query, result;
    try {
      if (driverColumn) {
        logger.debug(`Requête avec ${driverColumn} pour userId:`, maskUserId(userId));

        const withDriverQuery = await (pool as any).query(
          `SELECT COUNT(*) as count FROM orders 
           WHERE ${driverColumn} IS NOT NULL AND status = 'completed'`
        );
        const withDriverCount = parseInt(withDriverQuery.rows[0]?.count || 0);
        logger.debug(`Commandes completed avec ${driverColumn} défini:`, withDriverCount);

        const forThisDriverQuery = await (pool as any).query(
          `SELECT COUNT(*) as count FROM orders 
           WHERE ${driverColumn} = $1 AND status = 'completed'`,
          [userId]
        );
        const forThisDriverCount = parseInt(forThisDriverQuery.rows[0]?.count || 0);
        logger.debug(`Commandes completed pour ce livreur (${maskUserId(userId)}):`, forThisDriverCount);

        let unionQuery = '';
        let unionParams: any[] = [];

        unionQuery = `
          SELECT DISTINCT o.id, o.${priceColumn} AS price,
            ${distanceSelect.includes('o.') ? distanceSelect : `o.${distanceSelect}`} AS distance,
            o.delivery_method, o.completed_at, o.created_at
          FROM orders o
          WHERE o.${driverColumn} = $1 AND o.status = 'completed' ${queryDate}
        `;
        unionParams = [...dateParams];

        if (hasOrderAssignments) {
          let paramOffset = dateParams.length;
          let queryDate2 = queryDate;
          
          if (queryDate.includes('$2') && queryDate.includes('$3')) {
            queryDate2 = queryDate.replace('$2', `$${paramOffset + 2}`).replace('$3', `$${paramOffset + 3}`);
            unionParams = [...unionParams, userId, ...dateParams.slice(1)];
          } else {
            unionParams = [...unionParams, userId];
          }

          unionQuery += `
            UNION
            SELECT DISTINCT o.id,
              o.${priceColumn} AS price,
              ${distanceSelect.includes('o.') ? distanceSelect : `COALESCE(o.${distanceSelect}, 0)`} AS distance,
              o.delivery_method, o.completed_at, o.created_at
            FROM orders o
            INNER JOIN order_assignments oa ON oa.order_id = o.id
            WHERE oa.driver_id = $${paramOffset + 1}
              AND o.status = 'completed'
              AND oa.accepted_at IS NOT NULL
              AND (o.${driverColumn} IS NULL OR o.${driverColumn} != $${paramOffset + 1})
              ${queryDate2}
          `;
        }
        
        unionQuery += ` ORDER BY completed_at DESC`;
        result = await (pool as any).query(unionQuery, unionParams);
        logger.debug('Résultat requête avec driverColumn (et order_assignments si disponible):', result.rows.length, 'lignes');
      } else if (hasOrderAssignments) {
        logger.debug('Requête via order_assignments pour userId:', maskUserId(userId));

        const viaAssignmentsQuery = await (pool as any).query(
          `SELECT COUNT(DISTINCT o.id) as count 
           FROM orders o
           INNER JOIN order_assignments oa ON oa.order_id = o.id
           WHERE oa.driver_id = $1 AND o.status = 'completed'`,
          [userId]
        );
        const viaAssignmentsCount = parseInt(viaAssignmentsQuery.rows[0]?.count || 0);
        logger.debug('Commandes completed via order_assignments:', viaAssignmentsCount);

        query = `
          SELECT o.id, o.${priceColumn} AS price,
            ${distanceSelect} AS distance,
            o.delivery_method,
            o.completed_at,
            o.created_at
          FROM orders o
          INNER JOIN order_assignments oa ON oa.order_id = o.id
          WHERE oa.driver_id = $1
            AND o.status = 'completed' ${queryDate}
          ORDER BY o.completed_at DESC
        `;
        result = await (pool as any).query(query, dateParams);
        logger.info('Résultat requête via order_assignments:', result.rows.length, 'lignes');
      } else {
        logger.info('Impossible de calculer les revenus: ni driver_id, ni order_assignments');
        logger.warn(`Impossible de calculer les revenus: ni colonne driver dans orders, ni table order_assignments pour userId ${maskUserId(userId)}`);
        result = { rows: [] };
      }
    } catch (queryError) {
      logger.error('Erreur requête getDriverRevenues:', queryError);
      result = { rows: [] };
    }

    const totalEarnings = result.rows.reduce((sum, order) => sum + (Number(order.price) || 0), 0);
    const totalDeliveries = result.rows.length;
    const totalDistance = result.rows.reduce((sum, order) => sum + (Number(order.distance) || 0), 0);
    
    logger.debug('Résultats finaux getDriverRevenues:');
    logger.debug(' - Total livraisons:', totalDeliveries);
    logger.debug(' - Total gains:', maskAmount(totalEarnings));
    logger.debug(' - Total distance:', totalDistance, 'km');
    logger.debug(' - Période:', period);

    if (result.rows.length > 0) {
      logger.info('Nombre de commandes récupérées:', result.rows.length);
    }

    const earningsByMethod = {
      moto: 0,
      vehicule: 0,
      cargo: 0,
    };
    const deliveriesByMethod = {
      moto: 0,
      vehicule: 0,
      cargo: 0,
    };
    
    result.rows.forEach(order => {
      const method = order.delivery_method || 'moto';
      const price = Number(order.price) || 0;
      earningsByMethod[method] = (earningsByMethod[method] || 0) + price;
      deliveriesByMethod[method] = (deliveriesByMethod[method] || 0) + 1;
    });

    const earningsByDay: Record<string, number> = {};
    result.rows.forEach(order => {
      if (order.completed_at) {
        const date = new Date(order.completed_at);
        const dayKey = date.toISOString().split('T')[0];
        earningsByDay[dayKey] = (earningsByDay[dayKey] || 0) + (Number(order.price) || 0);
      }
    });

    const averageEarningPerDelivery = totalDeliveries > 0 ? totalEarnings / totalDeliveries : 0;
    const averageDistance = totalDeliveries > 0 ? totalDistance / totalDeliveries : 0;

    res.json({
      success: true,
      data: {
        period,
        totalEarnings,
        totalDeliveries,
        totalDistance: parseFloat(totalDistance.toFixed(2)),
        averageEarningPerDelivery: parseFloat(averageEarningPerDelivery.toFixed(2)),
        averageDistance: parseFloat(averageDistance.toFixed(2)),
        earningsByMethod,
        deliveriesByMethod,
        earningsByDay,
        orders: result.rows.map(order => ({
          id: order.id,
          price: Number(order.price) || 0,
          distance: Number(order.distance) || 0,
          delivery_method: order.delivery_method,
          completed_at: order.completed_at,
          created_at: order.created_at,
        }))
      }
    });
  } catch (error: any) {
    logger.error('Erreur getDriverRevenues:', error);
    
    if (error.message && (error.message.includes('SASL') || error.message.includes('password'))) {
      logger.warn('Erreur de connexion DB (peut-être non configurée), retour de données vides');
      res.json({
        success: true,
        data: {
          period: req.query.period || 'today',
          totalEarnings: 0,
          totalDeliveries: 0,
          totalDistance: 0,
          averageEarningPerDelivery: 0,
          averageDistance: 0,
          earningsByMethod: { moto: 0, vehicule: 0, cargo: 0 },
          deliveriesByMethod: { moto: 0, vehicule: 0, cargo: 0 },
          earningsByDay: {},
          orders: []
        }
      });
      return;
    }
    
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la récupération des revenus',
      error: error.message
    });
  }
};

export const getOnlineDrivers = async (req: Request, res: Response): Promise<void> => {
  try {
    const latitude = req.query.latitude as string | undefined;
    const longitude = req.query.longitude as string | undefined;
    const radius = parseInt(req.query.radius as string) || 10;

    logger.debug('Récupération chauffeurs online:', {
      userPosition: latitude && longitude ? `${latitude}, ${longitude}` : 'Non fournie',
      radius: `${radius}km`
    });

    logger.debug(`État mémoire actuelle: ${realDriverStatuses.size} chauffeurs stockés`);

    if (realDriverStatuses.size > 0) {
      const maskedDrivers = Array.from(realDriverStatuses.entries()).map(([id, data]) => ({
        id: maskUserId(id),
        online: data.is_online,
        position: data.current_latitude ? 'Oui' : 'Non'
      }));
      logger.debug(`Chauffeurs en mémoire:`, maskedDrivers);
    }

    const allDrivers: Array<{
      user_id: string;
      first_name: string;
      last_name: string;
      vehicle_type: string;
      current_latitude: number;
      current_longitude: number;
      is_online: boolean;
      is_available: boolean;
      rating: number;
      total_deliveries: number;
    }> = [];

    const offlineDrivers: string[] = [];
    for (const [userId, driverData] of realDriverStatuses.entries()) {
      if (driverData.is_online === false) {
        offlineDrivers.push(userId);
        logger.debug(`Suppression immédiate chauffeur offline : ${maskUserId(userId)}`);
      }
    }

    offlineDrivers.forEach(userId => {
      realDriverStatuses.delete(userId);
    });

    // Nettoyer les drivers inactifs (pas de mise à jour dans les 5 dernières minutes)
    const now = new Date();
    const inactiveDrivers: string[] = [];
    for (const [userId, driverData] of realDriverStatuses.entries()) {
      if (driverData.updated_at) {
        const updatedAt = new Date(driverData.updated_at);
        const diffInMinutes = (now.getTime() - updatedAt.getTime()) / (1000 * 60);
        if (diffInMinutes > 5) {
          inactiveDrivers.push(userId);
          logger.debug(`Chauffeur inactif détecté (>5 min) : ${maskUserId(userId)} (dernière mise à jour: ${diffInMinutes.toFixed(1)} min)`);
        }
      } else if (driverData.is_online === true) {
        // Si pas de updated_at mais marqué comme online, considérer comme inactif
        inactiveDrivers.push(userId);
        logger.debug(`Chauffeur sans updated_at mais marqué online : ${maskUserId(userId)} - considéré comme inactif`);
      }
    }
    
    // Retirer les drivers inactifs
    inactiveDrivers.forEach(userId => {
      realDriverStatuses.delete(userId);
      logger.info(`Chauffeur inactif retiré de la Map : ${maskUserId(userId)}`);
    });

    for (const [userId, driverData] of realDriverStatuses.entries()) {
      logger.debug(`Vérification chauffeur ${maskUserId(userId)}`);

      if (driverData.is_online === true) {
        // Vérifier que le driver est vraiment actif (mis à jour dans les 5 dernières minutes)
        let isActive = true;
        if (driverData.updated_at) {
          const updatedAt = new Date(driverData.updated_at);
          const diffInMinutes = (now.getTime() - updatedAt.getTime()) / (1000 * 60);
          isActive = diffInMinutes <= 5;
        } else {
          // Si pas de updated_at, considérer comme inactif
          isActive = false;
        }

        if (isActive) {
          logger.debug(`Livreur online et actif détecté : ${maskUserId(userId)}`);

          const rating = await calculateDriverRating(userId);
          const emailName = userId.substring(0, 8);
          const driverProfile = {
            user_id: userId,
            first_name: 'Livreur',
            last_name: emailName,
            vehicle_type: 'moto',
            current_latitude: driverData.current_latitude || 5.3453,
            current_longitude: driverData.current_longitude || -4.0244,
            is_online: true,
            is_available: driverData.is_available || false,
            rating,
            total_deliveries: 0,
            updated_at: driverData.updated_at || new Date().toISOString()
          };
          
          allDrivers.push(driverProfile);
          logger.info(`Livreur ajouté:`, driverProfile.first_name, driverProfile.last_name);
        } else {
          logger.info(`Chauffeur online mais inactif ignoré : ${maskUserId(userId)} (pas de mise à jour récente)`);
          // Retirer de la Map car inactif
          realDriverStatuses.delete(userId);
        }
      } else {
        if (driverData.is_online === false || driverData.is_online === undefined || driverData.is_online === null) {
          logger.info(`Chauffeur offline/undefined ignoré et retiré : ${maskUserId(userId)} (is_online: ${driverData.is_online})`);
          realDriverStatuses.delete(userId);
        }
      }
    }

    const onlineDrivers = allDrivers.filter((driver: any) => {
      const isOnline = driver.is_online === true;
      if (!isOnline) {
        logger.info(`Chauffeur filtré côté backend (pas strictement online): ${driver.user_id} (is_online: ${driver.is_online})`);
      }
      return isOnline;
    });

    logger.info(`${onlineDrivers.length} chauffeurs online trouvés (${onlineDrivers.length} réels uniquement)`);

    res.json({
      success: true,
      message: `${onlineDrivers.length} chauffeurs online trouvés`,
      data: onlineDrivers,
      _debug: {
        mockDrivers: 0,
        realDriversTotal: realDriverStatuses.size,
        onlineReal: Array.from(realDriverStatuses.values()).filter(d => d.is_online).length
      }
    });

  } catch (error: any) {
    logger.error('Erreur getOnlineDrivers:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la récupération des chauffeurs',
      error: error.message
    });
  }
};

export const getDriverDetails = async (req: Request, res: Response): Promise<void> => {
  try {
    const { driverId } = req.params;

    // Utiliser PostgreSQL (pool) - driver_profiles est dans la DB principale (comme getAdminDriverDetails)
    let driver: any = null;
    try {
      const profileResult = await (pool as any).query(
        `SELECT * FROM driver_profiles WHERE user_id = $1`,
        [driverId]
      );
      if (profileResult.rows.length > 0) {
        driver = profileResult.rows[0];
      }
    } catch (dbError) {
      logger.warn('Table driver_profiles non disponible, essai Supabase:', dbError);
      // Fallback Supabase si driver_profiles n'existe pas en PostgreSQL
      const { data: supabaseDriver, error } = await supabase
        .from('driver_profiles')
        .select(`id, user_id, email, phone, first_name, last_name, vehicle_type, vehicle_plate,
                 vehicle_model, vehicle_brand, vehicle_color, license_number, driver_type,
                 current_latitude, current_longitude, is_online, is_available, total_deliveries,
                 completed_deliveries, profile_image_url, created_at, updated_at`)
        .eq('user_id', driverId)
        .single();
      if (!error && supabaseDriver) driver = supabaseDriver;
    }

    if (!driver) {
      res.status(404).json({
        success: false,
        message: 'Chauffeur non trouvé'
      });
      return;
    }

    const rating = await calculateDriverRating(driverId);

    // Calculer les revenus totaux depuis les commandes complétées
    let totalEarnings = 0;
    try {
      const earningsResult = await (pool as any).query(
        `SELECT COALESCE(SUM(price_cfa), 0) as total
         FROM orders
         WHERE driver_id = $1 AND status = 'completed'`,
        [driverId]
      );
      totalEarnings = parseFloat(earningsResult.rows[0]?.total || '0');
    } catch (earningsError) {
      logger.warn('Erreur calcul revenus:', earningsError);
    }

    res.json({
      success: true,
      message: 'Détails chauffeur récupérés',
      data: {
        ...driver,
        rating,
        total_earnings: totalEarnings,
        completed_deliveries: driver.completed_deliveries || 0,
      }
    });

  } catch (error: any) {
    logger.error('Erreur getDriverDetails:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur',
      error: error.message
    });
  }
};

export const getDriverWorkTime = async (req: RequestWithUser, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;

    if (req.user && req.user.id !== userId) {
      res.status(403).json({
        success: false,
        message: 'Vous ne pouvez consulter que votre propre temps de travail'
      });
      return;
    }

    const result = await (pool as any).query(
      `SELECT 
        daily_work_hours,
        max_daily_hours,
        work_start_time,
        last_work_reset_date,
        total_km_today,
        total_km_lifetime
      FROM driver_profiles
      WHERE user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({
        success: false,
        message: 'Profil chauffeur non trouvé'
      });
      return;
    }

    const profile = result.rows[0];
    
    const today = new Date().toISOString().split('T')[0];
    const lastResetDate = profile.last_work_reset_date ? new Date(profile.last_work_reset_date).toISOString().split('T')[0] : null;

    if (lastResetDate !== today) {
      await (pool as any).query(
        `UPDATE driver_profiles
         SET 
           daily_work_hours = 0,
           total_km_today = 0,
           work_start_time = NULL,
           last_work_reset_date = CURRENT_DATE
         WHERE user_id = $1`,
        [userId]
      );
      profile.daily_work_hours = 0;
      profile.total_km_today = 0;
      profile.work_start_time = null;
    }

    const currentHours = parseFloat(profile.daily_work_hours || 0);
    const maxHours = parseFloat(profile.max_daily_hours || 10);
    const remainingHours = Math.max(0, maxHours - currentHours);
    const remainingMinutes = Math.round(remainingHours * 60);

    let workDurationHours = 0;
    if (profile.work_start_time) {
      const startTime = new Date(profile.work_start_time);
      const now = new Date();
      const diffMs = now.getTime() - startTime.getTime();
      workDurationHours = diffMs / (1000 * 60 * 60);
    }

    logger.info(`Temps de travail consulté pour chauffeur ${maskUserId(userId)}`, {
      currentHours: currentHours.toFixed(2),
      maxHours,
      remainingHours: remainingHours.toFixed(2),
    });

    res.json({
      success: true,
      data: {
        dailyWorkHours: currentHours,
        maxDailyHours: maxHours,
        remainingHours: parseFloat(remainingHours.toFixed(2)),
        remainingMinutes,
        workStartTime: profile.work_start_time,
        workDurationHours: parseFloat(workDurationHours.toFixed(2)),
        totalKmToday: parseFloat(profile.total_km_today || 0),
        totalKmLifetime: parseFloat(profile.total_km_lifetime || 0),
        canWork: remainingHours > 0,
      },
    });
  } catch (error: any) {
    logger.error('Erreur récupération temps de travail:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
};

export const updateDriverWorkTime = async (req: RequestWithUser, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    
    if (req.user && req.user.id !== userId) {
      res.status(403).json({
        success: false,
        message: 'Vous ne pouvez modifier que votre propre temps de travail'
      });
      return;
    }

    const { hours, kilometers, startWork } = req.body;

    const profileResult = await (pool as any).query(
      'SELECT * FROM driver_profiles WHERE user_id = $1',
      [userId]
    );

    if (profileResult.rows.length === 0) {
      res.status(404).json({
        success: false,
        message: 'Profil chauffeur non trouvé'
      });
      return;
    }

    const profile = profileResult.rows[0];
    const today = new Date().toISOString().split('T')[0];
    const lastResetDate = profile.last_work_reset_date ? new Date(profile.last_work_reset_date).toISOString().split('T')[0] : null;

    if (lastResetDate !== today) {
      await (pool as any).query(
        `UPDATE driver_profiles
         SET 
           daily_work_hours = 0,
           total_km_today = 0,
           work_start_time = NULL,
           last_work_reset_date = CURRENT_DATE
         WHERE user_id = $1`,
        [userId]
      );
    }

    let updateQuery = 'UPDATE driver_profiles SET ';
    const updateParams: any[] = [];
    let paramIndex = 1;

    if (hours !== undefined) {
      const newHours = parseFloat(profile.daily_work_hours || 0) + parseFloat(hours);
      const maxHours = parseFloat(profile.max_daily_hours || 10);
      
      if (newHours > maxHours) {
        res.status(400).json({
          success: false,
          message: `Temps de travail maximum atteint (${maxHours}h/jour)`
        });
        return;
      }

      updateQuery += `daily_work_hours = $${paramIndex}, `;
      updateParams.push(newHours);
      paramIndex++;
    }

    if (kilometers !== undefined) {
      const newKmToday = parseFloat(profile.total_km_today || 0) + parseFloat(kilometers);
      const newKmLifetime = parseFloat(profile.total_km_lifetime || 0) + parseFloat(kilometers);
      
      updateQuery += `total_km_today = $${paramIndex}, total_km_lifetime = $${paramIndex + 1}, `;
      updateParams.push(newKmToday, newKmLifetime);
      paramIndex += 2;
    }

    if (startWork === true) {
      updateQuery += `work_start_time = NOW(), `;
    } else if (startWork === false) {
      updateQuery += `work_start_time = NULL, `;
    }

    updateQuery = updateQuery.slice(0, -2);
    updateQuery += ` WHERE user_id = $${paramIndex}`;
    updateParams.push(userId);

    await (pool as any).query(updateQuery, updateParams);

    logger.info(`Temps de travail mis à jour pour chauffeur ${maskUserId(userId)}`, {
      hours: hours !== undefined ? hours : 'non modifié',
      kilometers: kilometers !== undefined ? kilometers : 'non modifié',
      startWork,
    });

    res.json({
      success: true,
      message: 'Temps de travail mis à jour',
    });
  } catch (error: any) {
    logger.error('Erreur mise à jour temps de travail:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur'
    });
  }
};

export const getDriverStatistics = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;

    if (!userId) {
      res.status(400).json({
        success: false,
        message: 'userId est requis'
      });
      return;
    }

    if (!process.env.DATABASE_URL) {
      logger.warn('DATABASE_URL non configuré pour getDriverStatistics');
      res.json({
        success: true,
        data: {
          completedDeliveries: 0,
          averageRating: 5.0,
          totalEarnings: 0
        }
      });
      return;
    }

    try {
      logger.debug('DÉBUT getDriverStatistics pour userId:', maskUserId(userId));

      const allColumnsResult = await (pool as any).query(
        `SELECT column_name FROM information_schema.columns 
         WHERE table_schema = 'public' AND table_name = 'orders' 
         ORDER BY ordinal_position`
      );
      const allColumns = allColumnsResult.rows.map(row => row.column_name);
      logger.debug('Colonnes disponibles dans orders:', allColumns.join(', '));

      const allCompletedQuery = await (pool as any).query(
        `SELECT COUNT(*) as count FROM orders WHERE status = 'completed'`
      );
      const allCompletedCount = parseInt(allCompletedQuery.rows[0]?.count || 0);
      logger.debug('Total commandes completed (sans filtre):', allCompletedCount);

      const columnsInfo = await (pool as any).query(
        `SELECT column_name FROM information_schema.columns 
         WHERE table_schema = 'public' AND table_name = 'orders' 
         AND column_name = ANY($1)`,
        [['driver_id', 'driver_uuid']]
      );
      const columnSet = new Set(columnsInfo.rows.map((row) => row.column_name));
      const driverColumn = columnSet.has('driver_id') ? 'driver_id' : columnSet.has('driver_uuid') ? 'driver_uuid' : null;
      logger.debug('Colonne driver trouvée:', driverColumn);

      let hasOrderAssignments = false;
      try {
        const tableCheck = await (pool as any).query(
          `SELECT EXISTS (
             SELECT FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'order_assignments'
           )`
        );
        hasOrderAssignments = tableCheck.rows[0]?.exists === true;
        logger.debug('Table order_assignments existe:', hasOrderAssignments);
      } catch (err: any) {
        logger.warn('Erreur vérification order_assignments:', err.message);
      }

      let completedDeliveries = 0;

      const checkCompletedQuery = await (pool as any).query(
        `SELECT id, status, ${driverColumn || 'NULL as driver_id'}, price_cfa 
         FROM orders WHERE status = 'completed' LIMIT 10`
      );

      if (!driverColumn) {
        logger.info('Colonne driver_id/driver_uuid non trouvée dans orders');
        logger.warn(`Colonne driver_id/driver_uuid non trouvée dans orders. Essai avec order_assignments...`);

        const tableCheck = await (pool as any).query(
          `SELECT EXISTS (
             SELECT FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'order_assignments'
           )`
        );
        const hasOrderAssignments = tableCheck.rows[0]?.exists === true;
        logger.debug('Table order_assignments existe:', hasOrderAssignments);

        if (hasOrderAssignments) {
          const deliveriesResult = await (pool as any).query(
            `SELECT COUNT(DISTINCT o.id) as count
             FROM orders o
             INNER JOIN order_assignments oa ON oa.order_id = o.id
             WHERE oa.driver_id = $1 AND o.status = 'completed'`,
            [userId]
          );
          completedDeliveries = parseInt(deliveriesResult.rows[0]?.count || 0);
          logger.debug('Commandes completed via order_assignments:', completedDeliveries);
          logger.debug(`Commandes completed via order_assignments pour ${maskUserId(userId)}: ${completedDeliveries}`);
        } else {
          logger.info('Table order_assignments n\'existe pas');
          logger.warn(`Table order_assignments n'existe pas non plus. Impossible de compter les livraisons.`);
        }
      } else {
        const withDriverResult = await (pool as any).query(
          `SELECT COUNT(*) as count FROM orders 
           WHERE ${driverColumn} IS NOT NULL AND status = 'completed'`
        );
        const withDriver = parseInt(withDriverResult.rows[0]?.count || 0);
        logger.debug(`Commandes completed avec ${driverColumn} défini:`, withDriver);

        let countQuery = '';
        let countParams: any[] = [];

        countQuery = `
          SELECT COUNT(DISTINCT o.id) as count
          FROM orders o
          WHERE o.${driverColumn} = $1 AND o.status = 'completed'
        `;
        countParams = [userId];

        if (hasOrderAssignments) {
          countQuery += `
            UNION ALL
            SELECT COUNT(DISTINCT o.id) as count
            FROM orders o
            INNER JOIN order_assignments oa ON oa.order_id = o.id
            WHERE oa.driver_id = $2
              AND o.status = 'completed'
              AND oa.accepted_at IS NOT NULL
              AND (o.${driverColumn} IS NULL OR o.${driverColumn} != $2)
          `;
          countParams.push(userId);
        }

        const deliveriesResult = await (pool as any).query(
          `SELECT SUM(count) as total FROM (${countQuery}) as counts`,
          countParams
        );
        completedDeliveries = parseInt(deliveriesResult.rows[0]?.total || 0);
        logger.debug(`Commandes completed pour ce livreur (${maskUserId(userId)}):`, completedDeliveries);
        logger.debug(`Debug getDriverStatistics pour ${maskUserId(userId)}:`);
        logger.debug(` - Total commandes completed: ${allCompletedCount}`);
        logger.debug(` - Commandes completed avec ${driverColumn} défini: ${withDriver}`);
        logger.debug(` - Commandes completed pour ce livreur (avec UNION): ${completedDeliveries}`);
      }

      const averageRating = await calculateDriverRating(userId);

      let totalEarnings = 0;
      try {
        const priceColumnsInfo = await (pool as any).query(
          `SELECT column_name FROM information_schema.columns 
           WHERE table_schema = 'public' AND table_name = 'orders' 
           AND column_name = ANY($1)`,
          [['price_cfa', 'price']]
        );
        const priceColumnSet = new Set(priceColumnsInfo.rows.map((row) => row.column_name));
        const priceColumn = priceColumnSet.has('price_cfa') ? 'price_cfa' : priceColumnSet.has('price') ? 'price' : null;

        if (priceColumn) {
          logger.debug('Colonne de prix trouvée:', priceColumn);

          const allEarningsQuery = await (pool as any).query(
            `SELECT COALESCE(SUM(${priceColumn}), 0) as total 
             FROM orders WHERE status = 'completed'`
          );
          const allEarningsTotal = parseFloat(allEarningsQuery.rows[0]?.total || 0);
          logger.debug('Total gains toutes commandes completed (sans filtre):', maskAmount(allEarningsTotal));

          if (driverColumn) {
            const withDriverEarningsQuery = await (pool as any).query(
              `SELECT COALESCE(SUM(${priceColumn}), 0) as total 
               FROM orders WHERE ${driverColumn} IS NOT NULL AND status = 'completed'`
            );
            const withDriverEarnings = parseFloat(withDriverEarningsQuery.rows[0]?.total || 0);
            logger.debug(`Total gains commandes completed avec ${driverColumn}:`, maskAmount(withDriverEarnings));

            let earningsQuery = '';
            let earningsParams: any[] = [];

            earningsQuery = `
              SELECT COALESCE(SUM(o.${priceColumn}), 0) as total
              FROM orders o
              WHERE o.${driverColumn} = $1 AND o.status = 'completed'
            `;
            earningsParams = [userId];

            if (hasOrderAssignments) {
              earningsQuery += `
                UNION ALL
                SELECT COALESCE(SUM(o.${priceColumn}), 0) as total
                FROM orders o
                INNER JOIN order_assignments oa ON oa.order_id = o.id
                WHERE oa.driver_id = $2
                  AND o.status = 'completed'
                  AND oa.accepted_at IS NOT NULL
                  AND (o.${driverColumn} IS NULL OR o.${driverColumn} != $2)
              `;
              earningsParams.push(userId);
            }

            const earningsResult = await (pool as any).query(
              `SELECT COALESCE(SUM(total), 0) as total FROM (${earningsQuery}) as earnings`,
              earningsParams
            );
            totalEarnings = parseFloat(earningsResult.rows[0]?.total || 0);
            logger.debug(`Gains pour ce livreur (${maskUserId(userId)}) avec UNION:`, maskAmount(totalEarnings));
            logger.debug(`Debug gains pour ${maskUserId(userId)}:`);
            logger.debug(` - Total gains toutes commandes completed: ${maskAmount(allEarningsTotal)}`);
            logger.debug(` - Total gains commandes completed avec ${driverColumn}: ${maskAmount(withDriverEarnings)}`);
            logger.debug(` - Gains pour ce livreur: ${maskAmount(totalEarnings)} (${priceColumn})`);
          } else {
            const tableCheck = await (pool as any).query(
              `SELECT EXISTS (
                 SELECT FROM information_schema.tables
                 WHERE table_schema = 'public' AND table_name = 'order_assignments'
               )`
            );
            const hasOrderAssignments = tableCheck.rows[0]?.exists === true;

            if (hasOrderAssignments) {
              const earningsResult = await (pool as any).query(
                `SELECT COALESCE(SUM(o.${priceColumn}), 0) as total
                 FROM orders o
                 INNER JOIN order_assignments oa ON oa.order_id = o.id
                 WHERE oa.driver_id = $1 AND o.status = 'completed'`,
                [userId]
              );
              totalEarnings = parseFloat(earningsResult.rows[0]?.total || 0);
              logger.debug('Gains calculés via order_assignments:', maskAmount(totalEarnings));
              logger.debug(`Gains calculés via order_assignments pour ${maskUserId(userId)}: ${maskAmount(totalEarnings)}`);
            } else {
              logger.info('Impossible de calculer gains: pas de driver_id et pas de order_assignments');
              logger.warn(`Impossible de calculer gains: pas de driver_id dans orders et pas de order_assignments`);
            }
          }
        } else {
          logger.info('Colonne de prix (price_cfa/price) non trouvée');
          logger.warn(`Colonne de prix (price_cfa/price) non trouvée dans orders`);
        }

        logger.info('FIN getDriverStatistics - Livraisons:', completedDeliveries, 'Gains:', totalEarnings);
      } catch (err: any) {
        logger.warn('Erreur calcul gains totaux pour getDriverStatistics:', err.message);
      }

      res.json({
        success: true,
        data: {
          completedDeliveries,
          averageRating: parseFloat(averageRating.toFixed(1)),
          totalEarnings
        }
      });
    } catch (queryError: any) {
      logger.error('Erreur requête getDriverStatistics:', queryError);
      res.json({
        success: true,
        data: {
          completedDeliveries: 0,
          averageRating: 5.0,
          totalEarnings: 0
        }
      });
    }
  } catch (error: any) {
    logger.error('Erreur getDriverStatistics:', error);
    res.json({
      success: true,
      data: {
        completedDeliveries: 0,
        averageRating: 5.0,
        totalEarnings: 0
      }
    });
  }
};

/**
 * Met à jour les informations du véhicule du driver
 */
export const updateDriverVehicle = async (req: RequestWithUser, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const {
      vehicle_type,
      vehicle_plate,
      vehicle_brand,
      vehicle_model,
      vehicle_color,
      license_number,
    } = req.body;

    if (req.user && req.user.id !== userId) {
      res.status(403).json({
        success: false,
        message: 'Vous ne pouvez modifier que votre propre véhicule',
      });
      return;
    }

    // Vérifier que le profil driver existe
    const profileResult = await (pool as any).query(
      'SELECT id FROM driver_profiles WHERE user_id = $1',
      [userId]
    );

    if (!profileResult.rows || profileResult.rows.length === 0) {
      res.status(404).json({
        success: false,
        message: 'Profil chauffeur non trouvé',
      });
      return;
    }

    // Construire la requête de mise à jour dynamiquement
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (vehicle_type !== undefined) {
      if (!['moto', 'vehicule', 'cargo'].includes(vehicle_type)) {
        res.status(400).json({
          success: false,
          message: 'Type de véhicule invalide. Doit être: moto, vehicule ou cargo',
        });
        return;
      }
      updates.push(`vehicle_type = $${paramIndex}`);
      values.push(vehicle_type);
      paramIndex++;
    }

    if (vehicle_plate !== undefined) {
      updates.push(`vehicle_plate = $${paramIndex}`);
      values.push(vehicle_plate || null);
      paramIndex++;
    }

    if (vehicle_brand !== undefined) {
      updates.push(`vehicle_brand = $${paramIndex}`);
      values.push(vehicle_brand || null);
      paramIndex++;
    }

    if (vehicle_model !== undefined) {
      updates.push(`vehicle_model = $${paramIndex}`);
      values.push(vehicle_model || null);
      paramIndex++;
    }

    if (vehicle_color !== undefined) {
      updates.push(`vehicle_color = $${paramIndex}`);
      values.push(vehicle_color || null);
      paramIndex++;
    }

    if (license_number !== undefined) {
      updates.push(`license_number = $${paramIndex}`);
      values.push(license_number || null);
      paramIndex++;
    }

    if (updates.length === 0) {
      res.status(400).json({
        success: false,
        message: 'Aucune donnée à mettre à jour',
      });
      return;
    }

    // Ajouter updated_at
    updates.push(`updated_at = NOW()`);
    values.push(userId);

    const updateQuery = `
      UPDATE driver_profiles 
      SET ${updates.join(', ')}
      WHERE user_id = $${paramIndex}
      RETURNING vehicle_type, vehicle_plate, vehicle_brand, vehicle_model, vehicle_color, license_number
    `;

    const result = await (pool as any).query(updateQuery, values);

    // Si une plaque d'immatriculation a été fournie, créer/mettre à jour le véhicule dans fleet_vehicles
    const finalVehiclePlate = vehicle_plate || result.rows[0]?.vehicle_plate;
    const finalVehicleType = vehicle_type || result.rows[0]?.vehicle_type;
    
    if (finalVehiclePlate && finalVehicleType) {
      try {
        // Vérifier si le véhicule existe déjà dans fleet_vehicles
        const vehicleCheck = await (pool as any).query(
          'SELECT id, current_driver_id FROM fleet_vehicles WHERE vehicle_plate = $1',
          [finalVehiclePlate]
        );

        if (vehicleCheck.rows.length === 0) {
          // Créer le véhicule dans fleet_vehicles
          const insertVehicleQuery = `
            INSERT INTO fleet_vehicles (
              vehicle_plate, vehicle_type, vehicle_brand, vehicle_model, vehicle_color,
              current_driver_id, current_odometer, status
            )
            VALUES ($1, $2, $3, $4, $5, $6, 0, 'active')
            ON CONFLICT (vehicle_plate) DO NOTHING
            RETURNING id
          `;

          await (pool as any).query(insertVehicleQuery, [
            finalVehiclePlate,
            finalVehicleType,
            vehicle_brand || result.rows[0]?.vehicle_brand || null,
            vehicle_model || result.rows[0]?.vehicle_model || null,
            vehicle_color || result.rows[0]?.vehicle_color || null,
            userId, // Assigner le livreur comme conducteur actuel
          ]);

          logger.info(`Véhicule créé automatiquement dans fleet_vehicles: ${finalVehiclePlate}`, {
            driver_id: userId,
            vehicle_type: finalVehicleType,
          });
        } else {
          // Mettre à jour le véhicule existant si nécessaire
          const existingVehicle = vehicleCheck.rows[0];
          const updateVehicleFields: string[] = [];
          const updateVehicleValues: any[] = [];
          let updateParamIndex = 1;

          // Mettre à jour le conducteur actuel si différent
          if (existingVehicle.current_driver_id !== userId) {
            updateVehicleFields.push(`current_driver_id = $${updateParamIndex}`);
            updateVehicleValues.push(userId);
            updateParamIndex++;
          }

          // Mettre à jour les autres champs si fournis
          if (vehicle_brand !== undefined) {
            updateVehicleFields.push(`vehicle_brand = $${updateParamIndex}`);
            updateVehicleValues.push(vehicle_brand);
            updateParamIndex++;
          }

          if (vehicle_model !== undefined) {
            updateVehicleFields.push(`vehicle_model = $${updateParamIndex}`);
            updateVehicleValues.push(vehicle_model);
            updateParamIndex++;
          }

          if (vehicle_color !== undefined) {
            updateVehicleFields.push(`vehicle_color = $${updateParamIndex}`);
            updateVehicleValues.push(vehicle_color);
            updateParamIndex++;
          }

          if (vehicle_type !== undefined) {
            updateVehicleFields.push(`vehicle_type = $${updateParamIndex}`);
            updateVehicleValues.push(vehicle_type);
            updateParamIndex++;
          }

          if (updateVehicleFields.length > 0) {
            updateVehicleFields.push(`updated_at = NOW()`);
            updateVehicleValues.push(finalVehiclePlate);

            const updateVehicleQuery = `
              UPDATE fleet_vehicles
              SET ${updateVehicleFields.join(', ')}
              WHERE vehicle_plate = $${updateParamIndex}
            `;

            await (pool as any).query(updateVehicleQuery, updateVehicleValues);

            logger.info(`Véhicule mis à jour dans fleet_vehicles: ${finalVehiclePlate}`, {
              driver_id: userId,
              updated_fields: updateVehicleFields.length - 1, // -1 pour updated_at
            });
          }
        }
      } catch (fleetError: any) {
        // Ne pas bloquer la mise à jour du driver_profiles si la création dans fleet_vehicles échoue
        // (peut arriver si la table n'existe pas encore ou en cas d'erreur)
        logger.warn(`Erreur lors de la création/mise à jour dans fleet_vehicles: ${fleetError.message}`, {
          vehicle_plate: finalVehiclePlate,
          driver_id: userId,
        });
      }
    }

    logger.info(`Informations véhicule mises à jour pour ${maskUserId(userId)}`, {
      vehicle_type: vehicle_type !== undefined,
      vehicle_plate: vehicle_plate !== undefined,
      vehicle_brand: vehicle_brand !== undefined,
      vehicle_model: vehicle_model !== undefined,
      vehicle_color: vehicle_color !== undefined,
      license_number: license_number !== undefined,
    });

    res.json({
      success: true,
      message: 'Informations du véhicule mises à jour avec succès',
      data: result.rows[0],
    });
  } catch (error: any) {
    logger.error('Erreur mise à jour véhicule:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour du véhicule',
      error: error.message,
    });
  }
};

/**
 * Met à jour le type de livreur (internal/partner)
 */
export const updateDriverType = async (req: RequestWithUser, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const { driver_type } = req.body;

    if (req.user && req.user.id !== userId) {
      res.status(403).json({
        success: false,
        message: 'Vous ne pouvez modifier que votre propre type de livreur',
      });
      return;
    }

    if (!driver_type || !['internal', 'partner'].includes(driver_type)) {
      res.status(400).json({
        success: false,
        message: 'Type de livreur invalide. Doit être: internal ou partner',
      });
      return;
    }

    // Vérifier que le profil driver existe
    const profileResult = await (pool as any).query(
      'SELECT id, driver_type FROM driver_profiles WHERE user_id = $1',
      [userId]
    );

    let finalDriverType: string;

    if (!profileResult.rows || profileResult.rows.length === 0) {
      // Le profil n'existe pas → le créer avec le driver_type spécifié
      logger.info(`Profil driver non trouvé pour ${maskUserId(userId)}, création automatique avec driver_type=${driver_type}`);
      
      // Récupérer les informations de l'utilisateur depuis la table users
      const userResult = await (pool as any).query(
        'SELECT email, phone FROM users WHERE id = $1',
        [userId]
      );

      if (!userResult.rows || userResult.rows.length === 0) {
        res.status(404).json({
          success: false,
          message: 'Utilisateur non trouvé',
        });
        return;
      }

      const user = userResult.rows[0];

      // Créer le profil driver via Supabase (utiliser supabaseAdmin si disponible pour contourner RLS)
      const clientForInsert = supabaseAdmin || supabase;
      const { data: newProfile, error: insertError } = await clientForInsert
        .from('driver_profiles')
        .insert([
          {
            user_id: userId,
            email: user.email,
            phone: user.phone || null,
            driver_type: driver_type,
            vehicle_type: 'moto', // Valeur par défaut
          },
        ])
        .select()
        .single();

      if (insertError) {
        logger.error('Erreur création profil driver:', insertError);
        res.status(500).json({
          success: false,
          message: 'Erreur lors de la création du profil driver',
          error: insertError.message,
        });
        return;
      }

      finalDriverType = driver_type;
      logger.info(`Profil driver créé avec succès pour ${maskUserId(userId)} avec driver_type=${driver_type}`);
    } else {
      // Le profil existe → mettre à jour le driver_type
      const updateResult = await (pool as any).query(
        `UPDATE driver_profiles 
         SET driver_type = $1, updated_at = NOW()
         WHERE user_id = $2
         RETURNING driver_type`,
        [driver_type, userId]
      );

      finalDriverType = updateResult.rows[0].driver_type;
      logger.info(`Type de livreur mis à jour pour ${maskUserId(userId)}: ${driver_type}`);
    }

    res.json({
      success: true,
      message: 'Type de livreur mis à jour avec succès',
      data: {
        driver_type: finalDriverType,
      },
    });
  } catch (error: any) {
    logger.error('Erreur mise à jour type livreur:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour du type de livreur',
      error: error.message,
    });
  }
};
