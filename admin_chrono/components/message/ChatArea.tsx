'use client'

import React, { useEffect, useRef, useState } from 'react'
import { Send } from 'lucide-react'
import { Conversation, Message } from '@/services/adminMessageService'

interface ChatAreaProps {
  conversation: Conversation | null
  participantPair?: { participant1Id: string; participant2Id: string } | null
  messages: Message[]
  onSendMessage: (content: string) => void
  isLoading?: boolean
  currentUserId?: string
}

export default function ChatArea({
  conversation,
  participantPair,
  messages,
  onSendMessage,
  isLoading = false,
  currentUserId,
}: ChatAreaProps) {
  const [messageText, setMessageText] = useState('')
  const [isSending, setIsSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const handleSend = async () => {
    if (!messageText.trim() || isSending || !conversation) return

    const content = messageText.trim()
    setMessageText('')
    setIsSending(true)

    try {
      await onSendMessage(content)
    } catch {
      setMessageText(content)
    } finally {
      setIsSending(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const getParticipantName = (): string => {
    if (participantPair && conversation) {
      // Pour un groupe, afficher les deux participants
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
        const client = p1?.role === 'client' ? name1 : (p2?.role === 'client' ? name2 : name1)
        const driver = p1?.role === 'driver' ? name1 : (p2?.role === 'driver' ? name2 : name2)
        return `${client} ↔ ${driver}`
      }
      
      return name1 || name2 || 'Utilisateur'
    }
    
    if (!conversation || !currentUserId) return ''
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

  const formatMessageTime = (dateString?: string | null): string => {
    if (!dateString) return ''
    const date = new Date(dateString)
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  }

  const isMessageFromCurrentUser = (message: Message): boolean => {
    if (!currentUserId) return false
    return message.sender_id === currentUserId
  }

  const chatAreaStyle: React.CSSProperties = {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: '12px',
    padding: '24px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    border: '1px solid #F3F4F6',
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
  }

  const headerStyle: React.CSSProperties = {
    paddingBottom: '12px',
    borderBottom: '1px solid #E5E7EB',
    marginBottom: '16px',
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  }

  const headerTitleStyle: React.CSSProperties = {
    fontSize: '18px',
    fontWeight: 600,
    color: '#111827',
  }

  const headerSubtitleStyle: React.CSSProperties = {
    fontSize: '12px',
    color: '#9CA3AF',
    marginTop: '2px',
  }

  const messagesContainerStyle: React.CSSProperties = {
    flex: 1,
    overflowY: 'auto',
    marginBottom: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  }

  const messageBubbleStyle: (isFromCurrentUser: boolean) => React.CSSProperties = (isFromCurrentUser) => ({
    padding: '10px 14px',
    borderRadius: '12px',
    maxWidth: '75%',
    alignSelf: isFromCurrentUser ? 'flex-end' : 'flex-start',
    backgroundColor: isFromCurrentUser ? '#8B5CF6' : '#F3F4F6',
    marginBottom: '4px',
  })

  const messageTextStyle: (isFromCurrentUser: boolean) => React.CSSProperties = (isFromCurrentUser) => ({
    fontSize: '14px',
    color: isFromCurrentUser ? '#FFFFFF' : '#111827',
    wordBreak: 'break-word',
  })

  const messageTimeStyle: (isFromCurrentUser: boolean) => React.CSSProperties = (isFromCurrentUser) => ({
    fontSize: '12px',
    color: isFromCurrentUser ? 'rgba(255,255,255,0.8)' : '#6B7280',
    marginTop: '4px',
  })

  const messageInputContainerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'row',
    gap: '12px',
    paddingTop: '16px',
    borderTop: '1px solid #E5E7EB',
  }

  const messageInputStyle: React.CSSProperties = {
    flex: 1,
    padding: '12px 16px',
    borderRadius: '8px',
    border: '1px solid #E5E7EB',
    fontSize: '14px',
    outline: 'none',
    resize: 'none',
    fontFamily: 'inherit',
  }

  const sendButtonStyle: React.CSSProperties = {
    padding: '12px 24px',
    borderRadius: '8px',
    backgroundColor: '#8B5CF6',
    color: '#FFFFFF',
    border: 'none',
    fontSize: '14px',
    fontWeight: 600,
    cursor: isSending ? 'not-allowed' : 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    opacity: isSending ? 0.6 : 1,
  }

  const emptyStateStyle: React.CSSProperties = {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#6B7280',
  }

  if (!conversation && !participantPair) {
    return (
      <div style={chatAreaStyle}>
        <div style={emptyStateStyle}>
          <p style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>
            Aucune conversation sélectionnée
          </p>
          <p style={{ fontSize: '14px' }}>
            Sélectionnez une conversation pour commencer à discuter
          </p>
        </div>
      </div>
    )
  }

  const getConversationTypeLabel = (): string => {
    if (participantPair) {
      return 'Toutes les conversations'
    }
    if (!conversation) return ''
    switch (conversation.type) {
      case 'order':
        return 'Commande'
      case 'support':
        return 'Support'
      case 'admin':
        return 'Livreur'
      default:
        return ''
    }
  }

  if (!conversation && !participantPair) {
    return (
      <div style={chatAreaStyle}>
        <div style={emptyStateStyle}>
          <p style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>
            Aucune conversation sélectionnée
          </p>
          <p style={{ fontSize: '14px' }}>
            Sélectionnez une conversation pour commencer à discuter
          </p>
        </div>
      </div>
    )
  }

  return (
    <div style={chatAreaStyle}>
      <div style={headerStyle}>
        <div>
          <div style={headerTitleStyle}>{getParticipantName()}</div>
          <div style={headerSubtitleStyle}>{getConversationTypeLabel()}</div>
        </div>
      </div>

      <div style={messagesContainerStyle}>
        {isLoading && messages.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#6B7280', padding: '20px' }}>
            Chargement des messages...
          </div>
        ) : messages.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#6B7280', padding: '20px' }}>
            Aucun message. Commencez la conversation !
          </div>
        ) : (
          messages.map((message, index) => {
            const isFromCurrentUser = isMessageFromCurrentUser(message)
            const senderName = message.sender 
              ? `${message.sender.first_name || ''} ${message.sender.last_name || ''}`.trim() || message.sender.email
              : 'Utilisateur'
            
            // Afficher le nom seulement si c'est le premier message ou si l'expéditeur a changé
            const prevMessage = index > 0 ? messages[index - 1] : null
            const showSenderName = !isFromCurrentUser && (
              !prevMessage || 
              prevMessage.sender_id !== message.sender_id || 
              isMessageFromCurrentUser(prevMessage)
            )
            
            return (
              <div key={message.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isFromCurrentUser ? 'flex-end' : 'flex-start' }}>
                {showSenderName && (
                  <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '4px', marginLeft: '4px', fontWeight: 500 }}>
                    {senderName}
                  </div>
                )}
                <div style={messageBubbleStyle(isFromCurrentUser)}>
                  <div style={messageTextStyle(isFromCurrentUser)}>{message.content}</div>
                  <div style={messageTimeStyle(isFromCurrentUser)}>
                    {formatMessageTime(message.created_at)}
                    {isFromCurrentUser && message.is_read && (
                      <span style={{ marginLeft: '8px' }}>✓✓</span>
                    )}
                  </div>
                </div>
              </div>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      <div style={messageInputContainerStyle}>
        <textarea
          value={messageText}
          onChange={(e) => setMessageText(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Tapez votre message..."
          rows={3}
          style={messageInputStyle}
          disabled={isSending}
        />
        <button
          onClick={handleSend}
          disabled={isSending || !messageText.trim()}
          style={sendButtonStyle}
          onMouseEnter={(e) => {
            if (!isSending && messageText.trim()) {
              e.currentTarget.style.backgroundColor = '#7C3AED'
            }
          }}
          onMouseLeave={(e) => {
            if (!isSending) {
              e.currentTarget.style.backgroundColor = '#8B5CF6'
            }
          }}
        >
          <Send size={16} />
          Envoyer
        </button>
      </div>
    </div>
  )
}

