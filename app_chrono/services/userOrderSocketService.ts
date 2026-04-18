import { io, Socket } from 'socket.io-client';
import Constants from 'expo-constants';
import { config } from '../config';
import { useOrderStore } from '../store/useOrderStore';
import { useAuthStore } from '../store/useAuthStore';
import { useRealtimeDegradedStore } from '../store/useRealtimeDegradedStore';
import { logger } from '../utils/logger';
import {
  addSocketSuccessBreadcrumb,
  captureError,
  reportSocketIssue,
} from '../utils/sentry';
import { createOrderRecord } from './orderApi';
import { syncOrderLiveActivity } from './orderLiveActivity';
import type { PaymentMethodType } from './paymentApi';
import { userApiService } from './userApiService';
import { soundService } from './soundService';
import { UserFriendlyError } from '../utils/userFriendlyError';

function readJwtExpEpochSeconds(token: string): number | null {
  try {
    const [, payload] = token.split('.');
    if (!payload) return null;
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const json = JSON.parse(atob(padded));
    const exp = (json as { exp?: unknown }).exp;
    return typeof exp === 'number' ? exp : null;
  } catch {
    return null;
  }
}

class UserOrderSocketService {
  private socket: Socket | null = null;
  private userId: string | null = null;
  private isConnected = false;
  /** Dernier JWT passé au handshake ; si le store a changé après refresh, il faut reconnecter. */
  private lastSocketAuthToken: string | null = null;
  private retryCount: number = 0;
  private isCreatingOrder = false; // Protection contre les appels multiples
  private listenersSetup = false; // Flag pour éviter les listeners multiples
  private isRefreshingSocketAuth = false;
  /** Après reconnect_failed : combien de fois on a déjà tout recréé avec JWT forcé. */
  private reconnectRecoveryCount = 0;
  /** Fallback transport: si WS échoue en boucle, forcer polling-only. */
  private forcedPollingMode = false;

  private isAuthRelatedSocketError(message: string | undefined): boolean {
    const m = (message || '').toLowerCase();
    return (
      m.includes('jwt') ||
      m.includes('token') ||
      m.includes('unauthorized') ||
      m.includes('unauthenticated') ||
      m.includes('authentication') ||
      m.includes('invalid credentials') ||
      m.includes('forbidden') ||
      m.includes('expired') ||
      m.includes('handshake')
    );
  }

  /**
   * reconnect_failed : Socket.IO a abandonné — souvent JWT périmé ou transport bloqué.
   * On force un refresh HTTP puis on recrée un socket neuf (pas seulement disconnect/connect).
   */
  private async recoverSocketAfterReconnectFailed(): Promise<void> {
    const uid = this.userId;
    if (!uid || this.isRefreshingSocketAuth) return;
    if (this.reconnectRecoveryCount >= 2) {
      useRealtimeDegradedStore.getState().setSocketDegraded(true);
      return;
    }
    this.reconnectRecoveryCount += 1;
    this.isRefreshingSocketAuth = true;
    try {
      logger.warn('Recovery socket après reconnect_failed (JWT forcé + nouveau client)', 'userOrderSocketService', {
        attempt: this.reconnectRecoveryCount,
      });
      const newToken = await userApiService.ensureAccessToken({ forceRefresh: true });
      if (!newToken) {
        useRealtimeDegradedStore.getState().setSocketDegraded(true);
        reportSocketIssue('client_orders_reconnect_failed_no_token', {
          socketUrl: config.socketUrl,
        });
        return;
      }
      if (this.socket) {
        try {
          this.socket.removeAllListeners();
          this.socket.io.removeAllListeners();
          this.socket.disconnect();
        } catch {
          /* ignore */
        }
        this.socket = null;
      }
      this.listenersSetup = false;
      this.isConnected = false;
      this.lastSocketAuthToken = newToken;
      this.connect(uid);
    } catch (err) {
      logger.warn('Recovery socket échouée', 'userOrderSocketService', err);
      useRealtimeDegradedStore.getState().setSocketDegraded(true);
    } finally {
      this.isRefreshingSocketAuth = false;
    }
  }

