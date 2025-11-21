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

  setConversations: (conversations) => set({ conversations }),

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

