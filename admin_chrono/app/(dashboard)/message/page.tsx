'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Bell } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { useAdminMessageStore } from '@/stores/useAdminMessageStore'
import { adminMessageService, Conversation, Message } from '@/services/adminMessageService'
import { adminMessageSocketService } from '@/services/adminMessageSocketService'
import ConversationList from '@/components/message/ConversationList'
import ChatArea from '@/components/message/ChatArea'
import NewConversationModal from '@/components/message/NewConversationModal'

export default function MessagePage() {
  const { user } = useAuthStore()
  const {
    conversations,
    currentConversation,
    messages,
    unreadCount,
    loading,
    setConversations,
    setCurrentConversation,
    setMessages,
    addMessage,
    markAsRead,
    setUnreadCount,
    setLoading,
  } = useAdminMessageStore()

  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'order' | 'support' | 'admin'>('all')
  const [selectedParticipantPair, setSelectedParticipantPair] = useState<{ participant1Id: string; participant2Id: string } | null>(null)
  const [isNewConversationModalOpen, setIsNewConversationModalOpen] = useState(false)

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    height: 'calc(100vh - 120px)',
  }

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  }

  const titleStyle: React.CSSProperties = {
    fontSize: '28px',
    fontWeight: 700,
    color: '#111827',
  }

  const mainContainerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'row',
    gap: '16px',
    flex: 1,
    minHeight: 0,
  }


  const loadConversations = useCallback(async () => {
    if (!user?.id) return

    setLoading(true)
    try {
      const data = await adminMessageService.getConversations(filterType === 'all' ? undefined : filterType)
      setConversations(data)
      
      // Rejoindre automatiquement toutes les conversations pour recevoir les messages en temps réel
      // Particulièrement important pour les conversations de support et admin
      for (const conv of data) {
        adminMessageSocketService.joinConversation(conv.id)
      }
    } catch (error) {
      console.error('Error loading conversations:', error)
    } finally {
      setLoading(false)
    }
  }, [user?.id, filterType, setConversations, setLoading])

  const loadMessages = useCallback(async (conversationId: string) => {
    setLoading(true)
    try {
      const data = await adminMessageService.getMessages(conversationId)
      setMessages(conversationId, data)
      await adminMessageService.markAsRead(conversationId)
      markAsRead(conversationId)
    } catch (error) {
      console.error('Error loading messages:', error)
    } finally {
      setLoading(false)
    }
  }, [setMessages, markAsRead, setLoading])

  // Charger tous les messages d'un groupe de conversations (pour les conversations de type "order")
  const loadAllMessagesForPair = useCallback(async (participant1Id: string, participant2Id: string) => {
    setLoading(true)
    try {
      // Trouver toutes les conversations entre ces deux participants
      const pairConversations = conversations.filter((conv) => {
        if (conv.type !== 'order') return false
        const p1Match = conv.participant_1_id === participant1Id || conv.participant_1_id === participant2Id
        const p2Match = conv.participant_2_id === participant1Id || conv.participant_2_id === participant2Id
        return p1Match && p2Match
      })

      // Charger tous les messages de toutes ces conversations
      const allMessages: Array<{ conversationId: string; message: Message }> = []
      for (const conv of pairConversations) {
        const messages = await adminMessageService.getMessages(conv.id)
        allMessages.push(...messages.map((msg) => ({ conversationId: conv.id, message: msg })))
        await adminMessageService.markAsRead(conv.id)
        markAsRead(conv.id)
      }

      // Trier tous les messages par date
      allMessages.sort((a, b) => {
        const dateA = a.message.created_at ? new Date(a.message.created_at).getTime() : 0
        const dateB = b.message.created_at ? new Date(b.message.created_at).getTime() : 0
        return dateA - dateB
      })

      // Stocker les messages dans le store avec une clé spéciale pour le groupe
      const groupKey = `group_${participant1Id}_${participant2Id}`
      setMessages(groupKey, allMessages.map((item) => item.message))
    } catch (error) {
      console.error('Error loading messages for pair:', error)
    } finally {
      setLoading(false)
    }
  }, [conversations, setMessages, markAsRead, setLoading])

  const loadUnreadCount = useCallback(async () => {
    if (!user?.id) return
    try {
      const count = await adminMessageService.getUnreadCount()
      setUnreadCount(count)
    } catch (error) {
      console.error('Error loading unread count:', error)
    }
  }, [user?.id, setUnreadCount])

  // Grouper les conversations par paire de participants (pour type "order")
  const groupedConversations = React.useMemo(() => {
    if (filterType !== 'all' && filterType !== 'order') {
      // Pour support/admin, pas de regroupement
      return conversations.map((conv) => ({ type: 'single' as const, conversation: conv, key: conv.id }))
    }

    const groups = new Map<string, typeof conversations>()
    const singleConversations: typeof conversations = []

    for (const conv of conversations) {
      if (conv.type === 'order') {
        // Créer une clé unique pour la paire de participants (toujours dans le même ordre)
        const participantIds = [conv.participant_1_id, conv.participant_2_id].sort()
        const groupKey = `order_${participantIds[0]}_${participantIds[1]}`
        
        if (!groups.has(groupKey)) {
          groups.set(groupKey, [])
        }
        groups.get(groupKey)!.push(conv)
      } else {
        singleConversations.push(conv)
      }
    }

    // Convertir les groupes en entrées de liste
    const result: Array<{ type: 'group' | 'single'; conversations?: typeof conversations; conversation?: typeof conversations[0]; key: string }> = []
    
    // Ajouter les groupes
    for (const [key, convs] of groups.entries()) {
      result.push({ type: 'group', conversations: convs, key })
    }
    
    // Ajouter les conversations individuelles
    for (const conv of singleConversations) {
      result.push({ type: 'single', conversation: conv, key: conv.id })
    }

    return result
  }, [conversations, filterType])

  const handleSelectConversation = useCallback(async (conversationIdOrGroupKey: string) => {
    // Vérifier si c'est un groupe (commence par "order_")
    if (conversationIdOrGroupKey.startsWith('order_')) {
      const parts = conversationIdOrGroupKey.split('_')
      const p1Id = parts[1]
      const p2Id = parts[2]
      setSelectedParticipantPair({ participant1Id: p1Id, participant2Id: p2Id })
      
      // Trouver la première conversation du groupe pour avoir les infos des participants
      const pairConversations = conversations.filter((conv) => {
        if (conv.type !== 'order') return false
        const p1Match = conv.participant_1_id === p1Id || conv.participant_1_id === p2Id
        const p2Match = conv.participant_2_id === p1Id || conv.participant_2_id === p2Id
        return p1Match && p2Match
      })
      
      // Utiliser la première conversation pour avoir les infos des participants
      if (pairConversations.length > 0) {
        setCurrentConversation(pairConversations[0])
      }
      
      // Rejoindre toutes les conversations du groupe
      for (const conv of pairConversations) {
        adminMessageSocketService.joinConversation(conv.id)
      }
      
      await loadAllMessagesForPair(p1Id, p2Id)
    } else {
      // Conversation normale
      const conversation = conversations.find((c) => c.id === conversationIdOrGroupKey)
      if (conversation) {
        setSelectedParticipantPair(null)
        setCurrentConversation(conversation)
        adminMessageSocketService.joinConversation(conversation.id)
        await loadMessages(conversation.id)
      }
    }
  }, [conversations, setCurrentConversation, loadMessages, loadAllMessagesForPair])

  const handleSendMessage = useCallback(async (content: string) => {
    if (!user?.id) return

    // Si on est dans un groupe, utiliser la conversation la plus récente
    if (selectedParticipantPair) {
      const pairConversations = conversations.filter((conv) => {
        if (conv.type !== 'order') return false
        const p1Match = conv.participant_1_id === selectedParticipantPair.participant1Id || conv.participant_1_id === selectedParticipantPair.participant2Id
        const p2Match = conv.participant_2_id === selectedParticipantPair.participant1Id || conv.participant_2_id === selectedParticipantPair.participant2Id
        return p1Match && p2Match
      })
      
      // Utiliser la conversation la plus récente, ou créer une nouvelle si aucune n'existe
      let targetConversation = pairConversations.sort((a, b) => {
        const dateA = a.last_message_at ? new Date(a.last_message_at).getTime() : 0
        const dateB = b.last_message_at ? new Date(b.last_message_at).getTime() : 0
        return dateB - dateA
      })[0]
      
      if (!targetConversation && pairConversations.length > 0) {
        targetConversation = pairConversations[0]
      }
      
      if (targetConversation) {
        const groupKey = `order_${[selectedParticipantPair.participant1Id, selectedParticipantPair.participant2Id].sort().join('_')}`
        
        // Créer un message optimiste
        const tempMessageId = `temp-${Date.now()}`
        const optimisticMessage: Message = {
          id: tempMessageId,
          conversation_id: targetConversation.id,
          sender_id: user.id,
          content,
          message_type: 'text',
          is_read: false,
          created_at: new Date().toISOString(),
          sender: {
            id: user.id,
            email: user.email || '',
            role: 'admin',
            first_name: user.first_name,
            last_name: user.last_name,
            avatar_url: user.avatar_url,
          },
        }
        
        // Ajouter le message optimiste immédiatement
        const currentMessages = useAdminMessageStore.getState().messages[groupKey] || []
        const updatedMessages = [...currentMessages, optimisticMessage].sort((a, b) => {
          const dateA = a.created_at ? new Date(a.created_at).getTime() : 0
          const dateB = b.created_at ? new Date(b.created_at).getTime() : 0
          return dateA - dateB
        })
        setMessages(groupKey, updatedMessages)
        
        try {
          // Envoyer via l'API REST (le socket diffusera automatiquement)
          const sentMessage = await adminMessageService.sendMessage(targetConversation.id, content)
          
          if (sentMessage) {
            // Remplacer le message optimiste par le vrai message
            const finalMessages = useAdminMessageStore.getState().messages[groupKey] || []
            const finalUpdatedMessages = finalMessages.map((m) =>
              m.id === tempMessageId ? sentMessage : m
            )
            setMessages(groupKey, finalUpdatedMessages)
          }
        } catch (error) {
          // Retirer le message optimiste en cas d'erreur
          const finalMessages = useAdminMessageStore.getState().messages[groupKey] || []
          const finalUpdatedMessages = finalMessages.filter((m) => m.id !== tempMessageId)
          setMessages(groupKey, finalUpdatedMessages)
          throw error
        }
      }
    } else if (currentConversation) {
      // Créer un message optimiste
      const tempMessageId = `temp-${Date.now()}`
      const optimisticMessage: Message = {
        id: tempMessageId,
        conversation_id: currentConversation.id,
        sender_id: user.id,
        content,
        message_type: 'text',
        is_read: false,
        created_at: new Date().toISOString(),
        sender: {
          id: user.id,
          email: user.email || '',
          role: 'admin',
          first_name: user.first_name,
          last_name: user.last_name,
          avatar_url: user.avatar_url,
        },
      }
      
      // Ajouter le message optimiste immédiatement
      addMessage(currentConversation.id, optimisticMessage)
      
      try {
        // Envoyer via l'API REST (le socket diffusera automatiquement)
        const sentMessage = await adminMessageService.sendMessage(currentConversation.id, content)
        
        if (sentMessage) {
          // Remplacer le message optimiste par le vrai message
          const existingMessages = messages[currentConversation.id] || []
          const updatedMessages = existingMessages.map((m) =>
            m.id === tempMessageId ? sentMessage : m
          )
          setMessages(currentConversation.id, updatedMessages)
        }
      } catch (error) {
        // Retirer le message optimiste en cas d'erreur
        const existingMessages = messages[currentConversation.id] || []
        const updatedMessages = existingMessages.filter((m) => m.id !== tempMessageId)
        setMessages(currentConversation.id, updatedMessages)
        throw error
      }
    }
  }, [currentConversation, selectedParticipantPair, conversations, setMessages, addMessage, messages, user])

  useEffect(() => {
    if (!user?.id) return

    adminMessageSocketService.connect(user.id)
    loadConversations()
    loadUnreadCount()

    const unsubscribe = adminMessageSocketService.onNewMessage((message, conversation) => {
      const state = useAdminMessageStore.getState()
      
      // Si c'est notre propre message, vérifier s'il y a un message optimiste à remplacer
      if (message.sender_id === user?.id) {
        // Vérifier dans la conversation actuelle
        const currentConv = state.currentConversation
        if (currentConv && conversation.id === currentConv.id) {
          const existingMessages = state.messages[conversation.id] || []
          const tempMessageIndex = existingMessages.findIndex((m) => 
            m.id.startsWith('temp-') && 
            m.content === message.content &&
            m.sender_id === message.sender_id
          )
          
          if (tempMessageIndex !== -1) {
            // Remplacer le message optimiste par le vrai message
            const updatedMessages = [...existingMessages]
            updatedMessages[tempMessageIndex] = message
            setMessages(conversation.id, updatedMessages)
          } else {
            // Ajouter normalement si pas de message optimiste correspondant
            addMessage(conversation.id, message)
          }
        } else {
          // Ajouter normalement si ce n'est pas la conversation actuelle
          addMessage(conversation.id, message)
        }
        
        // Vérifier dans les groupes
        if (conversation.type === 'order') {
          const participantIds = [conversation.participant_1_id, conversation.participant_2_id].sort()
          const groupKey = `order_${participantIds[0]}_${participantIds[1]}`
          const groupMessages = state.messages[groupKey]
          if (groupMessages) {
            const tempMessageIndex = groupMessages.findIndex((m) => 
              m.id.startsWith('temp-') && 
              m.content === message.content &&
              m.sender_id === message.sender_id
            )
            
            if (tempMessageIndex !== -1) {
              // Remplacer le message optimiste par le vrai message
              const updatedMessages = [...groupMessages]
              updatedMessages[tempMessageIndex] = message
              setMessages(groupKey, updatedMessages)
            } else if (!groupMessages.some((m) => m.id === message.id)) {
              // Ajouter normalement si pas de message optimiste et pas déjà présent
              const updatedMessages = [...groupMessages, message].sort((a, b) => {
                const dateA = a.created_at ? new Date(a.created_at).getTime() : 0
                const dateB = b.created_at ? new Date(b.created_at).getTime() : 0
                return dateA - dateB
              })
              setMessages(groupKey, updatedMessages)
            }
          }
        }
      } else {
        // Message d'un autre utilisateur, ajouter normalement
        addMessage(conversation.id, message)
        
        // Si on est dans un groupe et que ce message appartient au groupe, l'ajouter aussi au groupe
        if (conversation.type === 'order') {
          const participantIds = [conversation.participant_1_id, conversation.participant_2_id].sort()
          const groupKey = `order_${participantIds[0]}_${participantIds[1]}`
          const groupMessages = state.messages[groupKey]
          if (groupMessages) {
            if (!groupMessages.some((m) => m.id === message.id)) {
              const updatedMessages = [...groupMessages, message].sort((a, b) => {
                const dateA = a.created_at ? new Date(a.created_at).getTime() : 0
                const dateB = b.created_at ? new Date(b.created_at).getTime() : 0
                return dateA - dateB
              })
              setMessages(groupKey, updatedMessages)
            }
          }
        }
      }
      
      const currentConv = state.currentConversation
      if (conversation.id === currentConv?.id) {
        adminMessageService.markAsRead(conversation.id)
        markAsRead(conversation.id)
      }
      loadUnreadCount()
    })

    return () => {
      unsubscribe()
      const currentConv = useAdminMessageStore.getState().currentConversation
      if (currentConv) {
        adminMessageSocketService.leaveConversation(currentConv.id)
      }
      adminMessageSocketService.disconnect()
    }
  }, [user?.id, loadConversations, loadUnreadCount, addMessage, markAsRead, setMessages])

  useEffect(() => {
    loadConversations()
    
    // Recharger les conversations périodiquement pour détecter les nouvelles conversations de support
    const interval = setInterval(() => {
      loadConversations()
    }, 5000) // Recharger toutes les 5 secondes pour détecter rapidement les nouvelles conversations
    
    return () => clearInterval(interval)
  }, [loadConversations])

  // Rejoindre automatiquement les nouvelles conversations quand elles sont ajoutées
  useEffect(() => {
    if (conversations.length > 0) {
      for (const conv of conversations) {
        adminMessageSocketService.joinConversation(conv.id)
      }
    }
  }, [conversations])

  const handleNewConversationCreated = useCallback(async (conversation: Conversation) => {
    setCurrentConversation(conversation)
    setSelectedParticipantPair(null)
    await loadMessages(conversation.id)
    adminMessageSocketService.joinConversation(conversation.id)
    await loadConversations()
  }, [setCurrentConversation, loadMessages, loadConversations])

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <h1 style={titleStyle}>Messages</h1>
        <div style={{ display: 'flex', flexDirection: 'row', gap: '12px', alignItems: 'center' }}>
          <div
            style={{
              padding: '8px',
              borderRadius: '8px',
              backgroundColor: '#F3F4F6',
              cursor: 'pointer',
              position: 'relative',
            }}
          >
            <Bell size={20} style={{ color: '#6B7280' }} />
            {unreadCount > 0 && (
              <div
                style={{
                  position: 'absolute',
                  top: '4px',
                  right: '4px',
                  minWidth: '18px',
                  height: '18px',
                  borderRadius: '9px',
                  backgroundColor: '#EF4444',
                  color: '#FFFFFF',
                  fontSize: '11px',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0 6px',
                }}
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={mainContainerStyle}>
        <ConversationList
          conversations={conversations}
          groupedConversations={groupedConversations}
          selectedConversationId={currentConversation?.id || null}
          selectedGroupKey={selectedParticipantPair ? `order_${[selectedParticipantPair.participant1Id, selectedParticipantPair.participant2Id].sort().join('_')}` : null}
          onSelectConversation={handleSelectConversation}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          filterType={filterType}
          onFilterChange={setFilterType}
          currentUserId={user?.id}
          onNewConversation={() => setIsNewConversationModalOpen(true)}
        />

        <ChatArea
          conversation={currentConversation}
          participantPair={selectedParticipantPair}
          messages={
            selectedParticipantPair
              ? messages[`group_${selectedParticipantPair.participant1Id}_${selectedParticipantPair.participant2Id}`] || []
              : currentConversation
              ? messages[currentConversation.id] || []
              : []
          }
          onSendMessage={handleSendMessage}
          isLoading={loading}
          currentUserId={user?.id}
        />
      </div>

      <NewConversationModal
        isOpen={isNewConversationModalOpen}
        onClose={() => setIsNewConversationModalOpen(false)}
        onConversationCreated={handleNewConversationCreated}
      />
    </div>
  )
}
