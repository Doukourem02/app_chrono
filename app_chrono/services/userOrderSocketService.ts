import { Alert } from 'react-native';
import { io, Socket } from 'socket.io-client';
import { useOrderStore } from '../store/useOrderStore';
import { usePaymentErrorStore } from '../store/usePaymentErrorStore';
import { useRatingStore } from '../store/useRatingStore';
import { logger } from '../utils/logger';
import { createOrderRecord } from './orderApi';
import { userApiService } from './userApiService';
import { config } from '../config';

class UserOrderSocketService {
  private socket: Socket | null = null;
  private userId: string | null = null;
  private isConnected = false;
  private retryCount: number = 0;

  connect(userId: string) {
    // Si le socket est déjà connecté avec le même userId, ne rien faire
    if (this.socket && this.isConnected && this.socket.connected && this.userId === userId) {
      return;
    }

    // Nettoyer l'ancien socket s'il existe
    if (this.socket) {
      logger.info('🔄 Nettoyage de l\'ancien socket', 'userOrderSocketService');
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }

    this.userId = userId;
    // Utiliser la configuration centralisée qui fonctionne avec Expo Go
    const socketUrl = config.socketUrl;
    logger.info('🔌 Connexion au socket...', 'userOrderSocketService', { socketUrl });
    this.socket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
      reconnectionAttempts: 5,
      timeout: 20000,
      forceNew: false,
      upgrade: true,
      autoConnect: true,
    });

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

    this.socket.on('disconnect', (reason) => {
      logger.info('🔌 Socket user déconnecté', 'userOrderSocketService', { reason });
      this.isConnected = false;

      // Laisser Socket.IO gérer la reconnexion automatique
      // Ne pas forcer une reconnexion manuelle pour éviter les doubles connexions
      if (reason === 'io server disconnect') {
        // Le serveur a forcé la déconnexion, laisser Socket.IO se reconnecter
        logger.info('🔄 Le serveur a forcé la déconnexion, reconnexion automatique...', 'userOrderSocketService');
      }
    });

    // 📦 Confirmation création commande
    this.socket.on('order-created', (data) => {
      logger.info('📦 Commande créée', 'userOrderSocketService', data);
      // Stocker comme commande active
      try {
        const order = data?.order;
        if (order && order.id) {
          useOrderStore.getState().addOrder(order as any);
        }
        // If backend reported persistence failure, inform the user
        if (data && data.dbSaved === false) {
          const message = data.dbError || 'La commande n\'a pas pu être enregistrée en base de données.';
          Alert.alert(
            'Erreur enregistrement',
            `${message}\nVoulez-vous réessayer ?`,
            [
              {
                text: 'Réessayer', onPress: () => {
                  // Keep UI simple: clear pending so user can recreate or retry flow
                  useOrderStore.getState().clear();
                }
              },
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
        // Forcer la commande à passer en "cancelled" pour déclencher les effets de nettoyage côté UI
        if (data?.orderId) {
          const store = useOrderStore.getState();
          const existing = store.activeOrders.find((o) => o.id === data.orderId);
          if (existing) {
            store.updateOrderStatus(data.orderId, 'cancelled');
          }
        } else {
          // Fallback si aucun orderId n'est fourni
          useOrderStore.getState().clear();
        }

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
        if (order && order.id) {
          // Ajouter ou mettre à jour la commande dans le store
          const store = useOrderStore.getState();
          const existingOrder = store.activeOrders.find(o => o.id === order.id);
          if (existingOrder) {
            store.updateOrder(order.id, { ...order, driver: driverInfo } as any);
          } else {
            store.addOrder({ ...order, driver: driverInfo } as any);
          }
        }

        // Si backend fournit position dans driverInfo, l'utiliser
        if (driverInfo && driverInfo.current_latitude && driverInfo.current_longitude && order?.id) {
          useOrderStore.getState().setDriverCoordsForOrder(order.id, {
            latitude: driverInfo.current_latitude,
            longitude: driverInfo.current_longitude,
          });
        }

        // Si driverInfo contient déjà des informations exploitables (transmises
        // par le socket), on les utilise directement sans appeler l'API.
        // MAIS si first_name est 'Livreur' (fallback du backend), on récupère les vraies données
        if (driverInfo && order?.id) {
          const isFallbackName = driverInfo.first_name === 'Livreur' ||
            (driverInfo.first_name === 'Livreur' && driverInfo.last_name && driverInfo.last_name.length === 8);

          if (isFallbackName && driverInfo.id) {
            // Le backend a envoyé des valeurs par défaut, récupérer les vraies données depuis la table users
            (async () => {
              try {
                const res = await userApiService.getUserProfile(driverInfo.id);
                if (res && res.success && res.data && order?.id) {
                  const store = useOrderStore.getState();
                  const existingOrder = store.activeOrders.find(o => o.id === order.id);
                  if (existingOrder) {
                    store.updateOrder(order.id, {
                      driver: {
                        id: res.data.id,
                        first_name: res.data.first_name,
                        last_name: res.data.last_name,
                        name: res.data.first_name && res.data.last_name
                          ? `${res.data.first_name} ${res.data.last_name}`.trim()
                          : res.data.first_name || res.data.last_name || undefined,
                        phone: res.data.phone,
                        email: res.data.email,
                        avatar_url: res.data.avatar_url,
                        // Garder les coordonnées du socket si disponibles
                        ...(driverInfo.current_latitude && driverInfo.current_longitude ? {
                          current_latitude: driverInfo.current_latitude,
                          current_longitude: driverInfo.current_longitude,
                        } : {}),
                      }
                    } as any);
                  }
                }
              } catch (err) {
                logger.warn('Impossible de récupérer les détails du chauffeur', 'userOrderSocketService', err);
              }
            })();
          } else {
            // Utiliser les données du socket directement
            const hasUsefulInfo = !!(driverInfo.current_latitude || driverInfo.phone || driverInfo.profile_image_url || driverInfo.first_name);
            if (hasUsefulInfo) {
              const store = useOrderStore.getState();
              const existingOrder = store.activeOrders.find(o => o.id === order.id);
              if (existingOrder) {
                store.updateOrder(order.id, {
                  driver: {
                    id: driverInfo.id,
                    name: driverInfo.first_name ? `${driverInfo.first_name} ${driverInfo.last_name || ''}`.trim() : undefined,
                    first_name: driverInfo.first_name || undefined,
                    last_name: driverInfo.last_name || undefined,
                    phone: driverInfo.phone || undefined,
                    avatar: driverInfo.profile_image_url || undefined,
                    avatar_url: driverInfo.profile_image_url || driverInfo.avatar_url || undefined,
                    profile_image_url: driverInfo.profile_image_url || undefined,
                    rating: driverInfo.rating || undefined,
                  }
                } as any);
              }
            } else if (driverInfo.id) {
              // Fallback : si le socket n'a fourni que l'id, récupérer les détails depuis la table users
              (async () => {
                try {
                  const res = await userApiService.getUserProfile(driverInfo.id);
                  if (res && res.success && res.data && order?.id) {
                    const store = useOrderStore.getState();
                    const existingOrder = store.activeOrders.find(o => o.id === order.id);
                    if (existingOrder) {
                      store.updateOrder(order.id, {
                        driver: {
                          id: res.data.id,
                          first_name: res.data.first_name,
                          last_name: res.data.last_name,
                          name: res.data.first_name && res.data.last_name
                            ? `${res.data.first_name} ${res.data.last_name}`.trim()
                            : res.data.first_name || res.data.last_name || undefined,
                          phone: res.data.phone,
                          email: res.data.email,
                          avatar_url: res.data.avatar_url,
                        }
                      } as any);
                    }
                  }
                } catch (err) {
                  logger.warn('Impossible de récupérer les détails du chauffeur', 'userOrderSocketService', err);
                }
              })();
            }
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
        const { pendingOrders, activeOrders, pendingOrder, currentOrder, driverCoords } = data || {};
        const store = useOrderStore.getState();

        // Ajouter toutes les commandes actives (nouveau format avec tableaux)
        if (Array.isArray(activeOrders)) {
          activeOrders.forEach((order: any) => {
            if (order && order.id) {
              store.addOrder(order);
            }
          });
        } else if (currentOrder && currentOrder.id) {
          // Compatibilité avec l'ancien format
          store.addOrder(currentOrder as any);
        }

        // Ajouter toutes les commandes en attente
        if (Array.isArray(pendingOrders)) {
          pendingOrders.forEach((order: any) => {
            if (order && order.id) {
              store.addOrder(order);
            }
          });
        } else if (pendingOrder && pendingOrder.id) {
          // Compatibilité avec l'ancien format
          store.addOrder(pendingOrder as any);
        }

        // Mettre à jour les coordonnées du livreur si disponibles
        if (driverCoords && driverCoords.latitude && driverCoords.longitude) {
          const orderId = currentOrder?.id || pendingOrder?.id;
          if (orderId) {
            store.setDriverCoordsForOrder(orderId, {
              latitude: driverCoords.latitude,
              longitude: driverCoords.longitude,
            });
          }
        }
      } catch (err) {
        logger.warn('Error handling resync-order-state', 'userOrderSocketService', err);
      }
    });

    // 🚛 Mise à jour statut livraison (et position)
    // Canonical status update event emitted by server
    this.socket.on('order:status:update', (data) => {
      logger.info('🚛 order:status:update reçu', 'userOrderSocketService', {
        orderId: data?.order?.id,
        status: data?.order?.status,
        fullData: data
      });
      try {
        const { order, location } = data || {};

        if (!order || !order.id) {
          logger.warn('⚠️ order:status:update reçu sans order.id', 'userOrderSocketService', data);
          return;
        }

        // Vérifier le statut actuel dans le store avant la mise à jour
        const storeBefore = useOrderStore.getState();
        const existingOrder = storeBefore.activeOrders.find(o => o.id === order.id);
        const oldStatus = existingOrder?.status || 'unknown';
        const newStatus = order.status || 'unknown';

        logger.info(`🔄 order:status:update - ${order.id.slice(0, 8)}...: ${oldStatus} → ${newStatus}`, 'userOrderSocketService');

        // 🆕 Mettre à jour immédiatement les coordonnées du livreur si elles sont fournies
        // Cela évite que le polyline se dessine avec des coordonnées obsolètes
        // Cela corrige le problème où le polyline rouge est "n'importe quoi au départ"
        if (location && (location.latitude || location.lat || location.y) && (location.longitude || location.lng || location.x) && order?.id) {
          const normLocation = {
            latitude: location.latitude ?? location.lat ?? location.y,
            longitude: location.longitude ?? location.lng ?? location.x,
          };
          useOrderStore.getState().setDriverCoordsForOrder(order.id, normLocation);
        }

        // Normalize location keys to { latitude, longitude }
        const normLocation = location
          ? {
            latitude: location.latitude ?? location.lat ?? location.y ?? null,
            longitude: location.longitude ?? location.lng ?? location.x ?? null,
          }
          : null;

        // Mettre à jour le store immédiatement
        logger.info('🔄 Mise à jour du store avec nouveau statut', 'userOrderSocketService', {
          orderId: order?.id,
          status: order?.status,
          oldStatus,
          newStatus
        });
        useOrderStore.getState().updateFromSocket({ order: order as any, location: normLocation });

        // Vérifier que la mise à jour a bien été appliquée
        setTimeout(() => {
          const storeAfter = useOrderStore.getState();
          const updatedOrder = storeAfter.activeOrders.find(o => o.id === order.id);
          if (updatedOrder) {
            logger.info(`✅ Vérification post-update: ${order.id.slice(0, 8)}... a maintenant le statut ${updatedOrder.status}`, 'userOrderSocketService');
          } else {
            logger.warn(`⚠️ Commande ${order.id.slice(0, 8)}... n'a pas été trouvée dans le store après updateFromSocket`, 'userOrderSocketService');
          }
        }, 100);

        // Si la commande est complétée, afficher le bottom sheet d'évaluation
        if (order && order.status === 'completed' && order.id) {
          try {
            // Récupérer le driver_id depuis l'order ou depuis le store
            const store = useOrderStore.getState();
            const orderInStore = store.activeOrders.find(o => o.id === order.id);
            const driverId = order.driver?.id || order.driverId || orderInStore?.driver?.id || orderInStore?.driverId;

            if (driverId) {
              // Récupérer le nom du livreur
              const driverName = order.driver?.name ||
                (order.driver?.first_name ? `${order.driver.first_name || ''} ${order.driver.last_name || ''}`.trim() : null) ||
                orderInStore?.driver?.name ||
                'Votre livreur';

              logger.info('⭐ Déclenchement RatingBottomSheet pour commande complétée', 'userOrderSocketService', {
                orderId: order.id,
                driverId,
                driverName,
                orderHasDriver: !!order.driver?.id,
                orderInStoreHasDriver: !!orderInStore?.driver?.id
              });

              useRatingStore.getState().setRatingBottomSheet(
                true,
                order.id,
                driverId,
                driverName || 'Votre livreur'
              );

              logger.info('✅ RatingBottomSheet déclenché avec succès', 'userOrderSocketService', { orderId: order.id });
            } else {
              logger.warn('⚠️ Impossible de déclencher RatingBottomSheet : driverId manquant', 'userOrderSocketService', {
                orderId: order.id,
                orderDriver: order.driver,
                orderDriverId: order.driverId,
                orderInStoreDriver: orderInStore?.driver,
                orderInStoreDriverId: orderInStore?.driverId
              });
            }
          } catch (err) {
            logger.error('❌ Erreur déclenchement bottom sheet évaluation', 'userOrderSocketService', err);
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

    // ❌ Commande annulée
    this.socket.on('order-cancelled', (data) => {
      try {
        logger.info('❌ Commande annulée reçue', 'userOrderSocketService', data);
        const { orderId } = data || {};
        if (orderId) {
          // Mettre à jour le store pour refléter l'annulation
          const store = useOrderStore.getState();
          store.updateOrderStatus(orderId, 'cancelled');
          // Le nettoyage complet sera fait automatiquement après 2 secondes
        }
      } catch (err) {
        logger.warn('Error handling order-cancelled', 'userOrderSocketService', err);
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
    this.socket.on('order-error', (data: { success?: boolean; message?: string; code?: string }) => {
      // Pour les erreurs de paiement différé, utiliser warn() au lieu de error()
      // car ce sont des erreurs métier attendues et gérées par le modal personnalisé
      // Cela évite d'afficher l'écran d'erreur de la console React Native
      const isDeferredPaymentError = data.code === 'DEFERRED_PAYMENT_LIMIT_EXCEEDED' ||
        data.code === 'MONTHLY_LIMIT_EXCEEDED' ||
        data.code === 'ANNUAL_LIMIT_EXCEEDED' ||
        data.code === 'MAX_MONTHLY_USAGES_EXCEEDED' ||
        data.code === 'COOLDOWN_ACTIVE' ||
        data.code === 'DEFERRED_PAYMENT_BLOCKED';

      if (isDeferredPaymentError) {
        logger.warn('⚠️ Erreur paiement différé (gérée par modal):', 'userOrderSocketService', data);
      } else {
        logger.error('❌ Erreur commande:', 'userOrderSocketService', data);
      }

      // Afficher le modal d'erreur avec le message d'erreur
      const errorMessage = data.message || 'Une erreur est survenue lors de la création de la commande';

      // Titre différent selon le type d'erreur
      let title = 'Erreur de commande';
      if (isDeferredPaymentError) {
        title = 'Paiement différé non disponible';
      }

      // Afficher le modal d'erreur via le store
      usePaymentErrorStore.getState().showError(title, errorMessage, data.code || undefined);

      // Nettoyer complètement l'état pour revenir au formulaire initial
      try {
        useOrderStore.getState().clear();
      } catch { }
    });

    this.socket.on('connect_error', (error) => {
      this.isConnected = false;

      // Ignorer les erreurs de polling temporaires (Socket.IO essaie plusieurs transports)
      const isTemporaryPollError = error.message?.includes('xhr poll error') ||
        error.message?.includes('poll error') ||
        error.message?.includes('transport unknown');

      // Ne logger que les erreurs importantes
      if (!isTemporaryPollError || this.retryCount >= 3) {
        logger.error('❌ Erreur connexion socket user:', 'userOrderSocketService', {
          message: error.message,
          type: (error as any).type,
          description: (error as any).description,
          retryCount: this.retryCount,
        });
      }

      // Laisser Socket.IO gérer la reconnexion automatique
      // Ne pas forcer une reconnexion manuelle pour éviter les doubles connexions
      this.retryCount = (this.retryCount || 0) + 1;
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
      details?: {
        entrance?: string;
        apartment?: string;
        floor?: string;
        intercom?: string;
        photos?: string[];
      };
    };
    dropoff: {
      address: string;
      coordinates: { latitude: number; longitude: number };
      details?: {
        phone?: string;
        entrance?: string;
        apartment?: string;
        floor?: string;
        intercom?: string;
        photos?: string[];
      };
    };
    deliveryMethod: 'moto' | 'vehicule' | 'cargo';
    userInfo: {
      name: string;
      avatar?: string;
      rating?: number;
      phone?: string;
    };
    recipient?: {
      phone: string;
      contactId?: string;
    };
    packageImages?: string[];
    // Informations de paiement
    paymentMethodType?: 'orange_money' | 'wave' | 'cash' | 'deferred';
    paymentMethodId?: string | null; // ID de la méthode de paiement depuis payment_methods
    paymentPayerType?: 'client' | 'recipient';
    isPartialPayment?: boolean;
    partialAmount?: number;
    recipientUserId?: string;
    recipientIsRegistered?: boolean;
  }) {
    return new Promise<boolean>(async (resolve) => {
      // S'assurer que le socket est connecté avant de créer la commande
      const connected = await this.ensureConnected();
      if (!connected) {
        Alert.alert(
          'Erreur de connexion',
          'Impossible de se connecter au serveur. Veuillez vérifier votre connexion internet et réessayer.',
          [{ text: 'OK' }]
        );
        resolve(false);
        return;
      }

      // Double vérification après la reconnexion
      if (!this.socket || !this.isConnected || !this.userId) {
        logger.error('❌ Socket toujours non connecté après ensureConnected', 'userOrderSocketService');
        Alert.alert(
          'Erreur',
          'Vous devez être connecté pour créer une commande. Veuillez vous reconnecter.',
          [{ text: 'OK' }]
        );
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

  // Vérifier la connexion et se reconnecter si nécessaire
  isSocketConnected() {
    const isConnected = this.isConnected && this.socket?.connected;

    // Si le socket existe mais n'est pas connecté, essayer de se reconnecter
    if (this.socket && !isConnected && this.userId) {
      logger.warn('⚠️ Socket existe mais non connecté, tentative de reconnexion...', 'userOrderSocketService');
      this.connect(this.userId);
    }

    return isConnected;
  }

  // S'assurer que le socket est connecté avant une opération
  async ensureConnected(): Promise<boolean> {
    if (this.isSocketConnected()) {
      return true;
    }

    if (!this.userId) {
      logger.error('❌ Impossible de se connecter : aucun userId', 'userOrderSocketService');
      return false;
    }

    logger.info('🔄 Tentative de connexion du socket...', 'userOrderSocketService');
    this.connect(this.userId);

    // Attendre que la connexion s'établisse (maximum 3 secondes)
    const maxWaitTime = 3000;
    const checkInterval = 100;
    let elapsed = 0;

    while (elapsed < maxWaitTime) {
      if (this.isConnected && this.socket?.connected) {
        logger.info('✅ Socket connecté avec succès', 'userOrderSocketService');
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, checkInterval));
      elapsed += checkInterval;
    }

    logger.error('❌ Impossible de connecter le socket après 3 secondes', 'userOrderSocketService');
    return false;
  }
}

// Instance singleton
export const userOrderSocketService = new UserOrderSocketService();