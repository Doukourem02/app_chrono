import pool from '../config/db.js';
import { Conversation, Message, ConversationType, MessageType } from '../types/index.js';
import logger from '../utils/logger.js';

export class MessageService {
  /**
   * Créer une conversation liée à une commande
   */
  async createOrderConversation(orderId: string, userId: string, driverId: string): Promise<Conversation> {
    try {
      // Vérifier si une conversation existe déjà pour cette commande
      const existing = await pool.query(
        `SELECT id FROM conversations 
         WHERE order_id = $1 AND type = 'order'`,
        [orderId]
      );

      if (existing.rows.length > 0) {
        const conversation = await this.getConversationById(existing.rows[0].id);
        if (!conversation) {
          throw new Error('Conversation introuvable');
        }
        return conversation;
      }

      // Créer la nouvelle conversation
      const result = await pool.query(
        `INSERT INTO conversations (type, order_id, participant_1_id, participant_2_id)
         VALUES ('order', $1, $2, $3)
         RETURNING *`,
        [orderId, userId, driverId]
      );

      logger.info(`Conversation créée pour la commande ${orderId}`);
      return this.mapConversationFromRow(result.rows[0]);
    } catch (error: any) {
      logger.error('Erreur lors de la création de la conversation:', error);
      throw new Error(`Impossible de créer la conversation: ${error.message}`);
    }
  }