  private async tryRefreshAuthAndReconnect(source: string): Promise<void> {
    if (!this.socket || !this.userId || this.isRefreshingSocketAuth) return;
    this.isRefreshingSocketAuth = true;
    try {
      logger.warn('Refresh JWT avant reconnexion socket', 'userOrderSocketService', { source });
      const newToken = await userApiService.ensureAccessToken({ forceRefresh: true });
      if (!newToken || !this.socket || !this.userId) return;

      this.lastSocketAuthToken = newToken;
      this.socket.auth = { token: newToken };
      this.socket.disconnect();
      this.socket.connect();
      logger.info('Reconnexion socket relancée avec JWT rafraîchi', 'userOrderSocketService');
    } catch (err) {
      logger.warn('Échec refresh JWT pour socket', 'userOrderSocketService', err);
    } finally {
      this.isRefreshingSocketAuth = false;
    }
  }

  private buildSocketTransports(): ('websocket' | 'polling')[] {
    if (this.forcedPollingMode) return ['polling'];
    // Prod : WebSocket upgrade souvent cassé sur mobile/4G alors que HTTPS REST marche → polling seul (fiable).
    if (!__DEV__) return ['polling'];
    return ['websocket', 'polling'];
  }

  connect(userId: string) {
    // Déjà connecté
    if (this.socket && this.isConnected && this.socket.connected && this.userId === userId && this.listenersSetup) {
      logger.debug('🔌 Socket déjà connecté avec le même userId, ignoré', 'userOrderSocketService');
      return;
    }
    // Même user, socket en cours de connexion (handshake) : ne pas recréer (sinon 400 sur l’ancien sid)
    if (this.socket && this.userId === userId && this.listenersSetup && this.socket.active) {
      logger.debug('🔌 Socket commandes déjà actif pour ce userId (handshake ou reconnect), ignoré', 'userOrderSocketService');
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
    const token = useAuthStore.getState().accessToken;
    if (!token) {
      logger.warn('Impossible de connecter le socket: accessToken manquant', 'userOrderSocketService');
      return;
    }
    this.lastSocketAuthToken = token;
    const tokenExp = readJwtExpEpochSeconds(token);
    const tokenTtlSec =
      typeof tokenExp === 'number' ? tokenExp - Math.floor(Date.now() / 1000) : null;
    logger.info('🔌 Connexion au socket...', 'userOrderSocketService', { socketUrl });
    logger.info('Socket auth diagnostic', 'userOrderSocketService', {
      hasToken: Boolean(token),
      tokenExp,
      tokenTtlSec,
      userId,
    });
    this.socket = io(socketUrl, {
      transports: this.buildSocketTransports(),
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
      reconnectionAttempts: 24,
      timeout: 20000,
      forceNew: false,
      upgrade: __DEV__,
      autoConnect: true,
      auth: {
        token,
      },
    });

    this.socket.io.on('reconnect_attempt', (attempt) => {
      const latestToken = useAuthStore.getState().accessToken;
      if (latestToken && latestToken !== this.lastSocketAuthToken && this.socket) {
        this.lastSocketAuthToken = latestToken;
        this.socket.auth = { token: latestToken };
      }
      logger.warn('Socket commandes: tentative de reconnexion', 'userOrderSocketService', {
        attempt,
        connected: this.socket?.connected,
        transport: this.socket?.io?.engine?.transport?.name,
      });
    });

    const socketDiag = () => ({
      clientTransportMode: __DEV__ ? 'dev_ws_then_polling' : 'prod_polling_only',
      transportsConfigured: this.buildSocketTransports().join(','),
      iosBuild: Constants.nativeBuildVersion ?? 'unknown',
    });

    this.socket.io.on('reconnect_error', (error: Error & { type?: string; description?: unknown }) => {
      reportSocketIssue('client_orders_reconnect_error', {
        socketUrl,
        message: error.message,
        type: String(error.type ?? ''),
        description: String(error.description ?? ''),
        transport: this.socket?.io?.engine?.transport?.name ?? 'unknown',
        ...socketDiag(),
      });
    });

    this.socket.io.on('error', (error: Error & { type?: string; description?: unknown }) => {
      // Même famille que connect_error : ne pas envoyer une « exception » Sentry pour une coupure polling (background iOS, réseau).
      const transient =
        error.message?.includes('xhr poll error') ||
        error.message?.includes('poll error') ||
        error.message?.includes('transport unknown') ||
        (error as { type?: string }).type === 'TransportError';
      if (transient) {
        logger.warn('Socket manager error (transient, non reporté Sentry)', 'userOrderSocketService', {
          message: error.message,
          type: String(error.type ?? ''),
          transport: this.socket?.io?.engine?.transport?.name ?? 'unknown',
          ...socketDiag(),
        });
        return;
      }
      reportSocketIssue('client_orders_manager_error', {
        socketUrl,
        message: error.message,
        type: String(error.type ?? ''),
        description: String(error.description ?? ''),
        transport: this.socket?.io?.engine?.transport?.name ?? 'unknown',
        ...socketDiag(),
      });
    });

    this.socket.io.on('reconnect_failed', () => {
      logger.warn('Socket commandes: reconnexions épuisées — tentative recovery JWT + nouveau socket', 'userOrderSocketService');
      reportSocketIssue('client_orders_reconnect_failed', {
        socketUrl,
        transport: this.socket?.io?.engine?.transport?.name ?? 'unknown',
        retries: this.retryCount,
        recoveryAttempt: this.reconnectRecoveryCount,
        ...socketDiag(),
      });
      void this.recoverSocketAfterReconnectFailed();
    });

    this.socket.on('connect_error', (error: Error & { type?: string }) => {
      this.retryCount = (this.retryCount || 0) + 1;
      const msg = (error.message || '').toLowerCase();
      /** Session socket longue durée : le serveur renvoie souvent HTTP 400 sur polling → reconnexion normale, pas une alerte Sentry prioritaire. */
      const isLikelyStaleSocketSession =
        msg.includes('400') ||
        msg.includes('bad request') ||
        msg.includes('session id unknown') ||
        msg.includes('xhr post error') ||
        msg.includes('xhr get error');
      const isTemporaryPollError =
        error.message?.includes('xhr poll error') ||
        error.message?.includes('poll error') ||
        error.message?.includes('transport unknown') ||
        error.message?.includes('websocket error') ||
        (error as { type?: string }).type === 'TransportError' ||
        isLikelyStaleSocketSession;
      const errorPayload = {
        socketUrl,
        message: error.message,
        type: String((error as { type?: string }).type ?? ''),
        retries: this.retryCount,
        transport: this.socket?.io?.engine?.transport?.name ?? 'unknown',
        /** Permet de vérifier dans Sentry si le build est bien celui avec polling en prod */
        clientTransportMode: __DEV__ ? 'dev_ws_then_polling' : 'prod_polling_only',
        transportsConfigured: this.buildSocketTransports().join(','),
        iosBuild: Constants.nativeBuildVersion ?? 'unknown',
      };
      logger.warn('Socket connect_error', 'userOrderSocketService', errorPayload);
      if (!isTemporaryPollError || this.retryCount >= 3) {
        reportSocketIssue('client_orders_connect_error', {
          ...errorPayload,
          temporaryPollError: isTemporaryPollError,
        });
      }
      // iOS renvoie souvent seulement « websocket error » alors que le handshake JWT est refusé.
      const persistentAuthGuess = this.retryCount >= 8 && this.retryCount % 8 === 0;
      if (this.isAuthRelatedSocketError(error.message) || persistentAuthGuess) {
        void this.tryRefreshAuthAndReconnect('connect_error');
      }

      // Si WS échoue en boucle avec TransportError, basculer en polling-only.
      const isWebsocketTransportError =
        isTemporaryPollError &&
        ((error as { type?: string }).type === 'TransportError' ||
          (error.message || '').toLowerCase().includes('websocket error'));
      if (isWebsocketTransportError && !this.forcedPollingMode && this.retryCount >= 4 && this.userId) {
        const currentSocket = this.socket;
        if (!currentSocket) return;
        this.forcedPollingMode = true;
        reportSocketIssue('client_orders_force_polling_fallback', {
          socketUrl,
          retries: this.retryCount,
          previousTransport: currentSocket.io?.engine?.transport?.name ?? 'websocket',
        });
        logger.warn('Fallback socket: passage en polling-only après erreurs websocket', 'userOrderSocketService', {
          retries: this.retryCount,
        });
        const uid = this.userId;
        currentSocket.removeAllListeners();
        currentSocket.io.removeAllListeners();
        currentSocket.disconnect();
        this.socket = null;
        this.listenersSetup = false;
        this.isConnected = false;
        this.connect(uid);
        return;
      }
    });

    // CRITIQUE : Installer TOUS les listeners AVANT la connexion
    // Cela garantit que les événements sont capturés dès la connexion
    // setupSocketListeners installe les listeners connect/disconnect ET les event listeners
    this.setupSocketListeners(userId);
    this.listenersSetup = true;
  }

  /**
   * Annulation côté serveur : le backend n’utilise pas le même nom d’événement partout.
   * - `order-cancelled` : flux orderSocket (timeout livreurs, aucun dispo, etc.)
   * - `order:cancelled` : cancel HTTP, admin, et autres chemins (voir deliveryController, adminController)
   * Sans écouter les deux, le store peut rester en `pending` → Dynamic Island bloqué sur « recherche ».
   */
  private handleUserOrderCancelled = (data: { orderId?: string; reason?: string }) => {
    logger.info('Commande annulée (socket)', 'userOrderSocketService', data);
    try {
      if (data?.orderId) {
        useOrderStore.getState().updateOrderStatus(data.orderId, 'cancelled');
      }
    } catch (err) {
      logger.warn('Error handling order cancelled event', 'userOrderSocketService', err);
    }
  };

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
          // Sélectionner automatiquement la nouvelle commande créée
          // Cela garantit que la recherche de livreur se fait pour la nouvelle commande, pas pour l'ancienne
          logger.info('Sélection automatique de la nouvelle commande créée', 'userOrderSocketService', {
            orderId: order.id,
            previousSelectedId: store.selectedOrderId,
          });
          store.setSelectedOrder(order.id);
          /**
           * Live Activity : le premier `ActivityKit.start()` doit avoir lieu **au premier plan**.
           * En QA (un seul iPhone : client → livreur → client), si on n’appelle `start` qu’après
           * acceptation, l’app client est en arrière-plan → échec « Target is not foreground ».
           * Ici la commande est `pending` : l’utilisateur est encore sur la map — on enchaîne tout de suite.
           */
          const placed = useOrderStore.getState().activeOrders.find((o) => o.id === order.id);
          if (placed) {
            void syncOrderLiveActivity(placed);
          }
        }
        // If backend reported persistence failure, inform the user
        if (data && data.dbSaved === false) {
          UserFriendlyError.showSaveError('la commande', () => {
            // Keep UI simple: clear pending so user can recreate or retry flow
            useOrderStore.getState().clear();
          });
        }
      } catch (err) {
        logger.warn('Unable to store pending order', 'userOrderSocketService', err);
      }
    });

    // Aucun chauffeur disponible
    this.socket.on('no-drivers-available', (data) => {
      logger.info('Aucun chauffeur disponible', 'userOrderSocketService', data);

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
        UserFriendlyError.showInfo(
          'Aucun chauffeur disponible',
          'Aucun chauffeur n\'est disponible dans votre zone pour le moment. Vous pouvez réessayer plus tard.'
        );

        logger.info('État réinitialisé après aucun chauffeur disponible', 'userOrderSocketService');
      } catch (err) {
        logger.warn('Erreur lors de la réinitialisation après aucun chauffeur', 'userOrderSocketService', err);
      }
    });

    // Commande acceptée par un driver
    // Ce listener doit être réinstallé à chaque reconnexion
    this.socket.on('order-accepted', (data) => {
      logger.info('Commande acceptée par driver - ÉVÉNEMENT REÇU', 'userOrderSocketService', {
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
          logger.info('Commande mise à jour dans le store avec statut accepted', 'userOrderSocketService', {
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
            logger.warn('[userOrderSocketService] Erreur lecture son:', err);
          });

          // Sélectionner automatiquement la commande acceptée pour qu'elle soit affichée
          // Cela garantit que même avec plusieurs commandes actives, la commande acceptée est visible
          if (updatedOrder && updatedOrder.status === 'accepted' && updatedOrder.driver) {
            const currentSelectedId = updatedStore.selectedOrderId;
            // Sélectionner cette commande si aucune n'est sélectionnée, ou si la commande sélectionnée n'est pas acceptée
            if (!currentSelectedId) {
              logger.info('Sélection automatique de la commande acceptée (aucune sélection)', 'userOrderSocketService', {
                orderId: order.id,
              });
              updatedStore.setSelectedOrder(order.id);
            } else {
              const selectedOrder = updatedStore.activeOrders.find(o => o.id === currentSelectedId);
              // Si la commande sélectionnée n'est pas acceptée, sélectionner la nouvelle commande acceptée
              if (!selectedOrder || selectedOrder.status !== 'accepted' || !selectedOrder.driver) {
                logger.info('Sélection automatique de la commande acceptée (remplacement)', 'userOrderSocketService', {
                  orderId: order.id,
                  previousSelectedId: currentSelectedId,
                  previousStatus: selectedOrder?.status,
                });
                updatedStore.setSelectedOrder(order.id);
              }
            }
          }
        } else {
          logger.warn('order-accepted reçu mais order.id manquant', 'userOrderSocketService', { data });
        }

        // Si backend fournit position dans driverInfo, l'utiliser
        if (driverInfo && driverInfo.current_latitude && driverInfo.current_longitude && order?.id) {
          useOrderStore.getState().setDriverCoordsForOrder(order.id, {
            latitude: driverInfo.current_latitude,
            longitude: driverInfo.current_longitude,
          });
        }

        // Le backend enrichit désormais driverInfo avec le profil users/driver_profiles.
        // On utilise les données du socket directement (plus d'appel getUserProfile = plus d'erreur 403).
        if (driverInfo && order?.id) {
          const store = useOrderStore.getState();
          const existingOrder = store.activeOrders.find(o => o.id === order.id);
          if (existingOrder) {
            const name = driverInfo.first_name
              ? `${driverInfo.first_name} ${driverInfo.last_name || ''}`.trim()
              : undefined;
            store.updateOrder(order.id, {
              driver: {
                id: driverInfo.id,
                name: name || 'Livreur',
                first_name: driverInfo.first_name || undefined,
                last_name: driverInfo.last_name || undefined,
                phone: driverInfo.phone || undefined,
                avatar: driverInfo.profile_image_url || undefined,
                avatar_url: driverInfo.profile_image_url || undefined,
                profile_image_url: driverInfo.profile_image_url || undefined,
                rating: driverInfo.rating || undefined,
                ...(driverInfo.current_latitude && driverInfo.current_longitude
                  ? {
                      current_latitude: driverInfo.current_latitude,
                      current_longitude: driverInfo.current_longitude,
                    }
                  : {}),
              },
            } as any);
          }
        }
        // If DB persistence failed for the assignment, notify user
        if (data && data.dbSaved === false) {
          UserFriendlyError.showSaveError('l\'affectation du livreur');
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

        // Ne pas retirer les commandes completed : le client en a besoin pour notation / QR jusqu’au nettoyage local.
        const cancelledOrDeclined = store.activeOrders.filter(
          (o) => o.status === 'cancelled' || o.status === 'declined'
        );
        cancelledOrDeclined.forEach((order) => store.removeOrder(order.id));

        // Ajouter toutes les commandes actives (filtrer les complétées/annulées)
        if (Array.isArray(activeOrders)) {
          const validActiveOrders = activeOrders.filter((order: any) => 
            order && order.id && order.status !== 'completed' && order.status !== 'cancelled' && order.status !== 'declined'
          );
          validActiveOrders.forEach((order: any) => {
            store.addOrder(order);
          });
        } else if (currentOrder && currentOrder.id && currentOrder.status !== 'completed' && currentOrder.status !== 'cancelled' && currentOrder.status !== 'declined') {
          // Compatibilité avec l'ancien format
          store.addOrder(currentOrder as any);
        }

        // Ajouter toutes les commandes en attente (filtrer les complétées/annulées)
        if (Array.isArray(pendingOrders)) {
          const validPendingOrders = pendingOrders.filter((order: any) => 
            order && order.id && order.status !== 'completed' && order.status !== 'cancelled' && order.status !== 'declined'
          );
          validPendingOrders.forEach((order: any) => {
            store.addOrder(order);
          });
        } else if (pendingOrder && pendingOrder.id && pendingOrder.status !== 'completed' && pendingOrder.status !== 'cancelled' && pendingOrder.status !== 'declined') {
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
    this.socket.on('order-cancelled', this.handleUserOrderCancelled);
    this.socket.on('order:cancelled', this.handleUserOrderCancelled);

    this.socket.on('order-error', (data) => {
      logger.warn('Erreur commande', 'userOrderSocketService', data);
      if (data?.message) {
        // Gérer spécifiquement les erreurs de paiement différé
        const errorCode = data.code || data.errorCode;
        if (errorCode && (
          errorCode === 'DEFERRED_PAYMENT_LIMIT_EXCEEDED' || 
          errorCode === 'MONTHLY_CREDIT_INSUFFICIENT' ||
          errorCode === 'MONTHLY_USAGE_LIMIT_EXCEEDED' ||
          errorCode === 'ANNUAL_LIMIT_EXCEEDED' ||
          errorCode === 'COOLDOWN_PERIOD_ACTIVE' ||
          errorCode === 'DEFERRED_PAYMENT_BLOCKED' ||
          errorCode === 'MIN_AMOUNT_NOT_REACHED'
        )) {
          UserFriendlyError.showDeferredPaymentError(
            data.message,
            {
              errorCode,
              ...data.details,
            }
          );
        } else {
          // Pour les autres erreurs, utiliser la gestion générique
          UserFriendlyError.handleUnknownError(
            new Error(data.message),
            'order-error',
            () => {
              // Retry logic si nécessaire
            }
          );
        }
      }
    });

    this.socket.on('order:status:update', (data) => {
      logger.info('🔄 [order:status:update] Événement reçu', 'userOrderSocketService', {
        orderId: data?.order?.id,
        status: data?.order?.status,
        hasOrder: !!data?.order,
        dbSaved: data?.dbSaved,
        dbError: data?.dbError,
        socketConnected: this.socket?.connected,
      });
      try {
        const { order } = data || {};
        if (order && order.id) {
          const store = useOrderStore.getState();
          const existingOrder = store.activeOrders.find(o => o.id === order.id);
          
          logger.info('📦 [order:status:update] État AVANT updateFromSocket', 'userOrderSocketService', {
            orderId: order.id,
            newStatus: order.status,
            existingStatus: existingOrder?.status,
            existsInStore: !!existingOrder,
            activeOrdersCount: store.activeOrders.length,
          });
          
          // CRITIQUE : Toujours utiliser updateFromSocket pour garantir la synchronisation
          store.updateFromSocket({ order: order as any });
          
          // Vérifier que la mise à jour a bien eu lieu
          const updatedStore = useOrderStore.getState();
          const updatedOrder = updatedStore.activeOrders.find(o => o.id === order.id);
          
          logger.info('✅ [order:status:update] État APRÈS updateFromSocket', 'userOrderSocketService', {
            orderId: order.id,
            expectedStatus: order.status,
            actualStatus: updatedOrder?.status,
            stillInStore: !!updatedOrder,
            shouldBeRemoved: order.status === 'completed' || order.status === 'cancelled' || order.status === 'declined',
            activeOrdersCount: updatedStore.activeOrders.length,
          });
        } else {
          logger.warn('⚠️ [order:status:update] order.id manquant', 'userOrderSocketService', { data });
        }
      } catch (err) {
        logger.error('❌ [order:status:update] Erreur', 'userOrderSocketService', err);
      }
    });

    this.socket.on('driver:location:update', (data) => {
      try {
        const { orderId, latitude, longitude } = data || {};
        if (
          orderId &&
          typeof latitude === 'number' &&
          typeof longitude === 'number' &&
          Number.isFinite(latitude) &&
          Number.isFinite(longitude)
        ) {
          const store = useOrderStore.getState();
          store.setDriverCoordsForOrder(orderId, { latitude, longitude });
        }
      } catch (err) {
        logger.warn('Error handling driver:location:update', 'userOrderSocketService', err);
      }
    });

    // Événement de géofencing (livreur entré dans la zone)
    this.socket.on('driver:geofence:event', (data) => {
      try {
        const { orderId, eventType } = data || {};
        if (orderId) {
          if (eventType === 'entered') {
            logger.info(
              'Votre livreur est arrivé dans la zone de livraison',
              'userOrderSocketService',
              { orderId }
            );
            // Vous pouvez ajouter une notification visuelle ici
            // Par exemple : Alert.alert('Livreur arrivé', 'Votre livreur est arrivé dans la zone de livraison');
          } else if (eventType === 'validated') {
            logger.info(
              'Livraison validée automatiquement',
              'userOrderSocketService',
              { orderId }
            );
          }
        }
      } catch (err) {
        logger.warn('Error handling driver:geofence:event', 'userOrderSocketService', err);
      }
    });
  }

  private setupSocketListeners(userId: string, skipConnectDisconnect = false) {
    if (!this.socket) return;

    // Retirer les anciens listeners avant d'en ajouter de nouveaux
    // Cela évite les listeners dupliqués lors des reconnexions
    // Ne pas retirer 'connect' et 'disconnect' si on est déjà dans le listener connect
    if (!skipConnectDisconnect) {
      this.socket.removeAllListeners('connect');
      this.socket.removeAllListeners('disconnect');
    }
    this.socket.removeAllListeners('order-accepted');
    this.socket.removeAllListeners('order-created');
    this.socket.removeAllListeners('order-cancelled');
    this.socket.removeAllListeners('order:cancelled');
    this.socket.removeAllListeners('order-error');
    this.socket.removeAllListeners('no-drivers-available');
    this.socket.removeAllListeners('order:status:update');
    this.socket.removeAllListeners('driver:location:update');
    this.socket.removeAllListeners('resync-order-state');

    this.socket.on('connect', () => {
      useRealtimeDegradedStore.getState().setSocketDegraded(false);
      logger.info('🔌 Socket user connecté pour commandes', 'userOrderSocketService');
      this.isConnected = true;
      this.retryCount = 0; // Réinitialiser le compteur de retry en cas de succès
      this.reconnectRecoveryCount = 0;
      // Si on a réussi à se reconnecter en polling-only, on reste stable dans ce mode.
      addSocketSuccessBreadcrumb('client_orders_connected', {
        socketUrl: config.socketUrl,
        transport: this.socket?.io?.engine?.transport?.name ?? 'unknown',
      });

      // CRITIQUE : Installer les listeners AVANT d'émettre user-connect
      // Cela garantit que si le serveur envoie un événement immédiatement après user-connect,
      // le listener est déjà en place pour le recevoir
      logger.info('🔄 Réinstallation des listeners après reconnexion (AVANT user-connect)', 'userOrderSocketService');
      // Installer tous les listeners sauf connect/disconnect (pour éviter la récursion)
      if (this.socket) {
        this.socket.removeAllListeners('order-accepted');
        this.socket.removeAllListeners('order-created');
        this.socket.removeAllListeners('order-cancelled');
        this.socket.removeAllListeners('order:cancelled');
        this.socket.removeAllListeners('order-error');
        this.socket.removeAllListeners('no-drivers-available');
        this.socket.removeAllListeners('order:status:update');
        this.socket.removeAllListeners('driver:location:update');
        this.socket.removeAllListeners('resync-order-state');
      }

      // Réinstaller les listeners (sauf connect/disconnect pour éviter la récursion)
      this.installEventListeners(userId);

      // S'identifier comme user - toujours ré-émettre même si déjà connecté
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
    useRealtimeDegradedStore.getState().setSocketDegraded(false);
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      this.userId = null;
    }
    this.listenersSetup = false;
    this.lastSocketAuthToken = null;
  }

  /**
   * Après `ensureAccessToken()` (ex. retour premier plan) : si le JWT a changé ou le lien est mort,
   * reconnecter pour que le handshake envoie le bon token.
   */
  syncAfterAccessTokenRefresh(userId: string | undefined) {
    if (!userId) return;
    const token = useAuthStore.getState().accessToken;
    if (!token) return;
    const socketOk =
      this.socket?.connected &&
      token === this.lastSocketAuthToken &&
      this.userId === userId;
    if (socketOk) return;

    logger.info('🔄 Reconnexion socket commandes (JWT ou état lien)', 'userOrderSocketService');
    if (this.socket) {
      try {
        this.socket.removeAllListeners();
        this.socket.disconnect();
      } catch (err) {
        logger.warn('Teardown socket avant resync', 'userOrderSocketService', err);
      }
      this.socket = null;
    }
    this.listenersSetup = false;
    this.isConnected = false;
    this.connect(userId);
  }

  /**
   * Redemande l’état des commandes au serveur (HTTP vient d’aligner le store, ou retour réseau).
   */
  requestServerOrdersResync(userId: string) {
    if (!userId || !this.socket?.connected) return;
    try {
      this.socket.emit("user-connect", userId);
      setTimeout(() => {
        try {
          this.socket?.emit("user-reconnect", { userId });
          logger.debug("user-reconnect (resync demandé)", "userOrderSocketService", { userId });
        } catch (err) {
          logger.warn("user-reconnect emit failed", "userOrderSocketService", err);
        }
      }, 100);
    } catch (err) {
      logger.warn("requestServerOrdersResync failed", "userOrderSocketService", err);
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
    speedOptionId?: string;
    routeDistanceKm?: number;
    routeDurationSeconds?: number;
    routeDurationTypicalSeconds?: number;
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
    paymentMethodType?: PaymentMethodType;
    paymentPhone?: string;
    estimatedPrice?: number;
  }): Promise<boolean> {
    return new Promise<boolean>(async (resolve) => {
      // Protection contre les appels multiples simultanés
      if (this.isCreatingOrder) {
        logger.warn('Tentative de création de commande alors qu\'une création est déjà en cours', 'userOrderSocketService');
        resolve(false);
        return;
      }

      // Vérifier que l'utilisateur est connecté avant de créer la commande
      if (!this.userId) {
        logger.warn('Tentative de création de commande sans userId', 'userOrderSocketService');
        UserFriendlyError.showLoginRequired();
        resolve(false);
        return;
      }

      // Vérifier et rafraîchir le token d'authentification avant de créer la commande
      // Cela évite les erreurs de session expirée après une longue période d'inactivité
      try {
        const token = await userApiService.ensureAccessToken();
        if (!token) {
          logger.warn('Token d\'authentification invalide ou expiré', 'userOrderSocketService');
          const { user } = useAuthStore.getState();
          if (!user) {
            UserFriendlyError.showSessionExpired();
            resolve(false);
            return;
          }
          // Si l'utilisateur existe mais le token ne peut pas être rafraîchi, 
          // essayer de continuer quand même (le backend pourra rejeter si nécessaire)
          logger.warn('Impossible de rafraîchir le token, continuation avec les données existantes', 'userOrderSocketService');
        }
      } catch (error) {
        logger.error('Erreur lors de la vérification du token', 'userOrderSocketService', error);
        // Continuer quand même, le backend pourra rejeter si nécessaire
      }

      // S'assurer que le socket est connecté avant de créer la commande
      const connected = await this.ensureConnected();
      if (!connected) {
        UserFriendlyError.showNetworkError(() => {
          // Retry logic si nécessaire
        });
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
        logger.error('Socket toujours non connecté après ensureConnected', 'userOrderSocketService');
        UserFriendlyError.showLoginRequired();
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
          speedOptionId: orderData.speedOptionId,
          routeDistanceKm: orderData.routeDistanceKm,
          routeDurationSeconds: orderData.routeDurationSeconds,
          routeDurationTypicalSeconds: orderData.routeDurationTypicalSeconds,
        });
      } catch (error: any) {
        // Log full error for debugging (httpStatus / requestId si createOrderInDatabase les a posés)
        logger.error('Échec enregistrement commande Supabase', 'userOrderSocketService', {
          message: error?.message ?? String(error),
          code: error?.code ?? undefined,
          httpStatus: error?.httpStatus,
          requestId: error?.requestId,
          raw: error,
        });

        let apiHost = '';
        try {
          apiHost = new URL(config.apiUrl).host;
        } catch {
          apiHost = 'invalid-api-url';
        }
        const toReport =
          error instanceof Error
            ? error
            : new Error(
                typeof error?.message === 'string' ? error.message : 'createOrderRecord failed'
              );
        captureError(toReport, {
          source: 'createOrderRecord',
          userId: this.userId ?? undefined,
          code: error?.code,
          httpStatus: error?.httpStatus,
          requestId: error?.requestId,
          apiHost,
        });

        // Supabase / Postgres function may return a custom error code when the
        // user/profile is not present (seen as PO001 in dev logs). Detect this
        // case and show a clearer message / action to the user.
        const errorMessage = error?.message ?? String(error);
        const errorCode = error?.code ?? null;

        if (errorCode === 'PO001' || errorCode === 'MISSING_PROFILE' || /does not exist|profiles?/i.test(errorMessage)) {
          UserFriendlyError.showIncompleteAccount(() => {
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
          });
        } else {
          UserFriendlyError.showSaveError('la commande', () => {
            // Retry logic si nécessaire
          });
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
          logger.warn('createOrder ack timeout');
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
                UserFriendlyError.showSaveError('la commande', () => {
                  useOrderStore.getState().clear();
                });
                finishOrderCreation(false);
                return;
              }

              // server persisted the order
              finishOrderCreation(true);
            } else {
              logger.warn('createOrder rejected by server', ackResponse);
              finishOrderCreation(false);
            }
          } catch (err) {
            logger.warn('Error parsing createOrder ack', 'userOrderSocketService', err);
            finishOrderCreation(false);
          }
        });
      } catch (err) {
        clearTimeout(timeout);
        logger.error('Error emitting create-order', 'userOrderSocketService', err);
        finishOrderCreation(false);
      }
    });
  }

  // Vérifier la connexion et se reconnecter si nécessaire
  isSocketConnected() {
    const isConnected = this.isConnected && this.socket?.connected;

    // Si le socket existe mais n'est pas connecté, essayer de se reconnecter
    if (this.socket && !isConnected && this.userId) {
      logger.warn('Socket existe mais non connecté, tentative de reconnexion...', 'userOrderSocketService');
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
      logger.debug('ensureConnected appelé sans userId (utilisateur non connecté)', 'userOrderSocketService');
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
        logger.info('Socket connecté avec succès', 'userOrderSocketService');
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, checkInterval));
      elapsed += checkInterval;
    }

    logger.error('Impossible de connecter le socket après 3 secondes', 'userOrderSocketService');
    return false;
  }
}

// Instance singleton
export const userOrderSocketService = new UserOrderSocketService();