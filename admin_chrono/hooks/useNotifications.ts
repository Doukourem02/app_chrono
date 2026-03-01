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
 * Son uniquement pour les événements prioritaires (Nouvelle commande, Nouveau message).
 * Pas de son pour les mises à jour de statut (livrée, annulée, refusée) pour éviter
 * une avalanche de sons (ex: 100 commandes × 4 types = trop de bruits).
 */
// Type for order:created event (similar structure to order:status:update)
type OrderCreatedData = {
  order?: {
    id?: string
    is_phone_order?: boolean
    is_b2b_order?: boolean
    shipmentNumber?: string
    shipment_number?: string
    deliveryId?: string
    delivery_id?: string
    [key: string]: unknown
  }
  [key: string]: unknown
}

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
    // Écouter les nouvelles commandes
    const unsubscribeOrderCreated = adminSocketService.on('order:created', (data: unknown) => {
      const orderData = data as OrderCreatedData
      const order = orderData?.order
      if (!order || !order.id) return

      // Ne pas créer de notification pour les commandes téléphoniques normales (hors-ligne)
      // Mais permettre les notifications pour les commandes B2B
      const isB2BOrder = order.is_b2b_order === true
      if (order.is_phone_order && !isB2BOrder) return

      const shipmentNumber = order.shipmentNumber || order.shipment_number || order.deliveryId || order.delivery_id
      
      // Créer la notification + son (prioritaire : action requise)
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
      soundService.playNewOrder().catch((err) => {
        if (process.env.NODE_ENV === 'development') {
          logger.warn('[useNotifications] Erreur lecture son nouvelle commande:', err)
        }
      })
    })

    // Écouter les mises à jour de statut de commande
    const unsubscribeOrderStatus = adminSocketService.on('order:status:update', (data: unknown) => {
      const orderData = data as OrderStatusUpdateData
      const order = orderData?.order
      if (!order || !order.id) return

      // Ne créer une notification que pour les changements importants
      const importantStatuses = ['completed', 'cancelled', 'declined', 'canceled']
      if (!importantStatuses.includes(order.status?.toLowerCase())) return

      const statusConfig: Record<string, { title: string; messageSuffix: string }> = {
        completed: { title: 'Commande livrée', messageSuffix: 'livrée' },
        cancelled: { title: 'Commande annulée', messageSuffix: 'annulée' },
        canceled: { title: 'Commande annulée', messageSuffix: 'annulée' },
        declined: { title: 'Commande refusée', messageSuffix: 'refusée' },
      }

      const config = statusConfig[order.status?.toLowerCase()] || {
        title: 'Statut de commande mis à jour',
        messageSuffix: 'mise à jour',
      }
      const shipmentNumber = order.shipmentNumber || order.shipment_number || order.deliveryId || order.delivery_id

      // Notification uniquement (pas de son pour livrée/annulée/refusée - trop fréquent)
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

