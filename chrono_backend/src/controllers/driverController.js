import { supabase } from '../config/supabase.js';
import pool from '../config/db.js';
import logger from '../utils/logger.js';

/**
 * 🚗 GESTION DES CHAUFFEURS - Online/Offline et Géolocalisation
 */

// 💾 Stockage en mémoire des statuts réels des chauffeurs
export const realDriverStatuses = new Map();

// 🎭 Données de test pour compléter (TEMPORAIREMENT DÉSACTIVÉES)
const mockDrivers = [
  // Commenté pour tester avec de vraies données uniquement
  /*
  {
    user_id: '11111111-1111-1111-1111-111111111111',
    first_name: 'Kouame',
    last_name: 'Jean',
    vehicle_type: 'moto',
    current_latitude: 5.3165,
    current_longitude: -4.0266,
    is_online: true,
    is_available: true,
    rating: 4.8,
    total_deliveries: 127
  },
  {
    user_id: '22222222-2222-2222-2222-222222222222',
    first_name: 'Diallo',
    last_name: 'Fatoumata',
    vehicle_type: 'vehicule',
    current_latitude: 5.3532,
    current_longitude: -3.9851,
    is_online: true,
    is_available: true,
    rating: 4.9,
    total_deliveries: 89
  },
  {
    user_id: '33333333-3333-3333-3333-333333333333',
    first_name: 'Kone',
    last_name: 'Ibrahim',
    vehicle_type: 'cargo',
    current_latitude: 5.2945,
    current_longitude: -4.0419,
    is_online: true,
    is_available: true,
    rating: 4.7,
    total_deliveries: 203
  }
  */
];

/**
 * 📍 Mettre à jour le statut et la position du chauffeur
 */
