import { io, Socket } from 'socket.io-client';
import { logger } from '../utils/logger';
import { reportSocketIssue } from '../utils/sentry';
import { Conversation, Message } from './userMessageService';
import { config } from '../config';
import { useAuthStore } from '../store/useAuthStore';

class UserMessageSocketService {
  private socket: Socket | null = null;
  private userId: string | null = null;
  private isConnected = false;
  private messageCallbacks: ((message: Message, conversation: Conversation) => void)[] = [];
  private typingCallbacks: ((data: { userId: string; isTyping: boolean }) => void)[] = [];

  connect(userId: string) {
    // Si le socket est déjà connecté avec le même userId, ne rien faire
    if (this.socket && this.isConnected && this.socket.connected && this.userId === userId) {
      return;
    }

    // Même user, handshake ou reconnexion en cours : ne pas recréer (évite sid invalide → 400 / xhr poll error)
    if (this.socket && this.userId === userId && this.socket.active) {
      logger.debug('🔌 Socket messagerie déjà actif pour ce userId (handshake ou reconnect), ignoré', 'userMessageSocketService');
      return;
    }

    // Nettoyer l'ancien socket s'il existe
    if (this.socket) {
      logger.info('🔄 Nettoyage de l\'ancien socket', 'userMessageSocketService');
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }

    this.userId = userId;
    // Utiliser la configuration centralisée qui fonctionne avec Expo Go
    const socketUrl = config.socketUrl;
    const token = useAuthStore.getState().accessToken;
    if (!token) {
      logger.warn('Impossible de connecter le socket de messagerie: accessToken manquant', 'userMessageSocketService');
      return;
    }
    logger.info('🔌 Connexion au socket de messagerie...', 'userMessageSocketService', { socketUrl });
    this.socket = io(socketUrl, {
      transports: __DEV__ ? ['websocket', 'polling'] : ['polling'],
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
      reconnectionAttempts: 5,
      timeout: 20000,
      forceNew: false,
      upgrade: __DEV__,
      autoConnect: true,
      auth: {
        token,
      },
    });

    this.socket.io.on('reconnect_failed', () => {
      logger.warn('Socket messagerie: reconnexions épuisées', 'userMessageSocketService');
      reportSocketIssue('client_messages_reconnect_failed', { socketUrl });
    });

    this.socket.on('connect', () => {
      logger.info('🔌 Socket connecté pour messagerie', 'userMessageSocketService');
      this.isConnected = true;
      // S'identifier comme user
      this.socket?.emit('user-connect', userId);
    });

    this.socket.on('disconnect', (reason) => {
      logger.info('🔌 Socket déconnecté pour messagerie', 'userMessageSocketService', { reason });
      this.isConnected = false;
    });

    this.socket.on('connect_error', (error) => {
      this.isConnected = false;
      // Ignorer les erreurs de polling temporaires
      const isTemporaryPollError = error.message?.includes('xhr poll error') ||
        error.message?.includes('poll error') ||
        error.message?.includes('transport unknown');

      if (!isTemporaryPollError) {
        logger.error('Erreur connexion socket messagerie:', 'userMessageSocketService', {
          message: error.message,
          type: (error as any).type,
        });
        reportSocketIssue('client_messages_connect_error', {
          socketUrl,
          message: error.message,
          type: String((error as { type?: string }).type ?? ''),
        });
      }
    });

    // Écouter les nouveaux messages
    this.socket.on('new-message', (data: { message: Message; conversation: Conversation }) => {
      logger.info('📨 Nouveau message reçu', 'userMessageSocketService', data);
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
        logger.warn('Échec envoi message', 'userMessageSocketService', data);
      }
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
  }

  /**
   * Rejoindre une conversation (pour recevoir les messages en temps réel)
   */
  joinConversation(conversationId: string) {
    if (!this.socket) {
      logger.warn('Socket non initialisé', 'userMessageSocketService');
      // Réessayer après un court délai si le socket n'est pas encore initialisé
      setTimeout(() => {
        if (this.socket && this.isConnected) {
          this.socket.emit('join-conversation', { conversationId });
          logger.info(`Rejoint la conversation ${conversationId} (retry)`, 'userMessageSocketService');
        }
      }, 1000);
      return;
    }

    if (!this.isConnected) {
      logger.warn('Socket non connecté, attente de la connexion...', 'userMessageSocketService');
      // Attendre que le socket soit connecté
      const checkConnection = setInterval(() => {
        if (this.isConnected && this.socket) {
          clearInterval(checkConnection);
          this.socket.emit('join-conversation', { conversationId });
          logger.info(`Rejoint la conversation ${conversationId} (après connexion)`, 'userMessageSocketService');
        }
      }, 100);

      // Arrêter après 5 secondes
      setTimeout(() => {
        clearInterval(checkConnection);
      }, 5000);
      return;
    }

    this.socket.emit('join-conversation', { conversationId });
    logger.info(`Rejoint la conversation ${conversationId}`, 'userMessageSocketService');
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

export const userMessageSocketService = new UserMessageSocketService();

