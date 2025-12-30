'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { adminApiService } from '@/lib/adminApiService'
import { CheckCircle, XCircle, Search, MessageSquare } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { useAdminMessageStore } from '@/stores/useAdminMessageStore'
import { adminMessageService, Message } from '@/services/adminMessageService'
import { adminMessageSocketService } from '@/services/adminMessageSocketService'
import ConversationList from '@/components/message/ConversationList'
import ChatArea from '@/components/message/ChatArea'

interface Dispute {
  id: string
  dispute_type?: string
  user_email?: string
  user_phone?: string
  transaction_id?: string
  order_id_full?: string
  amount?: string | number
  status?: string
  created_at?: string
  description?: string
  admin_notes?: string
  reason?: string
}

type TabType = 'disputes' | 'support-messages'

export default function DisputesPage() {
  const { user } = useAuthStore()
  const [activeTab, setActiveTab] = useState<TabType>('disputes')
  
  // État pour les disputes
  const [currentPage, setCurrentPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedDispute, setSelectedDispute] = useState<Dispute | null>(null)
  const [adminNotes, setAdminNotes] = useState('')
  const itemsPerPage = 20
  const queryClient = useQueryClient()

  // État pour les messages de support
  const {
    conversations: supportConversations,
    currentConversation,
    messages,
    unreadCount,
    loading: messagesLoading,
    setConversations,
    setCurrentConversation,
    setMessages,
    addMessage,
    markAsRead,
    updateConversationUnreadCount,
    setUnreadCount,
    setLoading,
  } = useAdminMessageStore()

  const [supportSearchQuery, setSupportSearchQuery] = useState('')
  const isLoadingConversationsRef = useRef(false)
  const lastLoadTimeRef = useRef<number>(0)

  const { data: disputesData, isLoading } = useQuery({
    queryKey: ['disputes', currentPage, statusFilter],
    queryFn: () =>
      adminApiService.getDisputes({
        page: currentPage,
        limit: itemsPerPage,
        status: statusFilter !== 'all' ? statusFilter : undefined,
      }),
    refetchInterval: false, 
    staleTime: Infinity, 
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  })

  const updateMutation = useMutation({
    mutationFn: async ({ disputeId, status, notes }: { disputeId: string; status: string; notes?: string }) => {
      return await adminApiService.updateDispute(disputeId, { status, adminNotes: notes })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['disputes'] })
      setSelectedDispute(null)
      setAdminNotes('')
    },
  })

  const disputes: Dispute[] = (disputesData?.data as Dispute[]) || []
  const pagination = disputesData?.pagination

  const formatCurrency = (amount: number) => {
    return `${amount.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} FCFA`
  }

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return 'N/A'
    const date = new Date(dateString)
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getDisputeTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      refund_request: 'Demande de remboursement',
      payment_issue: 'Problème de paiement',
      service_issue: 'Problème de service',
      other: 'Autre',
    }
    return labels[type] || type
  }

  const getStatusBadgeStyle = (status: string): React.CSSProperties => {
    const baseStyle: React.CSSProperties = {
      padding: '4px 12px',
      borderRadius: '12px',
      fontSize: '12px',
      fontWeight: 600,
    }

    switch (status) {
      case 'resolved':
        return { ...baseStyle, backgroundColor: '#D1FAE5', color: '#065F46' }
      case 'pending':
        return { ...baseStyle, backgroundColor: '#FEF3C7', color: '#92400E' }
      case 'rejected':
        return { ...baseStyle, backgroundColor: '#FEE2E2', color: '#991B1B' }
      default:
        return { ...baseStyle, backgroundColor: '#F3F4F6', color: '#374151' }
    }
  }

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      resolved: 'Résolu',
      pending: 'En attente',
      rejected: 'Rejeté',
    }
    return labels[status] || status
  }

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
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

  const filtersStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'row',
    gap: '12px',
    marginBottom: '16px',
  }

  const inputStyle: React.CSSProperties = {
    padding: '10px 16px',
    borderRadius: '8px',
    border: '1px solid #E5E7EB',
    fontSize: '14px',
    flex: 1,
    minWidth: '200px',
  }

  const selectStyle: React.CSSProperties = {
    padding: '10px 16px',
    borderRadius: '8px',
    border: '1px solid #E5E7EB',
    fontSize: '14px',
    backgroundColor: '#FFFFFF',
    cursor: 'pointer',
  }

  const cardStyle: React.CSSProperties = {
    backgroundColor: '#FFFFFF',
    borderRadius: '12px',
    padding: '24px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    border: '1px solid #F3F4F6',
  }

  const tableStyle: React.CSSProperties = {
    width: '100%',
    borderCollapse: 'collapse',
  }

  const thStyle: React.CSSProperties = {
    padding: '12px',
    textAlign: 'left',
    fontSize: '12px',
    fontWeight: 600,
    color: '#6B7280',
    textTransform: 'uppercase',
    borderBottom: '1px solid #E5E7EB',
  }

  const tdStyle: React.CSSProperties = {
    padding: '12px',
    fontSize: '14px',
    color: '#111827',
    borderBottom: '1px solid #F3F4F6',
  }

  const modalOverlayStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  }

  const modalStyle: React.CSSProperties = {
    backgroundColor: '#FFFFFF',
    borderRadius: '12px',
    padding: '24px',
    width: '90%',
    maxWidth: '600px',
    maxHeight: '90vh',
    overflowY: 'auto',
  }

  // Charger les conversations de support
  const loadSupportConversations = useCallback(async () => {
    if (!user?.id) return

    const now = Date.now()
    const timeSinceLastLoad = now - lastLoadTimeRef.current
    
    if (isLoadingConversationsRef.current) return
    if (timeSinceLastLoad < 2000 && timeSinceLastLoad > 0) return

    isLoadingConversationsRef.current = true
    lastLoadTimeRef.current = now
    setLoading(true)
    
    try {
      const data = await adminMessageService.getConversations('support')
      setConversations(data)
      
      for (const conv of data) {
        adminMessageSocketService.joinConversation(conv.id)
      }
    } catch (error) {
      console.error('Error loading support conversations:', error)
    } finally {
      setLoading(false)
      isLoadingConversationsRef.current = false
    }
  }, [user?.id, setConversations, setLoading])

  const loadSupportMessages = useCallback(async (conversationId: string) => {
    setLoading(true)
    try {
      const data = await adminMessageService.getMessages(conversationId)
      setMessages(conversationId, data)
      await adminMessageService.markAsRead(conversationId)
      markAsRead(conversationId, user?.id)
      updateConversationUnreadCount(conversationId, 0)
      
      await new Promise(resolve => setTimeout(resolve, 100))
      
      await Promise.all([
        adminMessageService.getUnreadCount().then(setUnreadCount),
        adminMessageService.getConversations('support').then(setConversations)
      ])
    } catch (error) {
      console.error('Error loading support messages:', error)
    } finally {
      setLoading(false)
    }
  }, [setMessages, markAsRead, updateConversationUnreadCount, setUnreadCount, setConversations, setLoading, user?.id])

  const handleSelectSupportConversation = useCallback(async (conversationId: string) => {
    const conversation = supportConversations.find((c) => c.id === conversationId)
    if (conversation) {
      setCurrentConversation(conversation)
      updateConversationUnreadCount(conversation.id, 0)
      adminMessageSocketService.joinConversation(conversation.id)
      loadSupportMessages(conversation.id).catch((error) => {
        console.error('Error loading messages:', error)
      })
    }
  }, [supportConversations, setCurrentConversation, loadSupportMessages, updateConversationUnreadCount])

  const handleSendSupportMessage = useCallback(async (content: string) => {
    if (!user?.id || !currentConversation) return

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
        first_name: (user.user_metadata?.first_name as string | undefined) || undefined,
        last_name: (user.user_metadata?.last_name as string | undefined) || undefined,
        avatar_url: (user.user_metadata?.avatar_url as string | undefined) || undefined,
      },
    }
    
    addMessage(currentConversation.id, optimisticMessage)
    
    try {
      const sentMessage = await adminMessageService.sendMessage(currentConversation.id, content)
      if (sentMessage) {
        const finalMessage = {
          ...sentMessage,
          is_read: false,
          read_at: null,
        }
        const currentState = useAdminMessageStore.getState()
        const existingMessages = currentState.messages[currentConversation.id] || []
        const updatedMessages = existingMessages.map((m) =>
          m.id === tempMessageId ? finalMessage : m
        )
        setMessages(currentConversation.id, updatedMessages)
      }
    } catch (error) {
      const currentState = useAdminMessageStore.getState()
      const existingMessages = currentState.messages[currentConversation.id] || []
      const updatedMessages = existingMessages.filter((m) => m.id !== tempMessageId)
      setMessages(currentConversation.id, updatedMessages)
      throw error
    }
  }, [currentConversation, setMessages, addMessage, user])

  useEffect(() => {
    if (!user?.id || activeTab !== 'support-messages') return

    adminMessageSocketService.connect(user.id)
    loadSupportConversations()

    const unsubscribe = adminMessageSocketService.onNewMessage((message, conversation) => {
      if (conversation.type === 'support') {
        addMessage(conversation.id, message)
        
        const state = useAdminMessageStore.getState()
        const currentConv = state.currentConversation
        if (conversation.id === currentConv?.id) {
          updateConversationUnreadCount(conversation.id, 0)
          adminMessageService.markAsRead(conversation.id).then(() => {
            markAsRead(conversation.id, user?.id)
            loadSupportConversations()
          })
        } else {
          const convInStore = state.conversations.find(c => c.id === conversation.id)
          if (convInStore && convInStore.unread_count !== undefined) {
            updateConversationUnreadCount(conversation.id, (convInStore.unread_count || 0) + 1)
          }
        }
      }
    })

    return () => {
      const currentConv = useAdminMessageStore.getState().currentConversation
      if (currentConv) {
        adminMessageSocketService.leaveConversation(currentConv.id)
      }
      unsubscribe()
      adminMessageSocketService.disconnect()
    }
  }, [user?.id, activeTab, loadSupportConversations, addMessage, markAsRead, updateConversationUnreadCount])

  useEffect(() => {
    if (activeTab === 'support-messages' && supportConversations.length > 0) {
      for (const conv of supportConversations) {
        adminMessageSocketService.joinConversation(conv.id)
      }
    }
  }, [activeTab, supportConversations])

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <h1 style={titleStyle}>Réclamations</h1>
      </div>

      {/* Onglets */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', borderBottom: '1px solid #E5E7EB' }}>
        <button
          onClick={() => setActiveTab('disputes')}
          style={{
            padding: '12px 20px',
            border: 'none',
            backgroundColor: 'transparent',
            borderBottom: activeTab === 'disputes' ? '2px solid #8B5CF6' : '2px solid transparent',
            color: activeTab === 'disputes' ? '#8B5CF6' : '#6B7280',
            fontWeight: activeTab === 'disputes' ? 600 : 500,
            cursor: 'pointer',
            fontSize: '14px',
            transition: 'all 0.2s',
          }}
        >
          Disputes
        </button>
        <button
          onClick={() => setActiveTab('support-messages')}
          style={{
            padding: '12px 20px',
            border: 'none',
            backgroundColor: 'transparent',
            borderBottom: activeTab === 'support-messages' ? '2px solid #8B5CF6' : '2px solid transparent',
            color: activeTab === 'support-messages' ? '#8B5CF6' : '#6B7280',
            fontWeight: activeTab === 'support-messages' ? 600 : 500,
            cursor: 'pointer',
            fontSize: '14px',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <MessageSquare size={16} />
          Messages Support
          {unreadCount > 0 && (
            <span style={{
              minWidth: '20px',
              height: '20px',
              borderRadius: '10px',
              backgroundColor: '#EF4444',
              color: '#FFFFFF',
              fontSize: '11px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 6px',
            }}>
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
      </div>

      {/* Contenu onglet Disputes */}
      {activeTab === 'disputes' && (
        <>
      {/* Filtres */}
      <div style={filtersStyle}>
        <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#6B7280' }} />
          <input
            type="text"
            placeholder="Rechercher par ID transaction, commande..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ ...inputStyle, paddingLeft: '40px' }}
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value)
            setCurrentPage(1)
          }}
          style={selectStyle}
        >
          <option value="all">Tous les statuts</option>
          <option value="pending">En attente</option>
          <option value="resolved">Résolu</option>
          <option value="rejected">Rejeté</option>
        </select>
      </div>

      {/* Table */}
      <div style={cardStyle}>
        <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px', color: '#111827' }}>
          Liste des disputes
        </h3>
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>Chargement...</div>
        ) : disputes.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#6B7280' }}>
            Aucune dispute trouvée
          </div>
        ) : (
          <>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>ID</th>
                  <th style={thStyle}>Type</th>
                  <th style={thStyle}>Client</th>
                  <th style={thStyle}>Transaction</th>
                  <th style={thStyle}>Montant</th>
                  <th style={thStyle}>Statut</th>
                  <th style={thStyle}>Date</th>
                  <th style={thStyle}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {disputes
                  .filter((dispute: Dispute) => {
                    if (!searchQuery) return true
                    const query = searchQuery.toLowerCase()
                    return (
                      dispute.transaction_id?.toLowerCase().includes(query) ||
                      dispute.order_id_full?.toLowerCase().includes(query) ||
                      dispute.id?.toLowerCase().includes(query)
                    )
                  })
                  .map((dispute: Dispute) => (
                    <tr key={dispute.id}>
                      <td style={tdStyle}>
                        <span style={{ fontSize: '12px', fontFamily: 'monospace' }}>
                          {dispute.id?.slice(0, 8)}...
                        </span>
                      </td>
                      <td style={tdStyle}>{getDisputeTypeLabel(dispute.dispute_type || '')}</td>
                      <td style={tdStyle}>
                        <div>
                          <div style={{ fontWeight: 600 }}>{dispute.user_email || 'N/A'}</div>
                          <div style={{ fontSize: '12px', color: '#6B7280' }}>
                            {dispute.user_phone || ''}
                          </div>
                        </div>
                      </td>
                      <td style={tdStyle}>
                        <span style={{ fontSize: '12px', fontFamily: 'monospace' }}>
                          {dispute.transaction_id?.slice(0, 8) || 'N/A'}...
                        </span>
                      </td>
                      <td style={tdStyle}>
                        {dispute.amount ? formatCurrency(parseFloat(String(dispute.amount))) : 'N/A'}
                      </td>
                      <td style={tdStyle}>
                        <span style={getStatusBadgeStyle(dispute.status || 'pending')}>
                          {getStatusLabel(dispute.status || 'pending')}
                        </span>
                      </td>
                      <td style={tdStyle}>{formatDate(dispute.created_at)}</td>
                      <td style={tdStyle}>
                        <button
                          onClick={() => setSelectedDispute(dispute)}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '8px',
                            backgroundColor: '#8B5CF6',
                            color: '#FFFFFF',
                            border: 'none',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                          }}
                        >
                          <MessageSquare size={14} />
                          Voir
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>

            {/* Pagination */}
            {pagination && pagination.totalPages > 1 && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginTop: '16px',
                  paddingTop: '16px',
                  borderTop: '1px solid #E5E7EB',
                }}
              >
                <div style={{ fontSize: '14px', color: '#6B7280' }}>
                  Affichage {((currentPage - 1) * itemsPerPage + 1)} à{' '}
                  {Math.min(currentPage * itemsPerPage, pagination.total)} sur {pagination.total}
                </div>
                <div style={{ display: 'flex', flexDirection: 'row', gap: '8px' }}>
                  <button
                    style={
                      currentPage === 1
                        ? {
                            padding: '8px 16px',
                            borderRadius: '8px',
                            border: '1px solid #E5E7EB',
                            backgroundColor: '#FFFFFF',
                            fontSize: '14px',
                            fontWeight: 600,
                            cursor: 'not-allowed',
                            color: '#374151',
                            opacity: 0.5,
                          }
                        : {
                            padding: '8px 16px',
                            borderRadius: '8px',
                            border: '1px solid #E5E7EB',
                            backgroundColor: '#FFFFFF',
                            fontSize: '14px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            color: '#374151',
                          }
                    }
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    Précédent
                  </button>
                  {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
                    .filter(
                      (page) =>
                        page === 1 ||
                        page === pagination.totalPages ||
                        (page >= currentPage - 1 && page <= currentPage + 1)
                    )
                    .map((page, idx, arr) => (
                      <React.Fragment key={page}>
                        {idx > 0 && arr[idx - 1] !== page - 1 && (
                          <span style={{ padding: '8px' }}>...</span>
                        )}
                        <button
                          style={
                            currentPage === page
                              ? {
                                  padding: '8px 16px',
                                  borderRadius: '8px',
                                  border: '1px solid #8B5CF6',
                                  backgroundColor: '#8B5CF6',
                                  fontSize: '14px',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  color: '#FFFFFF',
                                }
                              : {
                                  padding: '8px 16px',
                                  borderRadius: '8px',
                                  border: '1px solid #E5E7EB',
                                  backgroundColor: '#FFFFFF',
                                  fontSize: '14px',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  color: '#374151',
                                }
                          }
                          onClick={() => setCurrentPage(page)}
                        >
                          {page}
                        </button>
                      </React.Fragment>
                    ))}
                  <button
                    style={
                      currentPage === pagination.totalPages
                        ? {
                            padding: '8px 16px',
                            borderRadius: '8px',
                            border: '1px solid #E5E7EB',
                            backgroundColor: '#FFFFFF',
                            fontSize: '14px',
                            fontWeight: 600,
                            cursor: 'not-allowed',
                            color: '#374151',
                            opacity: 0.5,
                          }
                        : {
                            padding: '8px 16px',
                            borderRadius: '8px',
                            border: '1px solid #E5E7EB',
                            backgroundColor: '#FFFFFF',
                            fontSize: '14px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            color: '#374151',
                          }
                    }
                    onClick={() => setCurrentPage((p) => Math.min(pagination.totalPages, p + 1))}
                    disabled={currentPage === pagination.totalPages}
                  >
                    Suivant
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal de détails */}
      {selectedDispute && (
        <div style={modalOverlayStyle} onClick={() => setSelectedDispute(null)}>
          <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '24px', color: '#111827' }}>
              Détails de la dispute
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '4px' }}>Type</div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>
                  {getDisputeTypeLabel(selectedDispute.dispute_type || '')}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '4px' }}>Raison</div>
                <div style={{ fontSize: '14px', color: '#111827' }}>{selectedDispute.reason || 'N/A'}</div>
              </div>

              {selectedDispute.description && (
                <div>
                  <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '4px' }}>
                    Description
                  </div>
                  <div style={{ fontSize: '14px', color: '#111827', padding: '12px', backgroundColor: '#F9FAFB', borderRadius: '8px' }}>
                    {selectedDispute.description}
                  </div>
                </div>
              )}

              <div>
                <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '4px' }}>Client</div>
                <div style={{ fontSize: '14px', color: '#111827' }}>
                  {selectedDispute.user_email || 'N/A'}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '4px' }}>Montant</div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>
                  {selectedDispute.amount ? formatCurrency(parseFloat(String(selectedDispute.amount))) : 'N/A'}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '4px' }}>Statut actuel</div>
                <span style={getStatusBadgeStyle(selectedDispute.status || 'pending')}>
                  {getStatusLabel(selectedDispute.status || 'pending')}
                </span>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, marginBottom: '8px', color: '#111827' }}>
                  Notes admin
                </label>
                <textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Ajouter des notes..."
                  rows={4}
                  style={{
                    width: '100%',
                    padding: '10px 16px',
                    borderRadius: '8px',
                    border: '1px solid #E5E7EB',
                    fontSize: '14px',
                    outline: 'none',
                    resize: 'none',
                  }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'row', gap: '12px', marginTop: '8px' }}>
                <button
                  onClick={() => {
                    updateMutation.mutate({
                      disputeId: selectedDispute.id,
                      status: 'rejected',
                      notes: adminNotes,
                    })
                  }}
                  disabled={updateMutation.isPending}
                  style={{
                    flex: 1,
                    padding: '10px 20px',
                    borderRadius: '8px',
                    backgroundColor: '#EF4444',
                    color: '#FFFFFF',
                    border: 'none',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    opacity: updateMutation.isPending ? 0.5 : 1,
                  }}
                >
                  <XCircle size={16} />
                  Rejeter
                </button>
                <button
                  onClick={() => {
                    updateMutation.mutate({
                      disputeId: selectedDispute.id,
                      status: 'resolved',
                      notes: adminNotes,
                    })
                  }}
                  disabled={updateMutation.isPending}
                  style={{
                    flex: 1,
                    padding: '10px 20px',
                    borderRadius: '8px',
                    backgroundColor: '#10B981',
                    color: '#FFFFFF',
                    border: 'none',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    opacity: updateMutation.isPending ? 0.5 : 1,
                  }}
                >
                  <CheckCircle size={16} />
                  Résoudre
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
        </>
      )}

      {/* Contenu onglet Messages Support */}
      {activeTab === 'support-messages' && (
        <div style={{ display: 'flex', flexDirection: 'row', gap: '16px', flex: 1, minHeight: 0, height: 'calc(100vh - 250px)' }}>
          <ConversationList
            conversations={supportConversations}
            groupedConversations={supportConversations.map((conv) => ({ type: 'single' as const, conversation: conv, key: conv.id }))}
            selectedConversationId={currentConversation?.id || null}
            selectedGroupKey={null}
            onSelectConversation={handleSelectSupportConversation}
            searchQuery={supportSearchQuery}
            onSearchChange={setSupportSearchQuery}
            filterType="support"
            currentUserId={user?.id}
          />

          <ChatArea
            conversation={currentConversation}
            participantPair={null}
            messages={currentConversation ? messages[currentConversation.id] || [] : []}
            onSendMessage={handleSendSupportMessage}
            isLoading={messagesLoading}
            currentUserId={user?.id}
          />
        </div>
      )}
    </div>
  )
}

