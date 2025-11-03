import { v4 as uuidv4 } from 'uuid';
import {
  saveOrder,
  updateOrderStatus as updateOrderStatusDB,
  saveDeliveryProofRecord,
  recordOrderAssignment,
} from '../config/orderStorage.js';

// Store en mémoire pour les commandes actives (cache)
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
  const DEBUG = process.env.DEBUG_SOCKETS === 'true';

  io.on('connection', (socket) => {
    if (DEBUG) console.log(`🔌 Nouvelle connexion Socket: ${socket.id}`);
    
    // 📱 Enregistrement d'un driver
    socket.on('driver-connect', (driverId) => {
      connectedDrivers.set(driverId, socket.id);
      socket.driverId = driverId;
      if (DEBUG) console.log(`🚗 Driver connecté: ${driverId}`);
    });
    
    // 👤 Enregistrement d'un user
    socket.on('user-connect', (userId) => {
      connectedUsers.set(userId, socket.id);
      socket.userId = userId;
      if (DEBUG) console.log(`👤 User connecté: ${userId}`);
    });
    
    // 📦 Nouvelle commande depuis un user
    // Create-order now supports an acknowledgement callback from the client
    // so the client can know if the server accepted/created the order.
    socket.on('create-order', async (orderData, ack) => {
      try {
        if (DEBUG) console.log(`📦 Nouvelle commande de ${socket.userId}:`, orderData);

        const {
          pickup,
          dropoff,
          deliveryMethod,
          userId,
          userInfo,
          orderId: providedOrderId,
          price: providedPrice,
          distance: providedDistance,
          estimatedDuration: providedEta,
        } = orderData;

        // Vérifications minimales
        if (!pickup || !dropoff || !pickup.coordinates || !dropoff.coordinates) {
          socket.emit('order-error', { success: false, message: 'Coordinates manquantes' });
          return;
        }

        // Calculer distance et prix
        const rawDistance = providedDistance != null
          ? Number(providedDistance)
          : getDistanceInKm(
              pickup.coordinates.latitude,
              pickup.coordinates.longitude,
              dropoff.coordinates.latitude,
              dropoff.coordinates.longitude
            );

        const distance = Number.isFinite(rawDistance)
          ? Math.round(rawDistance * 100) / 100
          : 0;

        const price = providedPrice ?? calculatePrice(distance, deliveryMethod);
        const estimatedDuration = providedEta ?? estimateDuration(distance, deliveryMethod);

        // Créer la commande
        const order = {
          id: providedOrderId || uuidv4(),
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

        // Stocker la commande en mémoire (cache)
        activeOrders.set(order.id, order);
        
        // Sauvegarder en base de données (persistance)
        let dbSaved = false;
        let dbErrorMsg = null;
        try {
          await saveOrder(order);
          dbSaved = true;
          if (DEBUG) console.log(`💾 Commande ${order.id} sauvegardée en DB`);
        } catch (dbError) {
          dbSaved = false;
          dbErrorMsg = dbError && dbError.message ? dbError.message : String(dbError);
          console.warn(`⚠️ Échec sauvegarde DB pour ${order.id}:`, dbErrorMsg);
          // Continue même si la sauvegarde DB échoue (on garde en mémoire)
        }

        // Emit event to the user socket with DB persistence info
        io.to(socket.id).emit('order-created', {
          success: true,
          order,
          dbSaved,
          dbError: dbErrorMsg,
          message: 'Commande créée, recherche de chauffeur...'
        });

        // Acknowledge to the client (if provided) with DB info
        try {
          if (typeof ack === 'function') ack({ success: true, orderId: order.id, dbSaved, dbError: dbErrorMsg });
        } catch (e) {
          if (DEBUG) console.warn('Ack callback failed for create-order', e);
        }

        // Chercher des chauffeurs proches
        const nearbyDrivers = await findNearbyDrivers(pickup.coordinates, deliveryMethod);

        if (nearbyDrivers.length === 0) {
          if (DEBUG) console.log(`❌ Aucun chauffeur disponible dans la zone pour la commande ${order.id}`);
          io.to(socket.id).emit('no-drivers-available', {
            orderId: order.id,
            message: 'Aucun chauffeur disponible dans votre zone'
          });
          return;
        }

  if (DEBUG) console.log(`🔍 ${nearbyDrivers.length} chauffeurs trouvés pour la commande ${order.id}`);

        // Envoyer la commande aux chauffeurs proches (un par un)
        let driverIndex = 0;
        const tryNextDriver = async () => {
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
            const assignedAt = new Date();
            order.assignedAt = assignedAt;
            if (DEBUG) console.log(`📤 Envoi commande à driver ${driver.driverId} (socket: ${driverSocketId})`);

            // Persister l'affectation tentative
            await recordOrderAssignment(order.id, driver.driverId, { assignedAt }).catch(() => {});

            io.to(driverSocketId).emit('new-order-request', order);

            // Timer d'attente (20 secondes) pour passer au suivant
            setTimeout(async () => {
              const currentOrder = activeOrders.get(order.id);
              if (currentOrder && currentOrder.status === 'pending') {
                if (DEBUG) console.log(`⏰ Timeout driver ${driver.driverId} pour commande ${order.id}`);
                await recordOrderAssignment(order.id, driver.driverId, { declinedAt: new Date() }).catch(() => {});
                driverIndex++;
                tryNextDriver().catch(() => {});
              }
            }, 20000);
          } else {
            if (DEBUG) console.log(`⚠️ Chauffeur ${driver.driverId} trouvé mais socket non connecté.`);
            driverIndex++;
            tryNextDriver().catch(() => {});
          }
        };

        // Commencer par le premier driver
        tryNextDriver().catch(() => {});

      } catch (error) {
        console.error('❌ Erreur création commande:', error);
        socket.emit('order-error', {
          success: false,
          message: 'Erreur lors de la création de la commande'
        });
      }
    });

    // ✅ Driver accepte une commande
    socket.on('accept-order', async (data) => {
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
      
      // Sauvegarder en DB
      let dbSavedAssign = false;
      let dbErrorAssign = null;
      try {
        await updateOrderStatusDB(orderId, 'accepted', {
          driver_id: driverId,
          accepted_at: order.acceptedAt,
          assigned_at: order.assignedAt || order.createdAt,
        });
        dbSavedAssign = true;
        if (DEBUG) console.log(`💾 Statut commande ${orderId} mis à jour en DB`);
      } catch (dbError) {
        dbSavedAssign = false;
        dbErrorAssign = dbError && dbError.message ? dbError.message : String(dbError);
        console.warn(`⚠️ Échec mise à jour DB pour ${orderId}:`, dbErrorAssign);
      }

  if (DEBUG) console.log(`✅ Commande ${orderId} acceptée par driver ${driverId}`);

      // Confirmer au driver (inclure info persistance DB)
      socket.emit('order-accepted-confirmation', {
        success: true,
        order,
        dbSaved: dbSavedAssign,
        dbError: dbErrorAssign,
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
              driverInfo,
              dbSaved: dbSavedAssign,
              dbError: dbErrorAssign
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

  if (DEBUG) console.log(`❌ Commande ${orderId} déclinée par driver ${driverId}`);

      recordOrderAssignment(orderId, driverId, { declinedAt: new Date() }).catch(() => {});

      // Confirmer au driver
      socket.emit('order-declined-confirmation', {
        success: true,
        orderId,
        message: 'Commande déclinée'
      });

      // La logique pour essayer le driver suivant est gérée par le timer côté create-order
    });
    
    // 🚛 Driver met à jour le statut de livraison (socket)
    socket.on('update-delivery-status', async (data, ack) => {
      try {
        const { orderId, status, location } = data || {};
        const order = activeOrders.get(orderId);

        if (!order) {
          if (typeof ack === 'function') ack({ success: false, message: 'Order not found' });
          socket.emit('order-not-found', { orderId });
          return;
        }

        // Ensure the socket is an authenticated driver (we store driverId on socket on connect)
        const driverId = socket.driverId;
        if (!driverId) {
          if (typeof ack === 'function') ack({ success: false, message: 'Driver not authenticated on socket' });
          socket.emit('unauthorized', { message: 'Driver not authenticated' });
          return;
        }

        // Ensure driver is assigned to this order (if driverId exists on order)
        if (order.driverId && order.driverId !== driverId) {
          if (typeof ack === 'function') ack({ success: false, message: 'Driver not assigned to this order' });
          socket.emit('forbidden', { message: 'Driver not assigned to this order' });
          return;
        }

        // Allowed transitions
        const allowed = {
          pending: ['accepted', 'cancelled'],
          accepted: ['enroute', 'cancelled'],
          enroute: ['picked_up', 'cancelled'],
          picked_up: ['completed', 'cancelled'],
          completed: [],
          cancelled: []
        };

        const current = order.status || 'pending';
        if (current === status) {
          if (typeof ack === 'function') ack({ success: true, message: 'No-op: status already set', order });
          return;
        }

        if (!allowed[current] || !allowed[current].includes(status)) {
          if (typeof ack === 'function') ack({ success: false, message: `Invalid transition from ${current} to ${status}` });
          return;
        }

        // Apply transition
        order.status = status;
        if (status === 'completed') {
          order.completedAt = new Date();
        }
        
        // Sauvegarder en DB
        let dbSavedStatus = false;
        let dbErrorStatus = null;
        try {
          await updateOrderStatusDB(orderId, status, {
            driver_id: driverId,
            completed_at: status === 'completed' ? order.completedAt : undefined
          });
          dbSavedStatus = true;
          if (DEBUG) console.log(`💾 Statut commande ${orderId} mis à jour en DB`);
        } catch (dbError) {
          dbSavedStatus = false;
          dbErrorStatus = dbError && dbError.message ? dbError.message : String(dbError);
          console.warn(`⚠️ Échec mise à jour DB pour ${orderId}:`, dbErrorStatus);
        }

        if (DEBUG) console.log(`🚛 Statut livraison ${orderId}: ${status} par driver ${driverId}`);

        // Emit canonical event name for clients
        const userSocketId = connectedUsers.get(order.user.id);
        if (userSocketId) {
          io.to(userSocketId).emit('order:status:update', { order, location, dbSaved: dbSavedStatus, dbError: dbErrorStatus });
        }

        // Ack success (include dbSaved)
        if (typeof ack === 'function') ack({ success: true, order, dbSaved: dbSavedStatus, dbError: dbErrorStatus });

        // If completed, schedule removal
        if (status === 'completed') {
          setTimeout(() => {
            activeOrders.delete(orderId);
            if (DEBUG) console.log(`🗑️ Commande ${orderId} supprimée du cache`);
          }, 1000 * 60 * 5);
        }
      } catch (err) {
        if (DEBUG) console.error('Error in update-delivery-status socket handler', err);
        if (typeof ack === 'function') ack({ success: false, message: 'Server error' });
      }
    });

    // 🧾 Driver envoie une preuve (base64) via socket
    socket.on('send-proof', async (data, ack) => {
      try {
        const { orderId, proofBase64, proofType = 'image' } = data || {};

        if (!orderId || !proofBase64) {
          if (typeof ack === 'function') ack({ success: false, message: 'orderId and proofBase64 required' });
          return;
        }

        const order = activeOrders.get(orderId);
        if (!order) {
          if (typeof ack === 'function') ack({ success: false, message: 'Order not found' });
          return;
        }

        const driverId = socket.driverId;
        if (!driverId) {
          if (typeof ack === 'function') ack({ success: false, message: 'Driver not authenticated on socket' });
          return;
        }

        if (order.driverId && order.driverId !== driverId) {
          if (typeof ack === 'function') ack({ success: false, message: 'Driver not assigned to order' });
          return;
        }

        // Save proof metadata to DB
        let dbSavedProof = false;
        let dbErrorProof = null;
        try {
          const uploadedAt = new Date();
          const normalizedType = proofType === 'image' ? 'photo' : proofType;

          await saveDeliveryProofRecord({
            orderId,
            driverId,
            proofType: normalizedType,
            metadata: {
              received_from: 'socket',
              uploaded_at: uploadedAt.toISOString(),
              has_inline_proof: !!proofBase64,
            },
          });

          await updateOrderStatusDB(orderId, order.status, {
            driver_id: driverId,
            proof_type: normalizedType,
            uploaded_at: uploadedAt,
          });

          order.proof = {
            uploadedAt: uploadedAt.toISOString(),
            driverId,
            type: normalizedType,
            hasProof: true,
          };

          dbSavedProof = true;
          if (DEBUG) console.log(`💾 Preuve de livraison sauvegardée pour ${orderId}`);
        } catch (err) {
          dbSavedProof = false;
          dbErrorProof = err && err.message ? err.message : String(err);
          if (DEBUG) console.warn('Failed to save proof to DB', dbErrorProof);
        }

        // Notify user sockets
        const userSocketId = connectedUsers.get(order.user.id);
        if (userSocketId) {
          io.to(userSocketId).emit('order:proof:uploaded', { orderId, uploadedAt: order.proof?.uploadedAt || new Date(), dbSaved: dbSavedProof, dbError: dbErrorProof });
        }

        if (typeof ack === 'function') ack({ success: true, order, dbSaved: dbSavedProof, dbError: dbErrorProof });
      } catch (err) {
        if (DEBUG) console.error('Error in send-proof socket handler', err);
        if (typeof ack === 'function') ack({ success: false, message: 'Server error' });
      }
    });
    
    // Handle resync requests from clients (user / driver reconnect)
    socket.on('user-reconnect', ({ userId } = {}) => {
      try {
        if (!userId) return;
        const pending = [];
        const current = [];
        for (const [, o] of activeOrders.entries()) {
          if (o.user && o.user.id === userId) {
            if (o.status === 'pending') pending.push(o);
            else current.push(o);
          }
        }
        io.to(socket.id).emit('resync-order-state', {
          pendingOrder: pending.length ? pending[0] : null,
          currentOrder: current.length ? current[0] : null,
        });
      } catch (err) {
        if (DEBUG) console.warn('Error handling user-reconnect', err);
      }
    });

    socket.on('driver-reconnect', ({ driverId } = {}) => {
      try {
        if (!driverId) return;
        const assigned = [];
        for (const [, o] of activeOrders.entries()) {
          if (o.driverId === driverId) assigned.push(o);
        }
        io.to(socket.id).emit('resync-order-state', {
          pendingOrder: null,
          currentOrder: assigned.length ? assigned[0] : null,
        });
      } catch (err) {
        if (DEBUG) console.warn('Error handling driver-reconnect', err);
      }
    });

    // 🔌 Déconnexion
    socket.on('disconnect', () => {
      if (DEBUG) console.log(`🔌 Déconnexion Socket: ${socket.id}`);

      // Nettoyer les maps
      if (socket.driverId) {
        connectedDrivers.delete(socket.driverId);
        if (DEBUG) console.log(`🚗 Driver déconnecté: ${socket.driverId}`);
      }

      if (socket.userId) {
        connectedUsers.delete(socket.userId);
        if (DEBUG) console.log(`👤 User déconnecté: ${socket.userId}`);
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