'use client'

import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { adminApiService } from '@/lib/adminApiService'
import StatusKPICard from '@/components/orders/StatusKPICard'
import { ScreenTransition } from '@/components/animations'
import { SkeletonLoader } from '@/components/animations'

const statusConfig: Record<string, { label: string; backgroundColor: string; color: string }> = {
  pending: {
    label: 'Pending',
    backgroundColor: '#FFEDD5',
    color: '#EA580C',
  },
  accepted: {
    label: 'Accepted',
    backgroundColor: '#DBEAFE',
    color: '#2563EB',
  },
  enroute: {
    label: 'On Progress',
    backgroundColor: '#DBEAFE',
    color: '#2563EB',
  },
  picked_up: {
    label: 'Picked Up',
    backgroundColor: '#F3E8FF',
    color: '#9333EA',
  },
  completed: {
    label: 'Delivered',
    backgroundColor: '#D1FAE5',
    color: '#16A34A',
  },
  declined: {
    label: 'Declined',
    backgroundColor: '#FEE2E2',
    color: '#DC2626',
  },
  cancelled: {
    label: 'Cancelled',
    backgroundColor: '#F3F4F6',
    color: '#4B5563',
  },
}

type TabType = 'all' | 'onProgress' | 'successful' | 'onHold' | 'canceled'

interface Order {
  id: string
  deliveryId: string
  date: string
  departure: string
  destination: string
  status: string
}

