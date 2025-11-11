import { io, Socket } from 'socket.io-client';
import { useOrderStore, OrderRequest } from '../store/useOrderStore';
import { logger } from '../utils/logger';

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
    this.socket = io(process.env.EXPO_PUBLIC_SOCKET_URL || 'http://localhost:4000');

    this.socket.on('connect', () => {
          logger.info('🔌 Socket connecté pour commandes');
      this.isConnected = true;
      this.retryCount = 0; // Réinitialiser le compteur de retry en cas de succès
      
      // S'identifier comme driver
          logger.info('🚗 Identification comme driver', undefined, { driverId });
      this.socket?.emit('driver-connect', driverId);
      // Ask server to resync any pending order for this driver
      try {
        this.socket?.emit('driver-reconnect', { driverId });
      } catch (err) {
      logger.warn('Resync emit failed (driver)', undefined, err);
      }
    });

    this.socket.on('disconnect', () => {
          logger.info('🔌 Socket déconnecté');
      this.isConnected = false;
      
      // Auto-reconnect après 3 secondes
      setTimeout(() => {
        if (this.driverId && !this.isConnected) {
          logger.info('🔄 Tentative de reconnexion automatique...', undefined);
          this.connect(this.driverId);
        }
      }, 3000);
    });

    // 📦 Nouvelle commande reçue
    this.socket.on('new-order-request', (order: OrderRequest) => {
          logger.info('📦 Nouvelle commande reçue', undefined, order);
      useOrderStore.getState().setPendingOrder(order);
    });

    // ✅ Confirmation acceptation
    this.socket.on('order-accepted-confirmation', (data) => {
          logger.info('✅ Commande acceptée confirmée', undefined, data);
      try {
        const { order } = data || {};
        if (order) {
          useOrderStore.getState().setCurrentOrder(order as any);
          useOrderStore.getState().setPendingOrder(null);
        }
      } catch (err) {
            logger.warn('Error handling order-accepted-confirmation', undefined, err);
      }
    });

    // ❌ Confirmation déclinaison
    this.socket.on('order-declined-confirmation', (data) => {
          logger.info('❌ Commande déclinée confirmée', undefined, data);
      try {
        // Clear local pending order if server confirmed our decline
        useOrderStore.getState().setPendingOrder(null);
      } catch (err) {
            logger.warn('Error handling order-declined-confirmation', undefined, err);
      }
    });

    // ❌ Commande non trouvée
    this.socket.on('order-not-found', (data) => {
          logger.info('❌ Commande non trouvée', undefined, data);
      useOrderStore.getState().setPendingOrder(null);
    });

    // ⚠️ Commande déjà prise
    this.socket.on('order-already-taken', (data) => {
          logger.info('⚠️ Commande déjà prise', undefined, data);
      useOrderStore.getState().setPendingOrder(null);
    });

    // 🔄 Resync order state after reconnect
    this.socket.on('resync-order-state', (data) => {
      try {
        logger.info('🔄 Resync order state reçu', undefined, data);
        const { pendingOrder, currentOrder } = data || {};
        if (pendingOrder) {
          useOrderStore.getState().setPendingOrder(pendingOrder as any);
        }
        if (currentOrder) {
          useOrderStore.getState().setCurrentOrder(currentOrder as any);
          logger.info('✅ Commande active restaurée après reconnexion', undefined, { orderId: currentOrder.id });
        }
      } catch (err) {
        logger.warn('Error handling resync-order-state (driver)', undefined, err);
      }
    });

    // ❌ Commande annulée
    this.socket.on('order:cancelled', (data) => {
      try {
        logger.info('❌ Commande annulée reçue', undefined, data);
        const { orderId } = data || {};
        if (orderId) {
          useOrderStore.getState().cancelOrder(orderId);
        }
      } catch (err) {
        logger.warn('Error handling order:cancelled', undefined, err);
      }
    });

    this.socket.on('connect_error', (error) => {
          logger.error('❌ Erreur connexion socket:', undefined, error);
      this.isConnected = false;
      
      // Retry avec backoff exponentiel (5, 10, 20 secondes)
      const retryDelay = Math.min(5000 * Math.pow(2, this.retryCount || 0), 20000);
      this.retryCount = (this.retryCount || 0) + 1;
      
      setTimeout(() => {
        if (this.driverId && !this.isConnected) {
          logger.info(`🔄 Reconnexion dans ${retryDelay / 1000}s...`, undefined);
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

  // ✅ Accepter une commande
  acceptOrder(orderId: string) {
    if (!this.socket || !this.driverId) {
          logger.error('❌ Socket non connecté');
      return;
    }

  logger.info('✅ Acceptation commande', undefined, { orderId });
    this.socket.emit('accept-order', {
      orderId,
      driverId: this.driverId
    });

    // Wait for server confirmation event ('order-accepted-confirmation') to update local store.
  }

  // ❌ Décliner une commande
  declineOrder(orderId: string) {
    if (!this.socket || !this.driverId) {
          logger.error('❌ Socket non connecté');
      return;
    }

  logger.info('❌ Déclinaison commande', undefined, { orderId });
    this.socket.emit('decline-order', {
      orderId,
      driverId: this.driverId
    });

    // Wait for server confirmation event ('order-declined-confirmation') to update local store.
  }

  // 🚛 Mettre à jour le statut de livraison
  updateDeliveryStatus(orderId: string, status: string, location?: any) {
    if (!this.socket) {
          logger.error('❌ Socket non connecté');
      return;
    }

    this.socket.emit('update-delivery-status', {
      orderId,
      status,
      location
    });

    // Mettre à jour le store local
    useOrderStore.getState().updateOrderStatus(orderId, status as any);

    // If the driver marks the order as completed, move it to history / clear currentOrder
    // so the map and UI return to a normal state (no leftover markers/lines) immediately.
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