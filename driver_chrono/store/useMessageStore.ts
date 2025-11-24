import { create } from 'zustand';
import { Conversation, Message } from '../services/driverMessageService';

interface MessageStore {
  conversations: Conversation[];
  currentConversation: Conversation | null;
  messages: Record<string, Message[]>; 
  unreadCount: number;
  isLoading: boolean;
  error: string | null;

  setConversations: (conversations: Conversation[]) => void;
  setCurrentConversation: (conversation: Conversation | null) => void;
  setMessages: (conversationId: string, messages: Message[]) => void;
  addMessage: (conversationId: string, message: Message) => void;
  markAsRead: (conversationId: string) => void;
  setUnreadCount: (count: number) => void;
  incrementUnreadCount: () => void;
  decrementUnreadCount: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clear: () => void;
}

export const useMessageStore = create<MessageStore>((set) => ({
  conversations: [],
  currentConversation: null,
  messages: {},
  unreadCount: 0,
  isLoading: false,
  error: null,

  setConversations: (conversations) => set({ conversations }),

  setCurrentConversation: (conversation) => set({ currentConversation: conversation }),

  setMessages: (conversationId, messages) =>
    set((state) => ({
      messages: {
        ...state.messages,
        [conversationId]: messages,
      },
    })),

  addMessage: (conversationId, message) =>
    set((state) => {
      const existingMessages = state.messages[conversationId] || [];
      // Vérifier si le message existe déjà (éviter les doublons)
      // Vérifier par ID, ou par contenu + timestamp si l'ID n'est pas encore disponible
      const messageExists = existingMessages.some((m) => {
        if (m.id === message.id) return true;
        // Vérifier aussi par contenu + timestamp pour éviter les doublons même avec des IDs différents
        if (m.content === message.content && 
            m.sender_id === message.sender_id &&
            m.created_at && message.created_at) {
          const timeDiff = Math.abs(
            new Date(m.created_at).getTime() - new Date(message.created_at).getTime()
          );
          // Si le contenu et l'expéditeur sont identiques et que les timestamps sont très proches (< 2 secondes)
          // considérer comme un doublon
          if (timeDiff < 2000) return true;
        }
        return false;
      });
      if (messageExists) {
        return state;
      }
      return {
        messages: {
          ...state.messages,
          [conversationId]: [...existingMessages, message],
        },
      };
    }),

  markAsRead: (conversationId) =>
    set((state) => {
      const messages = state.messages[conversationId] || [];
      return {
        messages: {
          ...state.messages,
          [conversationId]: messages.map((msg) => ({
            ...msg,
            is_read: true,
            read_at: new Date().toISOString(),
          })),
        },
      };
    }),

  setUnreadCount: (count) => set({ unreadCount: count }),

  incrementUnreadCount: () =>
    set((state) => ({ unreadCount: state.unreadCount + 1 })),

  decrementUnreadCount: () =>
    set((state) => ({ unreadCount: Math.max(0, state.unreadCount - 1) })),

  setLoading: (loading) => set({ isLoading: loading }),

  setError: (error) => set({ error }),

  clear: () =>
    set({
      conversations: [],
      currentConversation: null,
      messages: {},
      unreadCount: 0,
      isLoading: false,
      error: null,
    }),
}));

