import { create } from 'zustand'
import { Conversation, Message } from '@/services/adminMessageService'
import { logger } from '@/utils/logger'

interface AdminMessageStore {
  conversations: Conversation[]
  currentConversation: Conversation | null
  messages: Record<string, Message[]>
  unreadCount: number
  loading: boolean
  error: string | null

  setConversations: (conversations: Conversation[]) => void
  setCurrentConversation: (conversation: Conversation | null) => void
  addMessage: (conversationId: string, message: Message) => void
  setMessages: (conversationId: string, messages: Message[]) => void
  markAsRead: (conversationId: string, currentUserId?: string) => void
  updateConversationUnreadCount: (conversationId: string, count: number) => void
  setUnreadCount: (count: number) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  clear: () => void
}

export const useAdminMessageStore = create<AdminMessageStore>((set) => ({
  conversations: [],
  currentConversation: null,
  messages: {},
  unreadCount: 0,
  loading: false,
  error: null,

  setConversations: (conversations) =>
    set((state) => {
      // Fusionner les unread_count locaux avec les conversations du backend
      // Cela préserve les mises à jour locales même après un rechargement
      const localUnreadCounts = new Map<string, number>()
      state.conversations.forEach((conv) => {
        // Si le unread_count local est 0, on le préserve (car cela signifie qu'on a marqué comme lu)
        // Sinon, on utilise la valeur du backend
        if (conv.unread_count === 0) {
          localUnreadCounts.set(conv.id, 0)
        }
      })
      
      const mergedConversations = conversations.map((conv) => {
        const localCount = localUnreadCounts.get(conv.id)
        // Si on a une mise à jour locale à 0, l'utiliser même si le backend dit autre chose
        // (car il peut y avoir un délai de synchronisation)
        if (localCount === 0) {
          return { ...conv, unread_count: 0 }
        }
        return conv
      })
      
      // Recalculer le compteur global à partir des conversations fusionnées
      const newUnreadCount = mergedConversations.reduce((sum, conv) => sum + (conv.unread_count || 0), 0)
      
      return { 
        conversations: mergedConversations,
        unreadCount: newUnreadCount
      }
    }),

  setCurrentConversation: (conversation) => set({ currentConversation: conversation }),

  addMessage: (conversationId, message) =>
    set((state) => {
      const existingMessages = state.messages[conversationId] || []
      const existingMessage = existingMessages.find((m) => m.id === message.id)
      
      // Si le message existe déjà, vérifier si on doit mettre à jour is_read
      if (existingMessage) {
        // Si c'est notre propre message et qu'il n'a pas encore été lu, ne pas mettre à jour is_read
        // (garder is_read: false jusqu'à ce que le destinataire le lise vraiment)
        if (existingMessage.sender_id === message.sender_id && !existingMessage.is_read && message.is_read) {
          // Ne pas mettre à jour is_read pour nos propres messages non lus
          return state
        }
        // Sinon, mettre à jour le message existant
        const updatedMessages = existingMessages.map((m) =>
          m.id === message.id ? message : m
        )
        return {
          messages: {
            ...state.messages,
            [conversationId]: updatedMessages,
          },
        }
      }
      
      // Ajouter le nouveau message
      return {
        messages: {
          ...state.messages,
          [conversationId]: [...existingMessages, message],
        },
      }
    }),

  setMessages: (conversationId, messages) =>
    set((state) => ({
      messages: {
        ...state.messages,
        [conversationId]: messages,
      },
    })),

  markAsRead: (conversationId, currentUserId?: string) =>
    set((state) => {
      const messages = state.messages[conversationId] || []
      return {
        messages: {
          ...state.messages,
          [conversationId]: messages.map((msg) => {
            // Ne marquer comme lus que les messages qu'on n'a pas envoyés
            // Nos propres messages doivent rester avec is_read: false jusqu'à ce que le destinataire les lise
            if (currentUserId && msg.sender_id === currentUserId) {
              // Garder le statut is_read tel quel pour nos propres messages
              return msg
            }
            // Marquer comme lus les messages des autres
            return {
              ...msg,
              is_read: true,
              read_at: new Date().toISOString(),
            }
          }),
        },
      }
    }),

  updateConversationUnreadCount: (conversationId, count) =>
    set((state) => {
      const updatedConversations = state.conversations.map((conv) =>
        conv.id === conversationId ? { ...conv, unread_count: count } : conv
      )
      
      // Recalculer le compteur global immédiatement à partir des conversations
      const newUnreadCount = updatedConversations.reduce((sum, conv) => sum + (conv.unread_count || 0), 0)
      
      // Debug en développement
      if (process.env.NODE_ENV === 'development') {
        const updated = updatedConversations.find(c => c.id === conversationId)
        if (updated) {
          logger.debug('[useAdminMessageStore] Updated unread_count:', {
            conversationId,
            oldCount: state.conversations.find(c => c.id === conversationId)?.unread_count,
            newCount: count,
            globalUnreadCount: newUnreadCount,
          })
        }
      }
      
      return { 
        conversations: updatedConversations,
        unreadCount: newUnreadCount
      }
    }),

  setUnreadCount: (count) => set({ unreadCount: count }),

  setLoading: (loading) => set({ loading }),

  setError: (error) => set({ error }),

  clear: () =>
    set({
      conversations: [],
      currentConversation: null,
      messages: {},
      unreadCount: 0,
      loading: false,
      error: null,
    }),
}))

