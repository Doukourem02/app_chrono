import { io, Socket } from 'socket.io-client'
import { logger } from '@/utils/logger'
import { Message, Conversation } from './adminMessageService'
import { supabase } from '@/lib/supabase'

const SOCKET_URL = 
  process.env.NEXT_PUBLIC_SOCKET_URL || 
  process.env.EXPO_PUBLIC_SOCKET_URL ||
  'http://localhost:4000'

class AdminMessageSocketService {
  private socket: Socket | null = null
  private adminId: string | null = null
  private isConnected = false
  private messageCallbacks: ((message: Message, conversation: Conversation) => void)[] = []
  private typingCallbacks: ((data: { userId: string; isTyping: boolean }) => void)[] = []

  async connect(adminId: string) {
    if (this.socket && this.isConnected) {
      return
    }

    this.adminId = adminId
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token
    if (!token) {
      logger.error('[adminMessageSocketService] No access token available')
      return
    }
    this.socket = io(SOCKET_URL, {
      transports: ['websocket'],
      auth: {
        token,
      },
    })

    this.socket.on('connect', () => {
      logger.info('[adminMessageSocketService] Socket connected')
      this.isConnected = true
      this.socket?.emit('admin-connect', adminId)
    })

    this.socket.on('disconnect', () => {
      logger.info('[adminMessageSocketService] Socket disconnected')
      this.isConnected = false
    })

    this.socket.on('new-message', (data: { message: Message; conversation: Conversation }) => {
      logger.info('[adminMessageSocketService] New message received', data)
      logger.debug('[adminMessageSocketService] 💬 Nouveau message reçu:', {
        messageId: data.message?.id,
        senderId: data.message?.sender_id,
        conversationId: data.conversation?.id,
      })
      // Jouer le son de nouveau message (même si on est sur la page Messages)
      if (typeof window !== 'undefined') {
        logger.debug('[adminMessageSocketService] 🔊 Tentative de jouer le son pour nouveau message')
        import('@/utils/soundService').then(({ soundService }) => {
          soundService.playNewMessage().catch((err) => {
            logger.warn('[adminMessageSocketService] Erreur lecture son nouveau message:', err)
          })
        }).catch((err) => {
          logger.warn('[adminMessageSocketService] Erreur chargement soundService:', err)
        })
      } else {
        logger.warn('[adminMessageSocketService] ⚠️ window undefined, impossible de jouer le son')
      }
      this.messageCallbacks.forEach((callback) => {
        callback(data.message, data.conversation)
      })
    })

    this.socket.on('typing', (data: { userId: string; isTyping: boolean }) => {
      this.typingCallbacks.forEach((callback) => {
        callback(data)
      })
    })

    this.socket.on('message-sent', (data: { success: boolean; messageId?: string }) => {
      if (!data.success) {
        logger.warn('[adminMessageSocketService] Message send failed', data)
      }
    })
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
      this.isConnected = false
      this.adminId = null
    }
  }

  joinConversation(conversationId: string) {
    if (!this.socket || !this.isConnected) {
      return
    }

    this.socket.emit('join-conversation', { conversationId })
  }

  leaveConversation(conversationId: string) {
    if (!this.socket || !this.isConnected) {
      return
    }

    this.socket.emit('leave-conversation', { conversationId })
  }

  sendMessage(conversationId: string, content: string, messageType: 'text' | 'image' = 'text') {
    if (!this.socket || !this.isConnected) {
      throw new Error('Socket not connected')
    }

    this.socket.emit('send-message', {
      conversationId,
      content,
      messageType,
    })
  }

  markAsRead(conversationId: string) {
    if (!this.socket || !this.isConnected) {
      return
    }

    this.socket.emit('mark-messages-read', { conversationId })
  }

  onNewMessage(callback: (message: Message, conversation: Conversation) => void): () => void {
    this.messageCallbacks.push(callback)

    return () => {
      const index = this.messageCallbacks.indexOf(callback)
      if (index > -1) {
        this.messageCallbacks.splice(index, 1)
      }
    }
  }

  onTyping(callback: (data: { userId: string; isTyping: boolean }) => void): () => void {
    this.typingCallbacks.push(callback)

    return () => {
      const index = this.typingCallbacks.indexOf(callback)
      if (index > -1) {
        this.typingCallbacks.splice(index, 1)
      }
    }
  }
}

export const adminMessageSocketService = new AdminMessageSocketService()

