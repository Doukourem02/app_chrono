'use client'

import React, { useState } from 'react'
import { MessageSquare, Send, Search, User, Truck, Bell } from 'lucide-react'

export default function MessagePage() {
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null)
  const [message, setMessage] = useState('')

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

  const searchInputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 16px',
    paddingLeft: '40px',
    borderRadius: '8px',
    border: '1px solid #E5E7EB',
    fontSize: '14px',
    outline: 'none',
  }

  const conversationItemStyle: React.CSSProperties = {
    padding: '12px',
    borderRadius: '8px',
    cursor: 'pointer',
    border: '1px solid #F3F4F6',
    marginBottom: '8px',
  }

  const emptyStateStyle: React.CSSProperties = {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#6B7280',
  }

  const messageInputContainerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'row',
    gap: '12px',
    paddingTop: '16px',
    borderTop: '1px solid #E5E7EB',
    marginTop: 'auto',
  }

  const messageInputStyle: React.CSSProperties = {
    flex: 1,
    padding: '12px 16px',
    borderRadius: '8px',
    border: '1px solid #E5E7EB',
    fontSize: '14px',
    outline: 'none',
    resize: 'none',
  }

  const sendButtonStyle: React.CSSProperties = {
    padding: '12px 24px',
    borderRadius: '8px',
    backgroundColor: '#8B5CF6',
    color: '#FFFFFF',
    border: 'none',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  }

  // Mock conversations
  const conversations = [
    { id: '1', name: 'Client - John Doe', type: 'client', lastMessage: 'Merci pour la livraison!', time: '10:30' },
    { id: '2', name: 'Driver - Marie K.', type: 'driver', lastMessage: 'Livraison complétée', time: '09:15' },
    { id: '3', name: 'Client - Sarah M.', type: 'client', lastMessage: 'Où est ma commande?', time: '08:45' },
  ]

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
            <div
              style={{
                position: 'absolute',
                top: '4px',
                right: '4px',
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: '#EF4444',
              }}
            />
          </div>
        </div>
      </div>

      <div style={mainContainerStyle}>
        {/* Sidebar - Liste des conversations */}
        <div style={sidebarStyle}>
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#6B7280' }} />
            <input
              type="text"
              placeholder="Rechercher une conversation..."
              style={searchInputStyle}
            />
          </div>

          <div style={{ flex: 1, overflowY: 'auto' }}>
            {conversations.map((conv) => (
              <div
                key={conv.id}
                style={{
                  ...conversationItemStyle,
                  backgroundColor: selectedConversation === conv.id ? '#F3F4F6' : 'transparent',
                }}
                onClick={() => setSelectedConversation(conv.id)}
                onMouseEnter={(e) => {
                  if (selectedConversation !== conv.id) {
                    e.currentTarget.style.backgroundColor = '#F9FAFB'
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedConversation !== conv.id) {
                    e.currentTarget.style.backgroundColor = 'transparent'
                  }
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                  {conv.type === 'client' ? (
                    <User size={20} style={{ color: '#2563EB' }} />
                  ) : (
                    <Truck size={20} style={{ color: '#059669' }} />
                  )}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>{conv.name}</div>
                    <div style={{ fontSize: '12px', color: '#6B7280' }}>{conv.time}</div>
                  </div>
                </div>
                <div style={{ fontSize: '13px', color: '#6B7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {conv.lastMessage}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Zone de chat */}
        <div style={chatAreaStyle}>
          {selectedConversation ? (
            <>
              <div style={{ flex: 1, overflowY: 'auto', marginBottom: '16px' }}>
                {/* Messages */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ padding: '12px 16px', borderRadius: '12px', backgroundColor: '#F3F4F6', maxWidth: '70%', alignSelf: 'flex-start' }}>
                    <div style={{ fontSize: '14px', color: '#111827' }}>Bonjour, j'ai une question sur ma commande.</div>
                    <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '4px' }}>10:30</div>
                  </div>
                  <div style={{ padding: '12px 16px', borderRadius: '12px', backgroundColor: '#8B5CF6', maxWidth: '70%', alignSelf: 'flex-end' }}>
                    <div style={{ fontSize: '14px', color: '#FFFFFF' }}>Bonjour, comment puis-je vous aider?</div>
                    <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.8)', marginTop: '4px' }}>10:32</div>
                  </div>
                </div>
              </div>

              <div style={messageInputContainerStyle}>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Tapez votre message..."
                  rows={3}
                  style={messageInputStyle}
                />
                <button
                  onClick={() => {
                    // TODO: Envoyer le message
                    setMessage('')
                  }}
                  style={sendButtonStyle}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#7C3AED'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#8B5CF6'
                  }}
                >
                  <Send size={16} />
                  Envoyer
                </button>
              </div>
            </>
          ) : (
            <div style={emptyStateStyle}>
              <MessageSquare size={64} style={{ color: '#D1D5DB', marginBottom: '16px' }} />
              <p style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>Aucune conversation sélectionnée</p>
              <p style={{ fontSize: '14px' }}>Sélectionnez une conversation pour commencer à discuter</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
