import { io, Socket } from 'socket.io-client';
import { useOrderStore } from '../store/useOrderStore';
import { useRatingStore } from '../store/useRatingStore';
import { userApiService } from './userApiService';
import { logger } from '../utils/logger';
import { Alert } from 'react-native';
import { createOrderRecord } from './orderApi';

class UserOrderSocketService {
  private socket: Socket | null = null;
  private userId: string | null = null;
  private isConnected = false;
  private retryCount: number = 0;

  connect(userId: string) {
    if (this.socket && this.isConnected) {
      return;
    }

    this.userId = userId;
    this.socket = io(process.env.EXPO_PUBLIC_SOCKET_URL || 'http://localhost:4000');

    this.socket.on('connect', () => {
      logger.info('🔌 Socket user connecté pour commandes', 'userOrderSocketService');
      this.isConnected = true;
      this.retryCount = 0; // Réinitialiser le compteur de retry en cas de succès
      
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
      
      // Auto-reconnect après 3 secondes
      setTimeout(() => {
        if (this.userId && !this.isConnected) {
          logger.info('🔄 Tentative de reconnexion automatique...', 'userOrderSocketService');
          this.connect(this.userId);
        }
      }, 3000);
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
        // If backend reported persistence failure, inform the user
        if (data && data.dbSaved === false) {
          const message = data.dbError || 'La commande n\'a pas pu être enregistrée en base de données.';
          Alert.alert(
            'Erreur enregistrement',
            `${message}\nVoulez-vous réessayer ?`,
            [
              { text: 'Réessayer', onPress: () => {
                // Keep UI simple: clear pending so user can recreate or retry flow
                useOrderStore.getState().clear();
              }},
              { text: 'OK', style: 'cancel' }
            ]
          );
        }
      } catch (err) {
        logger.warn('Unable to store pending order', 'userOrderSocketService', err);
      }
    });

