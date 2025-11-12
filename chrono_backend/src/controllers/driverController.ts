import { Request, Response } from 'express';
import { supabase } from '../config/supabase.js';
import pool from '../config/db.js';
import logger from '../utils/logger.js';
import { maskUserId, maskAmount, maskOrderId, maskFinancialStats } from '../utils/maskSensitiveData.js';
import { calculateDriverRating } from '../utils/calculateDriverRating.js';

/**
 * GESTION DES CHAUFFEURS - Online/Offline et Géolocalisation
 */

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

//  Stockage en mémoire des statuts réels des chauffeurs
export const realDriverStatuses = new Map<string, DriverStatus>();


const mockDrivers = [
  
];


export const updateDriverStatus = async (req: RequestWithUser, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    
    // Si le middleware JWT est utilisé, vérifier que le userId du token correspond au userId de la route
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

    // 🔒 SÉCURITÉ: Masquer userId
    logger.info(`🔄 Mise à jour statut chauffeur ${maskUserId(userId)}:`, {
      is_online,
      is_available,
      position: current_latitude && current_longitude ? 
        `${current_latitude}, ${current_longitude}` : 'Non fournie'
    });

    // � Stocker le statut réel du chauffeur en mémoire
    const existingDriver = realDriverStatuses.get(userId) || {} as DriverStatus;
    
    const updatedDriver: DriverStatus = {
      ...existingDriver,
      user_id: userId,
      updated_at: new Date().toISOString()
    };

    // Mettre à jour les champs fournis
    if (typeof is_online === 'boolean') {
      updatedDriver.is_online = is_online;
      // Si offline, automatiquement indisponible ET supprimer de la Map après un délai
      if (!is_online) {
        updatedDriver.is_available = false;
        // 🔒 SÉCURITÉ: Masquer userId
        logger.info(`⚠️ Chauffeur ${maskUserId(userId)} passé offline - sera retiré de la liste`);
        // Nettoyer immédiatement les chauffeurs offline de la Map
        setTimeout(() => {
          const driver = realDriverStatuses.get(userId);
          if (driver && driver.is_online === false) {
            realDriverStatuses.delete(userId);
            // 🔒 SÉCURITÉ: Masquer userId
            logger.info(`🗑️ Chauffeur ${maskUserId(userId)} retiré de la Map (offline)`);
          }
        }, 5000); // Retirer après 5 secondes pour éviter les suppressions immédiates en cas d'erreur
      } else {
        // Si online, automatiquement disponible (sauf si explicitement défini à false)
        // Si is_available n'est pas fourni ou est true, mettre à true
        if (typeof is_available !== 'boolean') {
          updatedDriver.is_available = true;
        } else {
          updatedDriver.is_available = is_available;
        }
      }
    } else if (typeof is_available === 'boolean' && updatedDriver.is_online !== false) {
      // Si seulement is_available est fourni (sans is_online), mettre à jour seulement si online
      updatedDriver.is_available = is_available;
    }

    if (current_latitude && current_longitude) {
      updatedDriver.current_latitude = parseFloat(current_latitude);
      updatedDriver.current_longitude = parseFloat(current_longitude);
    }

    // Sauvegarder en mémoire (cache)
    realDriverStatuses.set(userId, updatedDriver);
    
    // Sauvegarder aussi en DB pour persistance
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
      // 🔒 SÉCURITÉ: Masquer userId
      logger.warn(`⚠️ Échec mise à jour DB pour chauffeur ${maskUserId(userId)}:`, dbError.message);
      // Continue même si la sauvegarde DB échoue (on garde en mémoire)
    }
    
    // Log simple lors du changement de statut
    if (updatedDriver.is_online) {
      logger.info(`� Chauffeur connecté`);
    } else {
      logger.info(`� Chauffeur déconnecté`);
    }

    res.json({
      success: true,
      message: 'Statut mis à jour avec succès',
      data: updatedDriver
    });

  } catch (error: any) {
    logger.error('❌ Erreur updateDriverStatus:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la mise à jour du statut',
      error: error.message
    });
  }
};

/**
 * 💰 Récupérer les revenus d'un chauffeur
 */
