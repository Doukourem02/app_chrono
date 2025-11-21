'use client'

import React, { useState, useEffect } from 'react'
import { X, User, Truck, Search } from 'lucide-react'
import { adminApiService } from '@/lib/adminApiService'
import { adminMessageService } from '@/services/adminMessageService'
import { Conversation } from '@/services/adminMessageService'

interface UserData {
  id: string
  email: string
  phone?: string
  first_name?: string | null
  last_name?: string | null
  role?: string
  avatar_url?: string | null
}

interface NewConversationModalProps {
  isOpen: boolean
  onClose: () => void
  onConversationCreated: (conversation: Conversation) => void
}

export default function NewConversationModal({
  isOpen,
  onClose,
  onConversationCreated,
}: NewConversationModalProps) {
  const [conversationType, setConversationType] = useState<'support' | 'admin'>('support')
  const [users, setUsers] = useState<UserData[]>([])
  const [filteredUsers, setFilteredUsers] = useState<UserData[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isCreating, setIsCreating] = useState(false)

  useEffect(() => {
    if (isOpen) {
      loadUsers()
    }
  }, [isOpen, conversationType])

  useEffect(() => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      setFilteredUsers(
        users.filter(
          (user) =>
            user.email.toLowerCase().includes(query) ||
            (user.first_name && user.first_name.toLowerCase().includes(query)) ||
            (user.last_name && user.last_name.toLowerCase().includes(query)) ||
            ((user.first_name && user.last_name) &&
              `${user.first_name} ${user.last_name}`.toLowerCase().includes(query))
        )
      )
    } else {
      setFilteredUsers(users)
    }
  }, [searchQuery, users])

  const loadUsers = async () => {
    setIsLoading(true)
    try {
      const result = await adminApiService.getUsers()
      if (result.success && result.data) {
        const allUsers = result.data as UserData[]
        const targetRole = conversationType === 'support' ? 'client' : 'driver'
        const filtered = allUsers.filter((user) => user.role === targetRole)
        setUsers(filtered)
        setFilteredUsers(filtered)
      }
    } catch (error) {
      console.error('Error loading users:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateConversation = async (userId: string) => {
    setIsCreating(true)
    try {
      const conversation = await adminMessageService.createConversation(userId, conversationType)
      if (conversation) {
        onConversationCreated(conversation)
        onClose()
        setSearchQuery('')
      } else {
        alert('Impossible de créer la conversation')
      }
    } catch (error) {
      console.error('Error creating conversation:', error)
      alert('Une erreur est survenue lors de la création de la conversation')
    } finally {
      setIsCreating(false)
    }
  }

  const getUserDisplayName = (user: UserData): string => {
    if (user.first_name || user.last_name) {
      return `${user.first_name || ''} ${user.last_name || ''}`.trim()
    }
    return user.email
  }

  if (!isOpen) return null

  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  }

  const modalStyle: React.CSSProperties = {
    backgroundColor: '#FFFFFF',
    borderRadius: '12px',
    width: '90%',
    maxWidth: '500px',
    maxHeight: '80vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)',
  }

  const headerStyle: React.CSSProperties = {
    padding: '20px',
    borderBottom: '1px solid #E5E7EB',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  }

  const titleStyle: React.CSSProperties = {
    fontSize: '20px',
    fontWeight: 600,
    color: '#111827',
  }

  const closeButtonStyle: React.CSSProperties = {
    padding: '8px',
    borderRadius: '8px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  }

  const typeSelectorStyle: React.CSSProperties = {
    display: 'flex',
    gap: '8px',
    padding: '20px',
    borderBottom: '1px solid #E5E7EB',
  }

  const typeButtonStyle: (isActive: boolean) => React.CSSProperties = (isActive) => ({
    flex: 1,
    padding: '12px',
    borderRadius: '8px',
    border: `1px solid ${isActive ? '#8B5CF6' : '#E5E7EB'}`,
    backgroundColor: isActive ? '#F3E8FF' : '#FFFFFF',
    color: isActive ? '#8B5CF6' : '#6B7280',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
  })

  const searchContainerStyle: React.CSSProperties = {
    padding: '20px',
    borderBottom: '1px solid #E5E7EB',
    position: 'relative',
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

  const userListStyle: React.CSSProperties = {
    flex: 1,
    overflowY: 'auto',
    padding: '8px',
  }

  const userItemStyle: React.CSSProperties = {
    padding: '12px',
    borderRadius: '8px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '4px',
  }

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        <div style={headerStyle}>
          <h2 style={titleStyle}>Nouvelle conversation</h2>
          <button
            style={closeButtonStyle}
            onClick={onClose}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#F3F4F6'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent'
            }}
          >
            <X size={20} style={{ color: '#6B7280' }} />
          </button>
        </div>

        <div style={typeSelectorStyle}>
          <button
            style={typeButtonStyle(conversationType === 'support')}
            onClick={() => {
              setConversationType('support')
              setSearchQuery('')
            }}
          >
            <User size={18} />
            Support client
          </button>
          <button
            style={typeButtonStyle(conversationType === 'admin')}
            onClick={() => {
              setConversationType('admin')
              setSearchQuery('')
            }}
          >
            <Truck size={18} />
            Message livreur
          </button>
        </div>

        <div style={searchContainerStyle}>
          <Search
            size={16}
            style={{
              position: 'absolute',
              left: '32px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#6B7280',
            }}
          />
          <input
            type="text"
            placeholder={`Rechercher un ${conversationType === 'support' ? 'client' : 'livreur'}...`}
            style={searchInputStyle}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div style={userListStyle}>
          {isLoading ? (
            <div style={{ padding: '20px', textAlign: 'center', color: '#6B7280' }}>
              Chargement...
            </div>
          ) : filteredUsers.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', color: '#6B7280' }}>
              Aucun {conversationType === 'support' ? 'client' : 'livreur'} trouvé
            </div>
          ) : (
            filteredUsers.map((user) => (
              <div
                key={user.id}
                style={userItemStyle}
                onClick={() => handleCreateConversation(user.id)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#F9FAFB'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent'
                }}
              >
                {user.avatar_url ? (
                  <img
                    src={user.avatar_url}
                    alt={getUserDisplayName(user)}
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      objectFit: 'cover',
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      backgroundColor: '#E5E7EB',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#6B7280',
                      fontSize: '14px',
                      fontWeight: 600,
                    }}
                  >
                    {getUserDisplayName(user)
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .toUpperCase()
                      .slice(0, 2)}
                  </div>
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>
                    {getUserDisplayName(user)}
                  </div>
                  <div style={{ fontSize: '12px', color: '#6B7280' }}>{user.email}</div>
                </div>
                {conversationType === 'support' ? (
                  <User size={20} style={{ color: '#2563EB' }} />
                ) : (
                  <Truck size={20} style={{ color: '#059669' }} />
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

