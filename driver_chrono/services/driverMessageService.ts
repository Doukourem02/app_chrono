import { useDriverStore } from '../store/useDriverStore';
import { logger } from '../utils/logger';
import { config } from '../config/index';

const API_BASE_URL = config.apiUrl;

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

class DriverMessageService {
  /**
   * Vérifie et rafraîchit le token d'accès si nécessaire
   */
  private async ensureAccessToken(): Promise<string | null> {
    try {
      const {
        accessToken,
        refreshToken,
        setTokens,
        logout,
      } = useDriverStore.getState();

      // Vérifier si le token existe et s'il n'est pas expiré
      if (accessToken && this.isTokenValid(accessToken)) {
        return accessToken;
      }

      // Si le token est expiré ou absent, essayer de le rafraîchir
      if (!refreshToken) {
        logger.warn('⚠️ Pas de refreshToken disponible - session expirée');
        logout();
        return null;
      }

      // Vérifier si le refresh token est encore valide
      if (!this.isTokenValid(refreshToken)) {
        logger.warn('⚠️ Refresh token expiré - session expirée');
        logout();
        return null;
      }

      logger.info('🔄 Token expiré ou absent, rafraîchissement en cours...');
      const newAccessToken = await this.refreshAccessToken(refreshToken);
      if (newAccessToken) {
        setTokens({ accessToken: newAccessToken, refreshToken });
        logger.info('✅ Token rafraîchi et sauvegardé avec succès');
        return newAccessToken;
      }

      logger.warn('⚠️ Impossible de rafraîchir le token - session expirée');
      logout();
      return null;
    } catch (error: any) {
      logger.error('❌ Erreur ensureAccessToken:', error);
      const { logout } = useDriverStore.getState();
      logout();
      return null;
    }
  }

  /**
   * Vérifie si un token JWT est valide (non expiré)
   */
  private isTokenValid(token: string): boolean {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        return false;
      }

      const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));

      if (payload.exp) {
        const expirationTime = payload.exp * 1000;
        const now = Date.now();
        const isExpired = now >= expirationTime;
        
        if (isExpired) {
          logger.warn('⚠️ Token expiré, expiration:', new Date(expirationTime).toISOString());
          return false;
        }
        
        return true;
      }

      logger.warn('⚠️ Token sans expiration définie');
      return true;
    } catch (error: any) {
      logger.error('❌ Erreur vérification token:', error);
      return false;
    }
  }

  /**
   * Rafraîchit le token d'accès
   */
  private async refreshAccessToken(refreshToken: string): Promise<string | null> {
    try {
      logger.info('🔄 Tentative de rafraîchissement du token...');
      
      const response = await fetch(`${API_BASE_URL}/api/auth-simple/refresh-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken })
      });

      const result = await response.json();

      if (!response.ok) {
        logger.error(`Erreur HTTP lors du rafraîchissement: ${response.status}`, result.message);
        return null;
      }

      if (!result.success) {
        logger.error('❌ Échec du rafraîchissement:', result.message);
        return null;
      }

      if (!result.data?.accessToken) {
        logger.error('❌ Pas de accessToken dans la réponse:', result);
        return null;
      }

      logger.info('✅ Token rafraîchi avec succès');
      return result.data.accessToken as string;
    } catch (error: any) {
      logger.error('❌ Erreur réseau lors du rafraîchissement:', error);
      if (error instanceof TypeError && error.message.includes('Network request failed')) {
        logger.error('❌ Impossible de se connecter au serveur. Vérifiez que le backend est démarré sur', API_BASE_URL);
      }
      return null;
    }
  }

  private async fetchWithAuth(url: string, options: RequestInit = {}) {
    const token = await this.ensureAccessToken();
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
      const conversations = await this.getConversations('order');
      const existing = conversations.find((conv) => conv.order_id === orderId);

      if (existing) {
        return existing;
      }

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
   * Récupérer les conversations du driver
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

export const driverMessageService = new DriverMessageService();