    // ❌ Aucun chauffeur disponible
    this.socket.on('no-drivers-available', (data) => {
      logger.info('❌ Aucun chauffeur disponible', 'userOrderSocketService', data);
      
      // Réinitialiser l'état pour permettre une nouvelle commande
      try {
        
        // Nettoyer complètement l'état pour réinitialiser l'interface
        useOrderStore.getState().clear(); // clear() remet aussi deliveryStage à 'idle'
        
        // Afficher une alerte à l'utilisateur
        Alert.alert(
          'Aucun chauffeur disponible',
          data?.message || 'Aucun chauffeur n\'est disponible dans votre zone pour le moment. Vous pouvez réessayer plus tard.',
          [
            {
              text: 'OK',
              style: 'default'
            }
          ]
        );
        
        logger.info('✅ État réinitialisé après aucun chauffeur disponible', 'userOrderSocketService');
      } catch (err) {
        logger.warn('Erreur lors de la réinitialisation après aucun chauffeur', 'userOrderSocketService', err);
      }
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
        // If DB persistence failed for the assignment, notify user
        if (data && data.dbSaved === false) {
          const msg = data.dbError || 'Impossible d\'enregistrer l\'affectation en base.';
          Alert.alert('Erreur base de données', msg);
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
    // Canonical status update event emitted by server
    this.socket.on('order:status:update', (data) => {
      logger.debug('🚛 order:status:update', 'userOrderSocketService', data);
      try {
        const { order, location } = data || {};
        
        // 🆕 Mettre à jour immédiatement les coordonnées du livreur si elles sont fournies
        // Cela évite que le polyline se dessine avec des coordonnées obsolètes
        // Cela corrige le problème où le polyline rouge est "n'importe quoi au départ"
        if (location && (location.latitude || location.lat || location.y) && (location.longitude || location.lng || location.x)) {
          const normLocation = {
            latitude: location.latitude ?? location.lat ?? location.y,
            longitude: location.longitude ?? location.lng ?? location.x,
          };
          useOrderStore.getState().setDriverCoords(normLocation);
        }
        
        // Normalize location keys to { latitude, longitude }
        const normLocation = location
          ? {
              latitude: location.latitude ?? location.lat ?? location.y ?? null,
              longitude: location.longitude ?? location.lng ?? location.x ?? null,
            }
          : null;
        useOrderStore.getState().updateFromSocket({ order: order as any, location: normLocation });

        // Si la commande est complétée, afficher le modal d'évaluation
        if (order && order.status === 'completed' && order.id && order.driver?.id) {
          try {
            const driverName = order.driver?.name || order.driver?.first_name 
              ? `${order.driver.first_name || ''} ${order.driver.last_name || ''}`.trim() 
              : 'Votre livreur';
            useRatingStore.getState().setRatingModal(
              true,
              order.id,
              order.driver.id,
              driverName || 'Votre livreur'
            );
            logger.info('⭐ Modal d\'évaluation déclenché pour commande complétée', 'userOrderSocketService', { orderId: order.id });
          } catch (err) {
            logger.warn('Erreur déclenchement modal évaluation', 'userOrderSocketService', err);
          }
        }

        // If DB persistence for this status update failed, notify the user
        if (data && data.dbSaved === false) {
          const msg = data.dbError || 'Impossible d\'enregistrer la mise à jour du statut en base.';
          logger.warn('DB persistence failed for status update', 'userOrderSocketService', data.dbError);
          Alert.alert('Erreur base de données', msg);
        }
      } catch (err) {
        logger.warn('Error handling order:status:update', 'userOrderSocketService', err);
      }
    });

    // Proof uploaded notification
    this.socket.on('order:proof:uploaded', (data) => {
      logger.info('🧾 order:proof:uploaded', 'userOrderSocketService', data);
      try {
        const { orderId, proof, uploadedAt } = data || {};
        // Attach proof metadata to current order if matches
        useOrderStore.getState().updateFromSocket({ order: { id: orderId } as any, proof: { uploadedAt, ...proof } as any });
        if (data && data.dbSaved === false) {
          const msg = data.dbError || 'La preuve n\'a pas été sauvegardée en base.';
          Alert.alert('Erreur base de données', msg);
        }
      } catch (err) {
        logger.warn('Error handling order:proof:uploaded', 'userOrderSocketService', err);
      }
    });

    // Backwards-compatible event name (older code)
    this.socket.on('delivery-status-update', (data) => {
      logger.debug('🚛 delivery-status-update (legacy)', 'userOrderSocketService', data);
      try {
        const { order, location } = data || {};
        const normLocation = location
          ? {
              latitude: location.latitude ?? location.lat ?? location.y ?? null,
              longitude: location.longitude ?? location.lng ?? location.x ?? null,
            }
          : null;
        useOrderStore.getState().updateFromSocket({ order: order as any, location: normLocation });
      } catch (err) {
        logger.warn('Error handling legacy delivery-status-update', 'userOrderSocketService', err);
      }
    });

    // ❌ Erreur commande
    this.socket.on('order-error', (data) => {
      logger.error('❌ Erreur commande:', 'userOrderSocketService', data);
      // Nettoyer complètement l'état pour revenir au formulaire initial
      try {
        useOrderStore.getState().clear();
      } catch {}
    });

    this.socket.on('connect_error', (error) => {
      logger.error('❌ Erreur connexion socket user:', 'userOrderSocketService', error);
      this.isConnected = false;
      
      // Retry avec backoff exponentiel (5, 10, 20 secondes)
      const retryDelay = Math.min(5000 * Math.pow(2, this.retryCount || 0), 20000);
      this.retryCount = (this.retryCount || 0) + 1;
      
      setTimeout(() => {
        if (this.userId && !this.isConnected) {
          logger.info(`🔄 Reconnexion dans ${retryDelay / 1000}s...`, 'userOrderSocketService');
          this.connect(this.userId);
        }
      }, retryDelay);
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
    return new Promise<boolean>(async (resolve) => {
      if (!this.socket || !this.userId) {
        logger.error('❌ Socket non connecté');
        resolve(false);
        return;
      }

      let dbRecord: { orderId: string; priceCfa: number; distanceKm: number; etaMinutes: number; etaLabel: string | null };
      try {
        dbRecord = await createOrderRecord({
          userId: this.userId,
          pickup: orderData.pickup,
          dropoff: orderData.dropoff,
          method: orderData.deliveryMethod,
        });
      } catch (error: any) {
        // Log full error for debugging
        logger.error('❌ Échec enregistrement commande Supabase', 'userOrderSocketService', error);

        // Supabase / Postgres function may return a custom error code when the
        // user/profile is not present (seen as PO001 in dev logs). Detect this
        // case and show a clearer message / action to the user.
        const errorMessage = error?.message ?? String(error);
        const errorCode = error?.code ?? null;

  if (errorCode === 'PO001' || errorCode === 'MISSING_PROFILE' || /does not exist|profiles?/i.test(errorMessage)) {
          Alert.alert(
            'Compte incomplet',
            'Votre compte n\'est pas totalement configuré sur le serveur (profil manquant). Veuillez vous reconnecter pour synchroniser votre profil ou contacter le support.',
            [
              {
                text: 'Se reconnecter',
                onPress: () => {
                  // Try to trigger a logout so the app returns to auth flow and
                  // re-creates any missing server profile on next sign-in.
                  (async () => {
                    try {
                      const mod = await import('../store/useAuthStore');
                      mod.useAuthStore.getState().logout && mod.useAuthStore.getState().logout();
                    } catch (e) {
                      logger.warn('Unable to trigger logout after missing profile error', 'userOrderSocketService', e);
                    }
                  })();
                },
              },
              { text: 'OK', style: 'cancel' },
            ],
          );
        } else {
          Alert.alert('Erreur', 'Impossible d\'enregistrer la commande. Merci de réessayer.');
        }

        resolve(false);
        return;
      }

      const payload = {
        ...orderData,
        userId: this.userId,
        orderId: dbRecord.orderId,
        price: dbRecord.priceCfa,
        distance: dbRecord.distanceKm,
        estimatedDuration: dbRecord.etaLabel || undefined,
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
              // If server reports DB persistence failed, inform the user
              if (ackResponse.dbSaved === false) {
                const msg = ackResponse.dbError || 'La commande n\'a pas pu être enregistrée en base.';
                Alert.alert(
                  'Erreur enregistrement',
                  `${msg}\nVoulez-vous réessayer ?`,
                  [
                    { text: 'Réessayer', onPress: () => { useOrderStore.getState().clear(); } },
                    { text: 'OK', style: 'cancel' }
                  ]
                );
                resolve(false);
                return;
              }

              // server persisted the order
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