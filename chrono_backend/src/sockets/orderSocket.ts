import { Server as SocketIOServer, Socket } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import {
  saveOrder,
  updateOrderStatus as updateOrderStatusDB,
  saveDeliveryProofRecord,
  recordOrderAssignment,
} from '../config/orderStorage.js';
import { maskOrderId, maskUserId, sanitizeObject } from '../utils/maskSensitiveData.js';
import { createTransactionAndInvoiceForOrder } from '../utils/createTransactionForOrder.js';
import pool from '../config/db.js';

// Interfaces for order data
interface OrderCoordinates {
  latitude: number;
  longitude: number;
}

interface OrderLocation {
  address: string;
  coordinates: OrderCoordinates;
  details?: {
    entrance?: string;
    apartment?: string;
    floor?: string;
    intercom?: string;
    phone?: string;
    photos?: string[];
  };
}

interface OrderUser {
  id: string;
  name?: string;
  avatar?: string;
  rating?: number;
  phone?: string;
}

interface OrderRecipient {
  phone?: string;
}

interface Order {
  id: string;
  user: OrderUser;
  pickup: OrderLocation;
  dropoff: OrderLocation;
  recipient?: OrderRecipient | null;
  packageImages?: string[];
  price: number;
  deliveryMethod: string;
  distance: number;
  estimatedDuration: string;
  status: string;
  createdAt: Date;
  assignedAt?: Date;
  acceptedAt?: Date;
  completedAt?: Date;
  cancelledAt?: Date;
  driverId?: string;
  proof?: {
    uploadedAt: string;
    driverId: string;
    type: string;
    hasProof: boolean;
  };
}

interface CreateOrderData {
  pickup: OrderLocation;
  dropoff: OrderLocation;
  deliveryMethod: string;
  userId: string;
  userInfo?: OrderUser;
  orderId?: string;
  price?: number;
  distance?: number;
  estimatedDuration?: string;
  recipient?: OrderRecipient;
  packageImages?: string[];
  // Informations de paiement
  paymentMethodType?: 'orange_money' | 'wave' | 'cash' | 'deferred';
  paymentMethodId?: string | null; // ID de la méthode de paiement depuis payment_methods
  paymentPayerType?: 'client' | 'recipient';
  isPartialPayment?: boolean;
  partialAmount?: number;
  recipientUserId?: string;
  recipientIsRegistered?: boolean;
}

interface NearbyDriver {
  driverId: string;
  distance: number;
  [key: string]: any;
}

// Store en mémoire pour les commandes actives (cache)
const activeOrders = new Map<string, Order>();
const connectedDrivers = new Map<string, string>(); // driverId -> socketId
const connectedUsers = new Map<string, string>(); // userId -> socketId

// Extended Socket interface for custom properties
interface ExtendedSocket extends Socket {
  driverId?: string;
  userId?: string;
}

// Fonction pour calculer la distance entre deux points
function getDistanceInKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
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

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

// Fonction pour calculer le prix basé sur la distance et la méthode
function calculatePrice(distance: number, method: string): number {
  const basePrices: { [key: string]: { base: number; perKm: number } } = {
    moto: { base: 500, perKm: 200 },
    vehicule: { base: 800, perKm: 300 },
    cargo: { base: 1200, perKm: 450 }
  };
  
  const pricing = basePrices[method] || basePrices.vehicule;
  return Math.round(pricing.base + (distance * pricing.perKm));
}

