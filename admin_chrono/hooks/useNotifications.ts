import { useEffect } from 'react'
import { useNotificationStore } from '@/stores/useNotificationStore'
import { useAdminMessageStore } from '@/stores/useAdminMessageStore'
import { adminSocketService } from '@/lib/adminSocketService'
import { adminMessageSocketService } from '@/services/adminMessageSocketService'
import { soundService } from '@/utils/soundService'
import type { SocketEventData } from '@/types/socket'
import { logger } from '@/utils/logger'

/**
 * Hook pour gérer les notifications en temps réel
 * Écoute les événements Socket.IO et crée des notifications.
 * Son prioritaire : livreur assigné (accepted), nouveau message.
 * Pas de son pour les autres mises à jour de statut (livrée, annulée, refusée).
 */
// Extended type for order:status:update that includes additional properties
type OrderStatusUpdateData = SocketEventData['order:status:update'] & {
  order?: SocketEventData['order:status:update']['order'] & {
    shipment_number?: string
    deliveryId?: string
    delivery_id?: string
  }
}

export function useNotifications() {
  const { addNotification } = useNotificationStore()
  const { unreadCount: messageUnreadCount } = useAdminMessageStore()

  useEffect(() => {
    // order:created : aucune alerte — notification + son seulement quand un livreur accepte (accepted).

    // Écouter les mises à jour de statut de commande
    const unsubscribeOrderStatus = adminSocketService.on('order:status:update', (data: unknown) => {
      const orderData = data as OrderStatusUpdateData
      const order = orderData?.order
      if (!order || !order.id) return

      const st = order.status?.toLowerCase() || ''

      // Son prioritaire : un livreur a accepté la course (aligné produit : pas de son à la simple création côté client)
      if (st === 'accepted') {
        addNotification({
          type: 'order',
          title: 'Prise en charge',
          message: `Un livreur a accepté la commande${order.shipmentNumber || order.shipment_number ? ` (${order.shipmentNumber || order.shipment_number})` : ''}`,
          link: `/orders?orderId=${order.id}`,
          metadata: { orderId: order.id, status: order.status },
        })
        soundService.playNewOrder().catch((err) => {
          if (process.env.NODE_ENV === 'development') {
            logger.warn('[useNotifications] Erreur lecture son commande acceptée:', err)
          }
        })
        return
      }

      const importantStatuses = ['completed', 'cancelled', 'declined', 'canceled']
      if (!importantStatuses.includes(st)) return

      const statusConfig: Record<string, { title: string; messageSuffix: string }> = {
        completed: { title: 'Commande livrée', messageSuffix: 'livrée' },
        cancelled: { title: 'Commande annulée', messageSuffix: 'annulée' },
        canceled: { title: 'Commande annulée', messageSuffix: 'annulée' },
        declined: { title: 'Commande refusée', messageSuffix: 'refusée' },
      }

      const config = statusConfig[st] || {
        title: 'Statut de commande mis à jour',
        messageSuffix: 'mise à jour',
      }
      const shipmentNumber = order.shipmentNumber || order.shipment_number || order.deliveryId || order.delivery_id

      addNotification({
        type: 'order',
        title: config.title,
        message: `La commande${shipmentNumber ? ` ${shipmentNumber}` : ''} a été ${config.messageSuffix}`,
        link: `/orders?orderId=${order.id}`,
        metadata: {
          orderId: order.id,
          status: order.status,
        },
      })
    })

    // Écouter les nouveaux messages
    const unsubscribeNewMessage = adminMessageSocketService.onNewMessage((message, conversation) => {
      // Ne créer une notification que si on n'est pas déjà sur la page Messages
      const currentPath = typeof window !== 'undefined' ? window.location.pathname : ''
      if (currentPath.includes('/message')) return

      // Créer la notification + son (prioritaire)
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
          logger.warn('[useNotifications] Erreur lecture son nouveau message:', err)
        }
      })
    })

    return () => {
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
