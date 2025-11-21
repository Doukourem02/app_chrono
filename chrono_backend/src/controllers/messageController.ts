import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../types/index.js';
import messageService from '../services/messageService.js';
import logger from '../utils/logger.js';

/**
 * Récupérer toutes les conversations de l'utilisateur connecté
 * Pour les admins, retourne toutes les conversations
 */
export const getConversations = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Non authentifié' });
    }

    const type = req.query.type as string | undefined;
    
    // Si l'utilisateur est admin, retourner toutes les conversations
    let conversations;
    if (userRole === 'admin' || userRole === 'super_admin') {
      conversations = await messageService.getAllConversations(type as any);
    } else {
      conversations = await messageService.getUserConversations(userId, type as any);
    }

    return res.json({ success: true, data: conversations });
  } catch (error: any) {
    logger.error('Erreur lors de la récupération des conversations:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Récupérer une conversation par ID
 */
export const getConversationById = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Non authentifié' });
    }

    const { conversationId } = req.params;

    // Vérifier l'accès
    const canAccess = await messageService.canAccessConversation(
      userId,
      conversationId,
      userRole
    );
    if (!canAccess) {
      return res.status(403).json({ success: false, message: 'Accès refusé' });
    }

    const conversation = await messageService.getConversationById(conversationId);
    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Conversation introuvable' });
    }

    return res.json({ success: true, data: conversation });
  } catch (error: any) {
    logger.error('Erreur lors de la récupération de la conversation:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Créer une nouvelle conversation (admin uniquement pour support/admin)
 */
export const createConversation = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Non authentifié' });
    }

    const { type, participantId, orderId } = req.body;

    let conversation;
    if (type === 'order' && orderId) {
      // Récupérer ou créer une conversation pour une commande
      conversation = await messageService.getOrCreateOrderConversation(orderId);
      if (!conversation) {
        return res.status(404).json({
          success: false,
          message: 'Commande introuvable ou pas de livreur assigné',
        });
      }
    } else if (type === 'support') {
      // Les clients/livreurs peuvent créer des conversations de support
      if (userRole === 'admin' || userRole === 'super_admin') {
        // Admin crée avec un client/livreur
        if (!participantId) {
          return res.status(400).json({ success: false, message: 'participantId requis' });
        }
        conversation = await messageService.createSupportConversation(
          userId,
          participantId,
          'support'
        );
      } else {
        // Client/Livreur crée avec un admin (trouver un admin disponible)
        const adminId = await messageService.findAvailableAdmin();
        if (!adminId) {
          return res.status(503).json({
            success: false,
            message: 'Aucun administrateur disponible pour le moment',
          });
        }
        conversation = await messageService.createSupportConversation(
          adminId,
          userId,
          'support'
        );
      }
    } else if (type === 'admin') {
      // Seuls les admins peuvent créer des conversations admin-livreur
      if (userRole !== 'admin' && userRole !== 'super_admin') {
        return res.status(403).json({
          success: false,
          message: 'Seuls les admins peuvent créer des conversations admin-livreur',
        });
      }
      if (!participantId) {
        return res.status(400).json({ success: false, message: 'participantId requis' });
      }
      conversation = await messageService.createSupportConversation(
        userId,
        participantId,
        'admin'
      );
    } else {
      return res.status(400).json({ success: false, message: 'Type de conversation invalide' });
    }

    return res.status(201).json({ success: true, data: conversation });
  } catch (error: any) {
    logger.error('Erreur lors de la création de la conversation:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Récupérer les messages d'une conversation
 */
export const getMessages = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Non authentifié' });
    }

    const { conversationId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;

    // Vérifier l'accès
    const canAccess = await messageService.canAccessConversation(
      userId,
      conversationId,
      userRole
    );
    if (!canAccess) {
      return res.status(403).json({ success: false, message: 'Accès refusé' });
    }

    const messages = await messageService.getMessages(conversationId, page, limit);

    return res.json({ success: true, data: messages });
  } catch (error: any) {
    logger.error('Erreur lors de la récupération des messages:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Envoyer un message
 */
export const sendMessage = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Non authentifié' });
    }

    const { conversationId } = req.params;
    const { content, messageType } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Le contenu du message est requis' });
    }

    // Vérifier l'accès
    const canAccess = await messageService.canAccessConversation(
      userId,
      conversationId,
      userRole
    );
    if (!canAccess) {
      return res.status(403).json({ success: false, message: 'Accès refusé' });
    }

    const message = await messageService.sendMessage(
      conversationId,
      userId,
      content.trim(),
      messageType || 'text'
    );

    return res.status(201).json({ success: true, data: message });
  } catch (error: any) {
    logger.error('Erreur lors de l\'envoi du message:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Marquer les messages comme lus
 */
export const markMessagesAsRead = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Non authentifié' });
    }

    const { conversationId } = req.params;

    await messageService.markAsRead(conversationId, userId);

    return res.json({ success: true, message: 'Messages marqués comme lus' });
  } catch (error: any) {
    logger.error('Erreur lors du marquage des messages comme lus:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Récupérer le nombre de messages non lus
 * Pour les admins, retourne le nombre total de messages non lus
 */
export const getUnreadCount = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Non authentifié' });
    }

    let count;
    if (userRole === 'admin' || userRole === 'super_admin') {
      count = await messageService.getAllUnreadCount();
    } else {
      count = await messageService.getUnreadCount(userId);
    }

    return res.json({ success: true, data: count });
  } catch (error: any) {
    logger.error('Erreur lors du comptage des messages non lus:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

