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
  
  // Mémoriser setDateFilter pour éviter les changements de référence
  const stableSetDateFilter = React.useCallback((filter: DateFilterType) => {
    setDateFilter(filter)
  }, [])
  
  // Utiliser un état pour la date actuelle qui ne change que quand nécessaire
  // Pour 'today' et 'thisWeek', on met à jour toutes les minutes
  // Pour 'thisMonth', on met à jour toutes les heures
  // Pour 'lastMonth' et 'all', on ne met jamais à jour
  const [currentDate] = useState(() => new Date())
  
  // DÉSACTIVÉ : Le setInterval causait des refetch automatiques toutes les 5 minutes
  // Même si la date ne changeait pas, le recalcul de dateRange changeait la référence
  // et déclenchait un refetch dans React Query
  // 
  // Solution : Ne mettre à jour currentDate que lors d'un changement de dateFilter
  // ou lors d'un rechargement de page. Les dates seront recalculées à ce moment-là.
  // 
  // Si on a vraiment besoin de mettre à jour automatiquement (ex: passage à minuit),
  // on peut le faire manuellement ou via un événement spécifique, mais pas via un interval
  // qui pollue les queryKeys et déclenche des refetch inutiles.
  
  // React.useEffect(() => {
  //   if (dateFilter === 'lastMonth' || dateFilter === 'all') {
  //     return
  //   }
  //   const interval = dateFilter === 'today' || dateFilter === 'thisWeek' 
  //     ? 300000 // 5 minutes
  //     : 3600000 // 1 heure
  //   const timer = setInterval(() => {
  //     const now = new Date()
  //     setCurrentDate(prevDate => {
  //       const shouldUpdate = 
  //         (dateFilter === 'today' || dateFilter === 'thisWeek') && 
  //         (now.getDate() !== prevDate.getDate() || 
  //          now.getMonth() !== prevDate.getMonth() || 
  //          now.getFullYear() !== prevDate.getFullYear())
  //         ||
  //         (dateFilter === 'thisMonth' && 
  //          (now.getMonth() !== prevDate.getMonth() || 
  //           now.getFullYear() !== prevDate.getFullYear()))
  //       return shouldUpdate ? now : prevDate
  //     })
  //   }, interval)
  //   return () => clearInterval(timer)
  // }, [dateFilter])

  // Calculer les dates avec useMemo - React gère automatiquement le cache
  // Pour 'thisMonth', on n'a besoin que de l'année et du mois, pas de la date exacte
  // Donc on peut utiliser une clé basée sur l'année et le mois uniquement
  // Utiliser useRef pour mémoriser la dernière valeur de dateRange et éviter les recalculs inutiles
  const dateRangeRef = React.useRef<{ startDate: string; endDate: string } | null>(null)
  
  const dateKey = useMemo(() => {
    if (dateFilter === 'lastMonth' || dateFilter === 'all') {
      // Pour ces filtres, la clé ne change jamais
      return `${dateFilter}-static`
    }
    // Pour 'thisMonth', utiliser seulement l'année et le mois
    if (dateFilter === 'thisMonth') {
      const year = currentDate.getFullYear()
      const month = currentDate.getMonth() // 0-indexé (0 = janvier, 10 = novembre)
      return `${dateFilter}-${year}-${month}`
    }
    // Pour 'today' et 'thisWeek', utiliser la date complète
    return `${dateFilter}-${currentDate.getFullYear()}-${currentDate.getMonth()}-${currentDate.getDate()}`
  }, [dateFilter, currentDate])

  const dateRange = useMemo(() => {
    const now = currentDate
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

    const result = {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
    }
    
    // Vérifier si la valeur a vraiment changé pour éviter les recalculs inutiles
    if (dateRangeRef.current && 
        dateRangeRef.current.startDate === result.startDate && 
        dateRangeRef.current.endDate === result.endDate) {
      // La valeur n'a pas changé, retourner la référence précédente pour éviter les re-renders
      if (process.env.NODE_ENV === 'development') {
        console.warn('🔄🔄🔄 [DateFilterContext] dateRange unchanged, reusing previous value:', {
          dateFilter,
          dateKey,
          result,
          timestamp: new Date().toISOString()
        })
      }
      return dateRangeRef.current
    }
    
    // La valeur a changé, mettre à jour la référence
    if (process.env.NODE_ENV === 'development') {
      console.warn('🔄🔄🔄 [DateFilterContext] dateRange changed:', {
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
    // Utiliser dateKey au lieu de currentDate pour éviter les recalculs inutiles
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFilter, dateKey]) // dateKey change seulement quand la date pertinente change

  // Mémoriser le contextValue pour éviter les changements de référence inutiles
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

