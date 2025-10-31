import { io, Socket } from 'socket.io-client';
import { useOrderStore, OrderRequest } from '../store/useOrderStore';

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
      console.log('🔌 Socket connecté pour commandes');
      this.isConnected = true;
      
      // S'identifier comme driver
      console.log('🚗 Identification comme driver:', driverId);
      this.socket?.emit('driver-connect', driverId);
    });

    this.socket.on('disconnect', () => {
      console.log('🔌 Socket déconnecté');
      this.isConnected = false;
    });

    // 📦 Nouvelle commande reçue
    this.socket.on('new-order-request', (order: OrderRequest) => {
      console.log('📦 Nouvelle commande reçue:', order);
      useOrderStore.getState().setPendingOrder(order);
    });

    // ✅ Confirmation acceptation
    this.socket.on('order-accepted-confirmation', (data) => {
      console.log('✅ Commande acceptée confirmée:', data);
    });

    // ❌ Confirmation déclinaison
    this.socket.on('order-declined-confirmation', (data) => {
      console.log('❌ Commande déclinée confirmée:', data);
    });

    // ❌ Commande non trouvée
    this.socket.on('order-not-found', (data) => {
      console.log('❌ Commande non trouvée:', data);
      useOrderStore.getState().setPendingOrder(null);
    });

    // ⚠️ Commande déjà prise
    this.socket.on('order-already-taken', (data) => {
      console.log('⚠️ Commande déjà prise:', data);
      useOrderStore.getState().setPendingOrder(null);
    });

    this.socket.on('connect_error', (error) => {
      console.error('❌ Erreur connexion socket:', error);
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
      console.error('❌ Socket non connecté');
      return;
    }

    console.log('✅ Acceptation commande:', orderId);
    this.socket.emit('accept-order', {
      orderId,
      driverId: this.driverId
    });

    // Mettre à jour le store local
    useOrderStore.getState().acceptOrder(orderId, this.driverId);
  }

  // ❌ Décliner une commande
  declineOrder(orderId: string) {
    if (!this.socket || !this.driverId) {
      console.error('❌ Socket non connecté');
      return;
    }

    console.log('❌ Déclinaison commande:', orderId);
    this.socket.emit('decline-order', {
      orderId,
      driverId: this.driverId
    });

    // Mettre à jour le store local
    useOrderStore.getState().declineOrder(orderId);
  }

  // 🚛 Mettre à jour le statut de livraison
  updateDeliveryStatus(orderId: string, status: string, location?: any) {
    if (!this.socket) {
      console.error('❌ Socket non connecté');
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