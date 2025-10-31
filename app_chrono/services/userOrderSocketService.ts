import { io, Socket } from 'socket.io-client';
import { useOrderStore } from '../store/useOrderStore';
import { userApiService } from './userApiService';

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
      console.log('🔌 Socket user connecté pour commandes');
      this.isConnected = true;
      
      // S'identifier comme user
      console.log('👤 Identification comme user:', userId);
      this.socket?.emit('user-connect', userId);
    });

    this.socket.on('disconnect', () => {
      console.log('🔌 Socket user déconnecté');
      this.isConnected = false;
    });

    // 📦 Confirmation création commande
    this.socket.on('order-created', (data) => {
      console.log('📦 Commande créée:', data);
      // Stocker comme pendingOrder
      try {
        const order = data?.order;
        if (order) {
          useOrderStore.getState().setPendingOrder(order as any);
        }
      } catch (err) {
        console.warn('Unable to store pending order', err);
      }
    });

    // ❌ Aucun chauffeur disponible
    this.socket.on('no-drivers-available', (data) => {
      console.log('❌ Aucun chauffeur disponible:', data);
      // Ici on peut afficher une alerte à l'utilisateur
    });

    // ✅ Commande acceptée par un driver
    this.socket.on('order-accepted', (data) => {
      console.log('✅ Commande acceptée par driver:', data);
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
                console.warn('Impossible de récupérer les détails du chauffeur', err);
              }
            })();
          }
        }
      } catch (err) {
        console.warn('Error handling order-accepted', err);
      }
    });

    // 🚛 Mise à jour statut livraison (et position)
    this.socket.on('delivery-status-update', (data) => {
      console.log('🚛 Statut livraison:', data);
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
        console.warn('Error handling delivery-status-update', err);
      }
    });

    // ❌ Erreur commande
    this.socket.on('order-error', (data) => {
      console.error('❌ Erreur commande:', data);
      // clear pending if present
      try {
        useOrderStore.getState().setPendingOrder(null);
      } catch {}
    });

    this.socket.on('connect_error', (error) => {
      console.error('❌ Erreur connexion socket user:', error);
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
    if (!this.socket || !this.userId) {
      console.error('❌ Socket non connecté');
      return false;
    }

    console.log('📦 Envoi commande:', orderData);
    this.socket.emit('create-order', {
      ...orderData,
      userId: this.userId
    });

    return true;
  }

  // Vérifier la connexion
  isSocketConnected() {
    return this.isConnected && this.socket?.connected;
  }
}

// Instance singleton
export const userOrderSocketService = new UserOrderSocketService();