  /**
   * Créer une conversation de support ou admin
   */
  async createSupportConversation(
    adminId: string,
    userId: string,
    type: 'support' | 'admin'
  ): Promise<Conversation> {
    try {
      // Vérifier si une conversation existe déjà
      const existing = await pool.query(
        `SELECT id FROM conversations 
         WHERE type = $1 
         AND ((participant_1_id = $2 AND participant_2_id = $3) 
              OR (participant_1_id = $3 AND participant_2_id = $2))`,
        [type, adminId, userId]
      );

      if (existing.rows.length > 0) {
        const conversation = await this.getConversationById(existing.rows[0].id);
        if (!conversation) {
          throw new Error('Conversation introuvable');
        }
        return conversation;
      }

      // Créer la nouvelle conversation
      const result = await pool.query(
        `INSERT INTO conversations (type, participant_1_id, participant_2_id)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [type, adminId, userId]
      );

      logger.info(`Conversation ${type} créée entre ${adminId} et ${userId}`);
      return this.mapConversationFromRow(result.rows[0]);
    } catch (error: any) {
      logger.error('Erreur lors de la création de la conversation de support:', error);
      throw new Error(`Impossible de créer la conversation: ${error.message}`);
    }
  }

  /**
   * Récupérer une conversation par ID
   */
  async getConversationById(conversationId: string): Promise<Conversation | null> {
    try {
      const result = await pool.query(
        `SELECT c.*,
                u1.id as p1_id, u1.email as p1_email, u1.role as p1_role,
                u1.first_name as p1_first_name, u1.last_name as p1_last_name, u1.avatar_url as p1_avatar_url,
                u2.id as p2_id, u2.email as p2_email, u2.role as p2_role,
                u2.first_name as p2_first_name, u2.last_name as p2_last_name, u2.avatar_url as p2_avatar_url
         FROM conversations c
         LEFT JOIN users u1 ON c.participant_1_id = u1.id
         LEFT JOIN users u2 ON c.participant_2_id = u2.id
         WHERE c.id = $1`,
        [conversationId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapConversationFromRow(result.rows[0]);
    } catch (error: any) {
      logger.error('Erreur lors de la récupération de la conversation:', error);
      throw new Error(`Impossible de récupérer la conversation: ${error.message}`);
    }
  }

  /**
   * Récupérer les conversations d'un utilisateur
   */
  async getUserConversations(userId: string, type?: ConversationType): Promise<Conversation[]> {
    try {
      let query = `
        SELECT c.*,
               u1.id as p1_id, u1.email as p1_email, u1.role as p1_role,
               u1.first_name as p1_first_name, u1.last_name as p1_last_name, u1.avatar_url as p1_avatar_url,
               u2.id as p2_id, u2.email as p2_email, u2.role as p2_role,
               u2.first_name as p2_first_name, u2.last_name as p2_last_name, u2.avatar_url as p2_avatar_url,
               (SELECT COUNT(*) FROM messages m 
                WHERE m.conversation_id = c.id 
                AND m.sender_id != $1 
                AND m.is_read = FALSE) as unread_count,
               (SELECT row_to_json(m.*) FROM messages m 
                WHERE m.conversation_id = c.id 
                ORDER BY m.created_at DESC LIMIT 1) as last_message
        FROM conversations c
        LEFT JOIN users u1 ON c.participant_1_id = u1.id
        LEFT JOIN users u2 ON c.participant_2_id = u2.id
        WHERE (c.participant_1_id = $1 OR c.participant_2_id = $1)
        AND c.is_archived = FALSE
      `;

      const params: any[] = [userId];

      if (type) {
        query += ` AND c.type = $2`;
        params.push(type);
      }

      query += ` ORDER BY c.last_message_at DESC NULLS LAST, c.created_at DESC`;

      const result = await pool.query(query, params);
      return result.rows.map((row) => this.mapConversationFromRow(row));
    } catch (error: any) {
      logger.error('Erreur lors de la récupération des conversations:', error);
      throw new Error(`Impossible de récupérer les conversations: ${error.message}`);
    }
  }

  /**
   * Récupérer toutes les conversations (pour les admins)
   */
  async getAllConversations(type?: ConversationType): Promise<Conversation[]> {
    try {
      let query = `
        SELECT c.*,
               u1.id as p1_id, u1.email as p1_email, u1.role as p1_role,
               u1.first_name as p1_first_name, u1.last_name as p1_last_name, u1.avatar_url as p1_avatar_url,
               u2.id as p2_id, u2.email as p2_email, u2.role as p2_role,
               u2.first_name as p2_first_name, u2.last_name as p2_last_name, u2.avatar_url as p2_avatar_url,
               (SELECT COUNT(*) FROM messages m 
                WHERE m.conversation_id = c.id 
                AND m.is_read = FALSE) as unread_count,
               (SELECT row_to_json(m.*) FROM messages m 
                WHERE m.conversation_id = c.id 
                ORDER BY m.created_at DESC LIMIT 1) as last_message
        FROM conversations c
        LEFT JOIN users u1 ON c.participant_1_id = u1.id
        LEFT JOIN users u2 ON c.participant_2_id = u2.id
        WHERE c.is_archived = FALSE
      `;

      const params: any[] = [];

      if (type) {
        query += ` AND c.type = $1`;
        params.push(type);
      }

      query += ` ORDER BY c.last_message_at DESC NULLS LAST, c.created_at DESC`;

      const result = await pool.query(query, params);
      return result.rows.map((row) => this.mapConversationFromRow(row));
    } catch (error: any) {
      logger.error('Erreur lors de la récupération de toutes les conversations:', error);
      throw new Error(`Impossible de récupérer les conversations: ${error.message}`);
    }
  }

  /**
   * Récupérer ou créer une conversation pour une commande
   */
  async getOrCreateOrderConversation(orderId: string): Promise<Conversation | null> {
    try {
      // Récupérer la commande pour obtenir user_id et driver_id
      const orderResult = await pool.query(
        `SELECT user_id, driver_id FROM orders WHERE id = $1`,
        [orderId]
      );

      if (orderResult.rows.length === 0) {
        return null;
      }

      const { user_id, driver_id } = orderResult.rows[0];

      if (!driver_id) {
        // Pas de livreur assigné, pas de conversation possible
        return null;
      }

      // Vérifier si la conversation existe
      const existing = await pool.query(
        `SELECT id FROM conversations 
         WHERE order_id = $1 AND type = 'order'`,
        [orderId]
      );

      if (existing.rows.length > 0) {
        return await this.getConversationById(existing.rows[0].id);
      }

      // Créer la conversation
      return await this.createOrderConversation(orderId, user_id, driver_id);
    } catch (error: any) {
      logger.error('Erreur lors de la récupération/création de la conversation:', error);
      throw new Error(`Impossible de récupérer/créer la conversation: ${error.message}`);
    }
  }

  /**
   * Envoyer un message
   */
  async sendMessage(
    conversationId: string,
    senderId: string,
    content: string,
    messageType: MessageType = 'text'
  ): Promise<Message> {
    try {
      // Vérifier que la conversation existe et que l'utilisateur y a accès
      const conversation = await this.getConversationById(conversationId);
      if (!conversation) {
        throw new Error('Conversation introuvable');
      }

      if (
        conversation.participant_1_id !== senderId &&
        conversation.participant_2_id !== senderId
      ) {
        throw new Error('Vous n\'avez pas accès à cette conversation');
      }

      // Créer le message
      const result = await pool.query(
        `INSERT INTO messages (conversation_id, sender_id, content, message_type)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [conversationId, senderId, content, messageType]
      );

      logger.info(`Message envoyé dans la conversation ${conversationId}`);
      return this.mapMessageFromRow(result.rows[0]);
    } catch (error: any) {
      logger.error('Erreur lors de l\'envoi du message:', error);
      throw new Error(`Impossible d'envoyer le message: ${error.message}`);
    }
  }

