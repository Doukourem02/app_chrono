'use client'

import React, { useState, useMemo, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import NewB2BShippingModal from '@/components/orders/NewB2BShippingModal'
import { adminApiService } from '@/lib/adminApiService'
import { themeColors } from '@/utils/theme'

interface B2BOrder {
  id: string
  orderId?: string
  created_at: string
  pickup_address?: string
  dropoff_address?: string
  client?: {
    first_name?: string
    last_name?: string
    email?: string
  }
  status?: string
}

interface RawOrder {
  id: string
  is_phone_order?: boolean
  created_at?: string
  pickup_address?: string
  dropoff_address?: string
  client?: {
    first_name?: string
    last_name?: string
    email?: string
  }
  status?: string
}

export default function PlanningPage() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewMode, setViewMode] = useState<'day' | 'week' | 'month'>('week')
  const [isNewShippingModalOpen, setIsNewShippingModalOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedTime, setSelectedTime] = useState<string | null>(null)

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
    color: themeColors.textPrimary,
  }

  const controlsStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: '12px',
  }

  const viewModeButtonStyle: React.CSSProperties = {
    padding: '8px 16px',
    borderRadius: '8px',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: themeColors.cardBorder,
    backgroundColor: themeColors.cardBg,
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    color: themeColors.textPrimary,
  }

  const viewModeButtonActiveStyle: React.CSSProperties = {
    ...viewModeButtonStyle,
    backgroundColor: themeColors.purplePrimary,
    color: '#FFFFFF',
    borderColor: themeColors.purplePrimary,
  }

  const calendarCardStyle: React.CSSProperties = {
    backgroundColor: themeColors.cardBg,
    borderRadius: '12px',
    padding: '24px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    border: `1px solid ${themeColors.cardBorder}`,
  }

  const weekViewStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, 1fr)',
    gap: '8px',
  }

  const dayHeaderStyle: React.CSSProperties = {
    padding: '12px',
    textAlign: 'center',
    fontSize: '12px',
    fontWeight: 600,
    color: themeColors.textSecondary,
    textTransform: 'uppercase',
    borderBottom: `1px solid ${themeColors.cardBorder}`,
  }

  const dayCellStyle: React.CSSProperties = {
    minHeight: '120px',
    padding: '8px',
    border: `1px solid ${themeColors.cardBorder}`,
    borderRadius: '8px',
    backgroundColor: themeColors.grayLight,
  }

  const deliveryItemStyle: React.CSSProperties = {
    padding: '8px',
    borderRadius: '6px',
    backgroundColor: themeColors.purplePrimary,
    color: '#FFFFFF',
    fontSize: '12px',
    marginBottom: '4px',
    cursor: 'pointer',
  }

  // Calculer les dates de début et fin selon la vue
  const { startDate, endDate } = useMemo(() => {
    const now = new Date(currentDate)
    let start = new Date(now)
    let end = new Date(now)
    
    switch (viewMode) {
      case 'day':
        start.setHours(0, 0, 0, 0)
        end.setHours(23, 59, 59, 999)
        break
      case 'week':
        const day = now.getDay()
        const diff = now.getDate() - day + (day === 0 ? -6 : 1)
        start = new Date(now)
        start.setDate(diff)
        start.setHours(0, 0, 0, 0)
        end = new Date(start)
        end.setDate(start.getDate() + 6)
        end.setHours(23, 59, 59, 999)
        break
      case 'month':
        start = new Date(now.getFullYear(), now.getMonth(), 1)
        start.setHours(0, 0, 0, 0)
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
        end.setHours(23, 59, 59, 999)
        break
    }
    
    return {
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
    }
  }, [currentDate, viewMode])

  // Récupérer les commandes B2B (is_phone_order: true)
  const { data: b2bOrdersData, isLoading: isLoadingB2B } = useQuery({
    queryKey: ['b2b-orders', startDate, endDate],
    queryFn: async () => {
      // Récupérer toutes les commandes et filtrer côté client pour les B2B
      const result = await adminApiService.getOrdersByStatus()
      if (result.success && result.data) {
        const orders = result.data as RawOrder[]
        // Filtrer les commandes B2B (is_phone_order: true) dans la période
        const b2bOrders = orders.filter((order: RawOrder) => {
          // Ne garder que les commandes B2B (is_phone_order === true)
          if (order.is_phone_order !== true) return false
          const orderDate = order.created_at ? new Date(order.created_at).toISOString().split('T')[0] : null
          if (!orderDate) return false
          return orderDate >= startDate && orderDate <= endDate
        })
        return b2bOrders.map((order): B2BOrder => ({
          id: order.id,
          orderId: order.id,
          created_at: order.created_at || '',
          pickup_address: order.pickup_address,
          dropoff_address: order.dropoff_address,
          client: order.client,
          status: order.status,
        }))
      }
      return []
    },
    staleTime: 30000, // 30 secondes
    refetchInterval: 60000, // Refetch toutes les minutes
  })

  const b2bOrders = useMemo(() => {
    return Array.isArray(b2bOrdersData) ? b2bOrdersData : []
  }, [b2bOrdersData])

  // Organiser les commandes B2B par date
  const deliveriesByDate = useMemo(() => {
    const grouped: Record<string, Array<{ id: string; time: string; client: string; orderId?: string }>> = {}
    
    b2bOrders.forEach((order) => {
      const orderDate = order.created_at ? new Date(order.created_at).toISOString().split('T')[0] : null
      if (!orderDate) return
      
      // Extraire l'heure depuis created_at
      const orderDateTime = new Date(order.created_at)
      const time = `${orderDateTime.getHours().toString().padStart(2, '0')}:${orderDateTime.getMinutes().toString().padStart(2, '0')}`
      
      // Nom du client
      const clientName = order.client
        ? `${order.client.first_name || ''} ${order.client.last_name || ''}`.trim() || order.client.email || 'Client'
        : 'Client'
      
      if (!grouped[orderDate]) {
        grouped[orderDate] = []
      }
      
      grouped[orderDate].push({
        id: order.id,
        time,
        client: clientName,
        orderId: order.orderId || order.id,
      })
    })
    
    // Trier par heure pour chaque jour
    Object.keys(grouped).forEach((date) => {
      grouped[date].sort((a, b) => a.time.localeCompare(b.time))
    })
    
    return grouped
  }, [b2bOrders])

  const getWeekDays = () => {
    const startOfWeek = new Date(currentDate)
    const day = startOfWeek.getDay()
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1)
    startOfWeek.setDate(diff)

    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(startOfWeek)
      date.setDate(startOfWeek.getDate() + i)
      return date
    })
  }

  const getDayHours = () => {
    return Array.from({ length: 24 }, (_, i) => i)
  }

  const weekDays = getWeekDays()
  const dayNames = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

  // Navigation selon la vue
  const navigatePeriod = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate)
    
    switch (viewMode) {
      case 'day':
        newDate.setDate(newDate.getDate() + (direction === 'prev' ? -1 : 1))
        break
      case 'week':
        newDate.setDate(newDate.getDate() + (direction === 'prev' ? -7 : 7))
        break
      case 'month':
        newDate.setMonth(newDate.getMonth() + (direction === 'prev' ? -1 : 1))
        break
    }
    
    setCurrentDate(newDate)
  }

  // Ouvrir le modal avec date/heure pré-remplie
  const handleOpenModal = useCallback((date?: Date, time?: string) => {
    if (date) {
      setSelectedDate(date)
    } else {
      // Si pas de date spécifique, utiliser la date actuelle selon la vue
      setSelectedDate(new Date(currentDate))
    }
    setSelectedTime(time || '10:00')
    setIsNewShippingModalOpen(true)
  }, [currentDate])

  // Gérer le clic sur une cellule du calendrier
  const handleCellClick = useCallback((date: Date, hour?: number) => {
    const time = hour !== undefined 
      ? `${hour.toString().padStart(2, '0')}:00`
      : '10:00'
    handleOpenModal(date, time)
  }, [handleOpenModal])

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <h1 style={titleStyle}>Planning</h1>
        <div style={controlsStyle}>
          <div style={{ display: 'flex', flexDirection: 'row', gap: '8px' }}>
            <button
              style={viewMode === 'day' ? viewModeButtonActiveStyle : viewModeButtonStyle}
              onClick={() => setViewMode('day')}
            >
              Jour
            </button>
            <button
              style={viewMode === 'week' ? viewModeButtonActiveStyle : viewModeButtonStyle}
              onClick={() => setViewMode('week')}
            >
              Semaine
            </button>
            <button
              style={viewMode === 'month' ? viewModeButtonActiveStyle : viewModeButtonStyle}
              onClick={() => setViewMode('month')}
            >
              Mois
            </button>
          </div>
          <button
            onClick={() => handleOpenModal()}
            style={{
              padding: '10px 20px',
              borderRadius: '8px',
              backgroundColor: themeColors.purplePrimary,
              color: '#FFFFFF',
              border: 'none',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'background-color 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = themeColors.purpleDark
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = themeColors.purplePrimary
            }}
          >
            <Plus size={16} />
            Nouvelle livraison B2B
          </button>
        </div>
      </div>

      <div style={calendarCardStyle}>
        {/* Navigation */}
        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <button
            onClick={() => navigatePeriod('prev')}
            style={{
              padding: '8px',
              borderRadius: '8px',
              border: `1px solid ${themeColors.cardBorder}`,
              backgroundColor: themeColors.cardBg,
              cursor: 'pointer',
            }}
          >
            <ChevronLeft size={20} style={{ color: themeColors.textPrimary }} />
          </button>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: themeColors.textPrimary }}>
            {viewMode === 'week' && weekDays.length > 0 && (
              <>
                {weekDays[0].toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} -{' '}
                {weekDays[6].toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
              </>
            )}
            {viewMode === 'day' && currentDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            {viewMode === 'month' && currentDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
          </h2>
          <button
            onClick={() => navigatePeriod('next')}
            style={{
              padding: '8px',
              borderRadius: '8px',
              border: `1px solid ${themeColors.cardBorder}`,
              backgroundColor: themeColors.cardBg,
              cursor: 'pointer',
            }}
          >
            <ChevronRight size={20} style={{ color: themeColors.textPrimary }} />
          </button>
        </div>

        {viewMode === 'week' && (
          <div style={weekViewStyle}>
            {weekDays.map((day, index) => {
              const dayKey = day.toISOString().split('T')[0]
              const deliveries = deliveriesByDate[dayKey] || []
              const isToday = day.toDateString() === new Date().toDateString()

              return (
                <div key={index}>
                  <div style={dayHeaderStyle}>
                    <div>{dayNames[index]}</div>
                    <div style={{ fontSize: '18px', fontWeight: 700, color: isToday ? themeColors.purplePrimary : themeColors.textPrimary, marginTop: '4px' }}>
                      {day.getDate()}
                    </div>
                  </div>
                  <div
                    onClick={() => handleCellClick(day)}
                    style={{
                      ...dayCellStyle,
                      backgroundColor: isToday ? `${themeColors.purplePrimary}20` : themeColors.grayLight,
                      borderColor: isToday ? themeColors.purplePrimary : themeColors.cardBorder,
                      cursor: 'pointer',
                      position: 'relative',
                    }}
                    onMouseEnter={(e) => {
                      if (!isToday) {
                        e.currentTarget.style.backgroundColor = themeColors.cardBorder
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isToday) {
                        e.currentTarget.style.backgroundColor = themeColors.grayLight
                      }
                    }}
                  >
                    {isLoadingB2B ? (
                      <div style={{ fontSize: '12px', color: themeColors.textSecondary, textAlign: 'center', padding: '8px' }}>
                        Chargement...
                      </div>
                    ) : deliveries.length === 0 ? (
                      <div style={{ fontSize: '11px', color: themeColors.textTertiary, textAlign: 'center', padding: '4px', fontStyle: 'italic' }}>
                        Cliquez pour ajouter
                      </div>
                    ) : (
                      deliveries.map((delivery) => (
                        <div
                          key={delivery.id}
                          style={{
                            ...deliveryItemStyle,
                            backgroundColor: '#6366F1', // Indigo pour B2B
                          }}
                          onClick={(e) => {
                            e.stopPropagation()
                            // Rediriger vers la page des commandes avec l'ID
                            window.location.href = `/orders?orderId=${delivery.orderId || delivery.id}`
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = '#4F46E5'
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = '#6366F1'
                          }}
                        >
                          <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
                            <span
                              style={{
                                padding: '2px 6px',
                                borderRadius: '4px',
                                fontSize: '9px',
                                fontWeight: 700,
                                backgroundColor: '#E0E7FF',
                                color: '#4338CA',
                                textTransform: 'uppercase',
                              }}
                            >
                              B2B
                            </span>
                            <span>{delivery.time}</span>
                          </div>
                          <div style={{ fontSize: '11px', opacity: 0.9 }}>{delivery.client}</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {viewMode === 'day' && (
          <div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {getDayHours().map((hour) => {
                const hourKey = `${hour.toString().padStart(2, '0')}:00`
                const dayKey = currentDate.toISOString().split('T')[0]
                const hourDeliveries = deliveriesByDate[dayKey]?.filter(d => d.time.startsWith(hourKey.slice(0, 2))) || []
                
                return (
                  <div
                    key={hour}
                    onClick={() => handleCellClick(currentDate, hour)}
                    style={{
                      display: 'flex',
                      flexDirection: 'row',
                      gap: '16px',
                      padding: '12px',
                      borderBottom: `1px solid ${themeColors.cardBorder}`,
                      cursor: 'pointer',
                      borderRadius: '8px',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = themeColors.grayLight
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent'
                    }}
                  >
                    <div style={{ minWidth: '80px', fontSize: '14px', fontWeight: 600, color: themeColors.textSecondary }}>
                      {hourKey}
                    </div>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {isLoadingB2B ? (
                        <div style={{ fontSize: '12px', color: themeColors.textSecondary }}>Chargement...</div>
                      ) : hourDeliveries.length === 0 ? (
                        <div style={{ fontSize: '11px', color: themeColors.textTertiary, fontStyle: 'italic' }}>
                          Cliquez pour ajouter une livraison
                        </div>
                      ) : (
                        hourDeliveries.map((delivery) => (
                          <div
                            key={delivery.id}
                            onClick={(e) => {
                              e.stopPropagation()
                              window.location.href = `/orders?orderId=${delivery.orderId || delivery.id}`
                            }}
                            style={{
                              ...deliveryItemStyle,
                              backgroundColor: '#6366F1', // Indigo pour B2B
                              maxWidth: '300px',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = '#4F46E5'
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = '#6366F1'
                            }}
                          >
                          <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
                            <span
                              style={{
                                padding: '2px 6px',
                                borderRadius: '4px',
                                fontSize: '9px',
                                fontWeight: 700,
                                backgroundColor: '#E0E7FF',
                                color: '#4338CA',
                                textTransform: 'uppercase',
                              }}
                            >
                              B2B
                            </span>
                            <span>{delivery.time}</span>
                          </div>
                          <div style={{ fontSize: '11px', opacity: 0.9 }}>{delivery.client}</div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {viewMode === 'month' && (
          <div style={{ textAlign: 'center', padding: '40px', color: themeColors.textSecondary }}>
            Vue mensuelle à venir
          </div>
        )}
      </div>

      <NewB2BShippingModal
        isOpen={isNewShippingModalOpen}
        onClose={() => {
          setIsNewShippingModalOpen(false)
          setSelectedDate(null)
          setSelectedTime(null)
        }}
        scheduledDate={selectedDate || undefined}
        scheduledTime={selectedTime || undefined}
      />
    </div>
  )
}
