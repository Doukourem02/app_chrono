import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useNotificationStore, NotificationType } from '@/stores/useNotificationStore'
import { useAdminMessageStore } from '@/stores/useAdminMessageStore'
import { adminSocketService } from '@/lib/adminSocketService'
import { adminMessageSocketService } from '@/services/adminMessageSocketService'
import { soundService } from '@/utils/soundService'

/**
 * Hook pour gérer les notifications en temps réel
 * Écoute les événements Socket.IO et crée des notifications
 */
export function useNotifications() {
  const router = useRouter()
  const { addNotification } = useNotificationStore()
  const { unreadCount: messageUnreadCount } = useAdminMessageStore()

  useEffect(() => {
    // Écouter les nouvelles commandes
    const unsubscribeOrderCreated = adminSocketService.on('order:created', (data: any) => {
      const order = data?.order
      if (!order || !order.id) return

      // Ne pas créer de notification pour les commandes téléphoniques créées par l'admin
      if (order.is_phone_order) return

      const shipmentNumber = order.shipmentNumber || order.shipment_number || order.deliveryId || order.delivery_id
      
      // Créer la notification
      addNotification({
        type: 'order',
        title: 'Nouvelle commande',
        message: `Une nouvelle commande a été créée${shipmentNumber ? ` (${shipmentNumber})` : ''}`,
        link: `/orders?orderId=${order.id}`,
        metadata: {
          orderId: order.id,
          shipmentNumber: shipmentNumber,
        },
      })

      // Jouer le son pour nouvelle commande
      soundService.playNewOrder().catch((err) => {
        if (process.env.NODE_ENV === 'development') {
          console.warn('[useNotifications] Erreur lecture son nouvelle commande:', err)
        }
      })
    })

    // Écouter les mises à jour de statut de commande
    const unsubscribeOrderStatus = adminSocketService.on('order:status:update', (data: any) => {
      const order = data?.order
      if (!order || !order.id) return

      // Ne créer une notification que pour les changements importants
      const importantStatuses = ['completed', 'cancelled', 'declined', 'canceled']
      if (!importantStatuses.includes(order.status?.toLowerCase())) return

      const statusMessages: Record<string, string> = {
        completed: 'Commande livrée',
        cancelled: 'Commande annulée',
        canceled: 'Commande annulée',
        declined: 'Commande refusée',
      }

      const statusMessage = statusMessages[order.status?.toLowerCase()] || 'Statut de commande mis à jour'
      const shipmentNumber = order.shipmentNumber || order.shipment_number || order.deliveryId || order.delivery_id

      // Créer la notification
      addNotification({
        type: 'order',
        title: statusMessage,
        message: `La commande${shipmentNumber ? ` ${shipmentNumber}` : ''} a été ${statusMessage.toLowerCase()}`,
        link: `/orders?orderId=${order.id}`,
        metadata: {
          orderId: order.id,
          status: order.status,
        },
      })

      // Jouer le son pour mise à jour de commande (même son que nouvelle commande)
      soundService.playNewOrder().catch((err) => {
        if (process.env.NODE_ENV === 'development') {
          console.warn('[useNotifications] Erreur lecture son mise à jour commande:', err)
        }
      })
    })

    // Écouter les nouveaux messages
    const unsubscribeNewMessage = adminMessageSocketService.onNewMessage((message, conversation) => {
      // Ne créer une notification que si on n'est pas déjà sur la page Messages
      const currentPath = typeof window !== 'undefined' ? window.location.pathname : ''
      if (currentPath.includes('/message')) return

      // Créer la notification
      addNotification({
        type: 'message',
        title: 'Nouveau message',
        message: conversation.type === 'support' 
          ? 'Nouveau message de support'
          : conversation.type === 'order'
          ? 'Nouveau message concernant une commande'
          : 'Vous avez reçu un nouveau message',
        link: `/message?conversationId=${conversation.id}`,
        metadata: {
          messageId: message.id,
          conversationId: conversation.id,
          conversationType: conversation.type,
        },
      })

      // Jouer le son pour nouveau message
      soundService.playNewMessage().catch((err) => {
        if (process.env.NODE_ENV === 'development') {
          console.warn('[useNotifications] Erreur lecture son nouveau message:', err)
        }
      })
    })

    return () => {
      unsubscribeOrderCreated()
      unsubscribeOrderStatus()
      unsubscribeNewMessage()
    }
  }, [addNotification])

  // Mettre à jour le compteur de notifications non lues pour les messages
  useEffect(() => {
    const { notifications, markAsRead } = useNotificationStore.getState()
    
    // Si tous les messages sont lus, marquer les notifications de messages comme lues aussi
    if (messageUnreadCount === 0) {
      notifications
        .filter((n) => n.type === 'message' && !n.read)
        .forEach((n) => markAsRead(n.id))
    }
  }, [messageUnreadCount])
}

