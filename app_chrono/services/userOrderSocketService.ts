import { Alert } from 'react-native';
import { io, Socket } from 'socket.io-client';
import { config } from '../config';
import { useOrderStore } from '../store/useOrderStore';
import { logger } from '../utils/logger';
import { createOrderRecord } from './orderApi';
import { userApiService } from './userApiService';
import { soundService } from './soundService';

class UserOrderSocketService {
  private socket: Socket | null = null;
  private userId: string | null = null;
  private isConnected = false;
  private retryCount: number = 0;
  private isCreatingOrder = false; // Protection contre les appels multiples
  private listenersSetup = false; // Flag pour éviter les listeners multiples

  connect(userId: string) {
    // Si le socket est déjà connecté avec le même userId, ne rien faire
    if (this.socket && this.isConnected && this.socket.connected && this.userId === userId && this.listenersSetup) {
      logger.debug('🔌 Socket déjà connecté avec le même userId, ignoré', 'userOrderSocketService');
      return;
    }

    // Nettoyer l'ancien socket s'il existe
    if (this.socket) {
      logger.info('🔄 Nettoyage de l\'ancien socket', 'userOrderSocketService');
      try {
        this.socket.removeAllListeners();
        this.socket.disconnect();
      } catch (err) {
        logger.warn('Erreur lors du nettoyage du socket', 'userOrderSocketService', err);
      }
      this.socket = null;
      this.listenersSetup = false;
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

    // Toujours installer les listeners (ils seront réinstallés à chaque reconnexion dans setupSocketListeners)
    // Mais marquer comme setup pour éviter les appels multiples lors de la première connexion
    if (!this.listenersSetup) {
      this.setupSocketListeners(userId);
      this.listenersSetup = true;
    } else {
      // Si les listeners sont déjà setup mais qu'on recrée le socket, réinstaller les listeners
      this.setupSocketListeners(userId);
    }
  }

  // Méthode séparée pour installer uniquement les listeners d'événements (pas connect/disconnect)
  private installEventListeners(userId: string) {
    if (!this.socket) return;

    // 📦 Confirmation création commande
    this.socket.on('order-created', (data) => {
      logger.info('📦 Commande créée', 'userOrderSocketService', data);
      // Stocker comme commande active
      try {
        const order = data?.order;
        if (order && order.id) {
          const store = useOrderStore.getState();
          store.addOrder(order as any);
          // IMPORTANT : Sélectionner automatiquement la nouvelle commande créée
          // Cela garantit que la recherche de livreur se fait pour la nouvelle commande, pas pour l'ancienne
          logger.info('🎯 Sélection automatique de la nouvelle commande créée', 'userOrderSocketService', {
            orderId: order.id,
            previousSelectedId: store.selectedOrderId,
          });
          store.setSelectedOrder(order.id);
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
    // IMPORTANT : Ce listener doit être réinstallé à chaque reconnexion
    this.socket.on('order-accepted', (data) => {
      logger.info('✅ Commande acceptée par driver - ÉVÉNEMENT REÇU', 'userOrderSocketService', {
        orderId: data?.order?.id,
        hasOrder: !!data?.order,
        hasDriverInfo: !!data?.driverInfo,
        orderStatus: data?.order?.status,
      });
      try {
        const { order, driverInfo } = data || {};
        if (order && order.id) {
          // FORCER le statut à 'accepted' - c'est l'événement order-accepted, donc le statut doit être 'accepted'
          const orderWithStatus = {
            ...order,
            status: 'accepted' as const, // Forcer explicitement le statut à 'accepted'
            driver: driverInfo,
          };

          logger.info('🔄 Mise à jour du store avec order-accepted', 'userOrderSocketService', {
            orderId: order.id,
            status: orderWithStatus.status,
            hasDriver: !!driverInfo,
          });

          // Ajouter ou mettre à jour la commande dans le store
          const store = useOrderStore.getState();
          const existingOrder = store.activeOrders.find(o => o.id === order.id);

          logger.info('📦 État actuel du store', 'userOrderSocketService', {
            existingOrderFound: !!existingOrder,
            existingOrderStatus: existingOrder?.status,
            totalActiveOrders: store.activeOrders.length,
          });

          if (existingOrder) {
            // Utiliser updateFromSocket pour garantir que le statut est bien propagé et déclenche les effets
            logger.info('🔄 Utilisation de updateFromSocket pour commande existante', 'userOrderSocketService', {
              orderId: order.id,
              oldStatus: existingOrder.status,
              newStatus: orderWithStatus.status,
            });
            // Mettre à jour avec updateFromSocket qui gère correctement le changement de statut
            store.updateFromSocket({ order: orderWithStatus as any });
            // Forcer aussi la mise à jour du statut avec updateOrderStatus pour garantir la cohérence
            store.updateOrderStatus(order.id, 'accepted');
          } else {
            logger.info('➕ Ajout de nouvelle commande au store', 'userOrderSocketService', {
              orderId: order.id,
              status: orderWithStatus.status,
            });
            store.addOrder(orderWithStatus as any);
          }

          // Vérifier que la mise à jour a bien eu lieu
          const updatedStore = useOrderStore.getState();
          const updatedOrder = updatedStore.activeOrders.find(o => o.id === order.id);
          logger.info('✅ Commande mise à jour dans le store avec statut accepted', 'userOrderSocketService', {
            orderId: order.id,
            status: orderWithStatus.status,
            hasDriver: !!driverInfo,
            storeUpdated: !!updatedOrder,
            storeStatus: updatedOrder?.status,
            storeHasDriver: !!updatedOrder?.driver,
            totalActiveOrders: updatedStore.activeOrders.length,
            allOrdersStatuses: updatedStore.activeOrders.map(o => ({
              id: o.id.slice(0, 8),
              status: o.status,
              hasDriver: !!o.driver,
            })),
          });

          // Jouer le son de commande acceptée
          soundService.initialize().then(() => {
            soundService.playOrderAccepted();
          }).catch((err) => {
            console.warn('[userOrderSocketService] Erreur lecture son:', err);
          });

          // IMPORTANT : Sélectionner automatiquement la commande acceptée pour qu'elle soit affichée
          // Cela garantit que même avec plusieurs commandes actives, la commande acceptée est visible
          if (updatedOrder && updatedOrder.status === 'accepted' && updatedOrder.driver) {
            const currentSelectedId = updatedStore.selectedOrderId;
            // Sélectionner cette commande si aucune n'est sélectionnée, ou si la commande sélectionnée n'est pas acceptée
            if (!currentSelectedId) {
              logger.info('🎯 Sélection automatique de la commande acceptée (aucune sélection)', 'userOrderSocketService', {
                orderId: order.id,
              });
              updatedStore.setSelectedOrder(order.id);
            } else {
              const selectedOrder = updatedStore.activeOrders.find(o => o.id === currentSelectedId);
              // Si la commande sélectionnée n'est pas acceptée, sélectionner la nouvelle commande acceptée
              if (!selectedOrder || selectedOrder.status !== 'accepted' || !selectedOrder.driver) {
                logger.info('🎯 Sélection automatique de la commande acceptée (remplacement)', 'userOrderSocketService', {
                  orderId: order.id,
                  previousSelectedId: currentSelectedId,
                  previousStatus: selectedOrder?.status,
                });
                updatedStore.setSelectedOrder(order.id);
              }
            }
          }
        } else {
          logger.warn('⚠️ order-accepted reçu mais order.id manquant', 'userOrderSocketService', { data });
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

    // Autres listeners...
    this.socket.on('order-cancelled', (data) => {
      logger.info('❌ Commande annulée', 'userOrderSocketService', data);
      try {
        if (data?.orderId) {
          const store = useOrderStore.getState();
          store.updateOrderStatus(data.orderId, 'cancelled');
        }
      } catch (err) {
        logger.warn('Error handling order-cancelled', 'userOrderSocketService', err);
      }
    });

    this.socket.on('order-error', (data) => {
      logger.warn('❌ Erreur commande', 'userOrderSocketService', data);
      if (data?.message) {
        Alert.alert('Erreur', data.message);
      }
    });

    this.socket.on('order:status:update', (data) => {
      logger.info('🔄 Mise à jour statut commande', 'userOrderSocketService', data);
      try {
        const { order } = data || {};
        if (order && order.id) {
          const store = useOrderStore.getState();
          store.updateFromSocket({ order: order as any });
        }
      } catch (err) {
        logger.warn('Error handling order:status:update', 'userOrderSocketService', err);
      }
    });

    this.socket.on('driver:location:update', (data) => {
      try {
        const { orderId, latitude, longitude } = data || {};
        if (orderId && latitude && longitude) {
          const store = useOrderStore.getState();
          store.setDriverCoordsForOrder(orderId, { latitude, longitude });
        }
      } catch (err) {
        logger.warn('Error handling driver:location:update', 'userOrderSocketService', err);
      }
    });
  }

  private setupSocketListeners(userId: string, skipConnectDisconnect = false) {
    if (!this.socket) return;

    // IMPORTANT : Retirer les anciens listeners avant d'en ajouter de nouveaux
    // Cela évite les listeners dupliqués lors des reconnexions
    // Ne pas retirer 'connect' et 'disconnect' si on est déjà dans le listener connect
    if (!skipConnectDisconnect) {
      this.socket.removeAllListeners('connect');
      this.socket.removeAllListeners('disconnect');
    }
    this.socket.removeAllListeners('order-accepted');
    this.socket.removeAllListeners('order-created');
    this.socket.removeAllListeners('order-cancelled');
    this.socket.removeAllListeners('order-error');
    this.socket.removeAllListeners('no-drivers-available');
    this.socket.removeAllListeners('order:status:update');
    this.socket.removeAllListeners('driver:location:update');
    this.socket.removeAllListeners('resync-order-state');

    this.socket.on('connect', () => {
      logger.info('🔌 Socket user connecté pour commandes', 'userOrderSocketService');
      this.isConnected = true;
      this.retryCount = 0; // Réinitialiser le compteur de retry en cas de succès

      // CRITIQUE : Installer les listeners AVANT d'émettre user-connect
      // Cela garantit que si le serveur envoie un événement immédiatement après user-connect,
      // le listener est déjà en place pour le recevoir
      logger.info('🔄 Réinstallation des listeners après reconnexion (AVANT user-connect)', 'userOrderSocketService');
      // Installer tous les listeners sauf connect/disconnect (pour éviter la récursion)
      if (this.socket) {
        this.socket.removeAllListeners('order-accepted');
        this.socket.removeAllListeners('order-created');
        this.socket.removeAllListeners('order-cancelled');
        this.socket.removeAllListeners('order-error');
        this.socket.removeAllListeners('no-drivers-available');
        this.socket.removeAllListeners('order:status:update');
        this.socket.removeAllListeners('driver:location:update');
        this.socket.removeAllListeners('resync-order-state');
      }

      // Réinstaller les listeners (sauf connect/disconnect pour éviter la récursion)
      this.installEventListeners(userId);

      // S'identifier comme user - IMPORTANT : Toujours ré-émettre même si déjà connecté
      // Cela garantit que le serveur a bien le userId associé au socket actuel
      logger.info('👤 Identification comme user', 'userOrderSocketService', { userId });
      this.socket?.emit('user-connect', userId);

      // Attendre un peu pour s'assurer que le serveur a bien enregistré l'association
      setTimeout(() => {
        // Ask server to resync any existing order state for this user
        // (backend should reply with an event like `resync-order-state`)
        try {
          this.socket?.emit('user-reconnect', { userId });
          logger.debug('🔄 user-reconnect émis', 'userOrderSocketService', { userId });
        } catch (err) {
          logger.warn('Resync emit failed', 'userOrderSocketService', err);
        }
      }, 100);
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

    // Installer tous les listeners d'événements (pas connect/disconnect)
    this.installEventListeners(userId);
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
    paymentPhone?: string;
    estimatedPrice?: number;
  }): Promise<boolean> {
    return new Promise<boolean>(async (resolve) => {
      // Protection contre les appels multiples simultanés
      if (this.isCreatingOrder) {
        logger.warn('⚠️ Tentative de création de commande alors qu\'une création est déjà en cours', 'userOrderSocketService');
        resolve(false);
        return;
      }

      // Vérifier que l'utilisateur est connecté avant de créer la commande
      if (!this.userId) {
        logger.warn('⚠️ Tentative de création de commande sans userId', 'userOrderSocketService');
        Alert.alert(
          'Erreur',
          'Vous devez être connecté pour créer une commande. Veuillez vous connecter.',
          [{ text: 'OK' }]
        );
        resolve(false);
        return;
      }

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

      // Marquer qu'une création est en cours
      this.isCreatingOrder = true;

      // Helper pour réinitialiser le flag et résoudre la promesse
      const finishOrderCreation = (success: boolean) => {
        this.isCreatingOrder = false;
        resolve(success);
      };

      // Double vérification après la reconnexion
      if (!this.socket || !this.isConnected || !this.userId) {
        logger.error('❌ Socket toujours non connecté après ensureConnected', 'userOrderSocketService');
        Alert.alert(
          'Erreur',
          'Vous devez être connecté pour créer une commande. Veuillez vous reconnecter.',
          [{ text: 'OK' }]
        );
        finishOrderCreation(false);
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

        finishOrderCreation(false);
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
          finishOrderCreation(false);
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
                finishOrderCreation(false);
                return;
              }

              // server persisted the order
              finishOrderCreation(true);
            } else {
              logger.warn('❌ createOrder rejected by server', ackResponse);
              finishOrderCreation(false);
            }
          } catch (err) {
            logger.warn('Error parsing createOrder ack', 'userOrderSocketService', err);
            finishOrderCreation(false);
          }
        });
      } catch (err) {
        clearTimeout(timeout);
        logger.error('❌ Error emitting create-order', 'userOrderSocketService', err);
        finishOrderCreation(false);
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
      // Ce n'est pas une erreur critique, juste un avertissement
      // car ensureConnected() peut être appelé avant que l'utilisateur soit connecté
      logger.debug('⚠️ ensureConnected appelé sans userId (utilisateur non connecté)', 'userOrderSocketService');
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