  /**
   * Récupérer les messages d'une conversation (pagination)
   */
  async getMessages(
    conversationId: string,
    page: number = 1,
    limit: number = 50
  ): Promise<Message[]> {
    try {
      const offset = (page - 1) * limit;

      const result = await pool.query(
        `SELECT m.*, 
                u.id as sender_user_id, 
                u.email as sender_email, 
                u.role as sender_role,
                u.first_name as sender_first_name,
                u.last_name as sender_last_name,
                u.avatar_url as sender_avatar_url
         FROM messages m
         LEFT JOIN users u ON m.sender_id = u.id
         WHERE m.conversation_id = $1
         ORDER BY m.created_at ASC
         LIMIT $2 OFFSET $3`,
        [conversationId, limit, offset]
      );

      return result.rows.map((row) => this.mapMessageFromRow(row));
    } catch (error: any) {
      logger.error('Erreur lors de la récupération des messages:', error);
      throw new Error(`Impossible de récupérer les messages: ${error.message}`);
    }
  }

  /**
   * Marquer les messages comme lus
   */
  async markAsRead(conversationId: string, userId: string): Promise<void> {
    try {
      await pool.query(
        `UPDATE messages
         SET is_read = TRUE, read_at = NOW()
         WHERE conversation_id = $1
         AND sender_id != $2
         AND is_read = FALSE`,
        [conversationId, userId]
      );

      logger.info(`Messages marqués comme lus pour la conversation ${conversationId}`);
    } catch (error: any) {
      logger.error('Erreur lors du marquage des messages comme lus:', error);
      throw new Error(`Impossible de marquer les messages comme lus: ${error.message}`);
    }
  }

  /**
   * Récupérer le nombre de messages non lus pour un utilisateur
   */
  async getUnreadCount(userId: string): Promise<number> {
    try {
      const result = await pool.query(
        `SELECT COUNT(*) as count
         FROM messages m
         INNER JOIN conversations c ON m.conversation_id = c.id
         WHERE (c.participant_1_id = $1 OR c.participant_2_id = $1)
         AND m.sender_id != $1
         AND m.is_read = FALSE`,
        [userId]
      );

      return parseInt(result.rows[0].count, 10);
    } catch (error: any) {
      logger.error('Erreur lors du comptage des messages non lus:', error);
      return 0;
    }
  }

