import { Socket, Server as SocketIOServer } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import pool from '../config/db.js';
import {recordOrderAssignment,saveDeliveryProofRecord,saveOrder, updateOrderStatus as updateOrderStatusDB,getActiveOrdersByDriver,} from '../config/orderStorage.js';
import qrCodeService from '../services/qrCodeService.js';
import { createTransactionAndInvoiceForOrder } from '../utils/createTransactionForOrder.js';
import { canUseDeferredPayment } from '../utils/deferredPaymentLimits.js';
import { maskOrderId, maskUserId } from '../utils/maskSensitiveData.js';
import { broadcastOrderUpdateToAdmins } from './adminSocket.js';
import { orderMatchingService } from '../utils/orderMatchingService.js';
import { canReceiveOrders, deductCommissionAfterDelivery } from '../services/commissionService.js';
import logger from '../utils/logger.js';
interface OrderCoordinates {
  latitude: number; longitude: number;
}

interface OrderLocation {
  address: string;
  coordinates?: OrderCoordinates; // Optionnel pour les commandes téléphoniques
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
const MAX_ACTIVE_ORDERS_PER_DRIVER = parseInt(process.env.MAX_ACTIVE_ORDERS_PER_DRIVER || '3');

// Fonction pour compter les commandes actives d'un client
function getActiveOrdersCountByUser(userId: string): number {
  let count = 0; for (const [, order] of activeOrders.entries()) {
    if (order.user.id === userId &&
      order.status !== 'completed' && order.status !== 'cancelled' && order.status !== 'declined') { count++; }
  }
  return count;
} // Fonction pour compter les commandes actives d'un livreur
function getActiveOrdersCountByDriver(driverId: string): number {
  let count = 0;
  for (const [, order] of activeOrders.entries()) {
    if (order.driverId === driverId &&
      order.status !== 'completed' && order.status !== 'cancelled' && order.status !== 'declined') { count++; }
  }
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
// Aucune restriction sur le nombre de commandes qu'un client peut envoyer au même driver
// Les clients peuvent envoyer un nombre illimité de commandes au même driver
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
  // Aucun filtrage basé sur le nombre de commandes précédentes entre le client et le driver
  // Tous les drivers disponibles dans la zone sont retournés, même s'ils ont déjà reçu
  // plusieurs commandes du même client
  return nearbyDrivers.sort((a, b) => a.distance - b.distance);
}

/**
 * Trouve tous les livreurs disponibles (pour les commandes B2B sans coordonnées GPS précises)
 */
async function findAllAvailableDrivers(
  deliveryMethod: string
): Promise<NearbyDriver[]> {
  const DEBUG = process.env.DEBUG_SOCKETS === 'true';
  // Import dynamique pour éviter les problèmes de dépendances circulaires
  const { realDriverStatuses } = await import('../controllers/driverController.js');
  const availableDrivers: NearbyDriver[] = [];

  if (DEBUG) {
    console.log(`[findAllAvailableDrivers] Recherche tous les livreurs disponibles: ${realDriverStatuses.size} livreurs en mémoire`);
  }

  // Vérifier aussi les livreurs connectés via socket
  const connectedDriversCount = connectedDrivers.size;
  if (DEBUG) {
    console.log(`[findAllAvailableDrivers] Livreurs connectés (socket): ${connectedDriversCount}`);
  }

  for (const [driverId, driverData] of realDriverStatuses.entries()) {
    if (!driverData.is_online || !driverData.is_available) {
      if (DEBUG) {
        console.log(`[findAllAvailableDrivers] Livreur ${maskUserId(driverId)} ignoré: online=${driverData.is_online}, available=${driverData.is_available}`);
      }
      continue;
    }

    // Vérifier si le livreur est connecté via socket
    const isConnected = connectedDrivers.has(driverId);
    if (!isConnected && DEBUG) {
      console.log(`[findAllAvailableDrivers] Livreur ${maskUserId(driverId)} disponible mais non connecté via socket`);
    }

    // Pour les commandes B2B, on accepte même les livreurs sans position GPS
    // car ils devront appeler le client pour obtenir la position exacte
    availableDrivers.push({
      driverId,
      distance: 0, // Distance inconnue pour les commandes B2B
      ...driverData
    });
  }

  if (DEBUG) {
    console.log(`[findAllAvailableDrivers] Total livreurs disponibles: ${availableDrivers.length} (${availableDrivers.filter(d => connectedDrivers.has(d.driverId)).length} connectés)`);
  }

  return availableDrivers;
}

/**
 * Fonction utilitaire pour rechercher et notifier les livreurs d'une nouvelle commande
 * Peut être utilisée depuis adminController pour les commandes créées par l'admin
 */
async function notifyDriversForOrder(
  io: SocketIOServer,
  order: Order,
  pickupCoords: OrderCoordinates | undefined,
  deliveryMethod: string
): Promise<void> {
  const DEBUG = process.env.DEBUG_SOCKETS === 'true';
  
  // Vérifier si c'est une commande téléphonique (B2B ou hors-ligne)
  const isPhoneOrder = (order as any).is_phone_order === true;
  const isB2BOrder = (order as any).is_b2b_order === true;
  const isPhoneOrB2B = isPhoneOrder || isB2BOrder;
  
  // Si pas de coordonnées ET ce n'est pas une commande téléphonique/B2B, ne pas chercher de livreurs
  if ((!pickupCoords || !pickupCoords.latitude || !pickupCoords.longitude) && !isPhoneOrB2B) {
    if (DEBUG) {
      console.log(`[notifyDriversForOrder] Commande ${maskOrderId(order.id)} sans coordonnées GPS et non-téléphonique - pas de recherche de livreurs`);
    }
    return;
  }

  try {
    // Ajouter la commande à activeOrders pour le suivi
    activeOrders.set(order.id, order);

    // Pour les commandes B2B ou téléphoniques, notifier tous les livreurs disponibles
    // Pour les autres commandes, chercher les livreurs proches
    let nearbyDrivers: NearbyDriver[];
    if (isB2BOrder) {
      // Pour les commandes B2B, toujours notifier tous les livreurs disponibles (avec ou sans coordonnées GPS)
      if (DEBUG) {
        console.log(`[notifyDriversForOrder] Commande B2B ${maskOrderId(order.id)} - recherche de tous les livreurs disponibles (avec coordonnées: ${!!(pickupCoords && pickupCoords.latitude && pickupCoords.longitude)})`);
      }
      nearbyDrivers = await findAllAvailableDrivers(deliveryMethod);
    } else if (isPhoneOrder && (!pickupCoords || !pickupCoords.latitude || !pickupCoords.longitude)) {
      // Pour les commandes téléphoniques normales sans coordonnées GPS, notifier tous les livreurs
      if (DEBUG) {
        console.log(`[notifyDriversForOrder] Commande téléphonique ${maskOrderId(order.id)} sans coordonnées GPS - recherche de tous les livreurs disponibles`);
      }
      nearbyDrivers = await findAllAvailableDrivers(deliveryMethod);
    } else {
      // Chercher les livreurs proches avec coordonnées GPS
      if (DEBUG) {
        console.log(`[notifyDriversForOrder] Commande normale ${maskOrderId(order.id)} - recherche de livreurs proches`);
      }
      nearbyDrivers = await findNearbyDrivers(pickupCoords!, deliveryMethod);
    }
    
    if (DEBUG) {
      console.log(`[notifyDriversForOrder] ${nearbyDrivers.length} livreurs trouvés pour commande ${maskOrderId(order.id)} (B2B: ${isB2BOrder}, Téléphonique: ${isPhoneOrder})`);
    }

    if (nearbyDrivers.length === 0) {
      if (DEBUG) {
        console.log(`[notifyDriversForOrder] Aucun chauffeur disponible pour la commande ${maskOrderId(order.id)}`);
      }
      return;
    }

    // Matching équitable : tous les livreurs reçoivent la commande, triés par priorité (notes)
    let selectedDrivers: NearbyDriver[];
    const useFairMatching = process.env.USE_INTELLIGENT_MATCHING !== 'false';
    
    if (useFairMatching && nearbyDrivers.length > 0) {
      if (DEBUG) {
        console.log(`[notifyDriversForOrder] Utilisation du matching équitable pour commande ${maskOrderId(order.id)}`);
      }
      
      try {
        // Récupérer tous les livreurs triés par priorité
        // PRIORISATION INTERNES : Les internes sont prioritaires sur B2B/planifiées
        const allDrivers = await orderMatchingService.findBestDrivers(
          nearbyDrivers,
          (driverId: string) => getActiveOrdersCountByDriver(driverId),
          {
            isB2B: isB2BOrder,
            isScheduled: (order as any).is_scheduled === true || (order as any).scheduled_at !== null,
            isSensitive: (order as any).is_sensitive === true || (order as any).is_vip === true,
          }
        );
        
        // Convertir les ScoredDriver en NearbyDriver pour compatibilité
        // TOUS les livreurs sont inclus (pas de limite)
        // MAIS filtrer les partenaires avec solde insuffisant
        const driversWithBalance: NearbyDriver[] = [];
        
        for (const scored of allDrivers) {
          const balanceCheck = await canReceiveOrders(scored.driverId);
          if (balanceCheck.canReceive) {
            driversWithBalance.push({
              driverId: scored.driverId,
              distance: scored.distance,
            });
          } else {
            if (DEBUG) {
              console.log(`[notifyDriversForOrder] Livreur ${maskUserId(scored.driverId)} exclu: ${balanceCheck.reason}`);
            }
          }
        }
        
        selectedDrivers = driversWithBalance;
        
        if (DEBUG) {
          console.log(`[notifyDriversForOrder] ${selectedDrivers.length} livreurs recevront la commande (${allDrivers.length - selectedDrivers.length} exclus pour solde insuffisant)`);
        }
      } catch (error: any) {
        logger.warn(`[notifyDriversForOrder] Erreur matching équitable, fallback sur tri par distance:`, error.message);
        // Fallback : trier par distance si le matching échoue
        selectedDrivers = nearbyDrivers.sort((a, b) => a.distance - b.distance);
      }
    } else {
      // Fallback : trier par distance (comportement original)
      if (DEBUG) {
        console.log(`[notifyDriversForOrder] Utilisation du tri par distance (matching équitable désactivé)`);
      }
      selectedDrivers = nearbyDrivers.sort((a, b) => a.distance - b.distance);
    }

    // Envoyer la commande aux livreurs sélectionnés (top 3)
    let driverIndex = 0;
    const tryNextDriver = async (): Promise<void> => {
      if (driverIndex >= selectedDrivers.length) {
        if (DEBUG) {
          console.log(`[notifyDriversForOrder] Tous les ${selectedDrivers.length} chauffeurs sélectionnés ont refusé ou timeout pour la commande ${maskOrderId(order.id)}`);
        }
        // Ne pas annuler automatiquement, laisser la commande en pending
        // Optionnel : on pourrait réessayer avec les autres livreurs disponibles
        activeOrders.delete(order.id);
        return;
      }

      const driver = selectedDrivers[driverIndex];
      const driverSocketId = connectedDrivers.get(driver.driverId);

      if (DEBUG) {
        console.log(`[notifyDriversForOrder] Tentative envoi à livreur ${maskUserId(driver.driverId)}: socket=${driverSocketId || 'NON CONNECTÉ'}, distance=${driver.distance.toFixed(2)}km`);
      }

      if (driverSocketId) {
        const assignedAt = new Date();
        order.assignedAt = assignedAt;
        
        // Enregistrer l'assignation
        await recordOrderAssignment(order.id, driver.driverId, { assignedAt }).catch(() => {});
        
        // Envoyer la commande au livreur
        io.to(driverSocketId).emit('new-order-request', order);
        
        if (DEBUG) {
          console.log(`[notifyDriversForOrder] Événement 'new-order-request' émis vers socket ${driverSocketId}`);
        }

        // Timeout de 20 secondes pour la réponse du livreur
        setTimeout(async () => {
          const currentOrder = activeOrders.get(order.id);
          if (currentOrder && currentOrder.status === 'pending') {
            if (DEBUG) {
              console.log(`[notifyDriversForOrder] Timeout driver ${maskUserId(driver.driverId)} pour commande ${maskOrderId(order.id)}`);
            }
            await recordOrderAssignment(order.id, driver.driverId, { declinedAt: new Date() }).catch(() => {});
            driverIndex++;
            tryNextDriver().catch(() => {});
          }
        }, 20000);
      } else {
        if (DEBUG) {
          console.log(`[notifyDriversForOrder] Chauffeur ${maskUserId(driver.driverId)} trouvé mais socket non connecté`);
        }
        driverIndex++;
        tryNextDriver().catch(() => {});
      }
    };

    tryNextDriver().catch(() => {});
  } catch (error: any) {
    console.error(`[notifyDriversForOrder] Erreur notification livreurs pour commande ${maskOrderId(order.id)}:`, error);
  }
}

const setupOrderSocket = (io: SocketIOServer): void => {
  const DEBUG = process.env.DEBUG_SOCKETS === 'true'; io.on('connection', (socket: ExtendedSocket) => {
    if (DEBUG) console.log(`Nouvelle connexion Socket: ${socket.id}`); socket.on('driver-connect', (driverId: string) => { connectedDrivers.set(driverId, socket.id); socket.driverId = driverId; console.log(`[DIAGNOSTIC] Driver connecté: ${maskUserId(driverId)} (socket: ${socket.id})`); console.log(` - Total drivers connectés: ${connectedDrivers.size}`); }); socket.on('user-connect', (userId: string) => {
      // Toujours mettre à jour l'association userId -> socketId
      // Cela garantit que même si le socket se reconnecte, l'association est correcte
      const previousSocketId = connectedUsers.get(userId);
      connectedUsers.set(userId, socket.id);
      socket.userId = userId;

      if (DEBUG || previousSocketId !== socket.id) {
        console.log(`[DIAGNOSTIC] User connecté: ${maskUserId(userId)} (socket: ${socket.id})`);
        if (previousSocketId && previousSocketId !== socket.id) {
          console.log(`[DIAGNOSTIC] Socket précédent remplacé: ${previousSocketId} → ${socket.id}`);
        }
        console.log(`[DIAGNOSTIC] Total users connectés: ${connectedUsers.size}`);
      }
    }); socket.on('create-order', async (orderData: CreateOrderData, ack?: (response: any) => void) => {
      try {
        if (DEBUG) console.log(`Nouvelle commande de ${maskUserId(socket.userId || 'unknown')}`); const { pickup, dropoff, deliveryMethod, userId, userInfo,
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
          socket.emit('order-error', { success: false, message: 'Coordinates manquantes' }); if (typeof ack === 'function') ack({ success: false, message: 'Coordinates manquantes' }); return;
        } const activeOrdersCount = getActiveOrdersCountByUser(userId);
        if (activeOrdersCount >= MAX_ACTIVE_ORDERS_PER_CLIENT) {
          const errorMsg = `Vous avez déjà ${activeOrdersCount} commande(s) active(s). Limite: ${MAX_ACTIVE_ORDERS_PER_CLIENT}`; socket.emit('order-error', { success: false, message: errorMsg }); if (typeof ack === 'function') ack({ success: false, message: errorMsg }); return;
        } const rawDistance = providedDistance != null ? Number(providedDistance) : getDistanceInKm(
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

        // Valider les limites de paiement différé si c'est un paiement différé par le client
        if (paymentMethodType === 'deferred' && (paymentPayerType === 'client' || !paymentPayerType)) {
          const validation = await canUseDeferredPayment(userId, price);
          if (!validation.canUse) {
            const errorMsg = validation.reason || 'Paiement différé non autorisé';
            if (DEBUG) {
              console.log(`Paiement différé refusé pour ${maskUserId(userId)}: ${errorMsg}`);
            }
            socket.emit('order-error', {
              success: false,
              message: errorMsg,
              code: validation.errorCode || 'DEFERRED_PAYMENT_LIMIT_EXCEEDED',
              errorCode: validation.errorCode,
              details: validation.details,
            });
            if (typeof ack === 'function') {
              ack({ success: false, message: errorMsg, errorCode: validation.errorCode, details: validation.details });
            }
            return;
          }
          if (DEBUG) {
            console.log(`Paiement différé autorisé pour ${maskUserId(userId)} - Montant: ${price} FCFA`);
          }
        }

        let initialPaymentStatus: 'pending' | 'delayed' = 'pending'; if (paymentMethodType === 'deferred') { initialPaymentStatus = 'delayed'; } const order: Order = {
          id: providedOrderId || uuidv4(),
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
          status: 'pending', createdAt: new Date(),
        }; (order as any).payment_method_id = paymentMethodId || null;
        (order as any).payment_method_type = paymentMethodType;
        (order as any).payment_status = initialPaymentStatus;
        (order as any).payment_payer = paymentPayerType || 'client'; (order as any).is_partial_payment = isPartialPayment || false; (order as any).partial_amount = isPartialPayment && partialAmount ? partialAmount : null; (order as any).recipient_user_id = recipientUserId || null;
        (order as any).recipient_is_registered = recipientIsRegistered || false;

        activeOrders.set(order.id, order);

        // Diffuser la nouvelle commande aux admins
        broadcastOrderUpdateToAdmins(io, 'order:created', { order });

        let dbSaved = false;
        let dbErrorMsg: string | null = null;
        try {
          await saveOrder(order);
          dbSaved = true;
          if (DEBUG) console.log(`Commande ${maskOrderId(order.id)} sauvegardée en DB`);

          // Générer automatiquement le QR code de livraison
          try {
            const orderNumber = `CMD-${order.id.substring(0, 8).toUpperCase()}`;
            const recipientName = order.recipient?.phone
              ? `Destinataire (${order.recipient.phone})`
              : order.dropoff.details?.phone
                ? `Destinataire (${order.dropoff.details.phone})`
                : 'Destinataire';
            const recipientPhone = order.recipient?.phone || order.dropoff.details?.phone || '';
            const creatorName = order.user.name || 'Client';

            await qrCodeService.generateDeliveryQRCode(
              order.id,
              orderNumber,
              recipientName,
              recipientPhone,
              creatorName
            );

            if (DEBUG) console.log(`QR code généré pour commande ${maskOrderId(order.id)}`);
          } catch (qrError: any) {
            console.warn(`Échec génération QR code pour ${maskOrderId(order.id)}:`, qrError.message);
            // Ne pas bloquer la création de commande si le QR code échoue
          }

          if (paymentMethodType && price) {
            try {
              const { transactionId, invoiceId } = await createTransactionAndInvoiceForOrder(
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
                paymentPayerType || 'client', recipientUserId, paymentMethodId || null);

              if (transactionId && invoiceId) {
                if (DEBUG) {
                  console.log(`Transaction ${transactionId} et facture ${invoiceId} créées pour commande ${maskOrderId(order.id)}`);
                } else { console.log(`Transaction créée: ${transactionId} pour commande ${maskOrderId(order.id)}`); }
              } else { console.warn(`Transaction ou facture non créée pour commande ${maskOrderId(order.id)}: transactionId=${transactionId}, invoiceId=${invoiceId}`); }
            } catch (transactionError: any) { console.error(`Échec création transaction/facture pour ${maskOrderId(order.id)}:`, transactionError.message, transactionError.stack); }
          } else {
            if (DEBUG) {
              console.log(`Transaction non créée pour commande ${maskOrderId(order.id)}: paymentMethodType=${paymentMethodType}, price=${price}`);
            }
          }
        } catch (dbError: any) {
          dbSaved = false;
          dbErrorMsg = dbError && dbError.message ? dbError.message : String(dbError);
          console.warn(`Échec sauvegarde DB pour ${maskOrderId(order.id)}:`, dbErrorMsg);
        } io.to(socket.id).emit('order-created', {
          success: true, order, dbSaved, dbError: dbErrorMsg,
          message: 'Commande créée, recherche de chauffeur...'
        }); try { if (typeof ack === 'function') ack({ success: true, orderId: order.id, dbSaved, dbError: dbErrorMsg }); } catch (e) { if (DEBUG) console.warn('Ack callback failed for create-order', e); } const nearbyDrivers = await findNearbyDrivers(pickup.coordinates, deliveryMethod); const { realDriverStatuses } = await import('../controllers/driverController.js'); console.log(`[DIAGNOSTIC] Recherche livreurs pour commande ${maskOrderId(order.id)}:`); console.log(` - Livreurs en mémoire: ${realDriverStatuses.size}`); console.log(` - Livreurs connectés (socket): ${connectedDrivers.size}`); console.log(` - Livreurs proches trouvés: ${nearbyDrivers.length}`); for (const [driverId, driverData] of realDriverStatuses.entries()) {
          const isConnected = connectedDrivers.has(driverId); const hasPosition = !!(driverData.current_latitude && driverData.current_longitude); const distance = hasPosition ? getDistanceInKm(
            pickup.coordinates.latitude,
            pickup.coordinates.longitude,
            driverData.current_latitude!,
            driverData.current_longitude!
          ) : null;

          console.log(` - ${maskUserId(driverId)}: online=${driverData.is_online}, available=${driverData.is_available}, connected=${isConnected}, has_position=${hasPosition}${distance !== null ? `, distance=${distance.toFixed(2)}km` : ''}`);
        } if (nearbyDrivers.length === 0) {
          console.log(`Aucun chauffeur disponible dans la zone pour la commande ${maskOrderId(order.id)}`);
          io.to(socket.id).emit('no-drivers-available', { orderId: order.id, message: 'Aucun chauffeur disponible dans votre zone' });
          return;
        }
        if (DEBUG) console.log(`${nearbyDrivers.length} chauffeurs trouvés pour la commande ${maskOrderId(order.id)}`);
        
        // Matching équitable : tous les livreurs reçoivent la commande, triés par priorité (notes)
        let selectedDrivers: NearbyDriver[];
        const useFairMatching = process.env.USE_INTELLIGENT_MATCHING !== 'false'; // Activé par défaut
        
        if (useFairMatching && nearbyDrivers.length > 0) {
          if (DEBUG) {
            console.log(`[create-order] Utilisation du matching équitable pour commande ${maskOrderId(order.id)}`);
          }
          
          try {
            // Récupérer tous les livreurs triés par priorité
            // PRIORISATION INTERNES : Les internes sont prioritaires sur B2B/planifiées
            const orderIsB2B = (order as any).is_b2b_order === true;
            const allDrivers = await orderMatchingService.findBestDrivers(
              nearbyDrivers,
              (driverId: string) => getActiveOrdersCountByDriver(driverId),
              {
                isB2B: orderIsB2B,
                isScheduled: (order as any).is_scheduled === true || (order as any).scheduled_at !== null,
                isSensitive: (order as any).is_sensitive === true || (order as any).is_vip === true,
              }
            );
            
            // Convertir les ScoredDriver en NearbyDriver pour compatibilité
            // TOUS les livreurs sont inclus (pas de limite)
            selectedDrivers = allDrivers.map(scored => ({
              driverId: scored.driverId,
              distance: scored.distance,
            }));
            
            if (DEBUG) {
              console.log(`[create-order] ${selectedDrivers.length} livreurs recevront la commande (triés par priorité)`);
            }
          } catch (error: any) {
            logger.warn(`[create-order] Erreur matching équitable, fallback sur tri par distance:`, error.message);
            // Fallback : trier par distance si le matching échoue
            selectedDrivers = nearbyDrivers.sort((a, b) => a.distance - b.distance);
          }
        } else {
          // Fallback : trier par distance (comportement original)
          if (DEBUG) {
            console.log(`[create-order] Utilisation du tri par distance (matching équitable désactivé)`);
          }
          selectedDrivers = nearbyDrivers.sort((a, b) => a.distance - b.distance);
        }
        
        let driverIndex = 0;
        const tryNextDriver = async (): Promise<void> => {
          if (driverIndex >= selectedDrivers.length) {
            console.log(`Tous les chauffeurs sont occupés pour la commande ${maskOrderId(order.id)} - Annulation automatique`); try { order.status = 'cancelled'; order.cancelledAt = new Date(); await updateOrderStatusDB(order.id, 'cancelled', { cancelled_at: order.cancelledAt }); console.log(`Commande ${maskOrderId(order.id)} annulée automatiquement en DB`); } catch (dbError: any) { console.warn(`Échec annulation DB pour ${maskOrderId(order.id)}:`, dbError.message); } const userSocketId = connectedUsers.get(order.user.id); if (userSocketId) { io.to(userSocketId).emit('order-cancelled', { orderId: order.id, reason: 'no_drivers_available', message: 'Aucun chauffeur disponible - Commande annulée' }); } socket.emit('no-drivers-available', { orderId: order.id, message: 'Tous les chauffeurs sont occupés - Commande annulée' }); activeOrders.delete(order.id); return;
          }

          const driver = selectedDrivers[driverIndex];
          const driverSocketId = connectedDrivers.get(driver.driverId);

          console.log(`[DIAGNOSTIC] Tentative envoi à livreur ${maskUserId(driver.driverId)}:`); console.log(` - Socket ID: ${driverSocketId || 'NON CONNECTÉ'}`); console.log(` - Distance: ${driver.distance.toFixed(2)}km`); if (driverSocketId) {
            const assignedAt = new Date(); order.assignedAt = assignedAt; console.log(`Envoi commande à driver ${maskUserId(driver.driverId)} (socket: ${driverSocketId})`); await recordOrderAssignment(order.id, driver.driverId, { assignedAt }).catch(() => { }); io.to(driverSocketId).emit('new-order-request', order); console.log(`Événement 'new-order-request' émis vers socket ${driverSocketId}`); setTimeout(async () => { const currentOrder = activeOrders.get(order.id); if (currentOrder && currentOrder.status === 'pending') { if (DEBUG) console.log(`Timeout driver ${maskUserId(driver.driverId)} pour commande ${maskOrderId(order.id)}`); await recordOrderAssignment(order.id, driver.driverId, { declinedAt: new Date() }).catch(() => { }); driverIndex++; tryNextDriver().catch(() => { }); } }, 20000);
          } else {
            if (DEBUG) console.log(`Chauffeur ${driver.driverId} trouvé mais socket non connecté.`); driverIndex++; tryNextDriver().catch(() => { });
          }
        };

        tryNextDriver().catch(() => { });

      } catch (error: any) {
        console.error('Erreur création commande:', error); socket.emit('order-error', { success: false, message: 'Erreur lors de la création de la commande' });
      }
    });

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

      const activeOrdersCount = getActiveOrdersCountByDriver(driverId);
      if (activeOrdersCount >= MAX_ACTIVE_ORDERS_PER_DRIVER) {
        const errorMsg = `Vous avez déjà ${activeOrdersCount} commande(s) active(s). Limite: ${MAX_ACTIVE_ORDERS_PER_DRIVER}`;
        socket.emit('order-accept-error', { orderId, message: errorMsg });
        return;
      }

      order.status = 'accepted';
      order.driverId = driverId;
      order.acceptedAt = new Date();

      let dbSavedAssign = false;
      let dbErrorAssign: string | null = null;

      try {
        await updateOrderStatusDB(orderId, 'accepted', {
          driver_id: driverId,
          accepted_at: order.acceptedAt,
          assigned_at: order.assignedAt || order.createdAt,
        });
        dbSavedAssign = true;

        if (DEBUG) console.log(`Statut commande ${maskOrderId(orderId)} mis à jour en DB`);

        try {
          await (pool as any).query(
            `UPDATE invoices SET driver_id = $1 WHERE order_id = $2 AND driver_id IS NULL`,
            [driverId, orderId]
          );
          if (DEBUG) console.log(`Facture mise à jour avec driverId pour commande ${maskOrderId(orderId)}`);
        } catch (invoiceError: any) {
          if (DEBUG) console.warn(`Échec mise à jour facture pour ${maskOrderId(orderId)}:`, invoiceError.message);
        }
      } catch (dbError: any) {
        dbSavedAssign = false;
        dbErrorAssign = dbError && dbError.message ? dbError.message : String(dbError);
        console.warn(`Échec mise à jour DB pour ${maskOrderId(orderId)}:`, dbErrorAssign);
      }

      if (DEBUG) console.log(`Commande ${maskOrderId(orderId)} acceptée par driver ${maskUserId(driverId)}`);

      // Créer automatiquement une conversation pour cette commande
      try {
        const { default: messageService } = await import('../services/messageService.js');
        await messageService.createOrderConversation(orderId, order.user.id, driverId);
        if (DEBUG) console.log(`Conversation créée pour la commande ${maskOrderId(orderId)}`);
      } catch (convError: any) {
        // Ne pas bloquer l'acceptation de la commande si la création de conversation échoue
        console.warn(`Échec création conversation pour ${maskOrderId(orderId)}:`, convError.message);
      }

      socket.emit('order-accepted-confirmation', {
        success: true,
        order,
        dbSaved: dbSavedAssign,
        dbError: dbErrorAssign,
        message: 'Commande acceptée avec succès'
      });

      // Diffuser aux admins
      broadcastOrderUpdateToAdmins(io, 'order:assigned', { order, driverId });

      // Fonction helper pour envoyer order-accepted avec retry
      const sendOrderAccepted = async (retryCount = 0) => {
        // Récupérer le socketId à chaque tentative (peut avoir changé)
        let userSocketId = connectedUsers.get(order.user.id);

        if (!userSocketId) {
          if (retryCount < 3) {
            // Attendre un peu et réessayer (le client peut être en train de se reconnecter)
            console.log(`[RETRY ${retryCount + 1}/3] User ${maskUserId(order.user.id)} non connecté, attente de reconnexion...`);
            setTimeout(() => sendOrderAccepted(retryCount + 1), 500 * (retryCount + 1));
            return;
          } else {
            console.warn(`User ${maskUserId(order.user.id)} non connecté après ${retryCount} tentatives - impossible d'émettre order-accepted pour commande ${maskOrderId(orderId)}`);
            console.log(`[DIAGNOSTIC] Users connectés:`, Array.from(connectedUsers.keys()).map(id => maskUserId(id)));
            return;
          }
        }

        // Récupérer le socket à nouveau (peut avoir changé entre-temps)
        const userSocket = io.sockets.sockets.get(userSocketId);
        if (!userSocket || !userSocket.connected) {
          if (retryCount < 3) {
            // Le socket n'est plus connecté, attendre et réessayer
            console.log(`[RETRY ${retryCount + 1}/3] Socket ${userSocketId} déconnecté pour user ${maskUserId(order.user.id)}, attente de reconnexion...`);
            setTimeout(() => sendOrderAccepted(retryCount + 1), 500 * (retryCount + 1));
            return;
          } else {
            console.warn(`User ${maskUserId(order.user.id)} socket ${userSocketId} non connecté après ${retryCount} tentatives - impossible d'émettre order-accepted pour commande ${maskOrderId(orderId)}`);
            return;
          }
        }

        // S'assurer que le statut est bien 'accepted' avant d'envoyer
        const orderToSend = {
          ...order,
          status: 'accepted', // Forcer le statut à 'accepted'
        };

        console.log(`[DIAGNOSTIC] Envoi order-accepted à user ${maskUserId(order.user.id)} (socket: ${userSocketId}) pour commande ${maskOrderId(orderId)}`);

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

          // Vérifier une dernière fois que le socket est toujours connecté avant d'envoyer
          const currentSocket = io.sockets.sockets.get(userSocketId);
          if (!currentSocket || !currentSocket.connected) {
            if (retryCount < 3) {
              console.log(`[RETRY ${retryCount + 1}/3] Socket déconnecté juste avant l'envoi, nouvelle tentative...`);
              setTimeout(() => sendOrderAccepted(retryCount + 1), 500 * (retryCount + 1));
              return;
            } else {
              console.error(`Impossible d'envoyer order-accepted: socket déconnecté après ${retryCount} tentatives`);
              return;
            }
          }

          // Utiliser currentSocket.emit() directement pour garantir l'envoi au bon socket
          currentSocket.emit('order-accepted', {
            order: orderToSend, // Utiliser orderToSend avec statut 'accepted' garanti
            driverInfo,
            dbSaved: dbSavedAssign,
            dbError: dbErrorAssign
          });

          // Émettre aussi order:status:update pour garantir la synchronisation du statut
          currentSocket.emit('order:status:update', {
            order: orderToSend,
            location: null
          });

          console.log(`order-accepted et order:status:update émis avec succès pour commande ${maskOrderId(orderId)}`);
        } catch (err) {
          console.error(`Erreur préparation order-accepted:`, err);
          // En cas d'erreur, essayer quand même d'envoyer avec les données minimales
          const currentSocket = io.sockets.sockets.get(userSocketId);
          if (currentSocket && currentSocket.connected) {
            currentSocket.emit('order-accepted', {
              order: orderToSend, // Utiliser orderToSend même en cas d'erreur
              driverInfo: { id: driverId }
            });
            // Émettre aussi order:status:update même en cas d'erreur
            currentSocket.emit('order:status:update', {
              order: orderToSend,
              location: null
            });
            console.log(`order-accepted et order:status:update émis (mode fallback) pour commande ${maskOrderId(orderId)}`);
          } else if (retryCount < 3) {
            setTimeout(() => sendOrderAccepted(retryCount + 1), 500 * (retryCount + 1));
          }
        }
      };

      // Démarrer l'envoi avec retry
      sendOrderAccepted();
    });

    socket.on('decline-order', (data: { orderId: string; driverId: string }) => {
      const { orderId, driverId } = data;
      const order = activeOrders.get(orderId);

      if (!order) {
        socket.emit('order-not-found', { orderId });
        return;
      }

      if (DEBUG) console.log(`Commande ${maskOrderId(orderId)} déclinée par driver ${maskUserId(driverId)}`);

      recordOrderAssignment(orderId, driverId, { declinedAt: new Date() }).catch(() => { });

      socket.emit('order-declined-confirmation', {
        success: true,
        orderId,
        message: 'Commande déclinée'
      });
    });

    socket.on('update-delivery-status', async (data: { orderId: string; status: string; location?: any }, ack?: (response: any) => void) => {
      try {
        const { orderId, status, location } = data || {};
        const order = activeOrders.get(orderId);

        if (!order) {
          if (typeof ack === 'function') ack({ success: false, message: 'Order not found' });
          socket.emit('order-not-found', { orderId });
          return;
        }

        const driverId = socket.driverId;
        if (!driverId) {
          if (typeof ack === 'function') ack({ success: false, message: 'Driver not authenticated on socket' });
          socket.emit('unauthorized', { message: 'Driver not authenticated' });
          return;
        }

        if (order.driverId && order.driverId !== driverId) {
          if (typeof ack === 'function') ack({ success: false, message: 'Driver not assigned to this order' });
          socket.emit('forbidden', { message: 'Driver not assigned to this order' });
          return;
        }

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

        order.status = status;
        if (status === 'completed') {
          order.completedAt = new Date();
        }

        let dbSavedStatus = false;
        let dbErrorStatus: string | null = null;

        try {
          await updateOrderStatusDB(orderId, status, {
            driver_id: driverId,
            completed_at: status === 'completed' ? order.completedAt : undefined
          });
          dbSavedStatus = true;
          if (DEBUG) console.log(`Statut commande ${maskOrderId(orderId)} mis à jour en DB`);

          // Si le livreur marque "picked_up" et que c'est un paiement en espèces par le client,
          // marquer automatiquement le paiement comme payé
          if (status === 'picked_up') {
            try {
              // Récupérer les informations de paiement depuis la base de données
              const paymentInfoResult = await (pool as any).query(
                `SELECT payment_method_type, payment_payer, payment_status 
                 FROM orders 
                 WHERE id = $1`,
                [orderId]
              );

              if (paymentInfoResult.rows.length > 0) {
                const paymentInfo = paymentInfoResult.rows[0];
                const paymentMethodType = paymentInfo.payment_method_type;
                const paymentPayer = paymentInfo.payment_payer;
                const currentPaymentStatus = paymentInfo.payment_status;

                // Vérifier si c'est un paiement en espèces par le client et qu'il n'est pas déjà payé
                if (
                  paymentMethodType === 'cash' &&
                  paymentPayer === 'client' &&
                  currentPaymentStatus !== 'paid'
                ) {
                  // Mettre à jour le statut de paiement dans orders
                  await (pool as any).query(
                    `UPDATE orders 
                     SET payment_status = 'paid', updated_at = NOW() 
                     WHERE id = $1`,
                    [orderId]
                  );

                  // Mettre à jour le statut de paiement dans transactions
                  await (pool as any).query(
                    `UPDATE transactions 
                     SET status = 'paid', updated_at = NOW() 
                     WHERE order_id = $1 AND payer_type = 'client' AND status != 'paid'`,
                    [orderId]
                  );

                  if (DEBUG) {
                    console.log(`Paiement en espèces marqué comme payé pour commande ${maskOrderId(orderId)}`);
                  }
                }
              }
            } catch (paymentError: any) {
              // Ne pas bloquer la mise à jour du statut de livraison si la mise à jour du paiement échoue
              console.warn(`Échec mise à jour paiement pour ${maskOrderId(orderId)}:`, paymentError.message);
            }
          }
        } catch (dbError: any) {
          dbSavedStatus = false;
          dbErrorStatus = dbError && dbError.message ? dbError.message : String(dbError);
          console.warn(`Échec mise à jour DB pour ${maskOrderId(orderId)}:`, dbErrorStatus);
        }

        if (DEBUG) console.log(`Statut livraison ${maskOrderId(orderId)}: ${status} par driver ${maskUserId(driverId)}`);

        // Émettre l'événement au client AVANT de supprimer de activeOrders
        // Cela garantit que le client reçoit la mise à jour même si la commande est complétée
        const userSocketId = connectedUsers.get(order.user.id);
        if (userSocketId) {
          // S'assurer que le statut est bien défini dans l'objet order avant l'émission
          const orderToEmit = {
            ...order,
            status: status, // Forcer le statut à jour
            completedAt: status === 'completed' ? order.completedAt : order.completedAt,
          };
          
          // Vérifier que le socket est toujours connecté
          const userSocket = io.sockets.sockets.get(userSocketId);
          if (userSocket && userSocket.connected) {
            userSocket.emit('order:status:update', {
              order: orderToEmit,
              location,
              dbSaved: dbSavedStatus,
              dbError: dbErrorStatus
            });
            
            logger.info(
              `[DIAGNOSTIC] order:status:update émis au client ${maskUserId(order.user.id)} pour commande ${maskOrderId(orderId)} avec statut ${status}`,
              undefined,
              { orderId, status, userSocketId, hasLocation: !!location }
            );
          } else {
            logger.warn(
              `[DIAGNOSTIC] Socket ${userSocketId} non connecté pour user ${maskUserId(order.user.id)} - impossible d'émettre order:status:update`,
              undefined,
              { orderId, status }
            );
          }
        } else {
          // Si le client n'est pas connecté, logger un avertissement
          logger.warn(
            `[DIAGNOSTIC] Client ${maskUserId(order.user.id)} non connecté - impossible d'émettre order:status:update pour commande ${maskOrderId(orderId)} avec statut ${status}`,
            undefined,
            { orderId, status, connectedUsersCount: connectedUsers.size }
          );
        }

        // Diffuser aux admins
        broadcastOrderUpdateToAdmins(io, 'order:status:update', {
          order,
          location,
          dbSaved: dbSavedStatus,
          dbError: dbErrorStatus
        });

        if (typeof ack === 'function') {
          ack({
            success: true,
            order,
            dbSaved: dbSavedStatus,
            dbError: dbErrorStatus
          });
        }

        if (status === 'completed') {
          // Prélever la commission pour les livreurs partenaires
          try {
            const commissionResult = await deductCommissionAfterDelivery(
              driverId,
              orderId,
              order.price
            );

            if (commissionResult.success) {
              if (DEBUG) {
                console.log(
                  `Commission prélevée pour ${maskUserId(driverId)}: ` +
                  `${commissionResult.commissionAmount?.toFixed(2)} FCFA ` +
                  `(nouveau solde: ${commissionResult.newBalance?.toFixed(2)} FCFA)`
                );
              }
            } else {
              logger.warn(
                `Échec prélèvement commission pour ${maskUserId(driverId)}: ${commissionResult.error}`
              );
              // Ne pas bloquer la livraison si le prélèvement échoue
              // Le système d'alertes gérera la notification au livreur
            }
          } catch (commissionError: any) {
            logger.error(
              `Erreur prélèvement commission pour ${maskUserId(driverId)}:`,
              commissionError
            );
            // Ne pas bloquer la livraison
          }

          // Retirer immédiatement de activeOrders pour éviter qu'elle réapparaisse après refresh
          activeOrders.delete(order.id);
          if (DEBUG) console.log(`Commande ${maskOrderId(order.id)} supprimée du cache (complétée)`);
        }
      } catch (err: any) {
        if (DEBUG) console.error('Error in update-delivery-status socket handler', err);
        if (typeof ack === 'function') {
          ack({ success: false, message: 'Server error' });
        }
      }
    });

    // Événement de géofencing (livreur entré dans la zone)
    socket.on('driver-geofence-event', (data: { orderId: string; eventType: 'entered' | 'validated'; location?: any; timestamp?: string }) => {
      try {
        const { orderId, eventType, location } = data || {};

        if (!orderId) {
          return;
        }

        const order = activeOrders.get(orderId);
        if (!order) {
          return;
        }

        const driverId = socket.driverId;
        if (!driverId || order.driverId !== driverId) {
          return;
        }

        // Notifier le client
        const userSocketId = connectedUsers.get(order.user.id);
        if (userSocketId) {
          io.to(userSocketId).emit('driver:geofence:event', {
            orderId,
            eventType,
            location,
            timestamp: data.timestamp || new Date().toISOString(),
          });

          if (DEBUG) {
            console.log(
              `[driver-geofence-event] ${eventType} pour commande ${maskOrderId(orderId)} - notifié client`
            );
          }
        }

        // Diffuser aux admins
        broadcastOrderUpdateToAdmins(io, 'driver:geofence:event', {
          orderId,
          eventType,
          location,
          timestamp: data.timestamp || new Date().toISOString(),
        });
      } catch (err: any) {
        if (DEBUG) {
          console.error('Error in driver-geofence-event socket handler', err);
        }
      }
    });

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
          if (DEBUG) console.log(`Preuve de livraison sauvegardée pour ${maskOrderId(orderId)}`);
        } catch (err: any) {
          dbSavedProof = false;
          dbErrorProof = err && err.message ? err.message : String(err);
          if (DEBUG) console.warn('Failed to save proof to DB', dbErrorProof);
        }

