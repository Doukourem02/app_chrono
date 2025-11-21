import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../types/index.js';
import messageService from '../services/messageService.js';
import logger from '../utils/logger.js';

/**
 * Récupérer toutes les conversations de l'utilisateur connecté
 */
export const getConversations = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Non authentifié' });
    }

    const type = req.query.type as string | undefined;
    const conversations = await messageService.getUserConversations(userId, type as any);

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

    // Seuls les admins peuvent créer des conversations de support/admin
    if ((type === 'support' || type === 'admin') && userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Seuls les admins peuvent créer des conversations de support/admin',
      });
    }

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
    } else if (type === 'support' || type === 'admin') {
      conversation = await messageService.createSupportConversation(
        userId,
        participantId,
        type
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
 */
export const getUnreadCount = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Non authentifié' });
    }

    const count = await messageService.getUnreadCount(userId);

    return res.json({ success: true, data: { count } });
  } catch (error: any) {
    logger.error('Erreur lors du comptage des messages non lus:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

