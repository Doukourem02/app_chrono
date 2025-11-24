import { create } from 'zustand'
import { Conversation, Message } from '@/services/adminMessageService'

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
  markAsRead: (conversationId: string) => void
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
      const messageExists = existingMessages.some((m) => m.id === message.id)
      if (messageExists) {
        return state
      }
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

  markAsRead: (conversationId) =>
    set((state) => {
      const messages = state.messages[conversationId] || []
      return {
        messages: {
          ...state.messages,
          [conversationId]: messages.map((msg) => ({
            ...msg,
            is_read: true,
            read_at: new Date().toISOString(),
          })),
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
          console.log('[useAdminMessageStore] Updated unread_count:', {
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

