import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type NotificationType = 'order' | 'message' | 'dispute' | 'system'

export interface Notification {
  id: string
  type: NotificationType
  title: string
  message: string
  link?: string // URL ou route pour naviguer
  read: boolean
  createdAt: string
  metadata?: {
    orderId?: string
    messageId?: string
    conversationId?: string
    disputeId?: string
    [key: string]: unknown
  }
}

interface NotificationStore {
  notifications: Notification[]
  unreadCount: number
  
  // Actions
  addNotification: (notification: Omit<Notification, 'id' | 'read' | 'createdAt'>) => void
  markAsRead: (notificationId: string) => void
  markAllAsRead: () => void
  removeNotification: (notificationId: string) => void
  clearAll: () => void
  getUnreadCount: () => number
}

export const useNotificationStore = create<NotificationStore>()(
  persist(
    (set, get) => {
      return {
        notifications: [],
        unreadCount: 0,

      addNotification: (notificationData) => {
        const notification: Notification = {
          ...notificationData,
          id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          read: false,
          createdAt: new Date().toISOString(),
        }

        set((state) => {
          // Ajouter la notification au début de la liste
          const newNotifications = [notification, ...state.notifications]
          // Garder seulement les 50 dernières notifications
          const limitedNotifications = newNotifications.slice(0, 50)
          
          return {
            notifications: limitedNotifications,
            unreadCount: limitedNotifications.filter((n) => !n.read).length,
          }
        })
      },

      markAsRead: (notificationId) => {
        set((state) => {
          const updatedNotifications = state.notifications.map((notif) =>
            notif.id === notificationId ? { ...notif, read: true } : notif
          )
          
          return {
            notifications: updatedNotifications,
            unreadCount: updatedNotifications.filter((n) => !n.read).length,
          }
        })
      },

      markAllAsRead: () => {
        set((state) => ({
          notifications: state.notifications.map((notif) => ({ ...notif, read: true })),
          unreadCount: 0,
        }))
      },

      removeNotification: (notificationId) => {
        set((state) => {
          const filtered = state.notifications.filter((notif) => notif.id !== notificationId)
          return {
            notifications: filtered,
            unreadCount: filtered.filter((n) => !n.read).length,
          }
        })
      },

      clearAll: () => {
        set({
          notifications: [],
          unreadCount: 0,
        })
      },

      getUnreadCount: () => {
        return get().notifications.filter((n) => !n.read).length
      },
      }
    },
    {
      name: 'admin-notifications-storage',
      // Ne persister que les notifications non lues et les 20 dernières
      partialize: (state) => ({
        notifications: state.notifications
          .filter((n) => !n.read)
          .slice(0, 20),
      }),
      // Recalculer le unreadCount après le rehydrate
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.unreadCount = state.notifications.filter((n) => !n.read).length
        }
      },
    }
  )
)