export default function OrdersPage() {
  const [activeTab, setActiveTab] = useState<TabType>('onProgress')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  const { data: ordersData, isLoading, isError, error } = useQuery({
    queryKey: ['orders', activeTab],
    queryFn: async () => {
      console.warn('🚀🚀🚀 [OrdersPage] queryFn CALLED - getOrdersByStatus', {
        activeTab,
        timestamp: new Date().toISOString(),
        stack: new Error().stack?.split('\n').slice(2, 15).join('\n')
      })
      const result = await adminApiService.getOrdersByStatus(activeTab === 'all' ? undefined : activeTab)
      console.log('🔍 [OrdersPage] Orders result:', result)
      return result
    },
    refetchInterval: false, // Pas de refresh automatique - utilise Socket.IO pour les mises à jour en temps réel
    staleTime: Infinity, // Les données ne deviennent jamais "stale" - pas de refetch automatique
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchIntervalInBackground: false, // Désactiver complètement le refetch en arrière-plan
    retry: false, // Ne pas réessayer en cas d'erreur (évite les requêtes supplémentaires)
    enabled: true, // Toujours activé, mais les autres options empêchent le refetch
  })

  // Debug logs
  React.useEffect(() => {
    if (isError) {
      console.error('❌ [OrdersPage] Error loading orders:', error)
    }
    if (ordersData) {
      console.log('🔍 [OrdersPage] Orders data:', ordersData)
      console.log('🔍 [OrdersPage] Orders count:', ordersData.data?.length || 0)
    }
  }, [ordersData, isError, error])

  const orders: Order[] = (ordersData?.data as Order[]) || []
  const counts = ordersData?.counts || {
    all: 0,
    onProgress: 0,
    successful: 0,
    onHold: 0,
    canceled: 0,
    changes: {
      all: 0,
      onProgress: 0,
      successful: 0,
      onHold: 0,
      canceled: 0,
    },
  }

  // Réinitialiser la page quand on change d'onglet
  React.useEffect(() => {
    setCurrentPage(1)
  }, [activeTab])

  // Calculer la pagination
  const totalPages = Math.max(1, Math.ceil(orders.length / itemsPerPage))
  const paginatedOrders = orders.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  }

  const titleStyle: React.CSSProperties = {
    fontSize: '24px',
    fontWeight: 700,
    color: '#111827',
    marginTop: '0',
  }

  const tabsContainerStyle: React.CSSProperties = {
    display: 'flex',
    gap: '32px',
    borderBottom: '1px solid #E5E7EB',
    paddingBottom: '8px',
  }

  const tabStyle = (isActive: boolean): React.CSSProperties => ({
    fontSize: '14px',
    fontWeight: 500,
    color: isActive ? '#8B5CF6' : '#6B7280',
    backgroundColor: 'transparent',
    border: 'none',
    borderBottom: isActive ? '2px solid #8B5CF6' : '2px solid transparent',
    paddingBottom: '8px',
    cursor: 'pointer',
    transition: 'all 0.2s',
  })

  const kpiCardsContainerStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '24px',
  }

  const tabs: { key: TabType; label: string }[] = [
    { key: 'all', label: 'All delivery' },
    { key: 'onProgress', label: 'On Progress Delivery' },
    { key: 'successful', label: 'Successfull' },
    { key: 'onHold', label: 'On hold delivery' },
    { key: 'canceled', label: 'Canceled Delivery' },
  ]

  return (
    <ScreenTransition direction="fade" duration={0.3}>
      <div style={containerStyle}>
      <div style={kpiCardsContainerStyle}>
        <StatusKPICard 
          type="onProgress" 
          count={counts.onProgress} 
          change={counts.changes?.onProgress || 0}
        />
        <StatusKPICard 
          type="successful" 
          count={counts.successful} 
          change={counts.changes?.successful || 0}
        />
        <StatusKPICard 
          type="onHold" 
          count={counts.onHold} 
          change={counts.changes?.onHold || 0}
        />
        <StatusKPICard 
          type="canceled" 
          count={counts.canceled} 
          change={counts.changes?.canceled || 0}
        />
      </div>

      <h1 style={titleStyle}>Rapport de livraison</h1>

      <div style={tabsContainerStyle}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={tabStyle(activeTab === tab.key)}
            onMouseEnter={(e) => {
              if (activeTab !== tab.key) {
                e.currentTarget.style.color = '#374151'
              }
            }}
            onMouseLeave={(e) => {
              if (activeTab !== tab.key) {
                e.currentTarget.style.color = '#6B7280'
              }
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

        {isLoading ? (
          <div style={{ padding: '48px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <SkeletonLoader width="100%" height={60} borderRadius={8} />
            <SkeletonLoader width="100%" height={60} borderRadius={8} />
            <SkeletonLoader width="100%" height={60} borderRadius={8} />
            <SkeletonLoader width="100%" height={60} borderRadius={8} />
            <SkeletonLoader width="100%" height={60} borderRadius={8} />
          </div>
      ) : orders.length === 0 ? (
        <div style={{ padding: '48px', textAlign: 'center', color: '#6B7280' }}>
          Aucune commande trouvée
        </div>
      ) : (
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #F3F4F6' }}>
          <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={{ color: '#6B7280', fontSize: '14px' }}>{orders.length} commande(s) trouvée(s)</p>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '12px', fontSize: '12px', fontWeight: 600, color: '#4B5563', textTransform: 'uppercase', borderBottom: '1px solid #E5E7EB' }}>Delivery ID</th>
                  <th style={{ textAlign: 'left', padding: '12px', fontSize: '12px', fontWeight: 600, color: '#4B5563', textTransform: 'uppercase', borderBottom: '1px solid #E5E7EB' }}>Date</th>
                  <th style={{ textAlign: 'left', padding: '12px', fontSize: '12px', fontWeight: 600, color: '#4B5563', textTransform: 'uppercase', borderBottom: '1px solid #E5E7EB' }}>Departure</th>
                  <th style={{ textAlign: 'left', padding: '12px', fontSize: '12px', fontWeight: 600, color: '#4B5563', textTransform: 'uppercase', borderBottom: '1px solid #E5E7EB' }}>Destination</th>
                  <th style={{ textAlign: 'left', padding: '12px', fontSize: '12px', fontWeight: 600, color: '#4B5563', textTransform: 'uppercase', borderBottom: '1px solid #E5E7EB' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {paginatedOrders.map((order: Order, idx: number) => {
                  const status = statusConfig[order.status] || {
                    label: order.status,
                    backgroundColor: '#F3F4F6',
                    color: '#4B5563',
                  }

                  return (
                    <tr
                      key={order.id || idx}
                      style={{
                        borderBottom: '1px solid #F3F4F6',
                        transition: 'background-color 0.2s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#F9FAFB'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent'
                      }}
                    >
                      <td style={{ padding: '12px' }}>
                        <span style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>{order.deliveryId}</span>
                      </td>
                      <td style={{ padding: '12px' }}>
                        <span style={{ fontSize: '14px', color: '#374151' }}>{order.date}</span>
                      </td>
                      <td style={{ padding: '12px' }}>
                        <span style={{ fontSize: '14px', color: '#374151' }} title={order.departure}>
                          {order.departure.length > 30 ? `${order.departure.substring(0, 30)}...` : order.departure}
                        </span>
                      </td>
                      <td style={{ padding: '12px' }}>
                        <span style={{ fontSize: '14px', color: '#374151' }} title={order.destination}>
                          {order.destination.length > 30 ? `${order.destination.substring(0, 30)}...` : order.destination}
                        </span>
                      </td>
                      <td style={{ padding: '12px' }}>
                        <span
                          style={{
                            paddingLeft: '12px',
                            paddingRight: '12px',
                            paddingTop: '4px',
                            paddingBottom: '4px',
                            backgroundColor: status.backgroundColor,
                            color: status.color,
                            borderRadius: '8px',
                            fontSize: '12px',
                            fontWeight: 600,
                          }}
                        >
                          {status.label}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {orders.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #E5E7EB' }}>
              <p style={{ color: '#6B7280', fontSize: '14px' }}>
                Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, orders.length)} of {orders.length} entries
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  style={{
                    padding: '8px',
                    backgroundColor: 'transparent',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                    opacity: currentPage === 1 ? 0.5 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  onMouseEnter={(e) => {
                    if (currentPage !== 1) {
                      e.currentTarget.style.backgroundColor = '#F9FAFB'
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent'
                  }}
                >
                  <ChevronLeft size={20} style={{ color: '#4B5563' }} />
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum: number
                  if (totalPages <= 5) {
                    pageNum = i + 1
                  } else if (currentPage <= 3) {
                    pageNum = i + 1
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i
                  } else {
                    pageNum = currentPage - 2 + i
                  }
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      style={{
                        paddingLeft: '12px',
                        paddingRight: '12px',
                        paddingTop: '4px',
                        paddingBottom: '4px',
                        borderRadius: '8px',
                        fontSize: '14px',
                        fontWeight: 500,
                        backgroundColor: currentPage === pageNum ? '#8B5CF6' : 'transparent',
                        color: currentPage === pageNum ? '#FFFFFF' : '#374151',
                        border: 'none',
                        cursor: 'pointer',
                        transition: 'background-color 0.2s',
                      }}
                      onMouseEnter={(e) => {
                        if (currentPage !== pageNum) {
                          e.currentTarget.style.backgroundColor = '#F3F4F6'
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (currentPage !== pageNum) {
                          e.currentTarget.style.backgroundColor = 'transparent'
                        }
                      }}
                    >
                      {pageNum}
                    </button>
                  )
                })}
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  style={{
                    padding: '8px',
                    backgroundColor: 'transparent',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer',
                    opacity: currentPage >= totalPages ? 0.5 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  onMouseEnter={(e) => {
                    if (currentPage < totalPages) {
                      e.currentTarget.style.backgroundColor = '#F9FAFB'
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent'
                  }}
                >
                  <ChevronRight size={20} style={{ color: '#4B5563' }} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
    </ScreenTransition>
  )
}