export const updateDriverStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Si le middleware JWT est utilisé, vérifier que le userId du token correspond au userId de la route
    if (req.user && req.user.id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Vous ne pouvez modifier que votre propre statut'
      });
    }
    
    const { 
      is_online, 
      is_available, 
      current_latitude, 
      current_longitude 
    } = req.body;

    console.log(`🔄 Mise à jour statut chauffeur ${userId}:`, {
      is_online,
      is_available,
      position: current_latitude && current_longitude ? 
        `${current_latitude}, ${current_longitude}` : 'Non fournie'
    });

    // � Stocker le statut réel du chauffeur en mémoire
    const existingDriver = realDriverStatuses.get(userId) || {};
    
    const updatedDriver = {
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
        console.log(`⚠️ Chauffeur ${userId} passé offline - sera retiré de la liste`);
        // Nettoyer immédiatement les chauffeurs offline de la Map
        setTimeout(() => {
          const driver = realDriverStatuses.get(userId);
          if (driver && driver.is_online === false) {
            realDriverStatuses.delete(userId);
            console.log(`🗑️ Chauffeur ${userId} retiré de la Map (offline)`);
          }
        }, 5000); // Retirer après 5 secondes pour éviter les suppressions immédiates en cas d'erreur
      }
    }

    if (typeof is_available === 'boolean' && is_online !== false) {
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
    } catch (dbError) {
      console.warn(`⚠️ Échec mise à jour DB pour chauffeur ${userId}:`, dbError.message);
      // Continue même si la sauvegarde DB échoue (on garde en mémoire)
    }
    
    // Log simple lors du changement de statut
    if (updatedDriver.is_online) {
      console.log(`� Chauffeur connecté`);
    } else {
      console.log(`� Chauffeur déconnecté`);
    }

    res.json({
      success: true,
      message: 'Statut mis à jour avec succès',
      data: updatedDriver
    });

  } catch (error) {
    console.error('❌ Erreur updateDriverStatus:', error);
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
export const getDriverRevenues = async (req, res) => {
  try {
    const { userId } = req.params;
    const period = req.query.period || 'today'; // today, week, month, all
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'userId est requis'
      });
    }

    // Vérifier que la connexion DB est configurée
    if (!process.env.DATABASE_URL) {
      console.warn('⚠️ DATABASE_URL non configuré pour getDriverRevenues');
      return res.json({
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

    // Calculer les dates selon la période
    let queryDate = '';
    let dateParams = [];
    
    if (startDate && endDate) {
      queryDate = 'AND completed_at >= $2 AND completed_at <= $3';
      dateParams = [userId, startDate, endDate];
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
          break;
      }
      
      if (period !== 'all') {
        queryDate = 'AND completed_at >= $2 AND completed_at <= $3';
        dateParams = [userId, start.toISOString(), now.toISOString()];
      }
    }

    // Vérifier dynamiquement les colonnes disponibles (compatibilité anciennes/nouvelles migrations)
    const columnsInfo = await pool.query(
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

    if (!priceColumn) {
      throw new Error("La colonne 'price' (ou 'price_cfa') est absente de la table orders. Exécutez les migrations.");
    }

    const distanceColumn = columnSet.has('distance_km')
      ? 'distance_km'
      : columnSet.has('distance')
        ? 'distance'
        : null;

    const distanceSelect = distanceColumn ? distanceColumn : 'NULL::numeric';

    const driverColumn = columnSet.has('driver_id')
      ? 'driver_id'
      : columnSet.has('driver_uuid')
        ? 'driver_uuid'
        : null;

    // Vérifier si order_assignments existe si driverColumn n'existe pas
    let hasOrderAssignments = false;
    if (!driverColumn) {
      try {
        const tableCheck = await pool.query(
          `SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'order_assignments'
          )`
        );
        hasOrderAssignments = tableCheck.rows[0]?.exists === true;
      } catch (err) {
        logger.warn('⚠️ Erreur vérification order_assignments:', err.message);
      }
    }

    // Récupérer les commandes terminées du chauffeur
    let query, result;
    try {
      if (driverColumn) {
        query = `
          SELECT 
            id,
            ${priceColumn} AS price,
            ${distanceSelect} AS distance,
            delivery_method,
            completed_at,
            created_at
          FROM orders
          WHERE ${driverColumn} = $1 
            AND status = 'completed'
            ${queryDate}
          ORDER BY completed_at DESC
        `;
        result = await pool.query(query, dateParams);
      } else if (hasOrderAssignments) {
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
        result = await pool.query(query, dateParams);
      } else {
        // Aucune colonne driver et pas de table order_assignments => retourner résultat vide
        logger.warn(`⚠️ Impossible de calculer les revenus: ni colonne driver dans orders, ni table order_assignments pour userId ${userId}`);
        result = { rows: [] };
      }
    } catch (queryError) {
      logger.error('❌ Erreur requête getDriverRevenues:', queryError);
      // En cas d'erreur SQL, retourner un résultat vide plutôt que planter
      result = { rows: [] };
    }
    
    // Calculer les statistiques
    const totalEarnings = result.rows.reduce((sum, order) => sum + (Number(order.price) || 0), 0);
    const totalDeliveries = result.rows.length;
    const totalDistance = result.rows.reduce((sum, order) => sum + (Number(order.distance) || 0), 0);
    
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
  } catch (error) {
    console.error('❌ Erreur getDriverRevenues:', error);
    
    // Si c'est une erreur de connexion DB, retourner un résultat vide plutôt qu'une erreur
    if (error.message && (error.message.includes('SASL') || error.message.includes('password'))) {
      console.warn('⚠️ Erreur de connexion DB (peut-être non configurée), retour de données vides');
      return res.json({
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
export const getOnlineDrivers = async (req, res) => {
  try {
    const { latitude, longitude, radius = 10 } = req.query;

    console.log('🔍 Récupération chauffeurs online:', {
      userPosition: latitude && longitude ? `${latitude}, ${longitude}` : 'Non fournie',
      radius: `${radius}km`
    });

    console.log(`💾 État mémoire actuelle: ${realDriverStatuses.size} chauffeurs stockés`);
    if (realDriverStatuses.size > 0) {
      console.log(`📋 Chauffeurs en mémoire:`, Array.from(realDriverStatuses.entries()).map(([id, data]) => ({
        id: id.substring(0, 8) + '...',
        online: data.is_online,
        position: data.current_latitude ? 'Oui' : 'Non'
      })));
    }

    // � Combiner données de test + données réelles
    const allDrivers = [];

    // 1️⃣ Ajouter les chauffeurs de test (DÉSACTIVÉ pour voir seulement les vrais)
    // allDrivers.push(...mockDrivers);

    // 2️⃣ Nettoyer d'abord les chauffeurs offline de la Map avant de récupérer
    const offlineDrivers = [];
    for (const [userId, driverData] of realDriverStatuses.entries()) {
      if (driverData.is_online === false) {
        offlineDrivers.push(userId);
        console.log(`🗑️ Suppression immédiate chauffeur offline : ${userId}`);
      }
    }
    // Supprimer immédiatement les chauffeurs offline
    offlineDrivers.forEach(userId => {
      realDriverStatuses.delete(userId);
    });

    // 3️⃣ Ajouter SEULEMENT les chauffeurs réels qui sont online (vérification STRICTE)
    for (const [userId, driverData] of realDriverStatuses.entries()) {
      console.log(`🔍 Vérification chauffeur ${userId}:`, { 
        is_online: driverData.is_online, 
        position: driverData.current_latitude ? `${driverData.current_latitude}, ${driverData.current_longitude}` : 'Non fournie' 
      });
      
      // 🔍 Vérification STRICTE : seulement si is_online === true (pas undefined, pas null, pas autre chose)
      // ET vérifier que la valeur n'est pas falsy (strictement true)
      if (driverData.is_online === true && driverData.is_online !== false && driverData.is_online !== undefined && driverData.is_online !== null) {
        // 🔧 VERSION SIMPLIFIÉE - Pas de Supabase pour éviter les erreurs de connexion
        console.log(`✅ Livreur online détecté : ${userId}`);
        
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
          rating: 4.5,
          total_deliveries: 0
        };
        
        allDrivers.push(driverProfile);
        console.log(`➕ Livreur ajouté:`, driverProfile.first_name, driverProfile.last_name);
      } else {
        // Log si un chauffeur est trouvé mais offline pour debug
        if (driverData.is_online === false || driverData.is_online === undefined || driverData.is_online === null) {
          console.log(`⚠️ Chauffeur offline/undefined ignoré et retiré : ${userId} (is_online: ${driverData.is_online})`);
          // Supprimer immédiatement si offline
          realDriverStatuses.delete(userId);
        }
      }
    }

    // 4️⃣ Filtrer seulement les chauffeurs online (triple vérification stricte)
    const onlineDrivers = allDrivers.filter(driver => {
      const isOnline = driver.is_online === true && driver.is_online !== false && driver.is_online !== undefined && driver.is_online !== null;
      if (!isOnline) {
        console.log(`⚠️ Chauffeur filtré côté backend (pas strictement online): ${driver.user_id} (is_online: ${driver.is_online})`);
      }
      return isOnline;
    });

    console.log(`✅ ${onlineDrivers.length} chauffeurs online trouvés (${onlineDrivers.length} réels uniquement)`);

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

  } catch (error) {
    console.error('❌ Erreur getOnlineDrivers:', error);
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
export const getDriverDetails = async (req, res) => {
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
        rating,
        total_deliveries,
        completed_deliveries,
        profile_image_url
      `)
      .eq('user_id', driverId)
      .single();

    if (error || !driver) {
      return res.status(404).json({
        success: false,
        message: 'Chauffeur non trouvé'
      });
    }

    res.json({
      success: true,
      message: 'Détails chauffeur récupérés',
      data: driver
    });

  } catch (error) {
    console.error('❌ Erreur getDriverDetails:', error);
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
export const getDriverStatistics = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'userId est requis'
      });
    }

    // Vérifier que la connexion DB est configurée
    if (!process.env.DATABASE_URL) {
      logger.warn('⚠️ DATABASE_URL non configuré pour getDriverStatistics');
      return res.json({
        success: true,
        data: {
          completedDeliveries: 0,
          averageRating: 5.0
        }
      });
    }

    try {
      // Compter les livraisons complétées (status = 'completed')
      // Vérifier d'abord les colonnes disponibles
      const columnsInfo = await pool.query(
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

      let completedDeliveries = 0;

      if (driverColumn) {
        // Compter via la colonne driver dans orders
        const deliveriesResult = await pool.query(
          `SELECT COUNT(*) as count FROM orders 
           WHERE ${driverColumn} = $1 AND status = 'completed'`,
          [userId]
        );
        completedDeliveries = parseInt(deliveriesResult.rows[0]?.count || 0);
      } else {
        // Essayer avec order_assignments
        try {
          const tableCheck = await pool.query(
            `SELECT EXISTS (
              SELECT FROM information_schema.tables
              WHERE table_schema = 'public'
              AND table_name = 'order_assignments'
            )`
          );
          const hasOrderAssignments = tableCheck.rows[0]?.exists === true;

          if (hasOrderAssignments) {
            const deliveriesResult = await pool.query(
              `SELECT COUNT(DISTINCT o.id) as count 
               FROM orders o
               INNER JOIN order_assignments oa ON oa.order_id = o.id
               WHERE oa.driver_id = $1 AND o.status = 'completed'`,
              [userId]
            );
            completedDeliveries = parseInt(deliveriesResult.rows[0]?.count || 0);
          }
        } catch (err) {
          logger.warn('⚠️ Erreur vérification order_assignments pour getDriverStatistics:', err.message);
        }
      }

      // Récupérer la note moyenne depuis driver_profiles (ou calculer depuis les évaluations si disponible)
      // Pour l'instant, on retourne 5.0 par défaut si aucune note n'est trouvée
      let averageRating = 5.0;
      try {
        const { data: driverProfile, error: profileError } = await supabase
          .from('driver_profiles')
          .select('rating')
          .eq('user_id', userId)
          .single();

        if (!profileError && driverProfile && driverProfile.rating != null) {
          averageRating = parseFloat(driverProfile.rating) || 5.0;
        }
      } catch (err) {
        logger.warn('⚠️ Erreur récupération rating depuis driver_profiles:', err.message);
      }

      res.json({
        success: true,
        data: {
          completedDeliveries,
          averageRating: parseFloat(averageRating.toFixed(1))
        }
      });
    } catch (queryError) {
      logger.error('❌ Erreur requête getDriverStatistics:', queryError);
      // En cas d'erreur SQL, retourner un résultat vide plutôt que planter
      return res.json({
        success: true,
        data: {
          completedDeliveries: 0,
          averageRating: 5.0
        }
      });
    }
  } catch (error) {
    logger.error('❌ Erreur getDriverStatistics:', error);
    // Retourner un résultat vide en cas d'erreur pour éviter de crasher l'app
    return res.json({
      success: true,
      data: {
        completedDeliveries: 0,
        averageRating: 5.0
      }
    });
  }
};