export const getDriverRevenues = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const period = (req.query.period as string) || 'today'; // today, week, month, all
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;

    // 🔒 SÉCURITÉ: Masquer userId dans les logs
    logger.debug('🔍 DÉBUT getDriverRevenues pour userId:', maskUserId(userId), 'period:', period);

    if (!userId) {
      res.status(400).json({
        success: false,
        message: 'userId est requis'
      });
      return;
    }

    // Vérifier que la connexion DB est configurée
    if (!process.env.DATABASE_URL) {
      logger.warn('⚠️ DATABASE_URL non configuré pour getDriverRevenues');
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
    }
    
    // Vérifier d'abord TOUTES les commandes completed
    const allCompletedQuery = await (pool as any).query(
      `SELECT COUNT(*) as count FROM orders WHERE status = 'completed'`
    );
    const allCompletedCount = parseInt(allCompletedQuery.rows[0]?.count || 0);
    logger.debug('📊 Total commandes completed (sans filtre):', allCompletedCount);

    // Calculer les dates selon la période
    let queryDate = '';
    let dateParams: any[] = [];
    
    logger.debug('📅 Calcul des dates - period:', period, 'startDate:', startDate, 'endDate:', endDate);
    
    if (startDate && endDate) {
      queryDate = 'AND completed_at >= $2 AND completed_at <= $3';
      dateParams = [userId, startDate, endDate];
      logger.debug('📅 Utilisation dates personnalisées:', startDate, 'à', endDate);
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
          logger.debug('📅 Période: all - pas de filtre de date');
          break;
      }
      
      if (period !== 'all') {
        queryDate = 'AND completed_at >= $2 AND completed_at <= $3';
        dateParams = [userId, start.toISOString(), now.toISOString()];
        logger.debug('📅 Filtre date:', start.toISOString(), 'à', now.toISOString());
      }
    }
    
    // 🔒 SÉCURITÉ: Ne pas logger dateParams (contient userId complet)
    logger.debug('📅 queryDate:', queryDate);

    // Lister TOUTES les colonnes de orders pour debug
    const allColumnsResult = await (pool as any).query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'orders'
       ORDER BY ordinal_position`
    );
    const allColumns = allColumnsResult.rows.map(row => row.column_name);
    logger.debug('📋 Colonnes disponibles dans orders:', allColumns.join(', '));

    // Vérifier dynamiquement les colonnes disponibles (compatibilité anciennes/nouvelles migrations)
    const columnsInfo = await (pool as any).query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'orders'
         AND column_name = ANY($1)`,
      [['price', 'price_cfa', 'distance', 'distance_km', 'driver_id', 'driver_uuid']]
    );

    const columnSet = new Set(columnsInfo.rows.map((row) => row.column_name));

    const priceColumn = columnSet.has('price_cfa')
      ? 'price_cfa'
      : columnSet.has('price')
        ? 'price'
        : null;

    logger.debug('💰 Colonne de prix trouvée:', priceColumn);

    if (!priceColumn) {
      throw new Error("La colonne 'price' (ou 'price_cfa') est absente de la table orders. Exécutez les migrations.");
    }

    const distanceColumn = columnSet.has('distance_km')
      ? 'distance_km'
      : columnSet.has('distance')
        ? 'distance'
        : null;

    const distanceSelect = distanceColumn ? distanceColumn : 'NULL::numeric';
    logger.debug('📏 Colonne de distance trouvée:', distanceColumn);

    const driverColumn = columnSet.has('driver_id')
      ? 'driver_id'
      : columnSet.has('driver_uuid')
        ? 'driver_uuid'
        : null;

    logger.debug('🔑 Colonne driver trouvée:', driverColumn);

    // Vérifier si order_assignments existe si driverColumn n'existe pas
    let hasOrderAssignments = false;
    if (!driverColumn) {
      try {
        const tableCheck = await (pool as any).query(
          `SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'order_assignments'
          )`
        );
        hasOrderAssignments = tableCheck.rows[0]?.exists === true;
        logger.debug('📋 Table order_assignments existe:', hasOrderAssignments);
        } catch (err: any) {
          logger.warn('⚠️ Erreur vérification order_assignments:', err.message);
      }
    }
    
    // 🔒 SÉCURITÉ: Ne pas logger les exemples d'objets (contiennent des données sensibles)
    // Vérification silencieuse pour debug interne uniquement

    // Récupérer les commandes terminées du chauffeur
    let query, result;
    try {
      if (driverColumn) {
        // 🔒 SÉCURITÉ: Masquer userId
        logger.debug(`🔍 Requête avec ${driverColumn} pour userId:`, maskUserId(userId));
        // Vérifier d'abord combien de commandes completed ont un driver_id défini
        const withDriverQuery = await (pool as any).query(
          `SELECT COUNT(*) as count FROM orders 
           WHERE ${driverColumn} IS NOT NULL AND status = 'completed'`
        );
        const withDriverCount = parseInt(withDriverQuery.rows[0]?.count || 0);
        logger.debug(`📊 Commandes completed avec ${driverColumn} défini:`, withDriverCount);
        
        // Compter pour ce livreur spécifique
        const forThisDriverQuery = await (pool as any).query(
          `SELECT COUNT(*) as count FROM orders 
           WHERE ${driverColumn} = $1 AND status = 'completed'`,
          [userId]
        );
        const forThisDriverCount = parseInt(forThisDriverQuery.rows[0]?.count || 0);
        // 🔒 SÉCURITÉ: Masquer userId
        logger.debug(`📊 Commandes completed pour ce livreur (${maskUserId(userId)}):`, forThisDriverCount);
        
        // Utiliser UNION pour combiner driverColumn et order_assignments
        // Cela permet de récupérer toutes les commandes même si driver_id est NULL
        let unionQuery = '';
        let unionParams: any[] = [];
        
        // Première partie : commandes avec driver_id défini
        unionQuery = `
          SELECT DISTINCT
            o.id,
            o.${priceColumn} AS price,
            ${distanceSelect.includes('o.') ? distanceSelect : `o.${distanceSelect}`} AS distance,
            o.delivery_method,
            o.completed_at,
            o.created_at
          FROM orders o
          WHERE o.${driverColumn} = $1 
            AND o.status = 'completed'
            ${queryDate}
        `;
        unionParams = [...dateParams];
        
        // Deuxième partie : commandes via order_assignments (si la table existe et si on a des dates)
        if (hasOrderAssignments) {
          // Adapter les paramètres pour la deuxième partie
          let paramOffset = dateParams.length;
          let queryDate2 = queryDate;
          
          if (queryDate.includes('$2') && queryDate.includes('$3')) {
            // Si on a des dates, les adapter pour la deuxième partie
            queryDate2 = queryDate.replace('$2', `$${paramOffset + 2}`).replace('$3', `$${paramOffset + 3}`);
            unionParams = [...unionParams, userId, ...dateParams.slice(1)];
          } else {
            // Pas de dates, juste userId
            unionParams = [...unionParams, userId];
          }
          
          unionQuery += `
            UNION
            SELECT DISTINCT
              o.id,
              o.${priceColumn} AS price,
              ${distanceSelect.includes('o.') ? distanceSelect : `COALESCE(o.${distanceSelect}, 0)`} AS distance,
              o.delivery_method,
              o.completed_at,
              o.created_at
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
        logger.debug('✅ Résultat requête avec driverColumn (et order_assignments si disponible):', result.rows.length, 'lignes');
      } else if (hasOrderAssignments) {
        // 🔒 SÉCURITÉ: Masquer userId
        logger.debug('🔍 Requête via order_assignments pour userId:', maskUserId(userId));
        // Compter les commandes via order_assignments
        const viaAssignmentsQuery = await (pool as any).query(
          `SELECT COUNT(DISTINCT o.id) as count 
           FROM orders o
           INNER JOIN order_assignments oa ON oa.order_id = o.id
           WHERE oa.driver_id = $1 AND o.status = 'completed'`,
          [userId]
        );
        const viaAssignmentsCount = parseInt(viaAssignmentsQuery.rows[0]?.count || 0);
        logger.debug('📊 Commandes completed via order_assignments:', viaAssignmentsCount);
        
        query = `
          SELECT 
            o.id,
            o.${priceColumn} AS price,
            ${distanceSelect} AS distance,
            o.delivery_method,
            o.completed_at,
            o.created_at
          FROM orders o
          INNER JOIN order_assignments oa ON oa.order_id = o.id
          WHERE oa.driver_id = $1
            AND o.status = 'completed'
            ${queryDate}
          ORDER BY o.completed_at DESC
        `;
        result = await (pool as any).query(query, dateParams);
        logger.info('✅ Résultat requête via order_assignments:', result.rows.length, 'lignes');
      } else {
        // Aucune colonne driver et pas de table order_assignments => retourner résultat vide
        logger.info('❌ Impossible de calculer les revenus: ni driver_id, ni order_assignments');
        // 🔒 SÉCURITÉ: Masquer userId
        logger.warn(`⚠️ Impossible de calculer les revenus: ni colonne driver dans orders, ni table order_assignments pour userId ${maskUserId(userId)}`);
        result = { rows: [] };
      }
    } catch (queryError) {
      logger.error('❌ Erreur requête getDriverRevenues:', queryError);
      logger.error('❌ Erreur requête getDriverRevenues:', queryError);
      // En cas d'erreur SQL, retourner un résultat vide plutôt que planter
      result = { rows: [] };
    }
    
    // Calculer les statistiques
    const totalEarnings = result.rows.reduce((sum, order) => sum + (Number(order.price) || 0), 0);
    const totalDeliveries = result.rows.length;
    const totalDistance = result.rows.reduce((sum, order) => sum + (Number(order.distance) || 0), 0);
    
    // 🔒 SÉCURITÉ: Masquer les montants et détails sensibles
    logger.debug('💰 Résultats finaux getDriverRevenues:');
    logger.debug('   - Total livraisons:', totalDeliveries);
    logger.debug('   - Total gains:', maskAmount(totalEarnings));
    logger.debug('   - Total distance:', totalDistance, 'km');
    logger.debug('   - Période:', period);
    
    // Log des détails des commandes récupérées (masqués)
    if (result.rows.length > 0) {
      // 🔒 SÉCURITÉ: Ne pas logger les détails complets (contiennent des données sensibles)
      logger.info('📦 Nombre de commandes récupérées:', result.rows.length);
    }
    
    // Par méthode de livraison
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

    // Revenus par jour (pour graphique)
    const earningsByDay = {};
    result.rows.forEach(order => {
      if (order.completed_at) {
        const date = new Date(order.completed_at);
        const dayKey = date.toISOString().split('T')[0];
        earningsByDay[dayKey] = (earningsByDay[dayKey] || 0) + (Number(order.price) || 0);
      }
    });

    // Moyennes
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
    logger.error('❌ Erreur getDriverRevenues:', error);
    
    // Si c'est une erreur de connexion DB, retourner un résultat vide plutôt qu'une erreur
    if (error.message && (error.message.includes('SASL') || error.message.includes('password'))) {
      logger.warn('⚠️ Erreur de connexion DB (peut-être non configurée), retour de données vides');
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
    }
    
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la récupération des revenus',
      error: error.message
    });
  }
};

/**
 * 🗺️ Récupérer tous les chauffeurs online
 */
export const getOnlineDrivers = async (req: Request, res: Response): Promise<void> => {
  try {
    const latitude = req.query.latitude as string | undefined;
    const longitude = req.query.longitude as string | undefined;
    const radius = parseInt(req.query.radius as string) || 10;

    logger.debug('🔍 Récupération chauffeurs online:', {
      userPosition: latitude && longitude ? `${latitude}, ${longitude}` : 'Non fournie',
      radius: `${radius}km`
    });

    // 🔒 SÉCURITÉ: Masquer les IDs dans les logs
    logger.debug(`💾 État mémoire actuelle: ${realDriverStatuses.size} chauffeurs stockés`);
    if (realDriverStatuses.size > 0) {
      const maskedDrivers = Array.from(realDriverStatuses.entries()).map(([id, data]) => ({
        id: maskUserId(id),
        online: data.is_online,
        position: data.current_latitude ? 'Oui' : 'Non'
      }));
      logger.debug(`📋 Chauffeurs en mémoire:`, maskedDrivers);
    }

    // � Combiner données de test + données réelles
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

    // 1️⃣ Ajouter les chauffeurs de test (DÉSACTIVÉ pour voir seulement les vrais)
    // allDrivers.push(...mockDrivers);

    // 2️⃣ Nettoyer d'abord les chauffeurs offline de la Map avant de récupérer
    const offlineDrivers: string[] = [];
    for (const [userId, driverData] of realDriverStatuses.entries()) {
      if (driverData.is_online === false) {
        offlineDrivers.push(userId);
        // 🔒 SÉCURITÉ: Masquer userId
        logger.debug(`🗑️ Suppression immédiate chauffeur offline : ${maskUserId(userId)}`);
      }
    }
    // Supprimer immédiatement les chauffeurs offline
    offlineDrivers.forEach(userId => {
      realDriverStatuses.delete(userId);
    });

    // 3️⃣ Ajouter SEULEMENT les chauffeurs réels qui sont online (vérification STRICTE)
    for (const [userId, driverData] of realDriverStatuses.entries()) {
      // 🔒 SÉCURITÉ: Masquer userId et données sensibles
      logger.debug(`🔍 Vérification chauffeur ${maskUserId(userId)}`);
      
      // 🔍 Vérification STRICTE : seulement si is_online === true (pas undefined, pas null, pas autre chose)
      // ET vérifier que la valeur n'est pas falsy (strictement true)
      if (driverData.is_online === true) {
        // 🔧 VERSION SIMPLIFIÉE - Pas de Supabase pour éviter les erreurs de connexion
        // 🔒 SÉCURITÉ: Masquer userId
        logger.debug(`✅ Livreur online détecté : ${maskUserId(userId)}`);
        
        // Calculer la note moyenne dynamiquement depuis la table ratings
        const rating = await calculateDriverRating(userId);
        
        // Créer un profil basé sur l'userId
        const emailName = userId.substring(0, 8); // Premiers 8 caractères de l'ID
        const driverProfile = {
          user_id: userId,
          first_name: 'Livreur',
          last_name: emailName,
          vehicle_type: 'moto',
          current_latitude: driverData.current_latitude || 5.3453,
          current_longitude: driverData.current_longitude || -4.0244,
          is_online: true, // Forcer à true car on a déjà vérifié
          is_available: driverData.is_available || false,
          rating, // Note calculée dynamiquement depuis ratings
          total_deliveries: 0
        };
        
        allDrivers.push(driverProfile);
        logger.info(`➕ Livreur ajouté:`, driverProfile.first_name, driverProfile.last_name);
      } else {
        // Log si un chauffeur est trouvé mais offline pour debug
        if (driverData.is_online === false || driverData.is_online === undefined || driverData.is_online === null) {
          // 🔒 SÉCURITÉ: Masquer userId
          logger.info(`⚠️ Chauffeur offline/undefined ignoré et retiré : ${maskUserId(userId)} (is_online: ${driverData.is_online})`);
          // Supprimer immédiatement si offline
          realDriverStatuses.delete(userId);
        }
      }
    }

    // 4️⃣ Filtrer seulement les chauffeurs online (triple vérification stricte)
    const onlineDrivers = allDrivers.filter((driver: any) => {
      const isOnline = driver.is_online === true;
      if (!isOnline) {
        logger.info(`⚠️ Chauffeur filtré côté backend (pas strictement online): ${driver.user_id} (is_online: ${driver.is_online})`);
      }
      return isOnline;
    });

    logger.info(`✅ ${onlineDrivers.length} chauffeurs online trouvés (${onlineDrivers.length} réels uniquement)`);

    res.json({
      success: true,
      message: `${onlineDrivers.length} chauffeurs online trouvés`,
      data: onlineDrivers,
      _debug: {
        mockDrivers: 0, // Désactivés
        realDriversTotal: realDriverStatuses.size,
        onlineReal: Array.from(realDriverStatuses.values()).filter(d => d.is_online).length
      }
    });

  } catch (error: any) {
    logger.error('❌ Erreur getOnlineDrivers:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la récupération des chauffeurs',
      error: error.message
    });
  }
};

/**
 * 🔍 Récupérer les détails d'un chauffeur spécifique
 */
export const getDriverDetails = async (req: Request, res: Response): Promise<void> => {
  try {
    const { driverId } = req.params;

    const { data: driver, error } = await supabase
      .from('driver_profiles')
      .select(`
        user_id,
        first_name,
        last_name,
        vehicle_type,
        vehicle_plate,
        vehicle_model,
        current_latitude,
        current_longitude,
        is_online,
        is_available,
        total_deliveries,
        completed_deliveries,
        profile_image_url
      `)
      .eq('user_id', driverId)
      .single();

    if (error || !driver) {
      res.status(404).json({
        success: false,
        message: 'Chauffeur non trouvé'
      });
      return;
    }

    // Calculer la note moyenne dynamiquement depuis la table ratings
    const rating = await calculateDriverRating(driverId);

    res.json({
      success: true,
      message: 'Détails chauffeur récupérés',
      data: {
        ...driver,
        rating // Note calculée dynamiquement depuis ratings
      }
    });

  } catch (error: any) {
    logger.error('❌ Erreur getDriverDetails:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur',
      error: error.message
    });
  }
};

/**
 * 📊 Récupérer les statistiques d'un livreur
 * Retourne : nombre de livraisons complétées, note moyenne
 */
/**
 * Obtenir le temps de travail restant d'un chauffeur
 */
export const getDriverWorkTime = async (req: RequestWithUser, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    
    // Vérifier que l'utilisateur peut accéder à ces informations
    if (req.user && req.user.id !== userId) {
      res.status(403).json({
        success: false,
        message: 'Vous ne pouvez consulter que votre propre temps de travail'
      });
      return;
    }

    // Récupérer les informations de temps de travail depuis driver_profiles
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
    
    // Réinitialiser si c'est un nouveau jour
    const today = new Date().toISOString().split('T')[0];
    const lastResetDate = profile.last_work_reset_date 
      ? new Date(profile.last_work_reset_date).toISOString().split('T')[0]
      : null;

    if (lastResetDate !== today) {
      // Réinitialiser les heures de travail
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

    // Calculer le temps de travail restant
    const currentHours = parseFloat(profile.daily_work_hours || 0);
    const maxHours = parseFloat(profile.max_daily_hours || 10);
    const remainingHours = Math.max(0, maxHours - currentHours);
    const remainingMinutes = Math.round(remainingHours * 60);

    // Calculer le temps de travail depuis le début si work_start_time existe
    let workDurationHours = 0;
    if (profile.work_start_time) {
      const startTime = new Date(profile.work_start_time);
      const now = new Date();
      const diffMs = now.getTime() - startTime.getTime();
      workDurationHours = diffMs / (1000 * 60 * 60); // Convertir en heures
    }

    logger.info(`⏰ Temps de travail consulté pour chauffeur ${maskUserId(userId)}`, {
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
    logger.error('❌ Erreur récupération temps de travail:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

/**
 * Mettre à jour le temps de travail d'un chauffeur
 */
export const updateDriverWorkTime = async (req: RequestWithUser, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    
    // Vérifier que l'utilisateur peut modifier ces informations
    if (req.user && req.user.id !== userId) {
      res.status(403).json({
        success: false,
        message: 'Vous ne pouvez modifier que votre propre temps de travail'
      });
      return;
    }

    const { hours, kilometers, startWork } = req.body;

    // Récupérer le profil actuel
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
    const lastResetDate = profile.last_work_reset_date 
      ? new Date(profile.last_work_reset_date).toISOString().split('T')[0]
      : null;

    // Réinitialiser si c'est un nouveau jour
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

    // Mettre à jour les heures de travail
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

    updateQuery = updateQuery.slice(0, -2); // Enlever la dernière virgule
    updateQuery += ` WHERE user_id = $${paramIndex}`;
    updateParams.push(userId);

    await (pool as any).query(updateQuery, updateParams);

    logger.info(`⏰ Temps de travail mis à jour pour chauffeur ${maskUserId(userId)}`, {
      hours: hours !== undefined ? hours : 'non modifié',
      kilometers: kilometers !== undefined ? kilometers : 'non modifié',
      startWork,
    });

    res.json({
      success: true,
      message: 'Temps de travail mis à jour',
    });
  } catch (error: any) {
    logger.error('❌ Erreur mise à jour temps de travail:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
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

    // Vérifier que la connexion DB est configurée
    if (!process.env.DATABASE_URL) {
      logger.warn('⚠️ DATABASE_URL non configuré pour getDriverStatistics');
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
      // 🔒 SÉCURITÉ: Masquer userId
      logger.debug('🔍 DÉBUT getDriverStatistics pour userId:', maskUserId(userId));
      
      // Lister TOUTES les colonnes de la table orders pour debug
      const allColumnsResult = await (pool as any).query(
        `SELECT column_name FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = 'orders'
         ORDER BY ordinal_position`
      );
      const allColumns = allColumnsResult.rows.map(row => row.column_name);
      logger.debug('📋 Colonnes disponibles dans orders:', allColumns.join(', '));
      
      // Compter TOUTES les commandes completed d'abord
      const allCompletedQuery = await (pool as any).query(
        `SELECT COUNT(*) as count FROM orders WHERE status = 'completed'`
      );
      const allCompletedCount = parseInt(allCompletedQuery.rows[0]?.count || 0);
      logger.debug('📊 Total commandes completed (sans filtre):', allCompletedCount);
      
      // Vérifier la colonne driver_id dans orders
      const columnsInfo = await (pool as any).query(
        `SELECT column_name FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = 'orders'
           AND column_name = ANY($1)`,
        [['driver_id', 'driver_uuid']]
      );

      const columnSet = new Set(columnsInfo.rows.map((row) => row.column_name));
      const driverColumn = columnSet.has('driver_id')
        ? 'driver_id'
        : columnSet.has('driver_uuid')
          ? 'driver_uuid'
          : null;
      
      logger.debug('🔑 Colonne driver trouvée:', driverColumn);

      // Vérifier si order_assignments existe (pour l'utiliser comme fallback)
      let hasOrderAssignments = false;
      try {
        const tableCheck = await (pool as any).query(
          `SELECT EXISTS (
            SELECT FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name = 'order_assignments'
          )`
        );
        hasOrderAssignments = tableCheck.rows[0]?.exists === true;
        logger.debug('📋 Table order_assignments existe:', hasOrderAssignments);
      } catch (err: any) {
        logger.warn('⚠️ Erreur vérification order_assignments:', err.message);
      }

      let completedDeliveries = 0;

      // Vérifier d'abord toutes les commandes completed avec leur driver_id (ou NULL)
      const checkCompletedQuery = await (pool as any).query(
        `SELECT id, status, ${driverColumn || 'NULL as driver_id'}, price_cfa 
         FROM orders 
         WHERE status = 'completed' 
         LIMIT 10`
      );
      // 🔒 SÉCURITÉ: Ne pas logger les exemples d'objets (contiennent des données sensibles)
      
      if (!driverColumn) {
        logger.info('❌ Colonne driver_id/driver_uuid non trouvée dans orders');
        logger.warn(`⚠️ Colonne driver_id/driver_uuid non trouvée dans orders. Essai avec order_assignments...`);
        
        // Vérifier si order_assignments existe
        const tableCheck = await (pool as any).query(
          `SELECT EXISTS (
            SELECT FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name = 'order_assignments'
          )`
        );
        const hasOrderAssignments = tableCheck.rows[0]?.exists === true;
        logger.debug('📋 Table order_assignments existe:', hasOrderAssignments);
        
        if (hasOrderAssignments) {
          // Compter via order_assignments
          const deliveriesResult = await (pool as any).query(
            `SELECT COUNT(DISTINCT o.id) as count 
             FROM orders o
             INNER JOIN order_assignments oa ON oa.order_id = o.id
             WHERE oa.driver_id = $1 AND o.status = 'completed'`,
            [userId]
          );
          completedDeliveries = parseInt(deliveriesResult.rows[0]?.count || 0);
          logger.debug('📊 Commandes completed via order_assignments:', completedDeliveries);
          // 🔒 SÉCURITÉ: Masquer userId
          logger.debug(`📊 Commandes completed via order_assignments pour ${maskUserId(userId)}: ${completedDeliveries}`);
        } else {
          logger.info('❌ Table order_assignments n\'existe pas');
          logger.warn(`⚠️ Table order_assignments n'existe pas non plus. Impossible de compter les livraisons.`);
        }
      } else {
        // Compter directement depuis orders avec driver_id
        // Vérifier les commandes avec driver_id défini (peu importe quel driver)
        const withDriverResult = await (pool as any).query(
          `SELECT COUNT(*) as count FROM orders WHERE ${driverColumn} IS NOT NULL AND status = 'completed'`
        );
        const withDriver = parseInt(withDriverResult.rows[0]?.count || 0);
        logger.debug(`📊 Commandes completed avec ${driverColumn} défini:`, withDriver);
        
        // Compter pour ce livreur spécifique : utiliser UNION pour combiner driverColumn et order_assignments
        let countQuery = '';
        let countParams: any[] = [];
        
        // Première partie : commandes avec driver_id défini
        countQuery = `
          SELECT COUNT(DISTINCT o.id) as count
          FROM orders o
          WHERE o.${driverColumn} = $1 
            AND o.status = 'completed'
        `;
        countParams = [userId];
        
        // Deuxième partie : commandes via order_assignments (si la table existe)
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
        
        // Exécuter la requête et sommer les résultats
        const deliveriesResult = await (pool as any).query(
          `SELECT SUM(count) as total FROM (${countQuery}) as counts`,
          countParams
        );
        completedDeliveries = parseInt(deliveriesResult.rows[0]?.total || 0);
        
        // 🔒 SÉCURITÉ: Masquer userId
        logger.debug(`📊 Commandes completed pour ce livreur (${maskUserId(userId)}):`, completedDeliveries);
        
        // 🔒 SÉCURITÉ: Masquer userId
        logger.debug(`📊 Debug getDriverStatistics pour ${maskUserId(userId)}:`);
        logger.debug(`   - Total commandes completed: ${allCompletedCount}`);
        logger.debug(`   - Commandes completed avec ${driverColumn} défini: ${withDriver}`);
        logger.debug(`   - Commandes completed pour ce livreur (avec UNION): ${completedDeliveries}`);
      }

      // Calculer la note moyenne dynamiquement depuis la table ratings
      // La note est la moyenne de toutes les évaluations reçues par le livreur
      const averageRating = await calculateDriverRating(userId);

      // Calculer les gains totaux : somme de price_cfa pour toutes les commandes completed
      let totalEarnings = 0;
      try {
        // Détecter la colonne de prix
        const priceColumnsInfo = await (pool as any).query(
          `SELECT column_name FROM information_schema.columns
           WHERE table_schema = 'public'
             AND table_name = 'orders'
             AND column_name = ANY($1)`,
          [['price_cfa', 'price']]
        );
        const priceColumnSet = new Set(priceColumnsInfo.rows.map((row) => row.column_name));
        const priceColumn = priceColumnSet.has('price_cfa') ? 'price_cfa' : priceColumnSet.has('price') ? 'price' : null;

        if (priceColumn) {
          logger.debug('💰 Colonne de prix trouvée:', priceColumn);
          
          // D'abord, vérifier la somme totale de toutes les commandes completed
          const allEarningsQuery = await (pool as any).query(
            `SELECT COALESCE(SUM(${priceColumn}), 0) as total 
             FROM orders 
             WHERE status = 'completed'`
          );
          const allEarningsTotal = parseFloat(allEarningsQuery.rows[0]?.total || 0);
          // 🔒 SÉCURITÉ: Masquer montant
          logger.debug('💰 Total gains toutes commandes completed (sans filtre):', maskAmount(allEarningsTotal));
          
          if (driverColumn) {
            // Calculer depuis orders avec driver_id
            const withDriverEarningsQuery = await (pool as any).query(
              `SELECT COALESCE(SUM(${priceColumn}), 0) as total 
               FROM orders 
               WHERE ${driverColumn} IS NOT NULL AND status = 'completed'`
            );
            const withDriverEarnings = parseFloat(withDriverEarningsQuery.rows[0]?.total || 0);
            // 🔒 SÉCURITÉ: Masquer montant
            logger.debug(`💰 Total gains commandes completed avec ${driverColumn}:`, maskAmount(withDriverEarnings));
            
            // Utiliser UNION pour combiner driverColumn et order_assignments
            let earningsQuery = '';
            let earningsParams: any[] = [];
            
            // Première partie : commandes avec driver_id défini
            earningsQuery = `
              SELECT COALESCE(SUM(o.${priceColumn}), 0) as total
              FROM orders o
              WHERE o.${driverColumn} = $1 
                AND o.status = 'completed'
            `;
            earningsParams = [userId];
            
            // Deuxième partie : commandes via order_assignments (si la table existe)
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
            
            // Exécuter la requête et sommer les résultats
            const earningsResult = await (pool as any).query(
              `SELECT COALESCE(SUM(total), 0) as total FROM (${earningsQuery}) as earnings`,
              earningsParams
            );
            totalEarnings = parseFloat(earningsResult.rows[0]?.total || 0);
            // 🔒 SÉCURITÉ: Masquer userId et montant
            logger.debug(`💰 Gains pour ce livreur (${maskUserId(userId)}) avec UNION:`, maskAmount(totalEarnings));
            
            // 🔒 SÉCURITÉ: Masquer userId et montants dans les logs
            logger.debug(`📊 Debug gains pour ${maskUserId(userId)}:`);
            logger.debug(`   - Total gains toutes commandes completed: ${maskAmount(allEarningsTotal)}`);
            logger.debug(`   - Total gains commandes completed avec ${driverColumn}: ${maskAmount(withDriverEarnings)}`);
            logger.debug(`   - Gains pour ce livreur: ${maskAmount(totalEarnings)} (${priceColumn})`);
          } else {
            // Si pas de driver_id, essayer avec order_assignments
            const tableCheck = await (pool as any).query(
              `SELECT EXISTS (
                SELECT FROM information_schema.tables
                WHERE table_schema = 'public'
                AND table_name = 'order_assignments'
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
              // 🔒 SÉCURITÉ: Masquer montant
              logger.debug('💰 Gains calculés via order_assignments:', maskAmount(totalEarnings));
              // 🔒 SÉCURITÉ: Masquer userId et montant
              logger.debug(`📊 Gains calculés via order_assignments pour ${maskUserId(userId)}: ${maskAmount(totalEarnings)}`);
            } else {
              logger.info('❌ Impossible de calculer gains: pas de driver_id et pas de order_assignments');
              logger.warn(`⚠️ Impossible de calculer gains: pas de driver_id dans orders et pas de order_assignments`);
            }
          }
        } else {
          logger.info('❌ Colonne de prix (price_cfa/price) non trouvée');
          logger.warn(`⚠️ Colonne de prix (price_cfa/price) non trouvée dans orders`);
        }
        
        logger.info('✅ FIN getDriverStatistics - Livraisons:', completedDeliveries, 'Gains:', totalEarnings);
      } catch (err: any) {
        logger.warn('⚠️ Erreur calcul gains totaux pour getDriverStatistics:', err.message);
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
      logger.error('❌ Erreur requête getDriverStatistics:', queryError);
      // En cas d'erreur SQL, retourner un résultat vide plutôt que planter
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
    logger.error('❌ Erreur getDriverStatistics:', error);
    // Retourner un résultat vide en cas d'erreur pour éviter de crasher l'app
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