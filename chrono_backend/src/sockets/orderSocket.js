import { v4 as uuidv4 } from 'uuid';

// Store en mémoire pour les commandes actives
const activeOrders = new Map();
const connectedDrivers = new Map(); // driverId -> socketId
const connectedUsers = new Map(); // userId -> socketId

// Fonction pour calculer la distance entre deux points
function getDistanceInKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Rayon de la Terre en km
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRadians(degrees) {
  return degrees * (Math.PI / 180);
}

// Fonction pour calculer le prix basé sur la distance et la méthode
function calculatePrice(distance, method) {
  const basePrices = {
    moto: { base: 500, perKm: 200 },
    vehicule: { base: 800, perKm: 300 },
    cargo: { base: 1200, perKm: 450 }
  };
  
  const pricing = basePrices[method] || basePrices.vehicule;
  return Math.round(pricing.base + (distance * pricing.perKm));
}

// Fonction pour estimer la durée
function estimateDuration(distance, method) {
  const avgSpeeds = {
    moto: 25, // km/h en ville
    vehicule: 20,
    cargo: 18
  };
  
  const speed = avgSpeeds[method] || avgSpeeds.vehicule;
  const durationHours = distance / speed;
  const minutes = Math.round(durationHours * 60);
  
  if (minutes < 60) {
    return `${minutes} min`;
  } else {
    const hours = Math.floor(minutes / 60);
    const remainingMin = minutes % 60;
    return `${hours}h ${remainingMin}min`;
  }
}

// Fonction pour trouver les chauffeurs proches disponibles
async function findNearbyDrivers(pickupCoords, deliveryMethod, maxDistance = 10) {
  // Import dynamique pour éviter les problèmes de dépendances circulaires
  const { realDriverStatuses } = await import('../controllers/driverController.js');
  const nearbyDrivers = [];
  
  for (const [driverId, driverData] of realDriverStatuses.entries()) {
    if (!driverData.is_online || !driverData.is_available) continue;
    if (!driverData.current_latitude || !driverData.current_longitude) continue;
    
    const distance = getDistanceInKm(
      pickupCoords.latitude,
      pickupCoords.longitude,
      driverData.current_latitude,
      driverData.current_longitude
    );
    
    if (distance <= maxDistance) {
      nearbyDrivers.push({
        driverId,
        distance,
        ...driverData
      });
    }
  }
  
  // Trier par distance
  return nearbyDrivers.sort((a, b) => a.distance - b.distance);
}

