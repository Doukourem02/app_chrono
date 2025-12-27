import { Alert } from 'react-native';
import { io, Socket } from 'socket.io-client';
import { config } from '../config/index';
import { OrderRequest, useOrderStore } from '../store/useOrderStore';
import { useDriverStore } from '../store/useDriverStore';
import { logger } from '../utils/logger';
import { soundService } from './soundService';
import { apiService } from './apiService';

class OrderSocketService {
  private socket: Socket | null = null;
  private driverId: string | null = null;
  private isConnected = false;
  private retryCount = 0;

  connect(driverId: string) {
    // Si le socket est déjà connecté avec le même driverId, ne rien faire
    if (this.socket && this.isConnected && this.socket.connected && this.driverId === driverId) {
      return;
    }

    // Nettoyer l'ancien socket s'il existe
    if (this.socket) {
      logger.info('Nettoyage de l\'ancien socket', undefined);
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }

    this.driverId = driverId;
    this.socket = io(config.socketUrl, {
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

    this.socket.on('disconnect', (reason) => {
      logger.info('Socket déconnecté', undefined, { reason });
      this.isConnected = false;

      // Laisser Socket.IO gérer la reconnexion automatique
      // Ne pas forcer une reconnexion manuelle pour éviter les doubles connexions
      if (reason === 'io server disconnect') {
        logger.info('Le serveur a forcé la déconnexion, reconnexion automatique...', undefined);
      }
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
          
          // Si la commande complète est fournie, l'ajouter directement au store
          if (order && typeof order === 'object' && order.id) {
            // Vérifier si elle est déjà dans pendingOrders
            const pendingOrder = store.pendingOrders.find(o => o.id === order.id);
            if (pendingOrder) {
              // Utiliser acceptOrder qui gère la transition de pending vers active
              store.acceptOrder(order.id, this.driverId || '');
            } else {
              // Si elle n'est pas dans pendingOrders, l'ajouter directement comme active
              // Cela peut arriver si le serveur assigne directement une commande au driver
              store.addOrder(order as OrderRequest);
              // Sélectionner automatiquement cette nouvelle commande
              store.setSelectedOrder(order.id);
              logger.info('Commande acceptée ajoutée directement (pas dans pending)', undefined, { orderId: order.id });
            }
          } else {
            // Fallback : utiliser seulement l'ID
          store.acceptOrder(order.id, this.driverId || '');
          }
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

    // Mise à jour du statut de commande (canonique event)
    this.socket.on('order:status:update', (data) => {
      try {
        logger.info('🔄 order:status:update reçu (driver)', undefined, data);
        const { order } = data || {};
        
        if (!order || !order.id) {
          logger.warn('order:status:update reçu sans order.id', undefined, data);
          return;
        }

        const store = useOrderStore.getState();
        const existingOrder = store.activeOrders.find(o => o.id === order.id);
        
        // Si la commande n'existe pas encore dans activeOrders mais a un statut actif, l'ajouter
        if (!existingOrder && (
          order.status === 'accepted' || 
          order.status === 'in_progress' || 
          order.status === 'enroute' || 
          order.status === 'picked_up' || 
          order.status === 'delivering'
        )) {
          logger.info('📦 Commande active reçue via order:status:update, ajout au store', undefined, { orderId: order.id, status: order.status });
          store.addOrder(order as OrderRequest);
          // Sélectionner automatiquement cette nouvelle commande active
          store.setSelectedOrder(order.id);
        } else if (existingOrder) {
          // Mettre à jour la commande existante
          store.updateOrder(order.id, order as Partial<OrderRequest>);
          // Si c'est une commande active et qu'aucune n'est sélectionnée, la sélectionner
          if (!store.selectedOrderId && (
            order.status === 'accepted' || 
            order.status === 'in_progress' || 
            order.status === 'enroute' || 
            order.status === 'picked_up' || 
            order.status === 'delivering'
          )) {
            store.setSelectedOrder(order.id);
          }
        }
      } catch (err) {
        logger.warn('Error handling order:status:update', undefined, err);
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
      this.isConnected = false;

      // Ignorer les erreurs de polling temporaires (Socket.IO essaie plusieurs transports)
      const isTemporaryPollError = error.message?.includes('xhr poll error') ||
        error.message?.includes('poll error') ||
        error.message?.includes('transport unknown') ||
        error.message?.includes('websocket error') ||
        (error as any).type === 'TransportError';

      // Ne logger que les erreurs importantes après plusieurs tentatives
      // Ignorer les erreurs si le backend est simplement inaccessible (normal en développement)
      if (!isTemporaryPollError && this.retryCount >= 3) {
        logger.warn('Erreur connexion socket persistante:', undefined, {
          message: error.message,
          type: (error as any).type,
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
      this.driverId = null;
    }
  }

  // Accepter une commande
  async acceptOrder(orderId: string) {
    if (!this.socket || !this.driverId) {
      logger.error('Socket non connecté');
      return;
    }

    // Vérifier et rafraîchir le token d'authentification avant d'accepter la commande
    // Cela évite les erreurs de session expirée après une longue période d'inactivité
    try {
      const tokenResult = await apiService.ensureAccessToken();
      if (!tokenResult.token) {
        logger.warn('Token d\'authentification invalide ou expiré lors de l\'acceptation', undefined, { orderId });
        const { user } = useDriverStore.getState();
        if (!user) {
          Alert.alert(
            'Session expirée',
            'Votre session a expiré. Veuillez vous reconnecter.',
            [{ text: 'OK' }]
          );
          return;
        }
        // Si l'utilisateur existe mais le token ne peut pas être rafraîchi, 
        // essayer de continuer quand même (le backend pourra rejeter si nécessaire)
        logger.warn('Impossible de rafraîchir le token, continuation avec les données existantes', undefined);
      }
    } catch (error) {
      logger.error('Erreur lors de la vérification du token', undefined, error);
      // Continuer quand même, le backend pourra rejeter si nécessaire
    }

    logger.info('Acceptation commande', undefined, { orderId });
    this.socket.emit('accept-order', {
      orderId,
      driverId: this.driverId
    });

    // Attendre la confirmation du serveur ('order-accepted-confirmation') pour mettre à jour le store local
  }

  // Décliner une commande
  async declineOrder(orderId: string) {
    if (!this.socket || !this.driverId) {
      logger.error('Socket non connecté');
      return;
    }

    // Vérifier et rafraîchir le token d'authentification avant de refuser la commande
    try {
      const tokenResult = await apiService.ensureAccessToken();
      if (!tokenResult.token) {
        logger.warn('Token d\'authentification invalide ou expiré lors du refus', undefined, { orderId });
        // Pour le refus, on peut continuer même sans token valide (moins critique)
      }
    } catch (error) {
      logger.error('Erreur lors de la vérification du token', undefined, error);
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

    // Log pour debug
    logger.info(`🔄 Mise à jour statut: ${orderId.slice(0, 8)}... → ${status}`, 'orderSocketService', { orderId, status, hasLocation: !!location });

    // Émettre l'événement socket immédiatement
    this.socket.emit('update-delivery-status', {
      orderId,
      status,
      location
    });

    // Mettre à jour le store local immédiatement pour une meilleure réactivité
    useOrderStore.getState().updateOrderStatus(orderId, status as any);

    // Si le driver marque la commande comme complétée, la déplacer vers l'historique / vider currentOrder
    // pour que la carte et l'UI reviennent à un état normal (sans marqueurs/lignes restants) immédiatement
    if (String(status) === 'completed') {
      try {
        useOrderStore.getState().completeOrder(orderId);
        
        // Jouer le son de commande complétée
        soundService.initialize().then(() => {
          soundService.playOrderCompleted();
        }).catch((err) => {
          console.warn('[orderSocketService] Erreur lecture son:', err);
        });
      } catch (err) {
        logger.warn('Failed to complete order locally', undefined, err);
      }
    }
  }

  // Émettre un événement de géofencing (livreur entré dans la zone)
  emitGeofenceEvent(orderId: string, eventType: 'entered' | 'validated', location?: any) {
    if (!this.socket) {
      logger.error('Socket non connecté pour géofencing');
      return;
    }

    this.socket.emit('driver-geofence-event', {
      orderId,
      eventType,
      location,
      timestamp: new Date().toISOString(),
    });

    logger.info(
      `Géofencing: ${eventType} pour commande ${orderId.slice(0, 8)}...`,
      'orderSocketService'
    );
  }

  // Vérifier la connexion
  isSocketConnected() {
    return this.isConnected && this.socket?.connected;
  }
}

// Instance singleton
export const orderSocketService = new OrderSocketService();