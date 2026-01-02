'use client'

import React, { createContext, useContext, useState, useMemo, ReactNode } from 'react'
import { logger } from '@/utils/logger'

export type DateFilterType = 'today' | 'thisWeek' | 'thisMonth' | 'lastMonth' | 'all'

interface DateFilterContextType {
  dateFilter: DateFilterType
  setDateFilter: (filter: DateFilterType) => void
  dateRange: { startDate: string; endDate: string }
}

const DateFilterContext = createContext<DateFilterContextType | undefined>(undefined)

export function DateFilterProvider({ children }: { children: ReactNode }) {
  const [dateFilter, setDateFilter] = useState<DateFilterType>('thisMonth')
  
  const stableSetDateFilter = React.useCallback((filter: DateFilterType) => {
    setDateFilter(filter)
  }, [])
  
  const [currentDate] = useState(() => new Date())
  

  const dateRangeRef = React.useRef<{ startDate: string; endDate: string } | null>(null)
  
  const dateKey = useMemo(() => {
    if (dateFilter === 'lastMonth' || dateFilter === 'all') {
      return `${dateFilter}-static`
    }
    if (dateFilter === 'thisMonth') {
      const year = currentDate.getFullYear()
      const month = currentDate.getMonth() 
      return `${dateFilter}-${year}-${month}`
    }
    return `${dateFilter}-${currentDate.getFullYear()}-${currentDate.getMonth()}-${currentDate.getDate()}`
  }, [dateFilter, currentDate])

  const dateRange = useMemo(() => {
    const now = currentDate
    const endDate = new Date(now)
    endDate.setHours(23, 59, 59, 999) 
    
    let startDate = new Date(now)

    switch (dateFilter) {
      case 'today':
        startDate.setHours(0, 0, 0, 0)
        break
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
      case 'lastMonth':
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
        startDate.setHours(0, 0, 0, 0)
        const lastDayOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0)
        endDate.setTime(lastDayOfLastMonth.getTime())
        endDate.setHours(23, 59, 59, 999)
        break
      case 'all':
        startDate = new Date(2020, 0, 1)
        break
      default:
        startDate.setHours(0, 0, 0, 0)
    }

    const result = {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
    }
    
    if (dateRangeRef.current && 
        dateRangeRef.current.startDate === result.startDate && 
        dateRangeRef.current.endDate === result.endDate) {
      if (process.env.NODE_ENV === 'development') {
        logger.warn('🔄🔄🔄 [DateFilterContext] dateRange unchanged, reusing previous value:', {
          dateFilter,
          dateKey,
          result,
          timestamp: new Date().toISOString()
        })
      }
      return dateRangeRef.current
    }
    
    if (process.env.NODE_ENV === 'development') {
      logger.warn('🔄🔄🔄 [DateFilterContext] dateRange changed:', {
        dateFilter,
        dateKey,
        previous: dateRangeRef.current,
        new: result,
        currentDate: currentDate.toISOString(),
        timestamp: new Date().toISOString(),
        stack: new Error().stack?.split('\n').slice(2, 10).join('\n')
      })
    }
    dateRangeRef.current = result
    return result
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFilter, dateKey]) // dateKey change seulement quand la date pertinente change


  const contextValue = useMemo(() => ({
    dateFilter,
    setDateFilter: stableSetDateFilter,
    dateRange
  }), [dateFilter, stableSetDateFilter, dateRange])

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