const setupOrderSocket = (io) => {
  io.on('connection', (socket) => {
    console.log(`🔌 Nouvelle connexion Socket: ${socket.id}`);
    
    // 📱 Enregistrement d'un driver
    socket.on('driver-connect', (driverId) => {
      connectedDrivers.set(driverId, socket.id);
      socket.driverId = driverId;
      console.log(`🚗 Driver connecté: ${driverId}`);
    });
    
    // 👤 Enregistrement d'un user
    socket.on('user-connect', (userId) => {
      connectedUsers.set(userId, socket.id);
      socket.userId = userId;
      console.log(`👤 User connecté: ${userId}`);
    });
    
    // 📦 Nouvelle commande depuis un user
    socket.on('create-order', async (orderData) => {
      try {
        console.log(`📦 Nouvelle commande de ${socket.userId}:`, orderData);

        const {
          pickup,
          dropoff,
          deliveryMethod,
          userId,
          userInfo
        } = orderData;

        // Vérifications minimales
        if (!pickup || !dropoff || !pickup.coordinates || !dropoff.coordinates) {
          socket.emit('order-error', { success: false, message: 'Coordinates manquantes' });
          return;
        }

        // Calculer distance et prix
        const distance = getDistanceInKm(
          pickup.coordinates.latitude,
          pickup.coordinates.longitude,
          dropoff.coordinates.latitude,
          dropoff.coordinates.longitude
        );

        const price = calculatePrice(distance, deliveryMethod);
        const estimatedDuration = estimateDuration(distance, deliveryMethod);

        // Créer la commande
        const order = {
          id: uuidv4(),
          user: {
            id: userId,
            name: userInfo?.name || 'Client',
            avatar: userInfo?.avatar,
            rating: userInfo?.rating || 4.5,
            phone: userInfo?.phone
          },
          pickup,
          dropoff,
          price,
          deliveryMethod,
          distance: Math.round(distance * 100) / 100,
          estimatedDuration,
          status: 'pending',
          createdAt: new Date(),
        };

        // Stocker la commande
        activeOrders.set(order.id, order);

        // Confirmer la création au user
        socket.emit('order-created', {
          success: true,
          order,
          message: 'Commande créée, recherche de chauffeur...'
        });

        // Chercher des chauffeurs proches
        const nearbyDrivers = await findNearbyDrivers(pickup.coordinates, deliveryMethod);

        if (nearbyDrivers.length === 0) {
          console.log(`❌ Aucun chauffeur disponible dans la zone pour la commande ${order.id}`);
          socket.emit('no-drivers-available', {
            orderId: order.id,
            message: 'Aucun chauffeur disponible dans votre zone'
          });
          return;
        }

        console.log(`🔍 ${nearbyDrivers.length} chauffeurs trouvés pour la commande ${order.id}`);

        // Envoyer la commande aux chauffeurs proches (un par un)
        let driverIndex = 0;
        const tryNextDriver = () => {
          if (driverIndex >= nearbyDrivers.length) {
            console.log(`❌ Tous les chauffeurs sont occupés pour la commande ${order.id}`);
            socket.emit('no-drivers-available', {
              orderId: order.id,
              message: 'Tous les chauffeurs sont occupés'
            });
            activeOrders.delete(order.id);
            return;
          }

          const driver = nearbyDrivers[driverIndex];
          const driverSocketId = connectedDrivers.get(driver.driverId);

          if (driverSocketId) {
            console.log(`📤 Envoi commande à driver ${driver.driverId} (socket: ${driverSocketId})`);
            io.to(driverSocketId).emit('new-order-request', order);

            // Timer d'attente (20 secondes)
            setTimeout(() => {
              const currentOrder = activeOrders.get(order.id);
              if (currentOrder && currentOrder.status === 'pending') {
                console.log(`⏰ Timeout driver ${driver.driverId} pour commande ${order.id}`);
                driverIndex++;
                tryNextDriver();
              }
            }, 20000);
          } else {
            // Driver pas connecté, essayer le suivant
            console.log(`⚠️ Chauffeur ${driver.driverId} trouvé mais socket non connecté.`);
            driverIndex++;
            tryNextDriver();
          }
        };

        // Commencer par le premier driver
        tryNextDriver();

      } catch (error) {
        console.error('❌ Erreur création commande:', error);
        socket.emit('order-error', {
          success: false,
          message: 'Erreur lors de la création de la commande'
        });
      }
    });

    // ✅ Driver accepte une commande
    socket.on('accept-order', (data) => {
      const { orderId, driverId } = data;
      const order = activeOrders.get(orderId);

      if (!order) {
        socket.emit('order-not-found', { orderId });
        return;
      }

      if (order.status !== 'pending') {
        socket.emit('order-already-taken', { orderId });
        return;
      }

      // Mettre à jour la commande
      order.status = 'accepted';
      order.driverId = driverId;
      order.acceptedAt = new Date();

      console.log(`✅ Commande ${orderId} acceptée par driver ${driverId}`);

      // Confirmer au driver
      socket.emit('order-accepted-confirmation', {
        success: true,
        order,
        message: 'Commande acceptée avec succès'
      });

      // Notifier le user
      const userSocketId = connectedUsers.get(order.user.id);
      if (userSocketId) {
        // Tenter d'enrichir driverInfo avec les données en mémoire si disponibles
        (async () => {
          try {
            const { realDriverStatuses } = await import('../controllers/driverController.js');
            const driverData = realDriverStatuses.get(driverId) || {};

            const driverInfo = {
              id: driverId,
              first_name: driverData.first_name || 'Livreur',
              last_name: driverData.last_name || driverId?.substring(0, 8) || null,
              current_latitude: driverData.current_latitude || null,
              current_longitude: driverData.current_longitude || null,
              phone: driverData.phone || null,
              profile_image_url: driverData.profile_image_url || null,
            };

            io.to(userSocketId).emit('order-accepted', {
              order,
              driverInfo
            });
          } catch (err) {
            // Fallback basique si l'import échoue
            io.to(userSocketId).emit('order-accepted', {
              order,
              driverInfo: { id: driverId }
            });
          }
        })();
      }
    });

    // ❌ Driver décline une commande
    socket.on('decline-order', (data) => {
      const { orderId, driverId } = data;
      const order = activeOrders.get(orderId);

      if (!order) {
        socket.emit('order-not-found', { orderId });
        return;
      }

      console.log(`❌ Commande ${orderId} déclinée par driver ${driverId}`);

      // Confirmer au driver
      socket.emit('order-declined-confirmation', {
        success: true,
        orderId,
        message: 'Commande déclinée'
      });

      // La logique pour essayer le driver suivant est gérée par le timer côté create-order
    });
    
    // 🚛 Driver met à jour le statut de livraison
    socket.on('update-delivery-status', (data) => {
      const { orderId, status, location } = data;
      const order = activeOrders.get(orderId);
      
      if (!order) {
        socket.emit('order-not-found', { orderId });
        return;
      }
      
      order.status = status;
      if (status === 'completed') {
        order.completedAt = new Date();
      }
      
      console.log(`🚛 Statut livraison ${orderId}: ${status}`);
      
      // Notifier le user
      const userSocketId = connectedUsers.get(order.user.id);
      if (userSocketId) {
        io.to(userSocketId).emit('delivery-status-update', {
          order,
          location
        });
      }
      
      // Si terminé, supprimer de la mémoire après un délai
      if (status === 'completed') {
        setTimeout(() => {
          activeOrders.delete(orderId);
          console.log(`🗑️ Commande ${orderId} supprimée du cache`);
        }, 300000); // 5 minutes
      }
    });
    
    // 🔌 Déconnexion
    socket.on('disconnect', () => {
      console.log(`🔌 Déconnexion Socket: ${socket.id}`);
      
      // Nettoyer les maps
      if (socket.driverId) {
        connectedDrivers.delete(socket.driverId);
        console.log(`🚗 Driver déconnecté: ${socket.driverId}`);
      }
      
      if (socket.userId) {
        connectedUsers.delete(socket.userId);
        console.log(`👤 User déconnecté: ${socket.userId}`);
      }
    });
  });
};

export {
  setupOrderSocket,
  activeOrders,
  connectedDrivers,
  connectedUsers,
  calculatePrice,
  estimateDuration,
  findNearbyDrivers
};