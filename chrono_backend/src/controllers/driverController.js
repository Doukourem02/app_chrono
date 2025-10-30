import { supabase } from '../config/supabase.js';

/**
 * 🚗 GESTION DES CHAUFFEURS - Online/Offline et Géolocalisation
 */

// 💾 Stockage en mémoire des statuts réels des chauffeurs
const realDriverStatuses = new Map();

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
      // Si offline, automatiquement indisponible
      if (!is_online) {
        updatedDriver.is_available = false;
      }
    }

    if (typeof is_available === 'boolean' && is_online !== false) {
      updatedDriver.is_available = is_available;
    }

    if (current_latitude && current_longitude) {
      updatedDriver.current_latitude = parseFloat(current_latitude);
      updatedDriver.current_longitude = parseFloat(current_longitude);
    }

    // Sauvegarder en mémoire
    realDriverStatuses.set(userId, updatedDriver);
    
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

    // 2️⃣ Ajouter SEULEMENT les chauffeurs réels qui sont online
    for (const [userId, driverData] of realDriverStatuses.entries()) {
      console.log(`🔍 Vérification chauffeur ${userId}:`, { 
        is_online: driverData.is_online, 
        position: driverData.current_latitude ? `${driverData.current_latitude}, ${driverData.current_longitude}` : 'Non fournie' 
      });
      
      if (driverData.is_online) {
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
          is_online: driverData.is_online,
          is_available: driverData.is_available,
          rating: 4.5,
          total_deliveries: 0
        };
        
        allDrivers.push(driverProfile);
        console.log(`➕ Livreur ajouté:`, driverProfile.first_name, driverProfile.last_name);
      }
    }

    // 3️⃣ Filtrer seulement les chauffeurs online
    const onlineDrivers = allDrivers.filter(driver => driver.is_online);

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