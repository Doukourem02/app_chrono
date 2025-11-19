'use client'

import React, { useState } from 'react'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'

export default function PlanningPage() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewMode, setViewMode] = useState<'day' | 'week' | 'month'>('week')

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
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    color: '#374151',
  }

  const viewModeButtonActiveStyle: React.CSSProperties = {
    ...viewModeButtonStyle,
    backgroundColor: '#8B5CF6',
    color: '#FFFFFF',
    borderColor: '#8B5CF6',
  }

  const calendarCardStyle: React.CSSProperties = {
    backgroundColor: '#FFFFFF',
    borderRadius: '12px',
    padding: '24px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    border: '1px solid #F3F4F6',
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
    color: '#6B7280',
    textTransform: 'uppercase',
    borderBottom: '1px solid #E5E7EB',
  }

  const dayCellStyle: React.CSSProperties = {
    minHeight: '120px',
    padding: '8px',
    border: '1px solid #F3F4F6',
    borderRadius: '8px',
    backgroundColor: '#F9FAFB',
  }

  const deliveryItemStyle: React.CSSProperties = {
    padding: '8px',
    borderRadius: '6px',
    backgroundColor: '#8B5CF6',
    color: '#FFFFFF',
    fontSize: '12px',
    marginBottom: '4px',
    cursor: 'pointer',
  }

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

  const weekDays = getWeekDays()
  const dayNames = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

  const mockDeliveries: Record<string, Array<{ id: string; time: string; client: string }>> = {
    [weekDays[0].toISOString().split('T')[0]]: [
      { id: '1', time: '10:00', client: 'Client A' },
      { id: '2', time: '14:30', client: 'Client B' },
    ],
    [weekDays[2].toISOString().split('T')[0]]: [
      { id: '3', time: '09:00', client: 'Client C' },
    ],
  }

  const navigateWeek = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate)
    if (direction === 'prev') {
      newDate.setDate(newDate.getDate() - 7)
    } else {
      newDate.setDate(newDate.getDate() + 7)
    }
    setCurrentDate(newDate)
  }

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
            style={{
              padding: '10px 20px',
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
            }}
          >
            <Plus size={16} />
            Nouvelle livraison
          </button>
        </div>
      </div>

      <div style={calendarCardStyle}>
        {/* Navigation */}
        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <button
            onClick={() => navigateWeek('prev')}
            style={{
              padding: '8px',
              borderRadius: '8px',
              border: '1px solid #E5E7EB',
              backgroundColor: '#FFFFFF',
              cursor: 'pointer',
            }}
          >
            <ChevronLeft size={20} style={{ color: '#374151' }} />
          </button>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#111827' }}>
            {viewMode === 'week' && (
              <>
                {weekDays[0].toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} -{' '}
                {weekDays[6].toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
              </>
            )}
            {viewMode === 'day' && currentDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            {viewMode === 'month' && currentDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
          </h2>
          <button
            onClick={() => navigateWeek('next')}
            style={{
              padding: '8px',
              borderRadius: '8px',
              border: '1px solid #E5E7EB',
              backgroundColor: '#FFFFFF',
              cursor: 'pointer',
            }}
          >
            <ChevronRight size={20} style={{ color: '#374151' }} />
          </button>
        </div>

        {viewMode === 'week' && (
          <div style={weekViewStyle}>
            {weekDays.map((day, index) => {
              const dayKey = day.toISOString().split('T')[0]
              const deliveries = mockDeliveries[dayKey] || []
              const isToday = day.toDateString() === new Date().toDateString()

              return (
                <div key={index}>
                  <div style={dayHeaderStyle}>
                    <div>{dayNames[index]}</div>
                    <div style={{ fontSize: '18px', fontWeight: 700, color: isToday ? '#8B5CF6' : '#111827', marginTop: '4px' }}>
                      {day.getDate()}
                    </div>
                  </div>
                  <div
                    style={{
                      ...dayCellStyle,
                      backgroundColor: isToday ? '#F3E8FF' : '#F9FAFB',
                      borderColor: isToday ? '#8B5CF6' : '#F3F4F6',
                    }}
                  >
                    {deliveries.map((delivery) => (
                      <div
                        key={delivery.id}
                        style={deliveryItemStyle}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = '#7C3AED'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = '#8B5CF6'
                        }}
                      >
                        <div style={{ fontWeight: 600 }}>{delivery.time}</div>
                        <div style={{ fontSize: '11px', opacity: 0.9 }}>{delivery.client}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {viewMode === 'day' && (
          <div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {Array.from({ length: 24 }, (_, hour) => {
                const hourKey = `${hour.toString().padStart(2, '0')}:00`
                return (
                  <div
                    key={hour}
                    style={{
                      display: 'flex',
                      flexDirection: 'row',
                      gap: '16px',
                      padding: '12px',
                      borderBottom: '1px solid #F3F4F6',
                    }}
                  >
                    <div style={{ minWidth: '80px', fontSize: '14px', fontWeight: 600, color: '#6B7280' }}>
                      {hourKey}
                    </div>
                    <div style={{ flex: 1 }}>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {viewMode === 'month' && (
          <div style={{ textAlign: 'center', padding: '40px', color: '#6B7280' }}>
            Vue mensuelle à venir
          </div>
        )}
      </div>
    </div>
  )
}
