'use client'

import React, { useMemo, useEffect, useCallback } from 'react'
import { AnimatedCard } from '@/components/animations'
import { useAdminMessageStore } from '@/stores/useAdminMessageStore'
import { useDriversTracking } from '@/hooks/useDriversTracking'
import { adminSocketService } from '@/lib/adminSocketService'
import { adminMessageService } from '@/services/adminMessageService'
import { adminMessageSocketService } from '@/services/adminMessageSocketService'
import { Conversation } from '@/services/adminMessageService'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/authStore'
import { logger } from '@/utils/logger'
import { themeColors } from '@/utils/theme'

export default function QuickMessage() {
  const router = useRouter()
  const { user } = useAuthStore()
  const { conversations, setConversations } = useAdminMessageStore()
  const isSocketConnected = adminSocketService.isConnected()
  const { onlineDrivers } = useDriversTracking(isSocketConnected)

  // Charger les conversations au montage et périodiquement
  const loadConversations = useCallback(async () => {
    if (!user?.id) return

    try {
      const data = await adminMessageService.getConversations()
      setConversations(data)
      
      // Rejoindre automatiquement toutes les conversations pour recevoir les messages en temps réel
      for (const conv of data) {
        adminMessageSocketService.joinConversation(conv.id)
      }
    } catch (error) {
      logger.error('Error loading conversations in QuickMessage:', error)
    }
  }, [user?.id, setConversations])

  // Charger les conversations au montage
  useEffect(() => {
    if (user?.id) {
      // Connecter le socket si pas déjà connecté
      if (!adminSocketService.isConnected()) {
        adminMessageSocketService.connect(user.id)
      }
      
      loadConversations()
    }
  }, [user?.id, loadConversations])

  // Recharger les conversations périodiquement pour détecter les nouveaux messages et changements de statut
  useEffect(() => {
    if (!user?.id) return

    const interval = setInterval(() => {
      loadConversations()
    }, 10000) // Recharger toutes les 10 secondes
    
    return () => clearInterval(interval)
  }, [user?.id, loadConversations])

  // Calculer le nombre total de personnes en ligne parmi les contacts affichés
  // On calcule d'abord les contacts, puis on compte ceux qui sont en ligne
  const contacts = useMemo(() => {
    const contactsMap = new Map<string, {
      id: string
      name: string
      avatar: string
      status: 'online' | 'offline'
      lastSeen: string
      unreadCount: number
      conversationId: string
      isGroup: boolean
      groupKey?: string
    }>()

    const now = new Date()

    conversations.forEach((conv) => {
      if (conv.type === 'order') {
        // Pour les conversations de commande, créer un contact groupé
        const participantIds = [conv.participant_1_id, conv.participant_2_id].sort()
        const groupKey = `order_${participantIds[0]}_${participantIds[1]}`
        
        if (!contactsMap.has(groupKey)) {
          const p1 = conv.participant_1
          const p2 = conv.participant_2
          
          const getName = (p: Conversation['participant_1']) => {
            if (!p) return ''
            const firstName = p.first_name || ''
            const lastName = p.last_name || ''
            if (firstName || lastName) {
              return `${firstName} ${lastName}`.trim()
            }
            return p.email || ''
          }
          
          const name1 = getName(p1)
          const name2 = getName(p2)
          
          let displayName = 'Utilisateur'
          if (name1 && name2) {
            const client = p1?.role === 'client' ? name1 : (p2?.role === 'client' ? name2 : name1)
            const driver = p1?.role === 'driver' ? name1 : (p2?.role === 'driver' ? name2 : name2)
            displayName = `${client} ↔ ${driver}`
          } else {
            displayName = name1 || name2 || 'Utilisateur'
          }
          
          // Déterminer le statut (online si au moins un participant est actif)
          let isOnline = false
          const lastSeenDate = conv.last_message_at ? new Date(conv.last_message_at) : new Date(conv.created_at || now)
          
          // Vérifier si le driver est en ligne
          const driverId = p1?.role === 'driver' ? conv.participant_1_id : (p2?.role === 'driver' ? conv.participant_2_id : null)
          if (driverId) {
            const driver = onlineDrivers.get(driverId)
            if (driver && driver.is_online === true && driver.updated_at) {
              const updatedAt = new Date(driver.updated_at)
              const diffInMinutes = (now.getTime() - updatedAt.getTime()) / (1000 * 60)
              if (diffInMinutes <= 5) {
                isOnline = true
              }
            }
          }
          
          // Vérifier si le client a été actif récemment (a envoyé un message dans les 5 dernières minutes)
          const clientId = p1?.role === 'client' ? conv.participant_1_id : (p2?.role === 'client' ? conv.participant_2_id : null)
          if (clientId && conv.last_message_at && conv.last_message?.sender_id === clientId) {
            const lastMessageAt = new Date(conv.last_message_at)
            const diffInMinutes = (now.getTime() - lastMessageAt.getTime()) / (1000 * 60)
            if (diffInMinutes <= 5) {
              isOnline = true
            }
          }
          
          // Calculer le nombre de messages non lus pour ce groupe
          const groupConversations = conversations.filter((c) => {
            if (c.type !== 'order') return false
            const cIds = [c.participant_1_id, c.participant_2_id].sort()
            return cIds[0] === participantIds[0] && cIds[1] === participantIds[1]
          })
          const totalUnread = groupConversations.reduce((sum, c) => sum + (c.unread_count || 0), 0)
          
          contactsMap.set(groupKey, {
            id: groupKey,
            name: displayName,
            avatar: displayName.charAt(0).toUpperCase(),
            status: isOnline ? 'online' : 'offline',
            lastSeen: lastSeenDate.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' }),
            unreadCount: totalUnread,
            conversationId: conv.id,
            isGroup: true,
            groupKey,
          })
        } else {
          // Mettre à jour le nombre de messages non lus
          const existing = contactsMap.get(groupKey)!
          const groupConversations = conversations.filter((c) => {
            if (c.type !== 'order') return false
            const cIds = [c.participant_1_id, c.participant_2_id].sort()
            return cIds[0] === participantIds[0] && cIds[1] === participantIds[1]
          })
          const totalUnread = groupConversations.reduce((sum, c) => sum + (c.unread_count || 0), 0)
          existing.unreadCount = totalUnread
        }
      } else {
        // Pour support/admin, créer un contact individuel
        const otherParticipant = conv.participant_1_id === user?.id ? conv.participant_2 : conv.participant_1
        
        if (otherParticipant) {
          const firstName = otherParticipant.first_name || ''
          const lastName = otherParticipant.last_name || ''
          const displayName = firstName || lastName 
            ? `${firstName} ${lastName}`.trim() 
            : otherParticipant.email || 'Utilisateur'
          
          // Déterminer le statut
          let isOnline = false
          const lastSeenDate = conv.last_message_at ? new Date(conv.last_message_at) : new Date(conv.created_at || now)
          
          // Pour tous les participants (drivers et clients), vérifier la dernière activité dans cette conversation
          // Un utilisateur est considéré en ligne seulement s'il a envoyé un message dans les 5 dernières minutes
          if (conv.last_message_at && conv.last_message?.sender_id === otherParticipant.id) {
            const lastMessageAt = new Date(conv.last_message_at)
            const diffInMinutes = (now.getTime() - lastMessageAt.getTime()) / (1000 * 60)
            if (diffInMinutes <= 5) {
              isOnline = true
            }
          }
          
          // Pour les drivers, on peut aussi vérifier dans onlineDrivers comme indicateur supplémentaire
          // mais seulement si le driver est vraiment actif (mis à jour dans les 5 dernières minutes)
          if (!isOnline && otherParticipant.role === 'driver') {
            const driver = onlineDrivers.get(otherParticipant.id)
            if (driver && driver.is_online === true && driver.updated_at) {
              const updatedAt = new Date(driver.updated_at)
              const diffInMinutes = (now.getTime() - updatedAt.getTime()) / (1000 * 60)
              if (diffInMinutes <= 5) {
                isOnline = true
              }
            }
          }
          
          contactsMap.set(conv.id, {
            id: conv.id,
            name: displayName,
            avatar: displayName.charAt(0).toUpperCase(),
            status: isOnline ? 'online' : 'offline',
            lastSeen: lastSeenDate.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' }),
            unreadCount: conv.unread_count || 0,
            conversationId: conv.id,
            isGroup: false,
          })
        }
      }
    })

    // Trier par priorité (messages non lus d'abord, puis par dernière activité) et limiter à 2-3 contacts
    const sortedContacts = Array.from(contactsMap.values()).sort((a, b) => {
      // Priorité aux messages non lus
      if (a.unreadCount > 0 && b.unreadCount === 0) return -1
      if (a.unreadCount === 0 && b.unreadCount > 0) return 1
      
      // Ensuite par dernière activité
      const dateA = conversations.find(c => c.id === a.conversationId)?.last_message_at
      const dateB = conversations.find(c => c.id === b.conversationId)?.last_message_at
      if (!dateA && !dateB) return 0
      if (!dateA) return 1
      if (!dateB) return -1
      return new Date(dateB).getTime() - new Date(dateA).getTime()
    })

    // Limiter à 2 contacts maximum pour le dashboard
    return sortedContacts.slice(0, 2)
  }, [conversations, onlineDrivers, user?.id])

  // Calculer le nombre total de personnes en ligne parmi les contacts affichés
  const onlineCount = useMemo(() => {
    return contacts.filter(contact => contact.status === 'online').length
  }, [contacts])


  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleContactClick = (contact: typeof contacts[0]) => {
    // Naviguer vers la page de messages avec la conversation sélectionnée
    router.push('/message')
  }

  const cardStyle: React.CSSProperties = {
    backgroundColor: themeColors.cardBg,
    borderRadius: '16px',
    padding: '16px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    border: `1px solid ${themeColors.cardBorder}`,
    transition: 'background-color 0.3s ease, border-color 0.3s ease',
    flex: 0.8,
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
  }

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '12px',
    flexShrink: 0,
  }

  const titleStyle: React.CSSProperties = {
    fontSize: '18px',
    fontWeight: 700,
    color: themeColors.textPrimary,
  }

  const onlineBadgeStyle: React.CSSProperties = {
    paddingLeft: '12px',
    paddingRight: '12px',
    paddingTop: '4px',
    paddingBottom: '4px',
    backgroundColor: '#D1FAE5',
    color: '#16A34A',
    borderRadius: '8px',
    fontSize: '12px',
    fontWeight: 600,
  }

  const contactsListStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    flex: 1,
    minHeight: 0,
    overflow: 'auto',
  }

  const contactItemStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '12px',
    borderRadius: '12px',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  }

  const avatarContainerStyle: React.CSSProperties = {
    position: 'relative',
    flexShrink: 0,
  }

  const avatarStyle: React.CSSProperties = {
    width: '48px',
    height: '48px',
    backgroundColor: '#9333EA',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#FFFFFF',
    fontWeight: 700,
    fontSize: '14px',
  }

  const onlineIndicatorStyle: React.CSSProperties = {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: '12px',
    height: '12px',
    backgroundColor: '#22C55E',
    borderRadius: '50%',
    border: '2px solid #FFFFFF',
  }

  const contactInfoStyle: React.CSSProperties = {
    flex: 1,
    minWidth: 0,
  }

  const contactHeaderStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '4px',
    gap: '8px',
  }

  const contactNameStyle: React.CSSProperties = {
    fontSize: '14px',
    fontWeight: 600,
    color: themeColors.textPrimary,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }

  const unreadBadgeStyle: React.CSSProperties = {
    paddingLeft: '8px',
    paddingRight: '8px',
    paddingTop: '4px',
    paddingBottom: '4px',
    backgroundColor: '#2563EB',
    color: '#FFFFFF',
    fontSize: '12px',
    fontWeight: 600,
    borderRadius: '4px',
    flexShrink: 0,
  }

  const contactStatusStyle: React.CSSProperties = {
    fontSize: '12px',
    color: themeColors.textSecondary,
  }

  return (
    <AnimatedCard index={0} delay={200} style={cardStyle}>
      <div style={headerStyle}>
        <h2 style={titleStyle}>Quick Message</h2>
        <span style={onlineBadgeStyle}>
          {onlineCount} Online
        </span>
      </div>

      <div style={contactsListStyle}>
        {contacts.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', color: '#6B7280', fontSize: '14px' }}>
            Aucune conversation
          </div>
        ) : (
          contacts.map((contact) => (
          <div
            key={contact.id}
            style={contactItemStyle}
              onClick={() => handleContactClick(contact)}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#F9FAFB'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent'
            }}
          >
            <div style={avatarContainerStyle}>
              <div style={avatarStyle}>
                {contact.avatar}
              </div>
              {contact.status === 'online' && (
                <div style={onlineIndicatorStyle}></div>
              )}
            </div>
            <div style={contactInfoStyle}>
              <div style={contactHeaderStyle}>
                  <p style={contactNameStyle} title={contact.name}>{contact.name}</p>
                  {contact.unreadCount > 0 && (
                  <span style={unreadBadgeStyle}>
                      {contact.unreadCount} new message{contact.unreadCount > 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <p style={contactStatusStyle}>
                {contact.status === 'online' ? 'Online' : 'Offline'} {contact.lastSeen}
              </p>
            </div>
          </div>
          ))
        )}
      </div>
    </AnimatedCard>
  )
}
