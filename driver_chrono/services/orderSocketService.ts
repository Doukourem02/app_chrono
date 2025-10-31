import { io, Socket } from 'socket.io-client';
import { useOrderStore, OrderRequest } from '../store/useOrderStore';
import { logger } from '../../app_chrono/utils/logger';

class OrderSocketService {
  private socket: Socket | null = null;
  private driverId: string | null = null;
  private isConnected = false;

  connect(driverId: string) {
    if (this.socket && this.isConnected) {
      return;
    }

    this.driverId = driverId;
    this.socket = io(process.env.EXPO_PUBLIC_SOCKET_URL || 'http://localhost:4000');

    this.socket.on('connect', () => {
          logger.info('🔌 Socket connecté pour commandes');
      this.isConnected = true;
      
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

    this.socket.on('connect_error', (error) => {
          logger.error('❌ Erreur connexion socket:', undefined, error);
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
  }

  // Vérifier la connexion
  isSocketConnected() {
    return this.isConnected && this.socket?.connected;
  }
}

// Instance singleton
export const orderSocketService = new OrderSocketService();