// Fonction pour estimer la durée
function estimateDuration(distance: number, method: string): string {
  const avgSpeeds: { [key: string]: number } = {
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
async function findNearbyDrivers(
  pickupCoords: OrderCoordinates,
  deliveryMethod: string,
  maxDistance: number = 10
): Promise<NearbyDriver[]> {
  const DEBUG = process.env.DEBUG_SOCKETS === 'true';
  
  // Import dynamique pour éviter les problèmes de dépendances circulaires
  const { realDriverStatuses } = await import('../controllers/driverController.js');
  const nearbyDrivers: NearbyDriver[] = [];
  
  if (DEBUG) {
    console.log(`🔍 Recherche livreurs proches: ${realDriverStatuses.size} livreurs en mémoire`);
  }
  
  for (const [driverId, driverData] of realDriverStatuses.entries()) {
    // Vérifier si le livreur est online et disponible
    if (!driverData.is_online || !driverData.is_available) {
      if (DEBUG) {
        console.log(`⏭️ Livreur ${driverId.slice(0, 8)} ignoré: online=${driverData.is_online}, available=${driverData.is_available}`);
      }
      continue;
    }
    
    // Vérifier si le livreur a une position GPS
    if (!driverData.current_latitude || !driverData.current_longitude) {
      if (DEBUG) {
        console.log(`⏭️ Livreur ${driverId.slice(0, 8)} ignoré: pas de position GPS`);
      }
      continue;
    }
    
    const distance = getDistanceInKm(
      pickupCoords.latitude,
      pickupCoords.longitude,
      driverData.current_latitude,
      driverData.current_longitude
    );
    
    if (distance <= maxDistance) {
      if (DEBUG) {
        console.log(`✅ Livreur ${driverId.slice(0, 8)} trouvé à ${distance.toFixed(2)}km`);
      }
      nearbyDrivers.push({
        driverId,
        distance,
        ...driverData
      });
    } else {
      if (DEBUG) {
        console.log(`⏭️ Livreur ${driverId.slice(0, 8)} trop loin: ${distance.toFixed(2)}km (max: ${maxDistance}km)`);
      }
    }
  }
  
  if (DEBUG) {
    console.log(`📊 Total livreurs trouvés: ${nearbyDrivers.length}`);
  }
  
  // Trier par distance
  return nearbyDrivers.sort((a, b) => a.distance - b.distance);
}

const setupOrderSocket = (io: SocketIOServer): void => {
  const DEBUG = process.env.DEBUG_SOCKETS === 'true';

  io.on('connection', (socket: ExtendedSocket) => {
    if (DEBUG) console.log(`🔌 Nouvelle connexion Socket: ${socket.id}`);
    
    // 📱 Enregistrement d'un driver
    socket.on('driver-connect', (driverId: string) => {
      connectedDrivers.set(driverId, socket.id);
      socket.driverId = driverId;
      if (DEBUG) console.log(`🚗 Driver connecté: ${driverId}`);
    });
    
    // 👤 Enregistrement d'un user
    socket.on('user-connect', (userId: string) => {
      connectedUsers.set(userId, socket.id);
      socket.userId = userId;
      // 🔒 SÉCURITÉ: Masquer userId
      if (DEBUG) console.log(`👤 User connecté: ${maskUserId(userId)}`);
    });
    
    // 📦 Nouvelle commande depuis un user
    // Create-order now supports an acknowledgement callback from the client
    // so the client can know if the server accepted/created the order.
    socket.on('create-order', async (orderData: CreateOrderData, ack?: (response: any) => void) => {
      try {
        // 🔒 SÉCURITÉ: Masquer userId et données sensibles
        if (DEBUG) console.log(`📦 Nouvelle commande de ${maskUserId(socket.userId || 'unknown')}`);

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
          recipient,
          packageImages,
          // Informations de paiement
          paymentMethodType,
          paymentMethodId,
          paymentPayerType,
          isPartialPayment,
          partialAmount,
          recipientUserId,
          recipientIsRegistered,
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

        // Déterminer le statut de paiement initial
        let initialPaymentStatus: 'pending' | 'delayed' = 'pending';
        if (paymentMethodType === 'deferred') {
          initialPaymentStatus = 'delayed';
        }

        // Créer la commande avec toutes les informations détaillées
        const order: Order = {
          id: providedOrderId || uuidv4(),
          user: {
            id: userId,
            name: userInfo?.name || 'Client',
            avatar: userInfo?.avatar,
            rating: userInfo?.rating || 4.5,
            phone: userInfo?.phone
          },
          pickup, // Contient address, coordinates, et details (entrance, apartment, floor, intercom, photos)
          dropoff, // Contient address, coordinates, phone (dans details), et details (entrance, apartment, floor, intercom, photos)
          recipient: recipient || (dropoff?.details?.phone ? { phone: dropoff.details.phone } : null),
          packageImages: packageImages || dropoff?.details?.photos || [],
          price,
          deliveryMethod,
          distance: Math.round(distance * 100) / 100,
          estimatedDuration,
          status: 'pending',
          createdAt: new Date(),
        };

        // Ajouter les informations de paiement à l'objet order pour la sauvegarde en base de données
        (order as any).payment_method_id = paymentMethodId || null;
        (order as any).payment_method_type = paymentMethodType;
        (order as any).payment_status = initialPaymentStatus;
        (order as any).payment_payer = paymentPayerType || 'client';
        (order as any).is_partial_payment = isPartialPayment || false;
        (order as any).partial_amount = isPartialPayment && partialAmount ? partialAmount : null;
        (order as any).recipient_user_id = recipientUserId || null;
        (order as any).recipient_is_registered = recipientIsRegistered || false;

        // Stocker la commande en mémoire (cache)
        activeOrders.set(order.id, order);
        
        // Sauvegarder en base de données (persistance)
        let dbSaved = false;
        let dbErrorMsg: string | null = null;
        try {
          await saveOrder(order);
          dbSaved = true;
          // 🔒 SÉCURITÉ: Masquer orderId
          if (DEBUG) console.log(`💾 Commande ${maskOrderId(order.id)} sauvegardée en DB`);
          
          // Créer automatiquement une transaction et une facture si les informations de paiement sont disponibles
          if (paymentMethodType && price) {
            try {
              const { transactionId, invoiceId } = await createTransactionAndInvoiceForOrder(
                order.id,
                userId,
                paymentMethodType,
                price,
                order.distance || null,
                null, // pricePerKm - à récupérer depuis la commande si disponible
                0, // urgencyFee - à récupérer depuis la commande si disponible
                null, // driverId - sera mis à jour lors de l'acceptation
                isPartialPayment || false,
                isPartialPayment && partialAmount ? partialAmount : undefined,
                isPartialPayment && partialAmount ? (price - partialAmount) : undefined,
                paymentPayerType || 'client',
                recipientUserId,
                paymentMethodId || null
              );
              
              if (transactionId && invoiceId) {
                if (DEBUG) {
                  console.log(`✅ Transaction ${transactionId} et facture ${invoiceId} créées pour commande ${maskOrderId(order.id)}`);
                } else {
                  // Toujours logger la création de transaction même si DEBUG est false
                  console.log(`✅ Transaction créée: ${transactionId} pour commande ${maskOrderId(order.id)}`);
                }
              } else {
                console.warn(`⚠️ Transaction ou facture non créée pour commande ${maskOrderId(order.id)}: transactionId=${transactionId}, invoiceId=${invoiceId}`);
              }
            } catch (transactionError: any) {
              // Ne pas bloquer la création de la commande si la transaction échoue
              console.error(`❌ Échec création transaction/facture pour ${maskOrderId(order.id)}:`, transactionError.message, transactionError.stack);
            }
          } else {
            // Logger si les informations de paiement ne sont pas disponibles
            if (DEBUG) {
              console.log(`ℹ️ Transaction non créée pour commande ${maskOrderId(order.id)}: paymentMethodType=${paymentMethodType}, price=${price}`);
            }
          }
        } catch (dbError: any) {
          dbSaved = false;
          dbErrorMsg = dbError && dbError.message ? dbError.message : String(dbError);
          // 🔒 SÉCURITÉ: Masquer orderId
          console.warn(`⚠️ Échec sauvegarde DB pour ${maskOrderId(order.id)}:`, dbErrorMsg);
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
          // 🔒 SÉCURITÉ: Masquer orderId
          if (DEBUG) {
            console.log(`❌ Aucun chauffeur disponible dans la zone pour la commande ${maskOrderId(order.id)}`);
            // Importer pour diagnostic
            const { realDriverStatuses } = await import('../controllers/driverController.js');
            console.log(`📊 Diagnostic: ${realDriverStatuses.size} livreurs en mémoire`);
            for (const [driverId, driverData] of realDriverStatuses.entries()) {
              console.log(`  - ${driverId.slice(0, 8)}: online=${driverData.is_online}, available=${driverData.is_available}, has_position=${!!(driverData.current_latitude && driverData.current_longitude)}`);
            }
          }
          io.to(socket.id).emit('no-drivers-available', {
            orderId: order.id,
            message: 'Aucun chauffeur disponible dans votre zone'
          });
          return;
        }

        // 🔒 SÉCURITÉ: Masquer orderId
        if (DEBUG) console.log(`🔍 ${nearbyDrivers.length} chauffeurs trouvés pour la commande ${maskOrderId(order.id)}`);

        // Envoyer la commande aux chauffeurs proches (un par un)
        let driverIndex = 0;
        const tryNextDriver = async (): Promise<void> => {
          if (driverIndex >= nearbyDrivers.length) {
            // Tous les chauffeurs ont été essayés, annuler la commande
            // 🔒 SÉCURITÉ: Masquer orderId
            console.log(`❌ Tous les chauffeurs sont occupés pour la commande ${maskOrderId(order.id)} - Annulation automatique`);
            
            // Annuler la commande dans la DB
            try {
              order.status = 'cancelled';
              order.cancelledAt = new Date();
              await updateOrderStatusDB(order.id, 'cancelled', {
                cancelled_at: order.cancelledAt
              });
              // 🔒 SÉCURITÉ: Masquer orderId
              console.log(`✅ Commande ${maskOrderId(order.id)} annulée automatiquement en DB`);
              } catch (dbError: any) {
              // 🔒 SÉCURITÉ: Masquer orderId
              console.warn(`⚠️ Échec annulation DB pour ${maskOrderId(order.id)}:`, dbError.message);
            }

            // Notifier le client que la commande a été annulée
            const userSocketId = connectedUsers.get(order.user.id);
            if (userSocketId) {
              io.to(userSocketId).emit('order-cancelled', {
                orderId: order.id,
                reason: 'no_drivers_available',
                message: 'Aucun chauffeur disponible - Commande annulée'
              });
            }
            
            socket.emit('no-drivers-available', {
              orderId: order.id,
              message: 'Tous les chauffeurs sont occupés - Commande annulée'
            });
            
            // Retirer de la mémoire
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
                // 🔒 SÉCURITÉ: Masquer orderId et driverId
                if (DEBUG) console.log(`⏰ Timeout driver ${maskUserId(driver.driverId)} pour commande ${maskOrderId(order.id)}`);
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

      } catch (error: any) {
        console.error('❌ Erreur création commande:', error);
        socket.emit('order-error', {
          success: false,
          message: 'Erreur lors de la création de la commande'
        });
      }
    });

    // ✅ Driver accepte une commande
    socket.on('accept-order', async (data: { orderId: string; driverId: string }) => {
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
      let dbErrorAssign: string | null = null;
      try {
        await updateOrderStatusDB(orderId, 'accepted', {
          driver_id: driverId,
          accepted_at: order.acceptedAt,
          assigned_at: order.assignedAt || order.createdAt,
        });
        dbSavedAssign = true;
        // 🔒 SÉCURITÉ: Masquer orderId
        if (DEBUG) console.log(`💾 Statut commande ${maskOrderId(orderId)} mis à jour en DB`);
        
        // Mettre à jour la facture avec le driverId si elle existe
        try {
          await (pool as any).query(
            `UPDATE invoices SET driver_id = $1 WHERE order_id = $2 AND driver_id IS NULL`,
            [driverId, orderId]
          );
          if (DEBUG) console.log(`✅ Facture mise à jour avec driverId pour commande ${maskOrderId(orderId)}`);
        } catch (invoiceError: any) {
          // Ne pas bloquer si la mise à jour de la facture échoue
          if (DEBUG) console.warn(`⚠️ Échec mise à jour facture pour ${maskOrderId(orderId)}:`, invoiceError.message);
        }
      } catch (dbError: any) {
        dbSavedAssign = false;
        dbErrorAssign = dbError && dbError.message ? dbError.message : String(dbError);
        // 🔒 SÉCURITÉ: Masquer orderId
        console.warn(`⚠️ Échec mise à jour DB pour ${maskOrderId(orderId)}:`, dbErrorAssign);
      }

  // 🔒 SÉCURITÉ: Masquer orderId et driverId
  if (DEBUG) console.log(`✅ Commande ${maskOrderId(orderId)} acceptée par driver ${maskUserId(driverId)}`);

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
            const driverData: any = realDriverStatuses.get(driverId) || {};

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
    socket.on('decline-order', (data: { orderId: string; driverId: string }) => {
      const { orderId, driverId } = data;
      const order = activeOrders.get(orderId);

      if (!order) {
        socket.emit('order-not-found', { orderId });
        return;
      }

  // 🔒 SÉCURITÉ: Masquer orderId et driverId
  if (DEBUG) console.log(`❌ Commande ${maskOrderId(orderId)} déclinée par driver ${maskUserId(driverId)}`);

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
    socket.on('update-delivery-status', async (data: { orderId: string; status: string; location?: any }, ack?: (response: any) => void) => {
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
        const allowed: { [key: string]: string[] } = {
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
        let dbErrorStatus: string | null = null;
        try {
          await updateOrderStatusDB(orderId, status, {
            driver_id: driverId,
            completed_at: status === 'completed' ? order.completedAt : undefined
          });
          dbSavedStatus = true;
          // 🔒 SÉCURITÉ: Masquer orderId
          if (DEBUG) console.log(`💾 Statut commande ${maskOrderId(orderId)} mis à jour en DB`);
        } catch (dbError: any) {
          dbSavedStatus = false;
          dbErrorStatus = dbError && dbError.message ? dbError.message : String(dbError);
          // 🔒 SÉCURITÉ: Masquer orderId
          console.warn(`⚠️ Échec mise à jour DB pour ${maskOrderId(orderId)}:`, dbErrorStatus);
        }

        // 🔒 SÉCURITÉ: Masquer orderId et driverId
        if (DEBUG) console.log(`🚛 Statut livraison ${maskOrderId(orderId)}: ${status} par driver ${maskUserId(driverId)}`);

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
            activeOrders.delete(order.id);
            // 🔒 SÉCURITÉ: Masquer orderId
            if (DEBUG) console.log(`🗑️ Commande ${maskOrderId(order.id)} supprimée du cache`);
          }, 1000 * 60 * 5);
        }
      } catch (err: any) {
        if (DEBUG) console.error('Error in update-delivery-status socket handler', err);
        if (typeof ack === 'function') ack({ success: false, message: 'Server error' });
      }
    });

    // 🧾 Driver envoie une preuve (base64) via socket
    socket.on('send-proof', async (data: { orderId: string; proofBase64: string; proofType?: string }, ack?: (response: any) => void) => {
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
        let dbErrorProof: string | null = null;
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
          // 🔒 SÉCURITÉ: Masquer orderId
          if (DEBUG) console.log(`💾 Preuve de livraison sauvegardée pour ${maskOrderId(orderId)}`);
        } catch (err: any) {
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
      } catch (err: any) {
        if (DEBUG) console.error('Error in send-proof socket handler', err);
        if (typeof ack === 'function') ack({ success: false, message: 'Server error' });
      }
    });
    
    // Handle resync requests from clients (user / driver reconnect)
    socket.on('user-reconnect', ({ userId }: { userId?: string } = {}) => {
      try {
        if (!userId) return;
        const pending: Order[] = [];
        const current: Order[] = [];
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
      } catch (err: any) {
        if (DEBUG) console.warn('Error handling user-reconnect', err);
      }
    });

    socket.on('driver-reconnect', ({ driverId }: { driverId?: string } = {}) => {
      try {
        if (!driverId) return;
        const assigned: Order[] = [];
        for (const [, o] of activeOrders.entries()) {
          if (o.driverId === driverId) assigned.push(o);
        }
        io.to(socket.id).emit('resync-order-state', {
          pendingOrder: null,
          currentOrder: assigned.length ? assigned[0] : null,
        });
      } catch (err: any) {
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

