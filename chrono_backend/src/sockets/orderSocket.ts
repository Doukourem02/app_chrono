import { Server as SocketIOServer, Socket } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import { saveOrder, updateOrderStatus as updateOrderStatusDB, saveDeliveryProofRecord,
 recordOrderAssignment,
} from '../config/orderStorage.js';
import { maskOrderId, maskUserId, sanitizeObject } from '../utils/maskSensitiveData.js';
import { createTransactionAndInvoiceForOrder } from '../utils/createTransactionForOrder.js';
import pool from '../config/db.js'; // Interfaces for order data
interface OrderCoordinates { latitude: number; longitude: number;
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
const connectedUsers = new Map<string, string>(); // userId -> socketId // Limites configurable pour les commandes multiples
const MAX_ACTIVE_ORDERS_PER_CLIENT = parseInt(process.env.MAX_ACTIVE_ORDERS_PER_CLIENT || '5');
const MAX_ACTIVE_ORDERS_PER_DRIVER = parseInt(process.env.MAX_ACTIVE_ORDERS_PER_DRIVER || ''); // Fonction pour compter les commandes actives d'un client
function getActiveOrdersCountByUser(userId: string): number { let count = 0; for (const [, order] of activeOrders.entries()) { if (order.user.id === userId && 
        order.status !== 'completed' && order.status !== 'cancelled' && order.status !== 'declined') { count++; } }
  return count;
} // Fonction pour compter les commandes actives d'un livreur
function getActiveOrdersCountByDriver(driverId: string): number {
  let count = 0;
  for (const [, order] of activeOrders.entries()) {
    if (order.driverId === driverId && 
        order.status !== 'completed' && order.status !== 'cancelled' && order.status !== 'declined') { count++; } }
  return count;
}

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
    console.log(`Recherche livreurs proches: ${realDriverStatuses.size} livreurs en mémoire`);
  }
  
  for (const [driverId, driverData] of realDriverStatuses.entries()) {
    if (!driverData.is_online || !driverData.is_available) {
      if (DEBUG) {
        console.log(`Livreur ${driverId.slice(0, 8)} ignoré: online=${driverData.is_online}, available=${driverData.is_available}`);
      }
      continue;
    }
    
    if (!driverData.current_latitude || !driverData.current_longitude) {
      if (DEBUG) {
        console.log(`Livreur ${driverId.slice(0, 8)} ignoré: pas de position GPS`);
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
        console.log(`Livreur ${driverId.slice(0, 8)} trouvé à ${distance.toFixed(2)}km`);
      }
      nearbyDrivers.push({
        driverId,
        distance,
        ...driverData
      });
    } else {
      if (DEBUG) {
        console.log(`Livreur ${driverId.slice(0, 8)} trop loin: ${distance.toFixed(2)}km (max: ${maxDistance}km)`);
      }
    }
  }
  
  if (DEBUG) {
    console.log(`Total livreurs trouvés: ${nearbyDrivers.length}`);
  }
  
  // Trier par distance
  return nearbyDrivers.sort((a, b) => a.distance - b.distance);
}

