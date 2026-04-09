import { io, Socket } from 'socket.io-client';
import { logger } from '../utils/logger';
import { Message, Conversation } from './driverMessageService';
import { config } from '../config/index';
import { useDriverStore } from '../store/useDriverStore';
import { useRealtimeDegradedStore } from '../store/useRealtimeDegradedStore';
import { apiService } from './apiService';
import { reportSocketIssue } from '../utils/sentry';

const SOCKET_URL = config.socketUrl || 'http://localhost:4000';

class DriverMessageSocketService {
  private socket: Socket | null = null;
  private driverId: string | null = null;
  private isConnected = false;
  private lastSocketAuthToken: string | null = null;
  private connectGeneration = 0;
  private messageCallbacks: ((message: Message, conversation: Conversation) => void)[] = [];
  private typingCallbacks: ((data: { userId: string; isTyping: boolean }) => void)[] = [];

  connect(driverId: string) {
    if (this.socket && this.isConnected && this.socket.connected && this.driverId === driverId) {
      return;
    }
    this.connectGeneration += 1;
    const gen = this.connectGeneration;
    void this.establishSocket(driverId, gen);
  }

  private async establishSocket(driverId: string, gen: number) {
    const tokenResult = await apiService.ensureAccessToken();
    if (gen !== this.connectGeneration) {
      return;
    }
    const token = tokenResult.token;
    if (!token) {
      logger.warn(
        'Socket messagerie: pas de jeton après ensureAccessToken',
        'driverMessageSocketService'
      );
      return;
    }

    if (this.socket) {
      try {
        logger.info("Nettoyage de l'ancien socket", 'driverMessageSocketService');
        this.socket.removeAllListeners();
        this.socket.disconnect();
      } catch {
        /* ignore */
      }
      this.socket = null;
    }

    if (gen !== this.connectGeneration) {
      return;
    }

    this.driverId = driverId;
    this.lastSocketAuthToken = token;
    this.isConnected = false;

    this.socket = io(SOCKET_URL, {
      transports: __DEV__ ? ['websocket', 'polling'] : ['polling'],
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

    this.socket.io.on('reconnect_failed', () => {
      logger.warn('Socket messagerie: reconnexions épuisées', 'driverMessageSocketService');
      useRealtimeDegradedStore.getState().setMessagesSocketDegraded(true);
      reportSocketIssue('driver_messages_reconnect_failed', {
        socketUrl: SOCKET_URL,
      });
    });

    this.socket.on('connect', () => {
      useRealtimeDegradedStore.getState().setMessagesSocketDegraded(false);
      logger.info('🔌 Socket connecté pour messagerie', 'driverMessageSocketService');
      this.isConnected = true;
      this.socket?.emit('driver-connect', driverId);
    });

    this.socket.on('disconnect', (reason) => {
      logger.info('🔌 Socket déconnecté pour messagerie', 'driverMessageSocketService', { reason });
      this.isConnected = false;
    });

    this.socket.on('connect_error', (error) => {
      this.isConnected = false;
      const isTemporaryPollError =
        error.message?.includes('xhr poll error') ||
        error.message?.includes('poll error') ||
        error.message?.includes('transport unknown') ||
        error.message?.includes('websocket error') ||
        (error as any).type === 'TransportError';

      if (!isTemporaryPollError) {
        if (__DEV__) {
          logger.debug(
            'Erreur connexion socket messagerie (tentative de reconnexion en cours)',
            'driverMessageSocketService',
            {
              message: error.message,
              type: (error as any).type,
            }
          );
        }
        reportSocketIssue('driver_messages_connect_error', {
          socketUrl: SOCKET_URL,
          message: error.message,
          type: String((error as { type?: string }).type ?? ''),
        });
      }
    });

    // Écouter les nouveaux messages
    this.socket.on('new-message', (data: { message: Message; conversation: Conversation }) => {
      logger.info('📨 Nouveau message reçu', 'driverMessageSocketService', data);
      this.messageCallbacks.forEach((callback) => {
        callback(data.message, data.conversation);
      });
    });

    // Écouter les indicateurs de frappe
    this.socket.on('typing', (data: { userId: string; isTyping: boolean }) => {
      this.typingCallbacks.forEach((callback) => {
        callback(data);
      });
    });

    // Confirmation d'envoi
    this.socket.on('message-sent', (data: { success: boolean; messageId?: string }) => {
      if (!data.success) {
        logger.warn('Échec envoi message', 'driverMessageSocketService', data);
      }
    });
  }

  disconnect() {
    this.connectGeneration += 1;
    useRealtimeDegradedStore.getState().setMessagesSocketDegraded(false);
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
    this.lastSocketAuthToken = null;
  }

  /** Ré-émet la présence driver (ex. après retour réseau) pour que le serveur renvoie les rooms actives. */
  reassertDriverPresence(driverId: string) {
    if (!driverId || !this.socket?.connected) return;
    try {
      this.socket.emit("driver-connect", driverId);
    } catch (err) {
      logger.warn("reassertDriverPresence failed", "driverMessageSocketService", err);
    }
  }

  /** Après refresh JWT : reconnecter si le token handshake a changé ou le lien est mort. */
  syncAfterAccessTokenRefresh(driverId: string | undefined) {
    if (!driverId) return;
    const token = useDriverStore.getState().accessToken;
    if (!token) return;
    const socketOk =
      this.socket?.connected &&
      token === this.lastSocketAuthToken &&
      this.driverId === driverId;
    if (socketOk) return;

    logger.info('Reconnexion socket messagerie (JWT ou lien)', 'driverMessageSocketService');
    if (this.socket) {
      try {
        this.socket.removeAllListeners();
        this.socket.disconnect();
      } catch (err) {
        logger.warn('Teardown socket messagerie', 'driverMessageSocketService', err);
      }
      this.socket = null;
    }
    this.isConnected = false;
    this.connect(driverId);
  }

  /**
   * Rejoindre une conversation (pour recevoir les messages en temps réel)
   */
  joinConversation(conversationId: string) {
    if (!this.socket || !this.isConnected) {
      logger.warn('Socket non connecté', 'driverMessageSocketService');
      return;
    }

    this.socket.emit('join-conversation', { conversationId });
    logger.info(`Rejoint la conversation ${conversationId}`, 'driverMessageSocketService');
  }

  /**
   * Quitter une conversation
   */
  leaveConversation(conversationId: string) {
    if (!this.socket || !this.isConnected) {
      return;
    }

    this.socket.emit('leave-conversation', { conversationId });
  }

  /**
   * Envoyer un message
   */
  sendMessage(conversationId: string, content: string, messageType: 'text' | 'image' = 'text') {
    if (!this.socket || !this.isConnected) {
      throw new Error('Socket non connecté');
    }

    this.socket.emit('send-message', {
      conversationId,
      content,
      messageType,
    });
  }

  /**
   * Marquer les messages comme lus
   */
  markAsRead(conversationId: string) {
    if (!this.socket || !this.isConnected) {
      return;
    }

    this.socket.emit('mark-messages-read', { conversationId });
  }

  /**
   * Envoyer un indicateur de frappe
   */
  sendTyping(conversationId: string, isTyping: boolean) {
    if (!this.socket || !this.isConnected) {
      return;
    }

    this.socket.emit('typing', { conversationId, isTyping });
  }

  /**
   * S'abonner aux nouveaux messages
   */
  onNewMessage(callback: (message: Message, conversation: Conversation) => void) {
    this.messageCallbacks.push(callback);
    return () => {
      this.messageCallbacks = this.messageCallbacks.filter((cb) => cb !== callback);
    };
  }

  /**
   * S'abonner aux indicateurs de frappe
   */
  onTyping(callback: (data: { userId: string; isTyping: boolean }) => void) {
    this.typingCallbacks.push(callback);
    return () => {
      this.typingCallbacks = this.typingCallbacks.filter((cb) => cb !== callback);
    };
  }
}

export const driverMessageSocketService = new DriverMessageSocketService();

