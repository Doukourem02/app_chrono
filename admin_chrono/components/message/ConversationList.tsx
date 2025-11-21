'use client'

import React from 'react'
import { Search, User, Truck, Package, MessageSquare, Plus } from 'lucide-react'
import { Conversation } from '@/services/adminMessageService'

interface ConversationListProps {
  conversations: Conversation[]
  groupedConversations?: Array<{ type: 'group' | 'single'; conversations?: Conversation[]; conversation?: Conversation; key: string }>
  selectedConversationId: string | null
  selectedGroupKey?: string | null
  onSelectConversation: (conversationIdOrGroupKey: string) => void
  searchQuery: string
  onSearchChange: (query: string) => void
  filterType?: 'all' | 'order' | 'support' | 'admin'
  onFilterChange?: (type: 'all' | 'order' | 'support' | 'admin') => void
  currentUserId?: string
  onNewConversation?: () => void
}

export default function ConversationList({
  conversations,
  groupedConversations,
  selectedConversationId,
  selectedGroupKey,
  onSelectConversation,
  searchQuery,
  onSearchChange,
  filterType = 'all',
  onFilterChange,
  currentUserId,
  onNewConversation,
}: ConversationListProps) {
  const getParticipantName = (conversation: Conversation): string => {
    if (!currentUserId) return 'Utilisateur'
    
    // Pour les conversations de commande, afficher les deux participants
    if (conversation.type === 'order') {
      const p1 = conversation.participant_1
      const p2 = conversation.participant_2
      
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
      
      if (name1 && name2) {
        // Afficher le client en premier, puis le livreur
        const client = p1?.role === 'client' ? name1 : (p2?.role === 'client' ? name2 : name1)
        const driver = p1?.role === 'driver' ? name1 : (p2?.role === 'driver' ? name2 : name2)
        return `${client} ↔ ${driver}`
      }
      
      return name1 || name2 || 'Utilisateur'
    }
    
    // Pour les autres types, afficher seulement l'autre participant
    const isParticipant1 = conversation.participant_1_id === currentUserId
    const participant = isParticipant1 ? conversation.participant_2 : conversation.participant_1
    
    if (participant) {
      const firstName = participant.first_name || ''
      const lastName = participant.last_name || ''
      if (firstName || lastName) {
        return `${firstName} ${lastName}`.trim()
      }
      return participant.email || 'Utilisateur'
    }
    
    return 'Utilisateur'
  }

  const getConversationIcon = (type: string) => {
    switch (type) {
      case 'order':
        return (
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            backgroundColor: '#F3E8FF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Package size={18} style={{ color: '#7C3AED' }} />
          </div>
        )
      case 'support':
        return (
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            backgroundColor: '#DBEAFE',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <MessageSquare size={18} style={{ color: '#2563EB' }} />
          </div>
        )
      case 'admin':
        return (
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            backgroundColor: '#D1FAE5',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Truck size={18} style={{ color: '#059669' }} />
          </div>
        )
      default:
        return (
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            backgroundColor: '#F3F4F6',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <User size={18} style={{ color: '#6B7280' }} />
          </div>
        )
    }
  }

  const formatTime = (dateString?: string | null): string => {
    if (!dateString) return ''
    const date = new Date(dateString)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    
    if (minutes < 1) return 'À l\'instant'
    if (minutes < 60) return `Il y a ${minutes} min`
    if (minutes < 1440) return `Il y a ${Math.floor(minutes / 60)}h`
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
  }

  // Fonction pour obtenir le nom d'un groupe
  const getGroupName = (groupConversations: Conversation[]): string => {
    if (groupConversations.length === 0) return 'Groupe'
    const firstConv = groupConversations[0]
    return getParticipantName(firstConv)
  }

  // Fonction pour obtenir le dernier message d'un groupe
  const getGroupLastMessage = (groupConversations: Conversation[]): string => {
    const lastMessages = groupConversations
      .map((conv) => ({ content: conv.last_message?.content || '', time: conv.last_message_at ? new Date(conv.last_message_at).getTime() : 0 }))
      .filter((msg) => msg.content)
      .sort((a, b) => b.time - a.time)
    return lastMessages[0]?.content || ''
  }

  // Fonction pour obtenir le dernier message_at d'un groupe
  const getGroupLastMessageAt = (groupConversations: Conversation[]): string | null => {
    const times = groupConversations
      .map((conv) => conv.last_message_at ? new Date(conv.last_message_at).getTime() : 0)
      .filter((time) => time > 0)
      .sort((a, b) => b - a)
    return times[0] ? new Date(times[0]).toISOString() : null
  }

  // Fonction pour obtenir le nombre total de messages non lus d'un groupe
  const getGroupUnreadCount = (groupConversations: Conversation[]): number => {
    return groupConversations.reduce((sum, conv) => sum + (conv.unread_count || 0), 0)
  }

  // Utiliser groupedConversations si disponible, sinon utiliser conversations
  const itemsToDisplay = groupedConversations || conversations.map((conv) => ({ type: 'single' as const, conversation: conv, key: conv.id }))

  const filteredItems = itemsToDisplay.filter((item) => {
    if (item.type === 'group' && item.conversations) {
      const groupName = getGroupName(item.conversations)
      const matchesSearch = searchQuery === '' || groupName.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesFilter = filterType === 'all' || filterType === 'order'
      return matchesSearch && matchesFilter
    } else if (item.type === 'single' && item.conversation) {
      const matchesSearch = searchQuery === '' || 
        getParticipantName(item.conversation).toLowerCase().includes(searchQuery.toLowerCase())
      const matchesFilter = filterType === 'all' || item.conversation.type === filterType
      return matchesSearch && matchesFilter
    }
    return false
  })

  const sortedItems = [...filteredItems].sort((a, b) => {
    let timeA = 0
    let timeB = 0
    
    if (a.type === 'group' && a.conversations) {
      timeA = getGroupLastMessageAt(a.conversations) ? new Date(getGroupLastMessageAt(a.conversations)!).getTime() : 0
    } else if (a.type === 'single' && a.conversation) {
      timeA = a.conversation.last_message_at ? new Date(a.conversation.last_message_at).getTime() : 0
    }
    
    if (b.type === 'group' && b.conversations) {
      timeB = getGroupLastMessageAt(b.conversations) ? new Date(getGroupLastMessageAt(b.conversations)!).getTime() : 0
    } else if (b.type === 'single' && b.conversation) {
      timeB = b.conversation.last_message_at ? new Date(b.conversation.last_message_at).getTime() : 0
    }
    
    return timeB - timeA
  })

  const sidebarStyle: React.CSSProperties = {
    width: '320px',
    backgroundColor: '#FFFFFF',
    borderRadius: '12px',
    padding: '16px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    border: '1px solid #F3F4F6',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  }

  const searchInputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 16px',
    paddingLeft: '40px',
    borderRadius: '8px',
    border: '1px solid #E5E7EB',
    fontSize: '14px',
    outline: 'none',
  }

  const filterContainerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'row',
    gap: '8px',
    flexWrap: 'wrap',
  }

  const filterButtonStyle: (active: boolean) => React.CSSProperties = (active) => ({
    padding: '6px 12px',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: active ? 600 : 400,
    border: '1px solid #E5E7EB',
    backgroundColor: active ? '#8B5CF6' : 'transparent',
    color: active ? '#FFFFFF' : '#6B7280',
    cursor: 'pointer',
  })

  const conversationItemStyle: (selected: boolean) => React.CSSProperties = (selected) => ({
    padding: '12px',
    borderRadius: '8px',
    cursor: 'pointer',
    border: '1px solid #F3F4F6',
    marginBottom: '8px',
    backgroundColor: selected ? '#F3F4F6' : 'transparent',
  })

  return (
    <div style={sidebarStyle}>
      <div style={{ position: 'relative' }}>
        <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#6B7280' }} />
        <input
          type="text"
          placeholder="Rechercher une conversation..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          style={searchInputStyle}
        />
      </div>

      {onFilterChange && (
        <div style={filterContainerStyle}>
          <button
            onClick={() => onFilterChange('all')}
            style={filterButtonStyle(filterType === 'all')}
          >
            Toutes
          </button>
          <button
            onClick={() => onFilterChange('order')}
            style={filterButtonStyle(filterType === 'order')}
          >
            Commandes
          </button>
          <button
            onClick={() => onFilterChange('support')}
            style={filterButtonStyle(filterType === 'support')}
          >
            Support
          </button>
          <button
            onClick={() => onFilterChange('admin')}
            style={filterButtonStyle(filterType === 'admin')}
          >
            Admin
          </button>
        </div>
      )}

      {onNewConversation && (
        <button
          onClick={onNewConversation}
          style={{
            width: '100%',
            padding: '12px',
            borderRadius: '8px',
            backgroundColor: '#8B5CF6',
            color: '#FFFFFF',
            border: 'none',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#7C3AED'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#8B5CF6'
          }}
        >
          <Plus size={18} />
          Nouvelle conversation
        </button>
      )}

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {sortedItems.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', color: '#6B7280', fontSize: '14px' }}>
            Aucune conversation
          </div>
        ) : (
          sortedItems.map((item) => {
            if (item.type === 'group' && item.conversations) {
              const isSelected = selectedGroupKey === item.key
              const participantName = getGroupName(item.conversations)
              const lastMessage = getGroupLastMessage(item.conversations)
              const lastMessageAt = getGroupLastMessageAt(item.conversations)
              const unreadCount = getGroupUnreadCount(item.conversations)
              const conversationCount = item.conversations.length

              return (
                <div
                  key={item.key}
                  style={conversationItemStyle(isSelected)}
                  onClick={() => onSelectConversation(item.key)}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.backgroundColor = '#F9FAFB'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.backgroundColor = 'transparent'
                    }
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-start', gap: '12px' }}>
                    {getConversationIcon('order')}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: '#111827', marginBottom: '4px' }}>
                        {participantName}
                      </div>
                      {conversationCount > 1 && (
                        <div style={{ fontSize: '11px', color: '#9CA3AF', marginBottom: '4px' }}>
                          {conversationCount} conversation{conversationCount > 1 ? 's' : ''}
                        </div>
                      )}
                      {lastMessage && (
                        <div style={{ fontSize: '13px', color: '#6B7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '4px' }}>
                          {lastMessage}
                        </div>
                      )}
                      <div style={{ fontSize: '12px', color: '#9CA3AF' }}>
                        {formatTime(lastMessageAt)}
                      </div>
                    </div>
                    {unreadCount > 0 && (
                      <div
                        style={{
                          backgroundColor: '#EF4444',
                          color: '#FFFFFF',
                          borderRadius: '10px',
                          padding: '2px 6px',
                          fontSize: '11px',
                          fontWeight: 600,
                          minWidth: '18px',
                          textAlign: 'center',
                          height: 'fit-content',
                        }}
                      >
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </div>
                    )}
                  </div>
                </div>
              )
            } else if (item.type === 'single' && item.conversation) {
              const conv = item.conversation
              const isSelected = selectedConversationId === conv.id
              const participantName = getParticipantName(conv)
              const lastMessage = conv.last_message?.content || ''
              const unreadCount = conv.unread_count || 0

              return (
                <div
                  key={conv.id}
                  style={conversationItemStyle(isSelected)}
                  onClick={() => onSelectConversation(conv.id)}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.backgroundColor = '#F9FAFB'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.backgroundColor = 'transparent'
                    }
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-start', gap: '12px' }}>
                    {getConversationIcon(conv.type)}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: '#111827', marginBottom: '4px' }}>
                        {participantName}
                      </div>
                      {conv.type === 'order' && conv.order_id && (
                        <div style={{ fontSize: '11px', color: '#9CA3AF', marginBottom: '4px' }}>
                          Commande #{conv.order_id.slice(0, 8)}
                        </div>
                      )}
                      {lastMessage && (
                        <div style={{ fontSize: '13px', color: '#6B7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '4px' }}>
                          {lastMessage}
                        </div>
                      )}
                      <div style={{ fontSize: '12px', color: '#9CA3AF' }}>
                        {formatTime(conv.last_message_at)}
                      </div>
                    </div>
                    {unreadCount > 0 && (
                      <div
                        style={{
                          backgroundColor: '#EF4444',
                          color: '#FFFFFF',
                          borderRadius: '10px',
                          padding: '2px 6px',
                          fontSize: '11px',
                          fontWeight: 600,
                          minWidth: '18px',
                          textAlign: 'center',
                          height: 'fit-content',
                        }}
                      >
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </div>
                    )}
                  </div>
                </div>
              )
            }
            return null
          })
        )}
      </div>
    </div>
  )
}