const setupOrderSocket = (io: SocketIOServer): void => {
 const DEBUG = process.env.DEBUG_SOCKETS === 'true'; io.on('connection', (socket: ExtendedSocket) => { if (DEBUG) console.log(`Nouvelle connexion Socket: ${socket.id}`); socket.on('driver-connect', (driverId: string) => { connectedDrivers.set(driverId, socket.id); socket.driverId = driverId; console.log(`[DIAGNOSTIC] Driver connecté: ${maskUserId(driverId)} (socket: ${socket.id})`); console.log(` - Total drivers connectés: ${connectedDrivers.size}`); }); socket.on('user-connect', (userId: string) => { connectedUsers.set(userId, socket.id); socket.userId = userId; if (DEBUG) console.log(`User connecté: ${maskUserId(userId)}`); }); socket.on('create-order', async (orderData: CreateOrderData, ack?: (response: any) => void) => { try { if (DEBUG) console.log(`Nouvelle commande de ${maskUserId(socket.userId || 'unknown')}`); const { pickup, dropoff, deliveryMethod, userId, userInfo,
          orderId: providedOrderId,
          price: providedPrice,
          distance: providedDistance,
          estimatedDuration: providedEta,
          recipient,
          packageImages,
          paymentMethodType,
          paymentMethodId,
          paymentPayerType,
          isPartialPayment,
          partialAmount,
          recipientUserId,
          recipientIsRegistered,
        } = orderData;

        if (!pickup || !dropoff || !pickup.coordinates || !dropoff.coordinates) {
         socket.emit('order-error', { success: false, message: 'Coordinates manquantes' }); if (typeof ack === 'function') ack({ success: false, message: 'Coordinates manquantes' }); return; } const activeOrdersCount = getActiveOrdersCountByUser(userId);
        if (activeOrdersCount >= MAX_ACTIVE_ORDERS_PER_CLIENT) {
         const errorMsg = `Vous avez déjà ${activeOrdersCount} commande(s) active(s). Limite: ${MAX_ACTIVE_ORDERS_PER_CLIENT}`; socket.emit('order-error', { success: false, message: errorMsg }); if (typeof ack === 'function') ack({ success: false, message: errorMsg }); return; } const rawDistance = providedDistance != null ? Number(providedDistance) : getDistanceInKm(
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

       let initialPaymentStatus: 'pending' | 'delayed' = 'pending'; if (paymentMethodType === 'deferred') { initialPaymentStatus = 'delayed'; } const order: Order = { id: providedOrderId || uuidv4(),
          user: {
            id: userId,
           name: userInfo?.name || 'Client', avatar: userInfo?.avatar, rating: userInfo?.rating || 4.5, phone: userInfo?.phone
          },
          pickup,
          dropoff,
          recipient: recipient || (dropoff?.details?.phone ? { phone: dropoff.details.phone } : null),
          packageImages: packageImages || dropoff?.details?.photos || [],
          price,
          deliveryMethod,
          distance: Math.round(distance * 100) / 100,
          estimatedDuration,
         status: 'pending', createdAt: new Date(), }; (order as any).payment_method_id = paymentMethodId || null;
        (order as any).payment_method_type = paymentMethodType;
        (order as any).payment_status = initialPaymentStatus;
       (order as any).payment_payer = paymentPayerType || 'client'; (order as any).is_partial_payment = isPartialPayment || false; (order as any).partial_amount = isPartialPayment && partialAmount ? partialAmount : null; (order as any).recipient_user_id = recipientUserId || null;
        (order as any).recipient_is_registered = recipientIsRegistered || false;

        activeOrders.set(order.id, order);
        
        let dbSaved = false;
        let dbErrorMsg: string | null = null;
        try {
          await saveOrder(order);
          dbSaved = true;
         if (DEBUG) console.log(`Commande ${maskOrderId(order.id)} sauvegardée en DB`); if (paymentMethodType && price) { try { const { transactionId, invoiceId } = await createTransactionAndInvoiceForOrder(
                order.id,
                userId,
                paymentMethodType,
                price,
                order.distance || null,
                null,
                0,
                null,
                isPartialPayment || false,
                isPartialPayment && partialAmount ? partialAmount : undefined,
                isPartialPayment && partialAmount ? (price - partialAmount) : undefined,
               paymentPayerType || 'client', recipientUserId, paymentMethodId || null );
              
              if (transactionId && invoiceId) {
                if (DEBUG) {
                 console.log(`Transaction ${transactionId} et facture ${invoiceId} créées pour commande ${maskOrderId(order.id)}`); } else { console.log(`Transaction créée: ${transactionId} pour commande ${maskOrderId(order.id)}`); } } else { console.warn(`Transaction ou facture non créée pour commande ${maskOrderId(order.id)}: transactionId=${transactionId}, invoiceId=${invoiceId}`); } } catch (transactionError: any) { console.error(`Échec création transaction/facture pour ${maskOrderId(order.id)}:`, transactionError.message, transactionError.stack); } } else { if (DEBUG) {
             console.log(`Transaction non créée pour commande ${maskOrderId(order.id)}: paymentMethodType=${paymentMethodType}, price=${price}`); } } } catch (dbError: any) {
          dbSaved = false;
          dbErrorMsg = dbError && dbError.message ? dbError.message : String(dbError);
         console.warn(`Échec sauvegarde DB pour ${maskOrderId(order.id)}:`, dbErrorMsg); } io.to(socket.id).emit('order-created', { success: true, order, dbSaved, dbError: dbErrorMsg,
         message: 'Commande créée, recherche de chauffeur...' }); try { if (typeof ack === 'function') ack({ success: true, orderId: order.id, dbSaved, dbError: dbErrorMsg }); } catch (e) { if (DEBUG) console.warn('Ack callback failed for create-order', e); } const nearbyDrivers = await findNearbyDrivers(pickup.coordinates, deliveryMethod); const { realDriverStatuses } = await import('../controllers/driverController.js'); console.log(`[DIAGNOSTIC] Recherche livreurs pour commande ${maskOrderId(order.id)}:`); console.log(` - Livreurs en mémoire: ${realDriverStatuses.size}`); console.log(` - Livreurs connectés (socket): ${connectedDrivers.size}`); console.log(` - Livreurs proches trouvés: ${nearbyDrivers.length}`); for (const [driverId, driverData] of realDriverStatuses.entries()) { const isConnected = connectedDrivers.has(driverId); const hasPosition = !!(driverData.current_latitude && driverData.current_longitude); const distance = hasPosition ? getDistanceInKm(
            pickup.coordinates.latitude,
            pickup.coordinates.longitude,
            driverData.current_latitude!,
            driverData.current_longitude!
          ) : null;
          
         console.log(` - ${maskUserId(driverId)}: online=${driverData.is_online}, available=${driverData.is_available}, connected=${isConnected}, has_position=${hasPosition}${distance !== null ? `, distance=${distance.toFixed(2)}km` : ''}`); } if (nearbyDrivers.length === 0) { console.log(`Aucun chauffeur disponible dans la zone pour la commande ${maskOrderId(order.id)}`); io.to(socket.id).emit('no-drivers-available', { orderId: order.id, message: 'Aucun chauffeur disponible dans votre zone' }); return; } if (DEBUG) console.log(`${nearbyDrivers.length} chauffeurs trouvés pour la commande ${maskOrderId(order.id)}`); let driverIndex = 0; const tryNextDriver = async (): Promise<void> => { if (driverIndex >= nearbyDrivers.length) {
           console.log(`Tous les chauffeurs sont occupés pour la commande ${maskOrderId(order.id)} - Annulation automatique`); try { order.status = 'cancelled'; order.cancelledAt = new Date(); await updateOrderStatusDB(order.id, 'cancelled', { cancelled_at: order.cancelledAt }); console.log(`Commande ${maskOrderId(order.id)} annulée automatiquement en DB`); } catch (dbError: any) { console.warn(`Échec annulation DB pour ${maskOrderId(order.id)}:`, dbError.message); } const userSocketId = connectedUsers.get(order.user.id); if (userSocketId) { io.to(userSocketId).emit('order-cancelled', { orderId: order.id, reason: 'no_drivers_available', message: 'Aucun chauffeur disponible - Commande annulée' }); } socket.emit('no-drivers-available', { orderId: order.id, message: 'Tous les chauffeurs sont occupés - Commande annulée' }); activeOrders.delete(order.id); return;
          }

          const driver = nearbyDrivers[driverIndex];
          const driverSocketId = connectedDrivers.get(driver.driverId);

         console.log(`[DIAGNOSTIC] Tentative envoi à livreur ${maskUserId(driver.driverId)}:`); console.log(` - Socket ID: ${driverSocketId || 'NON CONNECTÉ'}`); console.log(` - Distance: ${driver.distance.toFixed(2)}km`); if (driverSocketId) { const assignedAt = new Date(); order.assignedAt = assignedAt; console.log(`Envoi commande à driver ${maskUserId(driver.driverId)} (socket: ${driverSocketId})`); await recordOrderAssignment(order.id, driver.driverId, { assignedAt }).catch(() => {}); io.to(driverSocketId).emit('new-order-request', order); console.log(`Événement 'new-order-request' émis vers socket ${driverSocketId}`); setTimeout(async () => { const currentOrder = activeOrders.get(order.id); if (currentOrder && currentOrder.status === 'pending') { if (DEBUG) console.log(`Timeout driver ${maskUserId(driver.driverId)} pour commande ${maskOrderId(order.id)}`); await recordOrderAssignment(order.id, driver.driverId, { declinedAt: new Date() }).catch(() => {}); driverIndex++; tryNextDriver().catch(() => {}); } }, 20000);
          } else {
           if (DEBUG) console.log(`Chauffeur ${driver.driverId} trouvé mais socket non connecté.`); driverIndex++; tryNextDriver().catch(() => {}); }
        };

        tryNextDriver().catch(() => {});

      } catch (error: any) {
       console.error('Erreur création commande:', error); socket.emit('order-error', { success: false, message: 'Erreur lors de la création de la commande' }); } });

   socket.on('accept-order', async (data: { orderId: string; driverId: string }) => { const { orderId, driverId } = data; const order = activeOrders.get(orderId); if (!order) {
       socket.emit('order-not-found', { orderId }); return; } if (order.status !== 'pending') { socket.emit('order-already-taken', { orderId }); return; } const activeOrdersCount = getActiveOrdersCountByDriver(driverId);
      if (activeOrdersCount >= MAX_ACTIVE_ORDERS_PER_DRIVER) {
       const errorMsg = `Vous avez déjà ${activeOrdersCount} commande(s) active(s). Limite: ${MAX_ACTIVE_ORDERS_PER_DRIVER}`; socket.emit('order-accept-error', { orderId, message: errorMsg }); return; } order.status = 'accepted'; order.driverId = driverId; order.acceptedAt = new Date(); let dbSavedAssign = false; let dbErrorAssign: string | null = null;
      try {
       await updateOrderStatusDB(orderId, 'accepted', { driver_id: driverId, accepted_at: order.acceptedAt, assigned_at: order.assignedAt || order.createdAt,
        });
        dbSavedAssign = true;
       if (DEBUG) console.log(`Statut commande ${maskOrderId(orderId)} mis à jour en DB`); try { await (pool as any).query( `UPDATE invoices SET driver_id = $1 WHERE order_id = $2 AND driver_id IS NULL`, [driverId, orderId] ); if (DEBUG) console.log(`Facture mise à jour avec driverId pour commande ${maskOrderId(orderId)}`); } catch (invoiceError: any) { if (DEBUG) console.warn(`Échec mise à jour facture pour ${maskOrderId(orderId)}:`, invoiceError.message); } } catch (dbError: any) { dbSavedAssign = false;
        dbErrorAssign = dbError && dbError.message ? dbError.message : String(dbError);
       console.warn(`Échec mise à jour DB pour ${maskOrderId(orderId)}:`, dbErrorAssign); } if (DEBUG) console.log(`Commande ${maskOrderId(orderId)} acceptée par driver ${maskUserId(driverId)}`); socket.emit('order-accepted-confirmation', { success: true, order, dbSaved: dbSavedAssign, dbError: dbErrorAssign, message: 'Commande acceptée avec succès' }); const userSocketId = connectedUsers.get(order.user.id); if (userSocketId) {
        (async () => {
          try {
           const { realDriverStatuses } = await import('../controllers/driverController.js'); const driverData: any = realDriverStatuses.get(driverId) || {}; const driverInfo = { id: driverId,
             first_name: driverData.first_name || 'Livreur', last_name: driverData.last_name || driverId?.substring(0, 8) || null, current_latitude: driverData.current_latitude || null, current_longitude: driverData.current_longitude || null,
              phone: driverData.phone || null,
              profile_image_url: driverData.profile_image_url || null,
            };

           io.to(userSocketId).emit('order-accepted', { order, driverInfo, dbSaved: dbSavedAssign,
              dbError: dbErrorAssign
            });
          } catch (err) {
           io.to(userSocketId).emit('order-accepted', { order, driverInfo: { id: driverId } });
          }
        })();
      }
    });

   socket.on('decline-order', (data: { orderId: string; driverId: string }) => { const { orderId, driverId } = data; const order = activeOrders.get(orderId); if (!order) {
       socket.emit('order-not-found', { orderId }); return; } if (DEBUG) console.log(`Commande ${maskOrderId(orderId)} déclinée par driver ${maskUserId(driverId)}`); recordOrderAssignment(orderId, driverId, { declinedAt: new Date() }).catch(() => {}); socket.emit('order-declined-confirmation', { success: true, orderId, message: 'Commande déclinée' }); }); socket.on('update-delivery-status', async (data: { orderId: string; status: string; location?: any }, ack?: (response: any) => void) => { try { const { orderId, status, location } = data || {}; const order = activeOrders.get(orderId);

        if (!order) {
         if (typeof ack === 'function') ack({ success: false, message: 'Order not found' }); socket.emit('order-not-found', { orderId }); return; } const driverId = socket.driverId;
        if (!driverId) {
         if (typeof ack === 'function') ack({ success: false, message: 'Driver not authenticated on socket' }); socket.emit('unauthorized', { message: 'Driver not authenticated' }); return; } if (order.driverId && order.driverId !== driverId) {
         if (typeof ack === 'function') ack({ success: false, message: 'Driver not assigned to this order' }); socket.emit('forbidden', { message: 'Driver not assigned to this order' }); return; } const allowed: { [key: string]: string[] } = {
         pending: ['accepted', 'cancelled'], accepted: ['enroute', 'cancelled'], enroute: ['picked_up', 'cancelled'], picked_up: ['completed', 'cancelled'], completed: [], cancelled: [] };

       const current = order.status || 'pending'; if (current === status) { if (typeof ack === 'function') ack({ success: true, message: 'No-op: status already set', order }); return; } if (!allowed[current] || !allowed[current].includes(status)) {
        if (typeof ack === 'function') ack({ success: false, message: `Invalid transition from ${current} to ${status}` }); return; } order.status = status; if (status === 'completed') { order.completedAt = new Date(); } let dbSavedStatus = false; let dbErrorStatus: string | null = null;
        try {
          await updateOrderStatusDB(orderId, status, {
            driver_id: driverId,
           completed_at: status === 'completed' ? order.completedAt : undefined }); dbSavedStatus = true; if (DEBUG) console.log(`Statut commande ${maskOrderId(orderId)} mis à jour en DB`); } catch (dbError: any) { dbSavedStatus = false; dbErrorStatus = dbError && dbError.message ? dbError.message : String(dbError);
         console.warn(`Échec mise à jour DB pour ${maskOrderId(orderId)}:`, dbErrorStatus); } if (DEBUG) console.log(`Statut livraison ${maskOrderId(orderId)}: ${status} par driver ${maskUserId(driverId)}`); const userSocketId = connectedUsers.get(order.user.id); if (userSocketId) { io.to(userSocketId).emit('order:status:update', { order, location, dbSaved: dbSavedStatus, dbError: dbErrorStatus }); } if (typeof ack === 'function') ack({ success: true, order, dbSaved: dbSavedStatus, dbError: dbErrorStatus }); if (status === 'completed') { setTimeout(() => { activeOrders.delete(order.id); if (DEBUG) console.log(`Commande ${maskOrderId(order.id)} supprimée du cache`); }, 1000 * 60 * 5); } } catch (err: any) {
       if (DEBUG) console.error('Error in update-delivery-status socket handler', err); if (typeof ack === 'function') ack({ success: false, message: 'Server error' }); } }); socket.on('send-proof', async (data: { orderId: string; proofBase64: string; proofType?: string }, ack?: (response: any) => void) => { try { const { orderId, proofBase64, proofType = 'image' } = data || {}; if (!orderId || !proofBase64) { if (typeof ack === 'function') ack({ success: false, message: 'orderId and proofBase64 required' }); return; } const order = activeOrders.get(orderId);
        if (!order) {
         if (typeof ack === 'function') ack({ success: false, message: 'Order not found' }); return; } const driverId = socket.driverId;
        if (!driverId) {
         if (typeof ack === 'function') ack({ success: false, message: 'Driver not authenticated on socket' }); return; } if (order.driverId && order.driverId !== driverId) {
         if (typeof ack === 'function') ack({ success: false, message: 'Driver not assigned to order' }); return; } let dbSavedProof = false;
        let dbErrorProof: string | null = null;
        try {
          const uploadedAt = new Date();
         const normalizedType = proofType === 'image' ? 'photo' : proofType; await saveDeliveryProofRecord({ orderId, driverId,
            proofType: normalizedType,
            metadata: {
             received_from: 'socket', uploaded_at: uploadedAt.toISOString(), has_inline_proof: !!proofBase64, },
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
         if (DEBUG) console.log(`Preuve de livraison sauvegardée pour ${maskOrderId(orderId)}`); } catch (err: any) { dbSavedProof = false; dbErrorProof = err && err.message ? err.message : String(err);
         if (DEBUG) console.warn('Failed to save proof to DB', dbErrorProof); } const userSocketId = connectedUsers.get(order.user.id); if (userSocketId) {
         io.to(userSocketId).emit('order:proof:uploaded', { orderId, uploadedAt: order.proof?.uploadedAt || new Date(), dbSaved: dbSavedProof, dbError: dbErrorProof }); } if (typeof ack === 'function') ack({ success: true, order, dbSaved: dbSavedProof, dbError: dbErrorProof }); } catch (err: any) { if (DEBUG) console.error('Error in send-proof socket handler', err); if (typeof ack === 'function') ack({ success: false, message: 'Server error' }); } }); socket.on('user-reconnect', ({ userId }: { userId?: string } = {}) => { try { if (!userId) return; const pending: Order[] = [];
        const current: Order[] = [];
        for (const [, o] of activeOrders.entries()) {
          if (o.user && o.user.id === userId) {
           if (o.status === 'pending') { pending.push(o); } else if (o.status !== 'completed' && o.status !== 'cancelled' && o.status !== 'declined') { current.push(o); } }
        }
       io.to(socket.id).emit('resync-order-state', { pendingOrders: pending, activeOrders: current, pendingOrder: pending.length ? pending[0] : null,
          currentOrder: current.length ? current[0] : null,
        });
      } catch (err: any) {
       if (DEBUG) console.warn('Error handling user-reconnect', err); } }); socket.on('driver-reconnect', ({ driverId }: { driverId?: string } = {}) => { try { if (!driverId) return; const pending: Order[] = [];
        const active: Order[] = [];
        for (const [, o] of activeOrders.entries()) {
         if (o.driverId === driverId && o.status !== 'completed' && o.status !== 'cancelled' && o.status !== 'declined') { if (o.status === 'pending') { pending.push(o); } else { active.push(o);
            }
          }
        }
       io.to(socket.id).emit('resync-order-state', { pendingOrders: pending, activeOrders: active, pendingOrder: pending.length ? pending[0] : null,
          currentOrder: active.length ? active[0] : null,
        });
      } catch (err: any) {
       if (DEBUG) console.warn('Error handling driver-reconnect', err); } }); socket.on('disconnect', () => {
     if (DEBUG) console.log(`Déconnexion Socket: ${socket.id}`); if (socket.driverId) { connectedDrivers.delete(socket.driverId); if (DEBUG) console.log(`Driver déconnecté: ${socket.driverId}`); } if (socket.userId) { connectedUsers.delete(socket.userId);
       if (DEBUG) console.log(`User déconnecté: ${socket.userId}`);
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

