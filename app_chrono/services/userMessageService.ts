import { logger } from '../utils/logger';
import { userApiService } from './userApiService';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || (__DEV__ ? 'http://localhost:4000' : 'https://votre-api.com');

export interface Conversation {
  id: string;
  type: 'order' | 'support' | 'admin';
  order_id?: string | null;
  participant_1_id: string;
  participant_2_id: string;
  created_at?: string;
  updated_at?: string;
  last_message_at?: string | null;
  is_archived?: boolean;
  participant_1?: {
    id: string;
    email: string;
    role: string;
    first_name?: string;
    last_name?: string;
    avatar_url?: string;
  };
  participant_2?: {
    id: string;
    email: string;
    role: string;
    first_name?: string;
    last_name?: string;
    avatar_url?: string;
  };
  unread_count?: number;
  last_message?: Message;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  message_type: 'text' | 'image' | 'system';
  is_read: boolean;
  read_at?: string | null;
  created_at?: string;
  updated_at?: string;
  sender?: {
    id: string;
    email: string;
    role: string;
    first_name?: string;
    last_name?: string;
    avatar_url?: string;
  };
}

class UserMessageService {
  private async fetchWithAuth(url: string, options: RequestInit = {}) {
    const token = await userApiService.ensureAccessToken();
    if (!token) {
      throw new Error('Non autorisé - Session expirée. Veuillez vous reconnecter.');
    }

    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    };

    const response = await fetch(`${API_BASE_URL}${url}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Erreur réseau' }));
      throw new Error(error.message || `HTTP ${response.status}`);
    }

    return response.json();
  }

  /**
   * Récupérer ou créer une conversation pour une commande
   */
  async getOrCreateOrderConversation(orderId: string): Promise<Conversation> {
    try {
      // D'abord, essayer de récupérer une conversation existante
      const conversations = await this.getConversations('order');
      const existing = conversations.find((conv) => conv.order_id === orderId);

      if (existing) {
        return existing;
      }

      // Si aucune conversation n'existe, en créer une
      const result = await this.fetchWithAuth('/api/messages/conversations', {
        method: 'POST',
        body: JSON.stringify({
          type: 'order',
          orderId,
        }),
      });

      if (result.success && result.data) {
        return result.data;
      }

      throw new Error(result.message || 'Impossible de créer la conversation');
    } catch (error: any) {
      logger.error('Erreur lors de la récupération/création de la conversation:', error);
      throw error;
    }
  }

  /**
   * Créer une conversation de support avec l'admin
   */
  async createSupportConversation(): Promise<Conversation | null> {
    try {
      const result = await this.fetchWithAuth('/api/messages/conversations', {
        method: 'POST',
        body: JSON.stringify({
          type: 'support',
        }),
      });

      if (result.success && result.data) {
        return result.data;
      }

      return null;
    } catch (error: any) {
      logger.error('Erreur lors de la création de la conversation de support:', error);
      return null;
    }
  }

  /**
   * Récupérer les conversations de l'utilisateur
   */
  async getConversations(type?: 'order' | 'support' | 'admin'): Promise<Conversation[]> {
    try {
      const url = type
        ? `/api/messages/conversations?type=${type}`
        : '/api/messages/conversations';
      const result = await this.fetchWithAuth(url);

      if (result.success && result.data) {
        return result.data;
      }

      return [];
    } catch (error: any) {
      logger.error('Erreur lors de la récupération des conversations:', error);
      return [];
    }
  }

  /**
   * Récupérer une conversation par ID
   */
  async getConversationById(conversationId: string): Promise<Conversation | null> {
    try {
      const result = await this.fetchWithAuth(`/api/messages/conversations/${conversationId}`);

      if (result.success && result.data) {
        return result.data;
      }

      return null;
    } catch (error: any) {
      logger.error('Erreur lors de la récupération de la conversation:', error);
      return null;
    }
  }

  /**
   * Récupérer les messages d'une conversation
   */
  async getMessages(
    conversationId: string,
    page: number = 1,
    limit: number = 50
  ): Promise<Message[]> {
    try {
      const result = await this.fetchWithAuth(
        `/api/messages/conversations/${conversationId}/messages?page=${page}&limit=${limit}`
      );

      if (result.success && result.data) {
        return result.data;
      }

      return [];
    } catch (error: any) {
      logger.error('Erreur lors de la récupération des messages:', error);
      return [];
    }
  }

  /**
   * Envoyer un message
   */
  async sendMessage(
    conversationId: string,
    content: string,
    messageType: 'text' | 'image' | 'system' = 'text'
  ): Promise<Message> {
    try {
      const result = await this.fetchWithAuth(
        `/api/messages/conversations/${conversationId}/messages`,
        {
          method: 'POST',
          body: JSON.stringify({
            content,
            messageType,
          }),
        }
      );

      if (result.success && result.data) {
        return result.data;
      }

      throw new Error(result.message || 'Impossible d\'envoyer le message');
    } catch (error: any) {
      logger.error('Erreur lors de l\'envoi du message:', error);
      throw error;
    }
  }

  /**
   * Marquer les messages comme lus
   */
  async markAsRead(conversationId: string): Promise<void> {
    try {
      await this.fetchWithAuth(`/api/messages/conversations/${conversationId}/read`, {
        method: 'PUT',
      });
    } catch (error: any) {
      logger.error('Erreur lors du marquage des messages comme lus:', error);
    }
  }

  /**
   * Récupérer le nombre de messages non lus
   */
  async getUnreadCount(): Promise<number> {
    try {
      const result = await this.fetchWithAuth('/api/messages/unread-count');

      if (result.success && result.data) {
        return result.data.count || 0;
      }

      return 0;
    } catch (error: any) {
      logger.error('Erreur lors du comptage des messages non lus:', error);
      return 0;
    }
  }
}

export const userMessageService = new UserMessageService();

