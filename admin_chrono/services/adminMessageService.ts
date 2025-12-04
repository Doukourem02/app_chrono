import { supabase } from '@/lib/supabase'
import { logger } from '@/utils/logger'

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.EXPO_PUBLIC_API_URL ||
  'http://localhost:4000'

export interface Conversation {
  id: string
  type: 'order' | 'support' | 'admin'
  order_id?: string | null
  participant_1_id: string
  participant_2_id: string
  created_at?: string
  updated_at?: string
  last_message_at?: string | null
  is_archived?: boolean
  participant_1?: {
    id: string
    email: string
    role: string
    first_name?: string
    last_name?: string
    avatar_url?: string
  }
  participant_2?: {
    id: string
    email: string
    role: string
    first_name?: string
    last_name?: string
    avatar_url?: string
  }
  unread_count?: number
  last_message?: Message
}

export interface Message {
  id: string
  conversation_id: string
  sender_id: string
  content: string
  message_type: 'text' | 'image' | 'system'
  is_read: boolean
  read_at?: string | null
  created_at?: string
  updated_at?: string
  sender?: {
    id: string
    email: string
    role: string
    first_name?: string
    last_name?: string
    avatar_url?: string
  }
}

interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  message?: string
}

class AdminMessageService {
  /**
   * Récupère le token d'accès depuis Supabase
   */
  private async getAccessToken(): Promise<string | null> {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      return session?.access_token || null
    } catch (error) {
      logger.error('[adminMessageService] Error getting access token:', error)
      return null
    }
  }

  /**
   * Fait une requête HTTP au backend avec authentification
   */
  private async fetchWithAuth(url: string, options?: RequestInit): Promise<ApiResponse> {
    const token = await this.getAccessToken()
    if (!token) {
      throw new Error('No access token available')
    }

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${token}`,
      ...(options?.headers as Record<string, string> | undefined),
    }

    if (options?.method && ['POST', 'PUT', 'PATCH'].includes(options.method)) {
      headers['Content-Type'] = 'application/json'
    }

    try {
      const response = await fetch(`${API_BASE_URL}${url}`, {
        ...options,
        headers,
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Network error' }))
        throw new Error(errorData.message || `HTTP ${response.status}`)
      }

      return await response.json()
    } catch (error: unknown) {
      logger.error('[adminMessageService] Fetch error:', error)
      throw error
    }
  }

  /**
   * Récupère toutes les conversations (admin peut tout voir)
   */
  async getConversations(type?: 'order' | 'support' | 'admin'): Promise<Conversation[]> {
    try {
      const query = type ? `?type=${type}` : ''
      const result = await this.fetchWithAuth(`/api/admin/messages/conversations${query}`)

      if (result.success && Array.isArray(result.data)) {
        return result.data as Conversation[]
      }

      return []
    } catch (error: unknown) {
      logger.error('[adminMessageService] Error fetching conversations:', error)
      return []
    }
  }

  /**
   * Récupère une conversation par ID
   */
  async getConversationById(conversationId: string): Promise<Conversation | null> {
    try {
      const result = await this.fetchWithAuth(`/api/admin/messages/conversations/${conversationId}`)

      if (result.success && result.data) {
        return result.data as Conversation
      }

      return null
    } catch (error: unknown) {
      logger.error('[adminMessageService] Error fetching conversation:', error)
      return null
    }
  }

  /**
   * Crée une nouvelle conversation de support ou admin
   */
  async createConversation(
    userId: string,
    type: 'support' | 'admin'
  ): Promise<Conversation | null> {
    try {
      const result = await this.fetchWithAuth('/api/admin/messages/conversations', {
        method: 'POST',
        body: JSON.stringify({
          type,
          participantId: userId,
        }),
      })

      if (result.success && result.data) {
        return result.data as Conversation
      }

      return null
    } catch (error: unknown) {
      logger.error('[adminMessageService] Error creating conversation:', error)
      return null
    }
  }

  /**
   * Récupère les messages d'une conversation
   */
  async getMessages(
    conversationId: string,
    page: number = 1,
    limit: number = 50
  ): Promise<Message[]> {
    try {
      const result = await this.fetchWithAuth(
        `/api/admin/messages/conversations/${conversationId}/messages?page=${page}&limit=${limit}`
      )

      if (result.success && Array.isArray(result.data)) {
        return result.data as Message[]
      }

      return []
    } catch (error: unknown) {
      logger.error('[adminMessageService] Error fetching messages:', error)
      return []
    }
  }

  /**
   * Envoie un message
   */
  async sendMessage(
    conversationId: string,
    content: string,
    messageType: 'text' | 'image' | 'system' = 'text'
  ): Promise<Message | null> {
    try {
      const result = await this.fetchWithAuth(
        `/api/admin/messages/conversations/${conversationId}/messages`,
        {
          method: 'POST',
          body: JSON.stringify({
            content,
            messageType,
          }),
        }
      )

      if (result.success && result.data) {
        return result.data as Message
      }

      return null
    } catch (error: unknown) {
      logger.error('[adminMessageService] Error sending message:', error)
      throw error
    }
  }

  /**
   * Marque les messages comme lus
   */
  async markAsRead(conversationId: string): Promise<void> {
    try {
      await this.fetchWithAuth(`/api/admin/messages/conversations/${conversationId}/read`, {
        method: 'PUT',
      })
    } catch (error: unknown) {
      logger.error('[adminMessageService] Error marking as read:', error)
    }
  }

  /**
   * Récupère le nombre de messages non lus
   */
  async getUnreadCount(): Promise<number> {
    try {
      const result = await this.fetchWithAuth('/api/admin/messages/unread-count')

      if (result.success && typeof result.data === 'number') {
        return result.data
      }

      return 0
    } catch (error: unknown) {
      logger.error('[adminMessageService] Error fetching unread count:', error)
      return 0
    }
  }
}

export const adminMessageService = new AdminMessageService()

