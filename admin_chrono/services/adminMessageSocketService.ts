import { io, Socket } from 'socket.io-client'
import { logger } from '@/utils/logger'
import { Message, Conversation } from './adminMessageService'

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

  connect(adminId: string) {
    if (this.socket && this.isConnected) {
      return
    }

    this.adminId = adminId
    this.socket = io(SOCKET_URL, {
      transports: ['websocket'],
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