        const userSocketId = connectedUsers.get(order.user.id);
        if (userSocketId) {
          io.to(userSocketId).emit('order:proof:uploaded', {
            orderId,
            uploadedAt: order.proof?.uploadedAt || new Date(),
            dbSaved: dbSavedProof,
            dbError: dbErrorProof
          });
        }

        if (typeof ack === 'function') {
          ack({
            success: true,
            order,
            dbSaved: dbSavedProof,
            dbError: dbErrorProof
          });
        }
      } catch (err: any) {
        if (DEBUG) console.error('Error in send-proof socket handler', err);
        if (typeof ack === 'function') {
          ack({ success: false, message: 'Server error' });
        }
      }
    });

    socket.on('user-reconnect', async ({ userId }: { userId?: string } = {}) => {
      try {
        if (!userId) return;

        const pending: Order[] = [];
        const current: Order[] = [];
        const ordersFromDB = new Map<string, any>();

        // Charger depuis la base de données pour avoir les statuts à jour
        try {
          const { getActiveOrdersByUser } = await import('../config/orderStorage.js');
          const dbOrders = await getActiveOrdersByUser(userId);
          for (const dbOrder of dbOrders) {
            // Enrichir avec les informations driver si nécessaire
            if (dbOrder.driver_id) {
              const driverResult = await (pool as any).query(
                'SELECT id, email, phone, first_name, last_name, avatar_url FROM users WHERE id = $1',
                [dbOrder.driver_id]
              );
              if (driverResult.rows.length > 0) {
                const driver = driverResult.rows[0];
                ordersFromDB.set(dbOrder.id, {
                  ...dbOrder,
                  driver: {
                    id: driver.id,
                    email: driver.email,
                    phone: driver.phone,
                    name: driver.first_name && driver.last_name 
                      ? `${driver.first_name} ${driver.last_name}` 
                      : driver.email,
                    avatar: driver.avatar_url,
                  },
                  driverId: dbOrder.driver_id,
                  status: dbOrder.status,
                });
              }
            } else {
              ordersFromDB.set(dbOrder.id, {
                ...dbOrder,
                status: dbOrder.status,
              });
            }
          }
        } catch (dbError: any) {
          logger.warn('Erreur lors du chargement depuis la DB pour user-reconnect:', dbError);
        }

        // Fusionner avec activeOrders en mémoire (priorité à la DB)
        const allOrders = new Map<string, Order>();

        // D'abord ajouter les commandes de la DB (source de vérité)
        for (const [orderId, dbOrder] of ordersFromDB.entries()) {
          if (dbOrder.status !== 'completed' && dbOrder.status !== 'cancelled' && dbOrder.status !== 'declined') {
            allOrders.set(orderId, dbOrder as Order);
          }
        }

        // Ensuite ajouter les commandes de la mémoire qui ne sont pas dans la DB
        for (const [orderId, memOrder] of activeOrders.entries()) {
          if (memOrder.user && memOrder.user.id === userId && 
              memOrder.status !== 'completed' && 
              memOrder.status !== 'cancelled' && 
              memOrder.status !== 'declined' &&
              !allOrders.has(orderId)) {
            allOrders.set(orderId, memOrder);
          }
        }

        // Séparer pending et current
        for (const [, order] of allOrders.entries()) {
          if (order.status === 'pending') {
            pending.push(order);
          } else {
            current.push(order);
          }
        }

        io.to(socket.id).emit('resync-order-state', {
          pendingOrders: pending,
          activeOrders: current,
          pendingOrder: pending.length ? pending[0] : null,
          currentOrder: current.length ? current[0] : null,
        });
      } catch (err: any) {
        logger.error('Error handling user-reconnect', err);
        if (DEBUG) console.warn('Error handling user-reconnect', err);
      }
    });

    socket.on('driver-reconnect', async ({ driverId }: { driverId?: string } = {}) => {
      try {
        if (!driverId) return;

        const pending: Order[] = [];
        const active: Order[] = [];
        const ordersFromDB = new Map<string, any>();

        // Charger depuis la base de données pour avoir les statuts à jour
        try {
          const dbOrders = await getActiveOrdersByDriver(driverId);
          for (const dbOrder of dbOrders) {
            // Enrichir avec les informations user si nécessaire
            if (dbOrder.user_id) {
              const userResult = await (pool as any).query(
                'SELECT id, email, phone, first_name, last_name, avatar_url FROM users WHERE id = $1',
                [dbOrder.user_id]
              );
              if (userResult.rows.length > 0) {
                const user = userResult.rows[0];
                ordersFromDB.set(dbOrder.id, {
                  ...dbOrder,
                  user: {
                    id: user.id,
                    email: user.email,
                    phone: user.phone,
                    name: user.first_name && user.last_name 
                      ? `${user.first_name} ${user.last_name}` 
                      : user.email,
                    avatar: user.avatar_url,
                  },
                  driverId: dbOrder.driver_id,
                  status: dbOrder.status,
                });
              }
            }
          }
        } catch (dbError: any) {
          logger.warn('Erreur lors du chargement depuis la DB pour driver-reconnect:', dbError);
        }

        // Fusionner avec activeOrders en mémoire (priorité à la DB)
        const allOrders = new Map<string, Order>();

        // D'abord ajouter les commandes de la DB (source de vérité)
        for (const [orderId, dbOrder] of ordersFromDB.entries()) {
          if (dbOrder.status !== 'completed' && dbOrder.status !== 'cancelled' && dbOrder.status !== 'declined') {
            allOrders.set(orderId, dbOrder as Order);
          }
        }

        // Ensuite ajouter les commandes de la mémoire qui ne sont pas dans la DB
        for (const [orderId, memOrder] of activeOrders.entries()) {
          if (memOrder.driverId === driverId && 
              memOrder.status !== 'completed' && 
              memOrder.status !== 'cancelled' && 
              memOrder.status !== 'declined' &&
              !allOrders.has(orderId)) {
            allOrders.set(orderId, memOrder);
          }
        }

        // Séparer pending et active
        for (const [, order] of allOrders.entries()) {
          if (order.status === 'pending') {
            pending.push(order);
          } else {
            active.push(order);
          }
        }

        io.to(socket.id).emit('resync-order-state', {
          pendingOrders: pending,
          activeOrders: active,
          pendingOrder: pending.length ? pending[0] : null,
          currentOrder: active.length ? active[0] : null,
        });
      } catch (err: any) {
        logger.error('Error handling driver-reconnect', err);
        if (DEBUG) console.warn('Error handling driver-reconnect', err);
      }
    });

    socket.on('disconnect', () => {
      if (DEBUG) console.log(`Déconnexion Socket: ${socket.id}`);

      if (socket.driverId) {
        connectedDrivers.delete(socket.driverId);
        if (DEBUG) console.log(`Driver déconnecté: ${socket.driverId}`);
      }

      if (socket.userId) {
        connectedUsers.delete(socket.userId);
        if (DEBUG) console.log(`User déconnecté: ${socket.userId}`);
      }
    });
  });
};

export {
  activeOrders, calculatePrice, connectedDrivers,
  connectedUsers, estimateDuration,
  findNearbyDrivers, findAllAvailableDrivers, setupOrderSocket, notifyDriversForOrder
};

