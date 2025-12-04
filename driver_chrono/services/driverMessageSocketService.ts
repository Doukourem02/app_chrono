import { io, Socket } from 'socket.io-client';
import { logger } from '../utils/logger';
import { Message, Conversation } from './driverMessageService';
import { config } from '../config/index';

const SOCKET_URL = config.socketUrl || 'http://localhost:4000';

class DriverMessageSocketService {
  private socket: Socket | null = null;
  private driverId: string | null = null;
  private isConnected = false;
  private messageCallbacks: ((message: Message, conversation: Conversation) => void)[] = [];
  private typingCallbacks: ((data: { userId: string; isTyping: boolean }) => void)[] = [];

  connect(driverId: string) {
    // Si le socket est déjà connecté avec le même driverId, ne rien faire
    if (this.socket && this.isConnected && this.socket.connected && this.driverId === driverId) {
      return;
    }

    // Nettoyer l'ancien socket s'il existe
    if (this.socket) {
      logger.info('Nettoyage de l\'ancien socket', 'driverMessageSocketService');
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }

    this.driverId = driverId;
    this.socket = io(SOCKET_URL, {
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
      logger.info('🔌 Socket connecté pour messagerie', 'driverMessageSocketService');
      this.isConnected = true;
      // S'identifier comme driver
      this.socket?.emit('driver-connect', driverId);
    });

    this.socket.on('disconnect', (reason) => {
      logger.info('🔌 Socket déconnecté pour messagerie', 'driverMessageSocketService', { reason });
      this.isConnected = false;
    });

    this.socket.on('connect_error', (error) => {
      this.isConnected = false;
      // Ignorer les erreurs de polling temporaires
      const isTemporaryPollError = error.message?.includes('xhr poll error') || 
                                   error.message?.includes('poll error') ||
                                   error.message?.includes('transport unknown');
      
      if (!isTemporaryPollError) {
        logger.error('❌ Erreur connexion socket messagerie:', 'driverMessageSocketService', {
          message: error.message,
          type: (error as any).type,
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
        logger.warn('⚠️ Échec envoi message', 'driverMessageSocketService', data);
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

