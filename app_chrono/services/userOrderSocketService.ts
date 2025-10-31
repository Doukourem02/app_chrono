import { io, Socket } from 'socket.io-client';
import { useOrderStore } from '../store/useOrderStore';
import { userApiService } from './userApiService';
import { logger } from '../utils/logger';

class UserOrderSocketService {
  private socket: Socket | null = null;
  private userId: string | null = null;
  private isConnected = false;

  connect(userId: string) {
    if (this.socket && this.isConnected) {
      return;
    }

    this.userId = userId;
    this.socket = io(process.env.EXPO_PUBLIC_SOCKET_URL || 'http://localhost:4000');

    this.socket.on('connect', () => {
      logger.info('🔌 Socket user connecté pour commandes', 'userOrderSocketService');
      this.isConnected = true;
      
      // S'identifier comme user
      logger.info('👤 Identification comme user', 'userOrderSocketService', { userId });
      this.socket?.emit('user-connect', userId);

      // Ask server to resync any existing order state for this user
      // (backend should reply with an event like `resync-order-state`)
      try {
        this.socket?.emit('user-reconnect', { userId });
      } catch (err) {
        logger.warn('Resync emit failed', 'userOrderSocketService', err);
      }
    });

    this.socket.on('disconnect', () => {
      logger.info('🔌 Socket user déconnecté', 'userOrderSocketService');
      this.isConnected = false;
    });

    // 📦 Confirmation création commande
    this.socket.on('order-created', (data) => {
      logger.info('📦 Commande créée', 'userOrderSocketService', data);
      // Stocker comme pendingOrder
      try {
        const order = data?.order;
        if (order) {
          useOrderStore.getState().setPendingOrder(order as any);
        }
      } catch (err) {
        logger.warn('Unable to store pending order', 'userOrderSocketService', err);
      }
    });

    // ❌ Aucun chauffeur disponible
    this.socket.on('no-drivers-available', (data) => {
      logger.info('❌ Aucun chauffeur disponible', 'userOrderSocketService', data);
      // Ici on peut afficher une alerte à l'utilisateur
    });

    // ✅ Commande acceptée par un driver
    this.socket.on('order-accepted', (data) => {
      logger.info('✅ Commande acceptée par driver', 'userOrderSocketService', data);
      try {
        const { order, driverInfo } = data || {};
        if (order) {
          // Stocker l'ordre comme currentOrder (on l'enrichira avec driver si possible)
          useOrderStore.getState().setCurrentOrder({ ...order } as any);
          useOrderStore.getState().setPendingOrder(null);
        }

        // Si backend fournit position dans driverInfo, l'utiliser
        if (driverInfo && driverInfo.current_latitude && driverInfo.current_longitude) {
          useOrderStore.getState().setDriverCoords({
            latitude: driverInfo.current_latitude,
            longitude: driverInfo.current_longitude,
          });
        }

        // Si driverInfo contient déjà des informations exploitables (transmises
        // par le socket), on les utilise directement sans appeler l'API.
        if (driverInfo) {
          const hasUsefulInfo = !!(driverInfo.current_latitude || driverInfo.phone || driverInfo.profile_image_url || driverInfo.first_name);
          if (hasUsefulInfo) {
            const current = useOrderStore.getState().currentOrder;
            if (current) {
              useOrderStore.getState().setCurrentOrder({ ...current, driver: {
                id: driverInfo.id,
                name: driverInfo.first_name ? `${driverInfo.first_name} ${driverInfo.last_name || ''}`.trim() : undefined,
                phone: driverInfo.phone || undefined,
                avatar: driverInfo.profile_image_url || undefined,
                rating: driverInfo.rating || undefined,
              } } as any);
            }
          } else if (driverInfo.id) {
            // Fallback : si le socket n'a fourni que l'id, tenter de récupérer les détails via l'API
            (async () => {
              try {
                const res = await userApiService.getDriverDetails(driverInfo.id);
                if (res && res.success && res.data) {
                  const current = useOrderStore.getState().currentOrder;
                  if (current) {
                    useOrderStore.getState().setCurrentOrder({ ...current, driver: res.data } as any);
                  }
                }
              } catch (err) {
                logger.warn('Impossible de récupérer les détails du chauffeur', 'userOrderSocketService', err);
              }
            })();
          }
        }
      } catch (err) {
        logger.warn('Error handling order-accepted', 'userOrderSocketService', err);
      }
    });

    // Server may send a resync containing pending/current order after reconnect
    this.socket.on('resync-order-state', (data) => {
      try {
        const { pendingOrder, currentOrder, driverCoords } = data || {};
        if (pendingOrder) {
          useOrderStore.getState().setPendingOrder(pendingOrder as any);
        }
        if (currentOrder) {
          useOrderStore.getState().setCurrentOrder(currentOrder as any);
        }
        if (driverCoords && driverCoords.latitude && driverCoords.longitude) {
          useOrderStore.getState().setDriverCoords({
            latitude: driverCoords.latitude,
            longitude: driverCoords.longitude,
          });
        }
      } catch (err) {
        logger.warn('Error handling resync-order-state', 'userOrderSocketService', err);
      }
    });

    // 🚛 Mise à jour statut livraison (et position)
    this.socket.on('delivery-status-update', (data) => {
      logger.debug('🚛 Statut livraison', 'userOrderSocketService', data);
      try {
        const { order, location, status } = data || {};
        if (order) {
          useOrderStore.getState().setCurrentOrder(order as any);
        }
        if (location && location.latitude && location.longitude) {
          useOrderStore.getState().setDriverCoords({
            latitude: location.latitude,
            longitude: location.longitude,
          });
        }
        if (order && status) {
          useOrderStore.getState().updateOrderStatus(order.id, status as any);
        }
      } catch (err) {
        logger.warn('Error handling delivery-status-update', 'userOrderSocketService', err);
      }
    });

    // ❌ Erreur commande
    this.socket.on('order-error', (data) => {
      logger.error('❌ Erreur commande:', 'userOrderSocketService', data);
      // clear pending if present
      try {
        useOrderStore.getState().setPendingOrder(null);
      } catch {}
    });

    this.socket.on('connect_error', (error) => {
      logger.error('❌ Erreur connexion socket user:', 'userOrderSocketService', error);
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      this.userId = null;
    }
  }

  // 📦 Créer une nouvelle commande
  createOrder(orderData: {
    pickup: {
      address: string;
      coordinates: { latitude: number; longitude: number };
    };
    dropoff: {
      address: string;
      coordinates: { latitude: number; longitude: number };
    };
    deliveryMethod: 'moto' | 'vehicule' | 'cargo';
    userInfo: {
      name: string;
      avatar?: string;
      rating?: number;
      phone?: string;
    };
  }) {
    return new Promise<boolean>((resolve) => {
      if (!this.socket || !this.userId) {
        logger.error('❌ Socket non connecté');
        resolve(false);
        return;
      }

      const payload = {
        ...orderData,
        userId: this.userId,
      };

  logger.info('📦 Envoi commande (avec ack):', 'userOrderSocketService', payload);

      // Emit with acknowledgement callback (server should call the ack)
      let settled = false;
      const timeout = setTimeout(() => {
        if (!settled) {
          settled = true;
          logger.warn('⚠️ createOrder ack timeout');
          resolve(false);
        }
      }, 10000); // 10s timeout

      try {
        this.socket.emit('create-order', payload, (ackResponse: any) => {
          if (settled) return;
          settled = true;
          clearTimeout(timeout);
          try {
            if (ackResponse && ackResponse.success) {
              // server should have emitted 'order-created' after creating the order
              resolve(true);
            } else {
              logger.warn('❌ createOrder rejected by server', ackResponse);
              resolve(false);
            }
          } catch (err) {
            logger.warn('Error parsing createOrder ack', 'userOrderSocketService', err);
            resolve(false);
          }
        });
      } catch (err) {
        clearTimeout(timeout);
        logger.error('❌ Error emitting create-order', 'userOrderSocketService', err);
        resolve(false);
      }
    });
  }

  // Vérifier la connexion
  isSocketConnected() {
    return this.isConnected && this.socket?.connected;
  }
}

// Instance singleton
export const userOrderSocketService = new UserOrderSocketService();