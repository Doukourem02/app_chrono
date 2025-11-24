import { Server, Socket } from 'socket.io';
import messageService from '../services/messageService.js';
import logger from '../utils/logger.js';

interface ExtendedSocket extends Socket {
  userId?: string;
  driverId?: string;
  userRole?: 'client' | 'driver' | 'admin';
}

export const setupMessageSocket = (io: Server): void => {
  const DEBUG = process.env.DEBUG_SOCKETS === 'true';

  io.on('connection', (socket: ExtendedSocket) => {
    if (DEBUG) {
      logger.debug(`[MessageSocket] Nouvelle connexion: ${socket.id}`);
    }

    /**
     * Identification des clients (users)
     */
    socket.on('user-connect', (userId: string) => {
      socket.userId = userId;
      socket.userRole = 'client';
      if (DEBUG) {
        logger.debug(`[MessageSocket] User connecté: ${userId}`);
      }
    });

    /**
     * Identification des drivers
     */
    socket.on('driver-connect', (driverId: string) => {
      socket.userId = driverId;
      socket.userRole = 'driver';
      if (DEBUG) {
        logger.debug(`[MessageSocket] Driver connecté: ${driverId}`);
      }
    });

    /**
     * Identification des admins
     */
    socket.on('admin-connect', (adminId: string) => {
      socket.userId = adminId;
      socket.userRole = 'admin';
      if (DEBUG) {
        logger.debug(`[MessageSocket] Admin connecté: ${adminId}`);
      }
    });

    /**
     * Rejoindre une conversation (pour recevoir les messages en temps réel)
     */
    socket.on('join-conversation', async (data: { conversationId: string }) => {
      try {
        const { conversationId } = data;
        const userId = socket.userId;

        if (!userId) {
          socket.emit('error', { message: 'Non authentifié' });
          return;
        }

        // Vérifier l'accès à la conversation
        const canAccess = await messageService.canAccessConversation(
          userId,
          conversationId,
          socket.userRole
        );

        if (!canAccess) {
          socket.emit('error', { message: 'Accès refusé à cette conversation' });
          return;
        }

        // Rejoindre la room Socket.IO pour cette conversation
        socket.join(`conversation:${conversationId}`);

        if (DEBUG) {
          logger.debug(
            `[MessageSocket] Utilisateur ${userId} a rejoint la conversation ${conversationId}`
          );
        }

        socket.emit('joined-conversation', { conversationId });
      } catch (error: any) {
        logger.error('[MessageSocket] Erreur join-conversation:', error);
        socket.emit('error', { message: error.message });
      }
    });

    /**
     * Quitter une conversation
     */
    socket.on('leave-conversation', (data: { conversationId: string }) => {
      const { conversationId } = data;
      socket.leave(`conversation:${conversationId}`);

      if (DEBUG) {
        logger.debug(
          `[MessageSocket] Utilisateur ${socket.userId} a quitté la conversation ${conversationId}`
        );
      }
    });

    /**
     * Envoyer un message
     */
    socket.on(
      'send-message',
      async (data: { conversationId: string; content: string; messageType?: string }) => {
        try {
          const { conversationId, content, messageType } = data;
          const userId = socket.userId;

          if (!userId) {
            socket.emit('error', { message: 'Non authentifié' });
            return;
          }

          if (!content || content.trim().length === 0) {
            socket.emit('error', { message: 'Le contenu du message est requis' });
            return;
          }

          // Vérifier l'accès
          const canAccess = await messageService.canAccessConversation(
            userId,
            conversationId,
            socket.userRole
          );

          if (!canAccess) {
            socket.emit('error', { message: 'Accès refusé à cette conversation' });
            return;
          }

          // Créer le message en base de données
          const message = await messageService.sendMessage(
            conversationId,
            userId,
            content.trim(),
            (messageType as any) || 'text'
          );

          // Récupérer la conversation mise à jour
          const conversation = await messageService.getConversationById(conversationId);

          // Émettre le nouveau message à tous les participants de la conversation
          io.to(`conversation:${conversationId}`).emit('new-message', {
            message,
            conversation,
          });

          // Confirmer l'envoi à l'expéditeur
          socket.emit('message-sent', {
            messageId: message.id,
            conversationId,
            success: true,
          });

          if (DEBUG) {
            logger.debug(
              `[MessageSocket] Message envoyé dans la conversation ${conversationId} par ${userId}`
            );
          }
        } catch (error: any) {
          logger.error('[MessageSocket] Erreur send-message:', error);
          socket.emit('message-sent', {
            success: false,
            message: error.message,
          });
        }
      }
    );

    /**
     * Marquer les messages comme lus
     */
    socket.on('mark-messages-read', async (data: { conversationId: string }) => {
      try {
        const { conversationId } = data;
        const userId = socket.userId;

        if (!userId) {
          socket.emit('error', { message: 'Non authentifié' });
          return;
        }

        // Vérifier l'accès
        const canAccess = await messageService.canAccessConversation(
          userId,
          conversationId,
          socket.userRole
        );

        if (!canAccess) {
          socket.emit('error', { message: 'Accès refusé à cette conversation' });
          return;
        }

        // Marquer les messages comme lus
        // Pour les admins, marquer TOUS les messages comme lus
        const isAdmin = socket.userRole === 'admin' || socket.userRole === 'super_admin';
        await messageService.markAsRead(conversationId, userId, isAdmin);

        // Récupérer la conversation mise à jour
        const conversation = await messageService.getConversationById(conversationId);

        // Notifier les autres participants
        socket.to(`conversation:${conversationId}`).emit('conversation-updated', {
          conversation,
        });

        socket.emit('messages-read', { conversationId });

        if (DEBUG) {
          logger.debug(
            `[MessageSocket] Messages marqués comme lus pour la conversation ${conversationId} par ${userId}`
          );
        }
      } catch (error: any) {
        logger.error('[MessageSocket] Erreur mark-messages-read:', error);
        socket.emit('error', { message: error.message });
      }
    });

    /**
     * Indicateur de frappe (typing)
     */
    socket.on('typing', (data: { conversationId: string; isTyping: boolean }) => {
      const { conversationId, isTyping } = data;
      const userId = socket.userId;

      if (!userId) {
        return;
      }

      // Émettre l'indicateur de frappe aux autres participants
      socket.to(`conversation:${conversationId}`).emit('typing', {
        conversationId,
        userId,
        isTyping,
      });
    });
  });
};

