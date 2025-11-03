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

    console.log('🔍 DÉBUT getDriverRevenues pour userId:', userId, 'period:', period);

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
    
    // Vérifier d'abord TOUTES les commandes completed
    const allCompletedQuery = await pool.query(
      `SELECT COUNT(*) as count FROM orders WHERE status = 'completed'`
    );
    const allCompletedCount = parseInt(allCompletedQuery.rows[0]?.count || 0);
    console.log('📊 Total commandes completed (sans filtre):', allCompletedCount);

    // Calculer les dates selon la période
    let queryDate = '';
    let dateParams = [];
    
    console.log('📅 Calcul des dates - period:', period, 'startDate:', startDate, 'endDate:', endDate);
    
    if (startDate && endDate) {
      queryDate = 'AND completed_at >= $2 AND completed_at <= $3';
      dateParams = [userId, startDate, endDate];
      console.log('📅 Utilisation dates personnalisées:', startDate, 'à', endDate);
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
          console.log('📅 Période: all - pas de filtre de date');
          break;
      }
      
      if (period !== 'all') {
        queryDate = 'AND completed_at >= $2 AND completed_at <= $3';
        dateParams = [userId, start.toISOString(), now.toISOString()];
        console.log('📅 Filtre date:', start.toISOString(), 'à', now.toISOString());
      }
    }
    
    console.log('📅 queryDate:', queryDate);
    console.log('📅 dateParams:', dateParams);

    // Lister TOUTES les colonnes de orders pour debug
    const allColumnsResult = await pool.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'orders'
       ORDER BY ordinal_position`
    );
    const allColumns = allColumnsResult.rows.map(row => row.column_name);
    console.log('📋 Colonnes disponibles dans orders:', allColumns.join(', '));

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

    console.log('💰 Colonne de prix trouvée:', priceColumn);

    if (!priceColumn) {
      throw new Error("La colonne 'price' (ou 'price_cfa') est absente de la table orders. Exécutez les migrations.");
    }

    const distanceColumn = columnSet.has('distance_km')
      ? 'distance_km'
      : columnSet.has('distance')
        ? 'distance'
        : null;

    const distanceSelect = distanceColumn ? distanceColumn : 'NULL::numeric';
    console.log('📏 Colonne de distance trouvée:', distanceColumn);

    const driverColumn = columnSet.has('driver_id')
      ? 'driver_id'
      : columnSet.has('driver_uuid')
        ? 'driver_uuid'
        : null;

    console.log('🔑 Colonne driver trouvée:', driverColumn);

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
        console.log('📋 Table order_assignments existe:', hasOrderAssignments);
      } catch (err) {
        logger.warn('⚠️ Erreur vérification order_assignments:', err.message);
      }
    }
    
    // Vérifier quelques commandes completed pour debug
    const sampleQuery = await pool.query(
      `SELECT id, status, ${driverColumn || 'NULL as driver_id'}, ${priceColumn}, completed_at 
       FROM orders 
       WHERE status = 'completed' 
       LIMIT 5`
    );
    console.log('📋 Exemple de commandes completed:', JSON.stringify(sampleQuery.rows, null, 2));

    // Récupérer les commandes terminées du chauffeur
    let query, result;
    try {
      if (driverColumn) {
        console.log(`🔍 Requête avec ${driverColumn} pour userId:`, userId);
        // Vérifier d'abord combien de commandes completed ont un driver_id défini
        const withDriverQuery = await pool.query(
          `SELECT COUNT(*) as count FROM orders 
           WHERE ${driverColumn} IS NOT NULL AND status = 'completed'`
        );
        const withDriverCount = parseInt(withDriverQuery.rows[0]?.count || 0);
        console.log(`📊 Commandes completed avec ${driverColumn} défini:`, withDriverCount);
        
        // Compter pour ce livreur spécifique
        const forThisDriverQuery = await pool.query(
          `SELECT COUNT(*) as count FROM orders 
           WHERE ${driverColumn} = $1 AND status = 'completed'`,
          [userId]
        );
        const forThisDriverCount = parseInt(forThisDriverQuery.rows[0]?.count || 0);
        console.log(`📊 Commandes completed pour ce livreur (${userId}):`, forThisDriverCount);
        
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
        console.log('✅ Résultat requête avec driverColumn:', result.rows.length, 'lignes');
      } else if (hasOrderAssignments) {
        console.log('🔍 Requête via order_assignments pour userId:', userId);
        // Compter les commandes via order_assignments
        const viaAssignmentsQuery = await pool.query(
          `SELECT COUNT(DISTINCT o.id) as count 
           FROM orders o
           INNER JOIN order_assignments oa ON oa.order_id = o.id
           WHERE oa.driver_id = $1 AND o.status = 'completed'`,
          [userId]
        );
        const viaAssignmentsCount = parseInt(viaAssignmentsQuery.rows[0]?.count || 0);
        console.log('📊 Commandes completed via order_assignments:', viaAssignmentsCount);
        
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
        console.log('✅ Résultat requête via order_assignments:', result.rows.length, 'lignes');
      } else {
        // Aucune colonne driver et pas de table order_assignments => retourner résultat vide
        console.log('❌ Impossible de calculer les revenus: ni driver_id, ni order_assignments');
        logger.warn(`⚠️ Impossible de calculer les revenus: ni colonne driver dans orders, ni table order_assignments pour userId ${userId}`);
        result = { rows: [] };
      }
    } catch (queryError) {
      console.error('❌ Erreur requête getDriverRevenues:', queryError);
      logger.error('❌ Erreur requête getDriverRevenues:', queryError);
      // En cas d'erreur SQL, retourner un résultat vide plutôt que planter
      result = { rows: [] };
    }
    
    // Calculer les statistiques
    const totalEarnings = result.rows.reduce((sum, order) => sum + (Number(order.price) || 0), 0);
    const totalDeliveries = result.rows.length;
    const totalDistance = result.rows.reduce((sum, order) => sum + (Number(order.distance) || 0), 0);
    
    console.log('💰 Résultats finaux getDriverRevenues:');
    console.log('   - Total livraisons:', totalDeliveries);
    console.log('   - Total gains:', totalEarnings, 'FCFA');
    console.log('   - Total distance:', totalDistance, 'km');
    console.log('   - Période:', period);
    
    // Log des détails des commandes récupérées
    if (result.rows.length > 0) {
      console.log('📦 Détails des commandes récupérées:');
      result.rows.slice(0, 3).forEach((order, index) => {
        console.log(`   ${index + 1}. Order ${order.id.slice(0, 8)}: ${order.price} FCFA, méthode: ${order.delivery_method}, distance: ${order.distance} km`);
      });
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
          averageRating: 5.0,
          totalEarnings: 0
        }
      });
    }

    try {
      console.log('🔍 DÉBUT getDriverStatistics pour userId:', userId);
      
      // Lister TOUTES les colonnes de la table orders pour debug
      const allColumnsResult = await pool.query(
        `SELECT column_name FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = 'orders'
         ORDER BY ordinal_position`
      );
      const allColumns = allColumnsResult.rows.map(row => row.column_name);
      console.log('📋 Colonnes disponibles dans orders:', allColumns.join(', '));
      logger.info(`📋 Colonnes disponibles dans orders: ${allColumns.join(', ')}`);
      
      // Compter TOUTES les commandes completed d'abord
      const allCompletedQuery = await pool.query(
        `SELECT COUNT(*) as count FROM orders WHERE status = 'completed'`
      );
      const allCompletedCount = parseInt(allCompletedQuery.rows[0]?.count || 0);
      console.log('📊 Total commandes completed (sans filtre):', allCompletedCount);
      
      // Vérifier la colonne driver_id dans orders
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
      
      console.log('🔑 Colonne driver trouvée:', driverColumn);

      let completedDeliveries = 0;

      // Vérifier d'abord toutes les commandes completed avec leur driver_id (ou NULL)
      const checkCompletedQuery = await pool.query(
        `SELECT id, status, ${driverColumn || 'NULL as driver_id'}, price_cfa 
         FROM orders 
         WHERE status = 'completed' 
         LIMIT 10`
      );
      console.log('📋 Exemple de commandes completed:', JSON.stringify(checkCompletedQuery.rows, null, 2));
      
      if (!driverColumn) {
        console.log('❌ Colonne driver_id/driver_uuid non trouvée dans orders');
        logger.warn(`⚠️ Colonne driver_id/driver_uuid non trouvée dans orders. Essai avec order_assignments...`);
        
        // Vérifier si order_assignments existe
        const tableCheck = await pool.query(
          `SELECT EXISTS (
            SELECT FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name = 'order_assignments'
          )`
        );
        const hasOrderAssignments = tableCheck.rows[0]?.exists === true;
        console.log('📋 Table order_assignments existe:', hasOrderAssignments);
        
        if (hasOrderAssignments) {
          // Compter via order_assignments
          const deliveriesResult = await pool.query(
            `SELECT COUNT(DISTINCT o.id) as count 
             FROM orders o
             INNER JOIN order_assignments oa ON oa.order_id = o.id
             WHERE oa.driver_id = $1 AND o.status = 'completed'`,
            [userId]
          );
          completedDeliveries = parseInt(deliveriesResult.rows[0]?.count || 0);
          console.log('📊 Commandes completed via order_assignments:', completedDeliveries);
          logger.info(`📊 Commandes completed via order_assignments pour ${userId}: ${completedDeliveries}`);
        } else {
          console.log('❌ Table order_assignments n\'existe pas');
          logger.warn(`⚠️ Table order_assignments n'existe pas non plus. Impossible de compter les livraisons.`);
        }
      } else {
        // Compter directement depuis orders avec driver_id
        // Vérifier les commandes avec driver_id défini (peu importe quel driver)
        const withDriverResult = await pool.query(
          `SELECT COUNT(*) as count FROM orders WHERE ${driverColumn} IS NOT NULL AND status = 'completed'`
        );
        const withDriver = parseInt(withDriverResult.rows[0]?.count || 0);
        console.log(`📊 Commandes completed avec ${driverColumn} défini:`, withDriver);
        
        // Compter pour ce livreur spécifique
        const deliveriesResult = await pool.query(
          `SELECT COUNT(*) as count FROM orders 
           WHERE ${driverColumn} = $1 AND status = 'completed'`,
          [userId]
        );
        completedDeliveries = parseInt(deliveriesResult.rows[0]?.count || 0);
        console.log(`📊 Commandes completed pour ce livreur (${userId}):`, completedDeliveries);
        
        logger.info(`📊 Debug getDriverStatistics pour ${userId}:`);
        logger.info(`   - Total commandes completed: ${allCompletedCount}`);
        logger.info(`   - Commandes completed avec ${driverColumn} défini: ${withDriver}`);
        logger.info(`   - Commandes completed pour ce livreur: ${completedDeliveries}`);
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

      // Calculer les gains totaux : somme de price_cfa pour toutes les commandes completed
      let totalEarnings = 0;
      try {
        // Détecter la colonne de prix
        const priceColumnsInfo = await pool.query(
          `SELECT column_name FROM information_schema.columns
           WHERE table_schema = 'public'
             AND table_name = 'orders'
             AND column_name = ANY($1)`,
          [['price_cfa', 'price']]
        );
        const priceColumnSet = new Set(priceColumnsInfo.rows.map((row) => row.column_name));
        const priceColumn = priceColumnSet.has('price_cfa') ? 'price_cfa' : priceColumnSet.has('price') ? 'price' : null;

        if (priceColumn) {
          console.log('💰 Colonne de prix trouvée:', priceColumn);
          
          // D'abord, vérifier la somme totale de toutes les commandes completed
          const allEarningsQuery = await pool.query(
            `SELECT COALESCE(SUM(${priceColumn}), 0) as total 
             FROM orders 
             WHERE status = 'completed'`
          );
          const allEarningsTotal = parseFloat(allEarningsQuery.rows[0]?.total || 0);
          console.log('💰 Total gains toutes commandes completed (sans filtre):', allEarningsTotal, 'FCFA');
          
          if (driverColumn) {
            // Calculer depuis orders avec driver_id
            const withDriverEarningsQuery = await pool.query(
              `SELECT COALESCE(SUM(${priceColumn}), 0) as total 
               FROM orders 
               WHERE ${driverColumn} IS NOT NULL AND status = 'completed'`
            );
            const withDriverEarnings = parseFloat(withDriverEarningsQuery.rows[0]?.total || 0);
            console.log(`💰 Total gains commandes completed avec ${driverColumn}:`, withDriverEarnings, 'FCFA');
            
            const earningsResult = await pool.query(
              `SELECT COALESCE(SUM(${priceColumn}), 0) as total 
               FROM orders 
               WHERE ${driverColumn} = $1 AND status = 'completed'`,
              [userId]
            );
            totalEarnings = parseFloat(earningsResult.rows[0]?.total || 0);
            console.log(`💰 Gains pour ce livreur (${userId}):`, totalEarnings, 'FCFA');
            
            logger.info(`📊 Debug gains pour ${userId}:`);
            logger.info(`   - Total gains toutes commandes completed: ${allEarningsTotal} FCFA`);
            logger.info(`   - Total gains commandes completed avec ${driverColumn}: ${withDriverEarnings} FCFA`);
            logger.info(`   - Gains pour ce livreur: ${totalEarnings} FCFA (${priceColumn})`);
          } else {
            // Si pas de driver_id, essayer avec order_assignments
            const tableCheck = await pool.query(
              `SELECT EXISTS (
                SELECT FROM information_schema.tables
                WHERE table_schema = 'public'
                AND table_name = 'order_assignments'
              )`
            );
            const hasOrderAssignments = tableCheck.rows[0]?.exists === true;
            
            if (hasOrderAssignments) {
              const earningsResult = await pool.query(
                `SELECT COALESCE(SUM(o.${priceColumn}), 0) as total 
                 FROM orders o
                 INNER JOIN order_assignments oa ON oa.order_id = o.id
                 WHERE oa.driver_id = $1 AND o.status = 'completed'`,
                [userId]
              );
              totalEarnings = parseFloat(earningsResult.rows[0]?.total || 0);
              console.log('💰 Gains calculés via order_assignments:', totalEarnings, 'FCFA');
              logger.info(`📊 Gains calculés via order_assignments pour ${userId}: ${totalEarnings} FCFA`);
            } else {
              console.log('❌ Impossible de calculer gains: pas de driver_id et pas de order_assignments');
              logger.warn(`⚠️ Impossible de calculer gains: pas de driver_id dans orders et pas de order_assignments`);
            }
          }
        } else {
          console.log('❌ Colonne de prix (price_cfa/price) non trouvée');
          logger.warn(`⚠️ Colonne de prix (price_cfa/price) non trouvée dans orders`);
        }
        
        console.log('✅ FIN getDriverStatistics - Livraisons:', completedDeliveries, 'Gains:', totalEarnings);
      } catch (err) {
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
    } catch (queryError) {
      logger.error('❌ Erreur requête getDriverStatistics:', queryError);
      // En cas d'erreur SQL, retourner un résultat vide plutôt que planter
      return res.json({
        success: true,
        data: {
          completedDeliveries: 0,
          averageRating: 5.0,
          totalEarnings: 0
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
        averageRating: 5.0,
        totalEarnings: 0
      }
    });
  }
};