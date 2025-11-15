'use client'

import { ChevronLeft, ChevronRight, Filter } from 'lucide-react'
import React, { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { getRecentActivities } from '@/lib/dashboardApi'
import { AnimatedCard } from '@/components/animations'
import { useDateFilter } from '@/contexts/DateFilterContext'

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

export default function ActivityTable() {
  const router = useRouter()
  const { dateFilter, dateRange } = useDateFilter()
  const { startDate, endDate } = dateRange
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 3 // Limité à 3 comme demandé
  
  // Log pour voir si les dates changent
  useEffect(() => {
    console.log('🔄 [ActivityTable] Date range changed:', { dateFilter, startDate, endDate })
  }, [dateFilter, startDate, endDate])
  
  // Stabiliser la queryKey - React Query compare par valeur, pas par référence
  const queryKey = React.useMemo(() => {
    const key: [string, number, string, string, string] = ['recent-activities', currentPage, dateFilter, startDate, endDate]
    console.log('🔑 [ActivityTable] QueryKey calculated:', key)
    return key
  }, [currentPage, dateFilter, startDate, endDate])
  
  const { data: activities, isLoading, isError, error } = useQuery({
    queryKey,
    queryFn: () => {
      console.log('🚀 [ActivityTable] queryFn CALLED - getRecentActivities', { itemsPerPage, startDate, endDate, timestamp: new Date().toISOString(), stack: new Error().stack })
      return getRecentActivities(itemsPerPage, startDate, endDate)
    },
    refetchInterval: false, // Pas de refresh automatique - utilise Socket.IO pour les mises à jour en temps réel
    staleTime: Infinity, // Les données ne deviennent jamais "stale" - pas de refetch automatique
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    retry: false, // Ne pas réessayer en cas d'erreur (évite les requêtes supplémentaires)
    placeholderData: (previousData) => {
      if (previousData) {
        console.log('📦 [ActivityTable] Using cached data, skipping fetch')
      }
      return previousData
    },
    structuralSharing: true,
  })

  // Debug: logger les données reçues
  useEffect(() => {
    if (activities) {
      console.debug('🔍 [ActivityTable] Activities data received:', activities)
      console.debug('🔍 [ActivityTable] Activities count:', activities.length)
    }
    if (isError) {
      console.error('❌ [ActivityTable] Error loading activities:', error)
    }
  }, [activities, isError, error])

  // Utiliser les données réelles de l'API, ou un tableau vide si pas de données
  const displayData = Array.isArray(activities) ? activities : []
  const totalPages = Math.max(1, Math.ceil(displayData.length / itemsPerPage))
  const paginatedData = displayData.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  const cardStyle: React.CSSProperties = {
    backgroundColor: '#FFFFFF',
    borderRadius: '16px',
    padding: '16px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    border: '1px solid #F3F4F6',
  }

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '12px',
  }

  const titleStyle: React.CSSProperties = {
    fontSize: '18px',
    fontWeight: 700,
    color: '#111827',
  }

  const controlsStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  }

  const selectStyle: React.CSSProperties = {
    paddingLeft: '16px',
    paddingRight: '16px',
    paddingTop: '8px',
    paddingBottom: '8px',
    backgroundColor: '#F9FAFB',
    border: '1px solid #E5E7EB',
    borderRadius: '12px',
    fontSize: '14px',
    color: '#374151',
    outline: 'none',
  }

  const filterButtonStyle: React.CSSProperties = {
    padding: '8px',
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: '12px',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  }

  const tableStyle: React.CSSProperties = {
    width: '100%',
    borderCollapse: 'collapse',
  }

  const thStyle: React.CSSProperties = {
    textAlign: 'left',
    paddingTop: '8px',
    paddingBottom: '8px',
    paddingLeft: '12px',
    paddingRight: '12px',
    fontSize: '12px',
    fontWeight: 600,
    color: '#4B5563',
    textTransform: 'uppercase',
    borderBottom: '1px solid #E5E7EB',
  }

  const tdStyle: React.CSSProperties = {
    paddingTop: '10px',
    paddingBottom: '10px',
    paddingLeft: '12px',
    paddingRight: '12px',
    borderBottom: '1px solid #F3F4F6',
  }

  const statusBadgeStyle = (status: typeof statusConfig[string]): React.CSSProperties => ({
    paddingLeft: '12px',
    paddingRight: '12px',
    paddingTop: '4px',
    paddingBottom: '4px',
    borderRadius: '8px',
    fontSize: '12px',
    fontWeight: 600,
    backgroundColor: status.backgroundColor,
    color: status.color,
    display: 'inline-block',
  })

  const paginationStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: '12px',
    paddingTop: '12px',
    borderTop: '1px solid #E5E7EB',
  }

  const paginationTextStyle: React.CSSProperties = {
    fontSize: '14px',
    color: '#4B5563',
  }

  const paginationButtonsStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  }

  const paginationButtonStyle: React.CSSProperties = {
    padding: '8px',
    borderRadius: '8px',
    border: '1px solid #E5E7EB',
    backgroundColor: 'transparent',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  }

  const pageButtonStyle = (active: boolean): React.CSSProperties => ({
    paddingLeft: '12px',
    paddingRight: '12px',
    paddingTop: '4px',
    paddingBottom: '4px',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 500,
    backgroundColor: active ? '#8B5CF6' : 'transparent',
    color: active ? '#FFFFFF' : '#374151',
    border: 'none',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  })

  return (
    <AnimatedCard index={0} delay={0} style={cardStyle}>
      <div style={headerStyle}>
        <h2 
          style={{ ...titleStyle, cursor: 'pointer' }}
          onClick={() => router.push('/orders')}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = '#8B5CF6'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = '#111827'
          }}
        >
          Activity Data
        </h2>
        <div style={controlsStyle}>
          <select style={selectStyle}>
            <option>This week</option>
            <option>This month</option>
            <option>This year</option>
          </select>
          <button
            style={filterButtonStyle}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#F3F4F6'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent'
            }}
          >
            <Filter size={20} style={{ color: '#4B5563' }} />
          </button>
        </div>
      </div>

      {isLoading ? (
        <div style={{ paddingTop: '48px', paddingBottom: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ color: '#6B7280' }}>Chargement des activités...</div>
        </div>
      ) : isError ? (
        <div style={{ paddingTop: '48px', paddingBottom: '48px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          <div style={{ color: '#DC2626', fontSize: '14px', fontWeight: 500 }}>Erreur lors du chargement des activités</div>
          <div style={{ color: '#6B7280', fontSize: '12px' }}>Vérifiez votre connexion et réessayez</div>
        </div>
      ) : paginatedData.length === 0 ? (
        <div style={{ paddingTop: '48px', paddingBottom: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ color: '#6B7280' }}>Aucune activité récente</div>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Delivery ID</th>
                <th style={thStyle}>Date</th>
                <th style={thStyle}>Departure</th>
                <th style={thStyle}>Destination</th>
                <th style={thStyle}>Status</th>
              </tr>
            </thead>
            <tbody>
              {paginatedData.map((row, idx) => {
                const status = statusConfig[row.status] || {
                  label: row.status,
                  backgroundColor: '#F3F4F6',
                  color: '#4B5563',
                }

                const rowStyle: React.CSSProperties = {
                  ...tdStyle,
                  backgroundColor: row.deliveryId === 'NY-12321-SF' ? '#EFF6FF' : 'transparent',
                  transition: 'background-color 0.2s',
                }

                return (
                  <tr
                    key={row.id || idx}
                    style={rowStyle}
                    onMouseEnter={(e) => {
                      if (row.deliveryId !== 'NY-12321-SF') {
                        e.currentTarget.style.backgroundColor = '#F9FAFB'
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (row.deliveryId !== 'NY-12321-SF') {
                        e.currentTarget.style.backgroundColor = 'transparent'
                      }
                    }}
                  >
                    <td style={tdStyle}>
                      <span style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>{row.deliveryId}</span>
                    </td>
                    <td style={tdStyle}>
                      <span style={{ fontSize: '14px', color: '#374151' }}>{row.date}</span>
                    </td>
                    <td style={tdStyle}>
                      <span style={{ fontSize: '14px', color: '#374151' }} title={row.departure}>
                        {row.departure.length > 30 ? `${row.departure.substring(0, 30)}...` : row.departure}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <span style={{ fontSize: '14px', color: '#374151' }} title={row.destination}>
                        {row.destination.length > 30 ? `${row.destination.substring(0, 30)}...` : row.destination}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <span style={statusBadgeStyle(status)}>
                        {status.label}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {!isLoading && displayData.length > 0 && (
        <div style={paginationStyle}>
          <p style={paginationTextStyle}>
            Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, displayData.length)} of {displayData.length} entries
          </p>
          <div style={paginationButtonsStyle}>
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              style={{
                ...paginationButtonStyle,
                opacity: currentPage === 1 ? 0.5 : 1,
                cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
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
            {Array.from({ length: Math.min(4, totalPages) }, (_, i) => {
              const page = i + 1
              return (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  style={pageButtonStyle(currentPage === page)}
                  onMouseEnter={(e) => {
                    if (currentPage !== page) {
                      e.currentTarget.style.backgroundColor = '#F3F4F6'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (currentPage !== page) {
                      e.currentTarget.style.backgroundColor = 'transparent'
                    }
                  }}
                >
                  {page}
                </button>
              )
            })}
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              style={{
                ...paginationButtonStyle,
                opacity: currentPage >= totalPages ? 0.5 : 1,
                cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer',
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
    </AnimatedCard>
  )
}

