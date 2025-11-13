import { io, Socket } from 'socket.io-client';
import { useOrderStore, OrderRequest } from '../store/useOrderStore';
import { logger } from '../utils/logger';
import { config } from '../config/index';

class OrderSocketService {
  private socket: Socket | null = null;
  private driverId: string | null = null;
  private isConnected = false;
  private retryCount = 0;

  connect(driverId: string) {
    if (this.socket && this.isConnected) {
      return;
    }

    this.driverId = driverId;
    this.socket = io(config.socketUrl);

    this.socket.on('connect', () => {
      logger.info('Socket connecté pour commandes');
      this.isConnected = true;
      this.retryCount = 0; // Réinitialiser le compteur de retry en cas de succès
      
      // S'identifier comme driver
      logger.info('Identification comme driver', undefined, { driverId });
      this.socket?.emit('driver-connect', driverId);
      // Demander au serveur de resynchroniser les commandes en attente pour ce driver
      try {
        this.socket?.emit('driver-reconnect', { driverId });
      } catch (err) {
        logger.warn('Resync emit failed (driver)', undefined, err);
      }
    });

    this.socket.on('disconnect', () => {
      logger.info('Socket déconnecté');
      this.isConnected = false;
      
      // Auto-reconnect après 3 secondes
      setTimeout(() => {
        if (this.driverId && !this.isConnected) {
          logger.info('Tentative de reconnexion automatique...', undefined);
          this.connect(this.driverId);
        }
      }, 3000);
    });

    // Nouvelle commande reçue
    this.socket.on('new-order-request', (order: OrderRequest) => {
      logger.info('Nouvelle commande reçue', undefined, order);
      if (order && order.id) {
        useOrderStore.getState().addPendingOrder(order);
      }
    });

    // Confirmation acceptation
    this.socket.on('order-accepted-confirmation', (data) => {
      logger.info('Commande acceptée confirmée', undefined, data);
      try {
        const { order } = data || {};
        if (order && order.id) {
          const store = useOrderStore.getState();
          store.acceptOrder(order.id, this.driverId || '');
        }
      } catch (err) {
        logger.warn('Error handling order-accepted-confirmation', undefined, err);
      }
    });

    // Confirmation déclinaison
    this.socket.on('order-declined-confirmation', (data) => {
      logger.info('Commande déclinée confirmée', undefined, data);
      try {
        const { orderId } = data || {};
        if (orderId) {
          useOrderStore.getState().declineOrder(orderId);
        }
      } catch (err) {
        logger.warn('Error handling order-declined-confirmation', undefined, err);
      }
    });

    // Commande non trouvée
    this.socket.on('order-not-found', (data) => {
      logger.info('Commande non trouvée', undefined, data);
      const { orderId } = data || {};
      if (orderId) {
        useOrderStore.getState().removeOrder(orderId);
      }
    });

    // Commande déjà prise
    this.socket.on('order-already-taken', (data) => {
      logger.info('Commande déjà prise', undefined, data);
      const { orderId } = data || {};
      if (orderId) {
        useOrderStore.getState().removeOrder(orderId);
      }
    });

    // Erreur acceptation (limite atteinte)
    this.socket.on('order-accept-error', (data) => {
      logger.warn('Erreur acceptation commande', undefined, data);
      // La commande reste dans pendingOrders pour que le livreur puisse la voir
    });

    // Resync order state after reconnect
    this.socket.on('resync-order-state', (data) => {
      try {
        logger.info('Resync order state reçu', undefined, data);
        const { pendingOrders, activeOrders, pendingOrder, currentOrder } = data || {};
        const store = useOrderStore.getState();
        
        // Ajouter toutes les commandes en attente (nouveau format avec tableaux)
        if (Array.isArray(pendingOrders)) {
          pendingOrders.forEach((order: any) => {
            if (order && order.id) {
              store.addPendingOrder(order);
            }
          });
        } else if (pendingOrder && pendingOrder.id) {
          // Compatibilité avec l'ancien format
          store.addPendingOrder(pendingOrder as any);
        }
        
        // Ajouter toutes les commandes actives
        if (Array.isArray(activeOrders)) {
          activeOrders.forEach((order: any) => {
            if (order && order.id) {
              store.addOrder(order);
            }
          });
          logger.info(`${activeOrders.length} commande(s) active(s) restaurée(s) après reconnexion`, undefined);
        } else if (currentOrder && currentOrder.id) {
          // Compatibilité avec l'ancien format
          store.addOrder(currentOrder as any);
          logger.info('Commande active restaurée après reconnexion', undefined, { orderId: currentOrder.id });
        }
      } catch (err) {
        logger.warn('Error handling resync-order-state (driver)', undefined, err);
      }
    });

    // Commande annulée
    this.socket.on('order:cancelled', (data) => {
      try {
        logger.info('Commande annulée reçue', undefined, data);
        const { orderId } = data || {};
        if (orderId) {
          useOrderStore.getState().cancelOrder(orderId);
        }
      } catch (err) {
        logger.warn('Error handling order:cancelled', undefined, err);
      }
    });

    this.socket.on('connect_error', (error) => {
      logger.error('Erreur connexion socket:', undefined, error);
      this.isConnected = false;
      
      // Retry avec backoff exponentiel (5, 10, 20 secondes)
      const retryDelay = Math.min(5000 * Math.pow(2, this.retryCount || 0), 20000);
      this.retryCount = (this.retryCount || 0) + 1;
      
      setTimeout(() => {
        if (this.driverId && !this.isConnected) {
          logger.info(`Reconnexion dans ${retryDelay / 1000}s...`, undefined);
          this.connect(this.driverId);
        }
      }, retryDelay);
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      this.driverId = null;
    }
  }

  // Accepter une commande
  acceptOrder(orderId: string) {
    if (!this.socket || !this.driverId) {
      logger.error('Socket non connecté');
      return;
    }

    logger.info('Acceptation commande', undefined, { orderId });
    this.socket.emit('accept-order', {
      orderId,
      driverId: this.driverId
    });

    // Attendre la confirmation du serveur ('order-accepted-confirmation') pour mettre à jour le store local
  }

  // Décliner une commande
  declineOrder(orderId: string) {
    if (!this.socket || !this.driverId) {
      logger.error('Socket non connecté');
      return;
    }

    logger.info('Déclinaison commande', undefined, { orderId });
    this.socket.emit('decline-order', {
      orderId,
      driverId: this.driverId
    });

    // Attendre la confirmation du serveur ('order-declined-confirmation') pour mettre à jour le store local
  }

  // Mettre à jour le statut de livraison
  updateDeliveryStatus(orderId: string, status: string, location?: any) {
    if (!this.socket) {
      logger.error('Socket non connecté');
      return;
    }

    this.socket.emit('update-delivery-status', {
      orderId,
      status,
      location
    });

    // Mettre à jour le store local
    useOrderStore.getState().updateOrderStatus(orderId, status as any);

    // Si le driver marque la commande comme complétée, la déplacer vers l'historique / vider currentOrder
    // pour que la carte et l'UI reviennent à un état normal (sans marqueurs/lignes restants) immédiatement
    if (String(status) === 'completed') {
      try {
        useOrderStore.getState().completeOrder(orderId);
      } catch (err) {
        logger.warn('Failed to complete order locally', undefined, err);
      }
    }
  }

  // Vérifier la connexion
  isSocketConnected() {
    return this.isConnected && this.socket?.connected;
  }
}

// Instance singleton
export const orderSocketService = new OrderSocketService();