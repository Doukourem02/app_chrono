'use client'

import React, { createContext, useContext, useState, useMemo, ReactNode } from 'react'

export type DateFilterType = 'today' | 'thisWeek' | 'thisMonth' | 'lastMonth' | 'all'

interface DateFilterContextType {
  dateFilter: DateFilterType
  setDateFilter: (filter: DateFilterType) => void
  dateRange: { startDate: string; endDate: string }
}

const DateFilterContext = createContext<DateFilterContextType | undefined>(undefined)

export function DateFilterProvider({ children }: { children: ReactNode }) {
  const [dateFilter, setDateFilter] = useState<DateFilterType>('thisMonth')
  
  // Log pour détecter les re-renders du Provider
  if (process.env.NODE_ENV === 'development') {
    console.log('🔄 [DateFilterProvider] Render', {
      dateFilter,
      timestamp: new Date().toISOString(),
      stack: new Error().stack?.split('\n').slice(2, 5).join('\n')
    })
  }
  
  // Mémoriser setDateFilter pour éviter les changements de référence
  // useState retourne déjà une fonction stable, mais on s'assure qu'elle ne change jamais
  const stableSetDateFilter = React.useCallback((filter: DateFilterType) => {
    setDateFilter(filter)
  }, [])
  
  // Calculer les dates dans useMemo - React comparera par valeur, pas par référence
  const dateRange = useMemo(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('🔄 [DateFilterContext] Recalculating dateRange for filter:', dateFilter, { 
        timestamp: new Date().toISOString()
      })
    }
    
    const now = new Date()
    const endDate = new Date(now)
    endDate.setHours(23, 59, 59, 999) // Fin de la journée
    
    let startDate = new Date(now)

    switch (dateFilter) {
      case 'today':
        startDate.setHours(0, 0, 0, 0)
        break
      case 'thisWeek':
        // Début de la semaine (lundi)
        const dayOfWeek = now.getDay()
        const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1) // Ajuster pour lundi
        startDate = new Date(now)
        startDate.setDate(diff)
        startDate.setHours(0, 0, 0, 0)
        break
      case 'thisMonth':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1)
        startDate.setHours(0, 0, 0, 0)
        break
      case 'lastMonth':
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
        startDate.setHours(0, 0, 0, 0)
        const lastDayOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0)
        endDate.setTime(lastDayOfLastMonth.getTime())
        endDate.setHours(23, 59, 59, 999)
        break
      case 'all':
        // Toutes les dates - utiliser une date très ancienne
        startDate = new Date(2020, 0, 1)
        break
      default:
        startDate.setHours(0, 0, 0, 0)
    }

    const range = {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
    }
    
    if (process.env.NODE_ENV === 'development') {
      console.log('✅ [DateFilterContext] dateRange calculated:', range)
    }
    
    return range
  }, [dateFilter]) // Ne recalculer que quand dateFilter change

  // Mémoriser la valeur du Provider - React comparera par valeur, pas par référence
  const contextValue = React.useMemo(() => {
    const value = { dateFilter, setDateFilter: stableSetDateFilter, dateRange }
    if (process.env.NODE_ENV === 'development') {
      console.log('✅ [DateFilterContext] contextValue calculated')
    }
    return value
  }, [dateFilter, stableSetDateFilter, dateRange])

  return (
    <DateFilterContext.Provider value={contextValue}>
      {children}
    </DateFilterContext.Provider>
  )
}

export function useDateFilter() {
  const context = useContext(DateFilterContext)
  if (context === undefined) {
    throw new Error('useDateFilter must be used within a DateFilterProvider')
  }
  return context
}

