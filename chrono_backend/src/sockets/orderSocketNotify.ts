import { Server as SocketIOServer } from 'socket.io';
import { maskOrderId, maskUserId } from '../utils/maskSensitiveData.js';
import logger from '../utils/logger.js';
import { recordOrderAssignment } from '../config/orderStorage.js';
import { canReceiveOrders } from '../services/commissionService.js';
import { orderMatchingService } from '../utils/orderMatchingService.js';
import {
  activeOrders,
  connectedDrivers,
  DRIVER_OFFER_RESPONSE_MS,
  DRIVER_OFFER_SOCKET_RETRY_MS,
} from './orderSocketState.js';
import type { Order, NearbyDriver, OrderCoordinates } from './orderSocketTypes.js';
import {
  delayMs,
  getActiveOrdersCountByDriver,
} from './orderSocketUtils.js';
import {
  findNearbyDrivers,
  findAllAvailableDrivers,
  prioritizePreferredDrivers,
} from './orderSocketMatching.js';

/**
 * Fonction utilitaire pour rechercher et notifier les livreurs d'une nouvelle commande
 * Peut être utilisée depuis adminController pour les commandes créées par l'admin
 */
export async function notifyDriversForOrder(
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
  const preferredDriverId =
    typeof (order as any).preferred_driver_id === 'string'
      ? (order as any).preferred_driver_id
      : null;

  // Si pas de coordonnées ET ce n'est pas une commande téléphonique/B2B, ne pas chercher de livreurs
  if ((!pickupCoords || !pickupCoords.latitude || !pickupCoords.longitude) && !isPhoneOrB2B) {
    if (DEBUG) {
      logger.debug(
        `[notifyDriversForOrder] Commande ${maskOrderId(order.id)} sans coordonnées GPS et non-téléphonique - pas de recherche de livreurs`
      );
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
        logger.debug(
          `[notifyDriversForOrder] Commande B2B ${maskOrderId(order.id)} - recherche de tous les livreurs disponibles (avec coordonnées: ${!!(pickupCoords && pickupCoords.latitude && pickupCoords.longitude)})`
        );
      }
      nearbyDrivers = await findAllAvailableDrivers(deliveryMethod, { b2bOnly: true });
      if (nearbyDrivers.length === 0) {
        logger.warn(
          `[notifyDriversForOrder] Aucun livreur opt-in B2B disponible pour ${maskOrderId(order.id)} — fallback tous livreurs disponibles`
        );
        nearbyDrivers = await findAllAvailableDrivers(deliveryMethod);
      }
      nearbyDrivers = prioritizePreferredDrivers(nearbyDrivers, preferredDriverId);
    } else if (
      isPhoneOrder &&
      (!pickupCoords || !pickupCoords.latitude || !pickupCoords.longitude)
    ) {
      // Pour les commandes téléphoniques normales sans coordonnées GPS, notifier tous les livreurs
      if (DEBUG) {
        logger.debug(
          `[notifyDriversForOrder] Commande téléphonique ${maskOrderId(order.id)} sans coordonnées GPS - recherche de tous les livreurs disponibles`
        );
      }
      nearbyDrivers = await findAllAvailableDrivers(deliveryMethod);
    } else {
      // Chercher les livreurs proches avec coordonnées GPS
      if (DEBUG) {
        logger.debug(
          `[notifyDriversForOrder] Commande normale ${maskOrderId(order.id)} - recherche de livreurs proches`
        );
      }
      nearbyDrivers = await findNearbyDrivers(pickupCoords!, deliveryMethod);
    }

    if (DEBUG) {
      logger.debug(
        `[notifyDriversForOrder] ${nearbyDrivers.length} livreurs trouvés pour commande ${maskOrderId(order.id)} (B2B: ${isB2BOrder}, Téléphonique: ${isPhoneOrder})`
      );
    }

    if (nearbyDrivers.length === 0) {
      if (DEBUG) {
        logger.debug(
          `[notifyDriversForOrder] Aucun chauffeur disponible pour la commande ${maskOrderId(order.id)}`
        );
      }
      return;
    }

    // Matching équitable : tous les livreurs reçoivent la commande, triés par priorité (notes)
    let selectedDrivers: NearbyDriver[];
    const useFairMatching = process.env.USE_INTELLIGENT_MATCHING !== 'false';

    if (useFairMatching && nearbyDrivers.length > 0) {
      if (DEBUG) {
        logger.debug(
          `[notifyDriversForOrder] Utilisation du matching équitable pour commande ${maskOrderId(order.id)}`
        );
      }

      try {
        // Récupérer tous les livreurs triés par priorité
        // PRIORISATION INTERNES : Les internes sont prioritaires sur B2B/planifiées
        const allDrivers = await orderMatchingService.findBestDrivers(
          nearbyDrivers,
          (driverId: string) => getActiveOrdersCountByDriver(driverId),
          {
            isB2B: isB2BOrder,
            isScheduled:
              (order as any).is_scheduled === true || (order as any).scheduled_at !== null,
            isSensitive:
              (order as any).is_sensitive === true || (order as any).is_vip === true,
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
              logger.debug(
                `[notifyDriversForOrder] Livreur ${maskUserId(scored.driverId)} exclu: ${balanceCheck.reason}`
              );
            }
          }
        }

        selectedDrivers = driversWithBalance;

        if (DEBUG) {
          logger.debug(
            `[notifyDriversForOrder] ${selectedDrivers.length} livreurs recevront la commande (${allDrivers.length - selectedDrivers.length} exclus pour solde insuffisant)`
          );
        }
      } catch (error: any) {
        logger.warn(
          `[notifyDriversForOrder] Erreur matching équitable, fallback sur tri par distance:`,
          error.message
        );
        // Fallback : trier par distance si le matching échoue
        selectedDrivers = nearbyDrivers.sort((a, b) => a.distance - b.distance);
      }
    } else {
      // Fallback : trier par distance (comportement original)
      if (DEBUG) {
        logger.debug(
          `[notifyDriversForOrder] Utilisation du tri par distance (matching équitable désactivé)`
        );
      }
      selectedDrivers = nearbyDrivers.sort((a, b) => a.distance - b.distance);
    }

    if (isB2BOrder && preferredDriverId) {
      selectedDrivers = prioritizePreferredDrivers(selectedDrivers, preferredDriverId);
      logger.info('[notifyDriversForOrder] Livreur dédié priorisé pour commande B2B', {
        orderId: maskOrderId(order.id),
        preferredDriverId: maskUserId(preferredDriverId),
        candidates: selectedDrivers.length,
        firstCandidate: selectedDrivers[0]?.driverId
          ? maskUserId(selectedDrivers[0].driverId)
          : null,
      });
    }

    const connectedSelectedDrivers = selectedDrivers.filter((driver) =>
      connectedDrivers.has(driver.driverId)
    );
    if (connectedSelectedDrivers.length > 0) {
      selectedDrivers = connectedSelectedDrivers;
    } else {
      logger.warn('[notifyDriversForOrder] Aucun livreur sélectionné connecté en socket', {
        orderId: maskOrderId(order.id),
        candidates: selectedDrivers.length,
        isB2BOrder,
      });
    }

    // Envoyer la commande aux livreurs sélectionnés (top 3)
    let driverIndex = 0;
    const tryNextDriver = async (): Promise<void> => {
      if (driverIndex >= selectedDrivers.length) {
        if (DEBUG) {
          logger.debug(
            `[notifyDriversForOrder] Tous les ${selectedDrivers.length} chauffeurs sélectionnés ont refusé ou timeout pour la commande ${maskOrderId(order.id)}`
          );
        }
        // Ne pas annuler automatiquement, laisser la commande en pending
        // Optionnel : on pourrait réessayer avec les autres livreurs disponibles
        activeOrders.delete(order.id);
        return;
      }

      const driver = selectedDrivers[driverIndex];
      let driverSocketId = connectedDrivers.get(driver.driverId);
      if (!driverSocketId) {
        await delayMs(DRIVER_OFFER_SOCKET_RETRY_MS);
        driverSocketId = connectedDrivers.get(driver.driverId);
      }

      if (DEBUG) {
        logger.debug(
          `[notifyDriversForOrder] Tentative envoi à livreur ${maskUserId(driver.driverId)}: socket=${driverSocketId || 'NON CONNECTÉ'}, distance=${driver.distance.toFixed(2)}km`
        );
      }

      if (driverSocketId) {
        const assignedAt = new Date();
        order.assignedAt = assignedAt;
        (order as any).offeredDriverId = driver.driverId;

        // Enregistrer l'assignation
        await recordOrderAssignment(order.id, driver.driverId, { assignedAt }).catch(() => {});

        // Envoyer la commande au livreur
        io.to(driverSocketId).emit('new-order-request', order);

        if (DEBUG) {
          logger.debug(
            `[notifyDriversForOrder] Événement 'new-order-request' émis vers socket ${driverSocketId}`
          );
        }

        // Timeout aligné sur le popup livreur (OrderRequestPopup)
        setTimeout(async () => {
          const currentOrder = activeOrders.get(order.id);
          if (currentOrder && currentOrder.status === 'pending') {
            if (DEBUG) {
              logger.debug(
                `[notifyDriversForOrder] Timeout driver ${maskUserId(driver.driverId)} pour commande ${maskOrderId(order.id)}`
              );
            }
            await recordOrderAssignment(order.id, driver.driverId, {
              declinedAt: new Date(),
            }).catch(() => {});
            driverIndex++;
            tryNextDriver().catch(() => {});
          }
        }, DRIVER_OFFER_RESPONSE_MS);
      } else {
        if (DEBUG) {
          logger.debug(
            `[notifyDriversForOrder] Chauffeur ${maskUserId(driver.driverId)} trouvé mais socket non connecté`
          );
        }
        driverIndex++;
        tryNextDriver().catch(() => {});
      }
    };

    tryNextDriver().catch(() => {});
  } catch (error: any) {
    logger.error(
      `[notifyDriversForOrder] Erreur notification livreurs pour commande ${maskOrderId(order.id)}:`,
      error
    );
  }
}