  /**
   * Récupérer le nombre total de messages non lus (pour les admins)
   */
  async getAllUnreadCount(): Promise<number> {
    try {
      const result = await pool.query(
        `SELECT COUNT(*) as count
         FROM messages m
         INNER JOIN conversations c ON m.conversation_id = c.id
         WHERE m.is_read = FALSE
         AND c.is_archived = FALSE`
      );

      return parseInt(result.rows[0].count, 10);
    } catch (error: any) {
      logger.error('Erreur lors du comptage de tous les messages non lus:', error);
      return 0;
    }
  }

  /**
   * Vérifier si un utilisateur peut accéder à une conversation
   */
  async canAccessConversation(
    userId: string,
    conversationId: string,
    userRole?: string
  ): Promise<boolean> {
    try {
      // Admin peut tout voir
      if (userRole === 'admin') {
        return true;
      }

      const conversation = await this.getConversationById(conversationId);
      if (!conversation) {
        return false;
      }

      // Vérifier si l'utilisateur est participant
      return (
        conversation.participant_1_id === userId || conversation.participant_2_id === userId
      );
    } catch (error: any) {
      logger.error('Erreur lors de la vérification d\'accès:', error);
      return false;
    }
  }

  /**
   * Mapper une ligne de la base de données vers un objet Conversation
   */
  private mapConversationFromRow(row: any): Conversation {
    const conversation: Conversation = {
      id: row.id,
      type: row.type,
      order_id: row.order_id,
      participant_1_id: row.participant_1_id,
      participant_2_id: row.participant_2_id,
      created_at: row.created_at,
      updated_at: row.updated_at,
      last_message_at: row.last_message_at,
      is_archived: row.is_archived || false,
    };

    if (row.p1_id) {
      conversation.participant_1 = {
        id: row.p1_id,
        email: row.p1_email,
        role: row.p1_role,
        ...(row.p1_first_name && { first_name: row.p1_first_name }),
        ...(row.p1_last_name && { last_name: row.p1_last_name }),
        ...(row.p1_avatar_url && { avatar_url: row.p1_avatar_url }),
      } as any;
    }

    if (row.p2_id) {
      conversation.participant_2 = {
        id: row.p2_id,
        email: row.p2_email,
        role: row.p2_role,
        ...(row.p2_first_name && { first_name: row.p2_first_name }),
        ...(row.p2_last_name && { last_name: row.p2_last_name }),
        ...(row.p2_avatar_url && { avatar_url: row.p2_avatar_url }),
      } as any;
    }

    // Ajouter le nombre de messages non lus
    if (row.unread_count !== undefined) {
      conversation.unread_count = parseInt(row.unread_count, 10);
    }

    // Ajouter le dernier message si disponible (peut être un objet JSON ou null)
    if (row.last_message) {
      try {
        // Si c'est déjà un objet, l'utiliser directement
        // Sinon, essayer de le parser si c'est une chaîne JSON
        const lastMessageData = typeof row.last_message === 'string' 
          ? JSON.parse(row.last_message) 
          : row.last_message;
        
        conversation.last_message = this.mapMessageFromRow(lastMessageData);
      } catch (error) {
        // Ignorer les erreurs de parsing
        logger.warn('Erreur parsing last_message:', error);
      }
    }

    return conversation;
  }

  /**
   * Mapper une ligne de la base de données vers un objet Message
   */
  private mapMessageFromRow(row: any): Message {
    const message: Message = {
      id: row.id,
      conversation_id: row.conversation_id,
      sender_id: row.sender_id,
      content: row.content,
      message_type: row.message_type,
      is_read: row.is_read,
      read_at: row.read_at,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };

    // Ajouter les informations de l'expéditeur si disponibles
    if (row.sender_user_id) {
      message.sender = {
        id: row.sender_user_id,
        email: row.sender_email,
        role: row.sender_role,
        first_name: row.sender_first_name,
        last_name: row.sender_last_name,
        avatar_url: row.sender_avatar_url,
      } as User & { first_name?: string; last_name?: string; avatar_url?: string };
    }

    return message;
  }
}

export default new MessageService();

