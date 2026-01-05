'use client'

import { ChevronLeft, ChevronRight, Filter } from 'lucide-react'
import React, { useState, useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { getRecentActivities } from '@/lib/dashboardApi'
import { AnimatedCard } from '@/components/animations'
import { formatDeliveryId } from '@/utils/formatDeliveryId'
import { logger } from '@/utils/logger'
import { themeColors } from '@/utils/theme'
import { useThemeStore } from '@/stores/themeStore'

const statusConfig: Record<string, { label: string; backgroundColor: string; color: string }> = {
  pending: {
    label: 'En attente',
    backgroundColor: '#FFEDD5',
    color: '#EA580C',
  },
  accepted: {
    label: 'Acceptée',
    backgroundColor: '#DBEAFE',
    color: '#2563EB',
  },
  enroute: {
    label: 'En cours',
    backgroundColor: '#DBEAFE',
    color: '#2563EB',
  },
  picked_up: {
    label: 'Récupérée',
    backgroundColor: '#F3E8FF',
    color: '#9333EA',
  },
  completed: {
    label: 'Livrée',
    backgroundColor: '#D1FAE5',
    color: '#16A34A',
  },
  declined: {
    label: 'Refusée',
    backgroundColor: '#FEE2E2',
    color: '#DC2626',
  },
  cancelled: {
    label: 'Annulée',
    backgroundColor: '#FEE2E2',
    color: '#B91C1C',
  },
}

const parseDateToISO = (value?: string) => {
  if (!value) return undefined
  const parts = value.split(/[\/\-]/)
  if (parts.length === 3) {
    const [first, second, third] = parts
    if (first.length === 2 && second.length === 2 && third.length === 4) {
      return `${third}-${second}-${first}`
    }
    if (first.length === 4) {
      return `${first}-${second}-${third}`
    }
  }
  return undefined
}

type LocalDateFilter = 'thisWeek' | 'thisMonth' | 'thisYear'

export default function ActivityTable() {
  const router = useRouter()
  const theme = useThemeStore((state) => state.theme)
  const isDarkMode = theme === 'dark'
  const [localDateFilter, setLocalDateFilter] = useState<LocalDateFilter>('thisMonth')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 3 // Limité à 3 comme demandé
  
  // Calculer les dates localement en fonction du filtre sélectionné
  const { startDate, endDate } = useMemo(() => {
    const now = new Date()
    const endDate = new Date(now)
    endDate.setHours(23, 59, 59, 999)
    
    let startDate = new Date(now)
    
    switch (localDateFilter) {
      case 'thisWeek':
        const dayOfWeek = now.getDay()
        const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1)
        startDate = new Date(now)
        startDate.setDate(diff)
        startDate.setHours(0, 0, 0, 0)
        break
      case 'thisMonth':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1)
        startDate.setHours(0, 0, 0, 0)
        break
      case 'thisYear':
        startDate = new Date(now.getFullYear(), 0, 1)
        startDate.setHours(0, 0, 0, 0)
        break
      default:
        startDate.setHours(0, 0, 0, 0)
    }
    
    const result = {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
    }
    
    logger.debug('📅 [ActivityTable] Date range calculated:', {
      filter: localDateFilter,
      startDate: result.startDate,
      endDate: result.endDate,
    })
    
    return result
  }, [localDateFilter])
  
  // Gérer le changement de filtre
  const handleFilterChange = (value: string) => {
    setLocalDateFilter(value as LocalDateFilter)
    // Réinitialiser la page à 1 lors du changement de filtre
    setCurrentPage(1)
  }
  
  // Créer la queryKey directement - React Query refetch automatiquement quand elle change
  const queryKey = React.useMemo(
    () => ['recent-activities', currentPage, localDateFilter, startDate, endDate] as const,
    [currentPage, localDateFilter, startDate, endDate]
  )
  
  const { data: activities, isLoading, isError, error } = useQuery({
    queryKey,
    queryFn: () => {
      logger.debug('🚀 [ActivityTable] Fetching activities with filter:', { 
        localDateFilter,
        startDate, 
        endDate,
        itemsPerPage,
        timestamp: new Date().toISOString()
      })
      return getRecentActivities(itemsPerPage, startDate, endDate)
    },
    refetchInterval: false,
    staleTime: 0, // Les données sont toujours considérées comme stale pour permettre le refetch
    refetchOnWindowFocus: false,
    refetchOnMount: true, // Refetch quand le composant monte
    refetchOnReconnect: false,
    retry: 2,
    enabled: true,
  })

  // Debug: logger les données reçues
  useEffect(() => {
    if (activities) {
      logger.debug('🔍 [ActivityTable] Activities data received:', activities)
      logger.debug('🔍 [ActivityTable] Activities count:', activities.length)
    }
    if (isError) {
      logger.error('[ActivityTable] Error loading activities:', error)
    }
  }, [activities, isError, error])

  // Utiliser les données réelles de l'API,  tableau vide si pas de données
  const displayData = Array.isArray(activities) ? activities : []
  const totalPages = Math.max(1, Math.ceil(displayData.length / itemsPerPage))
  const paginatedData = displayData.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  const cardStyle: React.CSSProperties = {
    backgroundColor: themeColors.cardBg,
    borderRadius: '16px',
    padding: '16px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    border: `1px solid ${themeColors.cardBorder}`,
    transition: 'background-color 0.3s ease, border-color 0.3s ease',
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
    color: themeColors.textPrimary,
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
    backgroundColor: themeColors.grayLight,
    border: `1px solid ${themeColors.cardBorder}`,
    borderRadius: '12px',
    fontSize: '14px',
    color: themeColors.textPrimary,
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
    color: themeColors.textSecondary,
    textTransform: 'uppercase',
    borderBottom: `1px solid ${themeColors.cardBorder}`,
  }

  const tdStyle: React.CSSProperties = {
    paddingTop: '10px',
    paddingBottom: '10px',
    paddingLeft: '12px',
    paddingRight: '12px',
    borderBottom: `1px solid ${themeColors.cardBorder}`,
    color: themeColors.textPrimary,
  }

  // Adapter les couleurs des badges selon le thème
  const getStatusBadgeStyle = (statusKey: string, status: typeof statusConfig[string]): React.CSSProperties => {
    // Pour le mode sombre, utiliser des couleurs plus sombres et contrastées
    let bgColor = status.backgroundColor
    let textColor = status.color
    
    if (isDarkMode) {
      // Adapter les couleurs pour le mode sombre
      const darkModeColors: Record<string, { bg: string; text: string }> = {
        pending: { bg: '#7C2D12', text: '#FED7AA' },
        accepted: { bg: '#1E3A8A', text: '#DBEAFE' },
        enroute: { bg: '#1E3A8A', text: '#DBEAFE' },
        picked_up: { bg: '#6B21A8', text: '#E9D5FF' },
        completed: { bg: '#166534', text: '#D1FAE5' },
        declined: { bg: '#991B1B', text: '#FEE2E2' },
        cancelled: { bg: '#7F1D1D', text: '#FEE2E2' },
      }
      const darkColors = darkModeColors[statusKey] || { bg: status.backgroundColor, text: status.color }
      bgColor = darkColors.bg
      textColor = darkColors.text
    }
    
    return {
      paddingLeft: '12px',
      paddingRight: '12px',
      paddingTop: '4px',
      paddingBottom: '4px',
      borderRadius: '8px',
      fontSize: '12px',
      fontWeight: 600,
      backgroundColor: bgColor,
      color: textColor,
      display: 'inline-block',
    }
  }

  const paginationStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: '12px',
    paddingTop: '12px',
    borderTop: `1px solid ${themeColors.cardBorder}`,
  }

  const paginationTextStyle: React.CSSProperties = {
    fontSize: '14px',
    color: themeColors.textSecondary,
  }

  const paginationButtonsStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  }

  const paginationButtonStyle: React.CSSProperties = {
    padding: '8px',
    borderRadius: '8px',
    border: `1px solid ${themeColors.cardBorder}`,
    backgroundColor: 'transparent',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
    color: themeColors.textPrimary,
  }

  const pageButtonStyle = (active: boolean): React.CSSProperties => ({
    paddingLeft: '12px',
    paddingRight: '12px',
    paddingTop: '4px',
    paddingBottom: '4px',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 500,
    backgroundColor: active ? themeColors.purplePrimary : 'transparent',
    color: active ? '#FFFFFF' : themeColors.textPrimary,
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
            e.currentTarget.style.color = themeColors.purplePrimary
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = themeColors.textPrimary
          }}
        >
          Données d&apos;activité
        </h2>
        <div style={controlsStyle}>
          <select 
            style={selectStyle}
            value={localDateFilter}
            onChange={(e) => handleFilterChange(e.target.value)}
          >
            <option value="thisWeek">Cette semaine</option>
            <option value="thisMonth">Ce mois</option>
            <option value="thisYear">Cette année</option>
          </select>
          <button
            style={filterButtonStyle}
            onClick={() => router.push('/orders')}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = themeColors.grayLight
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent'
            }}
          >
            <Filter size={20} style={{ color: themeColors.textSecondary }} />
          </button>
        </div>
      </div>

      {isLoading ? (
        <div style={{ paddingTop: '48px', paddingBottom: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ color: themeColors.textSecondary }}>Chargement des activités...</div>
        </div>
      ) : isError ? (
        <div style={{ paddingTop: '48px', paddingBottom: '48px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          <div style={{ color: themeColors.redPrimary, fontSize: '14px', fontWeight: 500 }}>Erreur lors du chargement des activités</div>
          <div style={{ color: themeColors.textSecondary, fontSize: '12px' }}>Vérifiez votre connexion et réessayez</div>
        </div>
      ) : paginatedData.length === 0 ? (
        <div style={{ paddingTop: '48px', paddingBottom: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ color: themeColors.textSecondary }}>Aucune activité récente</div>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>ID de livraison</th>
                <th style={thStyle}>Date</th>
                <th style={thStyle}>Départ</th>
                <th style={thStyle}>Destination</th>
                <th style={thStyle}>Statut</th>
              </tr>
            </thead>
            <tbody>
              {paginatedData.map((row, idx) => {
                const statusKey = row.status
                const status = statusConfig[statusKey] || {
                  label: row.status,
                  backgroundColor: isDarkMode ? '#374151' : '#F3F4F6',
                  color: isDarkMode ? '#D1D5DB' : '#4B5563',
                }

                const rowStyle: React.CSSProperties = {
                  ...tdStyle,
                  backgroundColor: row.deliveryId === 'NY-12321-SF' ? themeColors.blueLight : 'transparent',
                  transition: 'background-color 0.2s',
                }

                return (
                  <tr
                    key={row.id || idx}
                    style={rowStyle}
                    onMouseEnter={(e) => {
                      if (row.deliveryId !== 'NY-12321-SF') {
                        e.currentTarget.style.backgroundColor = themeColors.grayLight
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (row.deliveryId !== 'NY-12321-SF') {
                        e.currentTarget.style.backgroundColor = 'transparent'
                      }
                    }}
                  >
                    <td style={tdStyle}>
                      <span style={{ fontSize: '13px', color: themeColors.textPrimary, fontWeight: 500 }}>
                        {formatDeliveryId(row.deliveryId, parseDateToISO(row.date) || row.date)}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <span style={{ fontSize: '14px', color: themeColors.textPrimary }}>{row.date}</span>
                    </td>
                    <td style={tdStyle}>
                      <span style={{ fontSize: '14px', color: themeColors.textPrimary }} title={row.departure}>
                        {row.departure.length > 30 ? `${row.departure.substring(0, 30)}...` : row.departure}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <span style={{ fontSize: '14px', color: themeColors.textPrimary }} title={row.destination}>
                        {row.destination.length > 30 ? `${row.destination.substring(0, 30)}...` : row.destination}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <span style={getStatusBadgeStyle(statusKey, status)}>
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
            Affichage de {((currentPage - 1) * itemsPerPage) + 1} à {Math.min(currentPage * itemsPerPage, displayData.length)} sur {displayData.length} entrées
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
                  e.currentTarget.style.backgroundColor = themeColors.grayLight
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent'
              }}
            >
              <ChevronLeft size={20} style={{ color: themeColors.textSecondary }} />
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
                      e.currentTarget.style.backgroundColor = themeColors.grayLight
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
                  e.currentTarget.style.backgroundColor = themeColors.grayLight
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent'
              }}
            >
              <ChevronRight size={20} style={{ color: themeColors.textSecondary }} />
            </button>
          </div>
        </div>
      )}
    </AnimatedCard>
  )
}

