'use client'

import { Search, Bell, SlidersHorizontal, X, Package, User, ChevronDown, CheckCheck } from 'lucide-react'
import { useState, useEffect, useRef, Fragment } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { adminApiService } from '@/lib/adminApiService'
import { useDateFilter, type DateFilterType } from '@/contexts/DateFilterContext'
import { useNotificationStore } from '@/stores/useNotificationStore'
import { useNotifications } from '@/hooks/useNotifications'
import { logger } from '@/utils/logger'
import { themeColors } from '@/utils/theme'
import { useTranslation } from '@/hooks/useTranslation'

interface SearchOrder {
  id: string
  deliveryId: string
  pickup: string
  dropoff: string
  status: string
  clientName?: string
  driverName?: string
  price?: string | null
  createdAt: string
}

interface SearchDriver {
  id: string
  email: string
  phone: string
  first_name?: string | null
  last_name?: string | null
  fullName?: string | null
  avatar_url?: string | null
  driver_type: string
  driver_type_label: string
  vehicle_type: string
  vehicle_type_label: string
  license_number?: string | null
  rating: string
  total_deliveries: number
  is_online: boolean
  is_available: boolean
  commission_balance?: string | null
  commission_rate?: string | null
  is_suspended: boolean
  createdAt: string
}

interface SearchClient {
  id: string
  email: string
  phone: string
  first_name?: string | null
  last_name?: string | null
  fullName?: string | null
  avatar_url?: string | null
  createdAt: string
}

export default function Header() {
  const router = useRouter()
  const { dateFilter, setDateFilter } = useDateFilter()
  const t = useTranslation()
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [showSearchResults, setShowSearchResults] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)
  const filtersRef = useRef<HTMLDivElement>(null)
  const datePickerRef = useRef<HTMLDivElement>(null)
  const notificationsRef = useRef<HTMLDivElement>(null)

  // Notifications
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotificationStore()
  useNotifications() // Active l'écoute des événements Socket.IO

  // Debounce pour éviter trop de requêtes
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query)
    }, 300) // Attendre 300ms après la dernière frappe

    return () => clearTimeout(timer)
  }, [query])

  const { data: searchResults, isLoading: isSearching } = useQuery({
    queryKey: ['global-search', debouncedQuery],
    queryFn: () => adminApiService.globalSearch(debouncedQuery),
    enabled: debouncedQuery.trim().length > 2,
    staleTime: 30000, // Cache pendant 30 secondes
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  })

  // Log pour déboguer les résultats de recherche
  useEffect(() => {
    if (searchResults?.data) {
      logger.debug('🔍 [Header] Résultats de recherche:', {
        query: debouncedQuery,
        ordersCount: searchResults.data.orders?.length || 0,
        driversCount: searchResults.data.drivers?.length || 0,
        clientsCount: searchResults.data.clients?.length || 0,
        orders: searchResults.data.orders?.slice(0, 3),
        drivers: searchResults.data.drivers?.slice(0, 3),
        clients: searchResults.data.clients?.slice(0, 3),
      })
    }
  }, [searchResults, debouncedQuery])

  // Fermer les menus quand on clique en dehors
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Utiliser un petit délai pour laisser le onClick du bouton se déclencher en premier
      setTimeout(() => {
        if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
          setShowSearchResults(false)
        }
        if (filtersRef.current && !filtersRef.current.contains(event.target as Node)) {
          setShowFilters(false)
        }
        if (datePickerRef.current && !datePickerRef.current.contains(event.target as Node)) {
          setShowDatePicker(false)
        }
        if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
          setShowNotifications(false)
        }
      }, 0)
    }

    // Utiliser 'click' au lieu de 'mousedown' pour que le onClick du bouton se déclenche en premier
    document.addEventListener('click', handleClickOutside, true)
    return () => document.removeEventListener('click', handleClickOutside, true)
  }, [])

  const handleSearchResultClick = (type: 'order' | 'driver' | 'client', id?: string, orderStatus?: string) => {
    if (type === 'order' && id) {
      // Mapper le statut de la commande vers le paramètre d'URL
      const statusToUrlMap: Record<string, string> = {
        'pending': 'onProgress',
        'accepted': 'onProgress',
        'enroute': 'onProgress',
        'picked_up': 'onProgress',
        'delivering': 'onProgress',
        'completed': 'successful',
        'cancelled': 'canceled',
        'canceled': 'canceled',
        'declined': 'canceled',
      }
      const urlStatus = orderStatus ? (statusToUrlMap[orderStatus.toLowerCase()] || 'all') : 'all'
      router.push(`/orders?status=${urlStatus}&orderId=${id}`)
    } else if (type === 'driver' && id) {
      router.push(`/drivers/${id}`)
    } else if (type === 'client' && id) {
      router.push(`/users/${id}`)
    } else {
      if (type === 'order') {
        router.push(`/orders`)
      } else if (type === 'driver') {
        router.push(`/drivers`)
      } else if (type === 'client') {
        router.push(`/users`)
      }
    }
    setShowSearchResults(false)
    setQuery('')
  }

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'completed':
        return '#10B981'
      case 'pending':
        return '#F59E0B'
      case 'accepted':
        return '#3B82F6'
      case 'cancelled':
        return '#EF4444'
      case 'enroute':
      case 'picked_up':
      case 'delivering':
        return '#8B5CF6'
      default:
        return '#6B7280'
    }
  }

  const getStatusLabel = (status: string) => {
    const statusKey = status?.toLowerCase() || ''
    return t(`header.searchResults.status.${statusKey}`) || status
  }

  const dateOptions: { value: DateFilterType; label: string }[] = [
    { value: 'today', label: t('header.dateFilter.today') },
    { value: 'thisWeek', label: t('header.dateFilter.thisWeek') },
    { value: 'thisMonth', label: t('header.dateFilter.thisMonth') },
    { value: 'lastMonth', label: t('header.dateFilter.lastMonth') },
    { value: 'all', label: t('header.dateFilter.all') },
  ]

  const headerStyle: React.CSSProperties = {
    backgroundColor: themeColors.cardBg,
    borderRadius: '28px',
    boxShadow: '0 15px 35px rgba(15,23,42,0.08)',
    border: `1px solid ${themeColors.cardBorder}`,
    paddingLeft: '16px',
    paddingRight: '24px',
    paddingTop: '12px',
    paddingBottom: '12px',
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    position: 'relative',
    zIndex: 100,
  }

  const searchContainerStyle: React.CSSProperties = {
    flex: 1,
    position: 'relative',
  }

  const searchIconStyle: React.CSSProperties = {
    position: 'absolute',
    left: '16px',
    top: '50%',
    transform: 'translateY(-50%)',
    width: '20px',
    height: '20px',
    color: themeColors.textTertiary,
    pointerEvents: 'none',
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    paddingLeft: '48px',
    paddingRight: '16px',
    paddingTop: '10px',
    paddingBottom: '10px',
    backgroundColor: themeColors.grayLight,
    borderRadius: '16px',
    border: 'none',
    outline: 'none',
    fontSize: '14px',
    transition: 'all 0.2s',
    color: themeColors.textPrimary,
  }

  const searchResultsStyle: React.CSSProperties = {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: '8px',
    backgroundColor: themeColors.cardBg,
    borderRadius: '16px',
    boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
    border: `1px solid ${themeColors.cardBorder}`,
    maxHeight: '400px',
    overflowY: 'auto',
    zIndex: 1000,
  }

  const searchResultItemStyle: React.CSSProperties = {
    padding: '12px 16px',
    borderBottom: `1px solid ${themeColors.cardBorder}`,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    transition: 'background-color 0.2s',
  }

  const buttonsContainerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  }

  const buttonStyle: React.CSSProperties = {
    paddingTop: '12px',
    paddingBottom: '12px',
    paddingLeft: '12px',
    paddingRight: '12px',
    borderRadius: '12px',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: themeColors.cardBorder,
    backgroundColor: 'transparent',
    color: themeColors.textSecondary,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background-color 0.2s',
    position: 'relative',
  }

  const monthButtonStyle: React.CSSProperties = {
    ...buttonStyle,
    gap: '8px',
    paddingLeft: '16px',
    paddingRight: '16px',
    paddingTop: '10px',
    paddingBottom: '10px',
    fontSize: '14px',
    fontWeight: 500,
    color: themeColors.textPrimary,
  }

  const notificationButtonStyle: React.CSSProperties = {
    ...buttonStyle,
    position: 'relative',
    color: themeColors.textPrimary,
  }

  const notificationBadgeStyle: React.CSSProperties = {
    position: 'absolute',
    top: '-4px',
    right: '-4px',
    width: unreadCount > 9 ? '26px' : '22px',
    height: unreadCount > 9 ? '26px' : '22px',
    minWidth: unreadCount > 9 ? '26px' : '22px',
    padding: 0,
    backgroundColor: '#EF4444',
    color: '#FFFFFF',
    borderRadius: '50%',
    fontSize: unreadCount > 9 ? '11px' : '12px',
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '2px solid #FFFFFF',
    transition: 'all 0.2s',
  }

  const handleNotificationClick = (notification: typeof notifications[0]) => {
    markAsRead(notification.id)
    if (notification.link) {
      router.push(notification.link)
      setShowNotifications(false)
    }
  }

  const formatNotificationTime = (createdAt: string) => {
    const date = new Date(createdAt)
    const now = new Date()
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

    if (diffInSeconds < 60) {
      return t('header.notifications.justNow')
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60)
      return `${t('header.notifications.ago')} ${minutes} ${t('header.notifications.minutes')}`
    } else if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600)
      return `${t('header.notifications.ago')} ${hours}${t('header.notifications.hours')}`
    } else if (diffInSeconds < 604800) {
      const days = Math.floor(diffInSeconds / 86400)
      return `${t('header.notifications.ago')} ${days}${t('header.notifications.days')}`
    } else {
      return date.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: 'short',
      })
    }
  }

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'order':
        return <Package size={16} style={{ color: '#8B5CF6' }} />
      case 'message':
        return <User size={16} style={{ color: '#3B82F6' }} />
      case 'dispute':
        return <X size={16} style={{ color: '#EF4444' }} />
      default:
        return <Bell size={16} style={{ color: '#6B7280' }} />
    }
  }

  const dropdownStyle: React.CSSProperties = {
    position: 'absolute',
    top: '100%',
    right: 0,
    marginTop: '8px',
    backgroundColor: themeColors.cardBg,
    borderRadius: '12px',
    boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
    border: `1px solid ${themeColors.cardBorder}`,
    minWidth: '200px',
    zIndex: 1000,
    padding: '8px',
  }

  const dropdownItemStyle: React.CSSProperties = {
    padding: '10px 12px',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    color: themeColors.textPrimary,
    transition: 'background-color 0.2s',
  }

  const activeFilterStyle: React.CSSProperties = {
    ...buttonStyle,
    backgroundColor: themeColors.purplePrimary,
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: themeColors.purplePrimary,
    color: '#FFFFFF',
  }

  return (
    <div style={headerStyle}>
      <div style={searchContainerStyle} ref={searchRef}>
        <Search style={searchIconStyle} />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setShowSearchResults(e.target.value.length > 2)
          }}
          placeholder={t('header.searchPlaceholder')}
          style={inputStyle}
          onFocus={(e) => {
            e.target.style.boxShadow = '0 0 0 2px rgba(139, 92, 246, 0.2)'
            e.target.style.backgroundColor = themeColors.cardBg
            if (debouncedQuery.length > 2 || query.length > 2) {
              setShowSearchResults(true)
            }
          }}
          onBlur={(e) => {
            e.target.style.boxShadow = 'none'
            e.target.style.backgroundColor = themeColors.grayLight
          }}
        />
        {query && (
          <button
            onClick={() => {
              setQuery('')
              setShowSearchResults(false)
            }}
            style={{
              position: 'absolute',
              right: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              padding: '4px',
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = themeColors.grayLight
              e.currentTarget.style.borderRadius = '8px'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent'
            }}
          >
            <X size={16} style={{ color: themeColors.textSecondary }} />
          </button>
        )}
        {showSearchResults && (query.length > 2 || debouncedQuery.length > 2) && (
          <div style={searchResultsStyle}>
            {isSearching ? (
              <div style={{ padding: '24px', textAlign: 'center', color: themeColors.textSecondary }}>
                {t('header.searching')}
              </div>
            ) : searchResults?.data && (searchResults.data.orders.length > 0 || searchResults.data.drivers.length > 0 || searchResults.data.clients.length > 0) ? (
              <>
                {(() => {
                  const hasOrders = searchResults.data.orders.length > 0
                  const hasDrivers = searchResults.data.drivers.length > 0
                  const hasClients = searchResults.data.clients.length > 0
                  
                  // Calculer un score de pertinence pour chaque catégorie
                  const normalizedQuery = debouncedQuery.toLowerCase().trim()
                  
                  // Fonction pour extraire les initiales d'un nom complet (première lettre de chaque mot)
                  const getInitials = (fullName: string): string => {
                    if (!fullName) return ''
                    return fullName
                      .split(/\s+/)
                      .map(word => word.charAt(0))
                      .join('')
                      .toLowerCase()
                  }
                  
                  // Fonction pour extraire les mots d'un nom (pour détecter les correspondances partielles)
                  const getNameWords = (fullName: string): string[] => {
                    if (!fullName) return []
                    return fullName
                      .toLowerCase()
                      .split(/\s+/)
                      .filter(word => word.length > 0)
                  }
                  
                  // Détecter si la recherche ressemble à un ID de commande
                  const isOrderId = normalizedQuery.startsWith('chlv') || 
                                   normalizedQuery.match(/^[a-z]{4}-\d{6}-[a-z0-9]{4}$/i)
                  
                  // Détecter si c'est un nom (pas un ID de commande, lettres uniquement, peut contenir des espaces)
                  const looksLikeName = !isOrderId && 
                                       /^[a-z\s]+$/.test(normalizedQuery) &&
                                       normalizedQuery.length >= 2
                  
                  // Score pour les commandes
                  let ordersScore = 0
                  if (hasOrders) {
                    // Si la recherche est un ID de commande, priorité maximale
                    if (isOrderId) {
                      ordersScore = 100
                    } else if (looksLikeName) {
                      // Si c'est un nom, score très bas pour les commandes (car c'est indirect)
                      // Seulement si le nom correspond au client ou livreur de la commande
                      const nameMatches = (searchResults.data.orders as SearchOrder[]).filter(order => {
                        const clientName = order.clientName?.toLowerCase() || ''
                        const driverName = order.driverName?.toLowerCase() || ''
                        return clientName.includes(normalizedQuery) || driverName.includes(normalizedQuery)
                      }).length
                      // Score très faible car recherche indirecte (via nom dans commande)
                      ordersScore = nameMatches * 1
                    } else {
                      // Score basé sur le nombre de résultats et les correspondances exactes
                      const exactMatches = (searchResults.data.orders as SearchOrder[]).filter(order => 
                        order.deliveryId?.toLowerCase().includes(normalizedQuery) ||
                        order.clientName?.toLowerCase().includes(normalizedQuery) ||
                        order.driverName?.toLowerCase().includes(normalizedQuery)
                      ).length
                      ordersScore = exactMatches * 10 + searchResults.data.orders.length
                    }
                  }
                  
                  // Score pour les livreurs
                  let driversScore = 0
                  if (hasDrivers && looksLikeName) {
                    // Analyser les correspondances dans les noms des livreurs
                    const drivers = searchResults.data.drivers as SearchDriver[]
                    const queryWords = normalizedQuery.split(/\s+/).filter(w => w.length > 0)
                    
                    let directNameMatches = 0
                    let partialMatches = 0
                    let initialsMatches = 0
                    
                    drivers.forEach(driver => {
                      const fullName = driver.fullName?.toLowerCase() || ''
                      if (!fullName) return
                      
                      const nameWords = getNameWords(fullName)
                      const initials = getInitials(fullName)
                      
                      // Correspondance exacte dans le nom complet
                      if (fullName.includes(normalizedQuery)) {
                        directNameMatches++
                      }
                      // Correspondance avec les initiales
                      else if (initials.startsWith(normalizedQuery) || normalizedQuery.startsWith(initials)) {
                        initialsMatches++
                      }
                      // Correspondance partielle avec un mot du nom
                      else if (queryWords.some(qw => nameWords.some(nw => nw.includes(qw) || qw.includes(nw)))) {
                        partialMatches++
                      }
                    })
                    
                    // Score prioritaire : correspondances directes dans le nom
                    driversScore = directNameMatches * 100 + initialsMatches * 50 + partialMatches * 25
                  } else if (hasDrivers) {
                    // Pour les recherches non-nom (emails, téléphones, etc.)
                    const exactMatches = (searchResults.data.drivers as SearchDriver[]).filter(driver => {
                      const fullName = driver.fullName?.toLowerCase() || ''
                      const email = driver.email?.toLowerCase() || ''
                      const phone = driver.phone?.toLowerCase() || ''
                      return fullName.includes(normalizedQuery) || email.includes(normalizedQuery) || phone.includes(normalizedQuery)
                    }).length
                    driversScore = exactMatches * 10 + searchResults.data.drivers.length
                  }
                  
                  // Score pour les clients
                  let clientsScore = 0
                  if (hasClients && looksLikeName) {
                    // Analyser les correspondances dans les noms des clients
                    const clients = searchResults.data.clients as SearchClient[]
                    const queryWords = normalizedQuery.split(/\s+/).filter(w => w.length > 0)
                    
                    let directNameMatches = 0
                    let partialMatches = 0
                    let initialsMatches = 0
                    
                    clients.forEach(client => {
                      const fullName = client.fullName?.toLowerCase() || ''
                      if (!fullName) return
                      
                      const nameWords = getNameWords(fullName)
                      const initials = getInitials(fullName)
                      
                      // Correspondance exacte dans le nom complet
                      if (fullName.includes(normalizedQuery)) {
                        directNameMatches++
                      }
                      // Correspondance avec les initiales
                      else if (initials.startsWith(normalizedQuery) || normalizedQuery.startsWith(initials)) {
                        initialsMatches++
                      }
                      // Correspondance partielle avec un mot du nom
                      else if (queryWords.some(qw => nameWords.some(nw => nw.includes(qw) || qw.includes(nw)))) {
                        partialMatches++
                      }
                    })
                    
                    // Score prioritaire : correspondances directes dans le nom
                    clientsScore = directNameMatches * 100 + initialsMatches * 50 + partialMatches * 25
                  } else if (hasClients) {
                    // Pour les recherches non-nom (emails, téléphones, etc.)
                    const exactMatches = (searchResults.data.clients as SearchClient[]).filter(client => {
                      const fullName = client.fullName?.toLowerCase() || ''
                      const email = client.email?.toLowerCase() || ''
                      const phone = client.phone?.toLowerCase() || ''
                      return fullName.includes(normalizedQuery) || email.includes(normalizedQuery) || phone.includes(normalizedQuery)
                    }).length
                    clientsScore = exactMatches * 10 + searchResults.data.clients.length
                  }
                  
                  // Créer un tableau des catégories avec leurs scores
                  const categories = [
                    { type: 'orders' as const, score: ordersScore, hasResults: hasOrders },
                    { type: 'drivers' as const, score: driversScore, hasResults: hasDrivers },
                    { type: 'clients' as const, score: clientsScore, hasResults: hasClients },
                  ]
                  
                  // Trier par score décroissant, puis par ordre alphabétique si scores égaux
                  categories.sort((a, b) => {
                    if (a.score !== b.score) {
                      return b.score - a.score
                    }
                    return a.type.localeCompare(b.type)
                  })
                  
                  // Afficher les catégories dans l'ordre de pertinence
                  return (
                    <>
                      {categories.map((category, categoryIndex) => {
                        if (!category.hasResults) return null
                        
                        if (category.type === 'orders') {
                          return (
                            <Fragment key="orders">
                              {/* Commandes */}
                              <div style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: themeColors.textSecondary, textTransform: 'uppercase', borderBottom: `1px solid ${themeColors.cardBorder}`, borderTop: categoryIndex > 0 ? `1px solid ${themeColors.cardBorder}` : 'none', marginTop: categoryIndex > 0 ? '8px' : '0' }}>
                                {t('header.searchResults.orders')} ({searchResults.data?.orders?.length || 0})
                              </div>
                              {((searchResults.data?.orders as SearchOrder[]) || []).map((order: SearchOrder) => (
                                <div
                                  key={order.id}
                                  style={searchResultItemStyle}
                                  onClick={() => handleSearchResultClick('order', order.id, order.status)}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = themeColors.grayLight
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = 'transparent'
                                  }}
                                >
                                  <Package size={20} style={{ color: themeColors.purplePrimary, flexShrink: 0 }} />
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                      <div style={{ fontSize: '14px', fontWeight: 600, color: themeColors.textPrimary }}>
                                        {order.deliveryId || order.id.slice(0, 8) + '...'}
                                      </div>
                                      <span
                                        style={{
                                          padding: '2px 8px',
                                          borderRadius: '4px',
                                          fontSize: '11px',
                                          fontWeight: 600,
                                          backgroundColor: getStatusColor(order.status) + '20',
                                          color: getStatusColor(order.status),
                                        }}
                                      >
                                        {getStatusLabel(order.status)}
                                      </span>
                                    </div>
                                    <div style={{ fontSize: '12px', color: themeColors.textSecondary, marginBottom: '2px' }}>
                                      {order.pickup} → {order.dropoff}
                                    </div>
                                    {order.price && (
                                      <div style={{ fontSize: '12px', color: themeColors.purplePrimary, fontWeight: 600, marginBottom: '2px' }}>
                                        {order.price}
                                      </div>
                                    )}
                                    {(order.clientName || order.driverName) && (
                                      <div style={{ fontSize: '11px', color: themeColors.textTertiary, marginTop: '4px' }}>
                                        {order.clientName && `${t('header.searchResults.client')}: ${order.clientName}`}
                                        {order.clientName && order.driverName && ' • '}
                                        {order.driverName && `${t('header.searchResults.driver')}: ${order.driverName}`}
                                      </div>
                                    )}
                                    <div style={{ fontSize: '11px', color: themeColors.textTertiary, marginTop: '2px' }}>
                                      {order.createdAt}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </Fragment>
                          )
                        }
                        
                        if (category.type === 'drivers') {
                          return (
                            <Fragment key="drivers">
                              {/* Livreurs */}
                              <div style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: themeColors.textSecondary, textTransform: 'uppercase', borderBottom: `1px solid ${themeColors.cardBorder}`, borderTop: categoryIndex > 0 ? `1px solid ${themeColors.cardBorder}` : 'none', marginTop: categoryIndex > 0 ? '8px' : '0' }}>
                                {t('header.searchResults.drivers')} ({searchResults.data?.drivers?.length || 0})
                              </div>
                              {((searchResults.data?.drivers as SearchDriver[]) || []).map((driver: SearchDriver) => {
                                const displayName = driver.fullName || driver.email
                                
                                return (
                                  <div
                                    key={driver.id}
                                    style={searchResultItemStyle}
                                    onClick={() => handleSearchResultClick('driver', driver.id)}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.backgroundColor = themeColors.grayLight
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.backgroundColor = 'transparent'
                                    }}
                                  >
                                    <User size={20} style={{ color: themeColors.purplePrimary, flexShrink: 0 }} />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                                        <div style={{ fontSize: '14px', fontWeight: 600, color: themeColors.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                          {displayName}
                                        </div>
                                        <span
                                          style={{
                                            padding: '2px 8px',
                                            borderRadius: '4px',
                                            fontSize: '11px',
                                            fontWeight: 600,
                                            backgroundColor: driver.driver_type === 'internal' ? '#EF444420' : '#8B5CF620',
                                            color: driver.driver_type === 'internal' ? '#EF4444' : '#8B5CF6',
                                            flexShrink: 0,
                                          }}
                                        >
                                          {driver.driver_type_label}
                                        </span>
                                        <span
                                          style={{
                                            padding: '2px 8px',
                                            borderRadius: '4px',
                                            fontSize: '11px',
                                            fontWeight: 600,
                                            backgroundColor: driver.is_online ? '#10B98120' : '#6B728020',
                                            color: driver.is_online ? '#10B981' : '#6B7280',
                                            flexShrink: 0,
                                          }}
                                        >
                                          {driver.is_online ? t('header.searchResults.online') : t('header.searchResults.offline')}
                                        </span>
                                      </div>
                                      {driver.fullName && (
                                        <div style={{ fontSize: '12px', color: themeColors.textSecondary, marginBottom: '2px' }}>
                                          {driver.email}
                                        </div>
                                      )}
                                      <div style={{ fontSize: '12px', color: themeColors.textSecondary, marginBottom: '2px' }}>
                                        {driver.phone}
                                      </div>
                                      <div style={{ display: 'flex', gap: '12px', marginTop: '4px', flexWrap: 'wrap' }}>
                                        <div style={{ fontSize: '11px', color: themeColors.textTertiary }}>
                                          {driver.vehicle_type_label} {driver.license_number ? `• ${driver.license_number}` : ''}
                                        </div>
                                        <div style={{ fontSize: '11px', color: themeColors.textTertiary }}>
                                          ⭐ {driver.rating} ({driver.total_deliveries} {t('header.searchResults.deliveries')})
                                        </div>
                                        {driver.commission_balance && (
                                          <div style={{ fontSize: '11px', color: themeColors.purplePrimary, fontWeight: 600 }}>
                                            💰 {driver.commission_balance} ({driver.commission_rate})
                                          </div>
                                        )}
                                      </div>
                                      <div style={{ fontSize: '11px', color: themeColors.textTertiary, marginTop: '2px' }}>
                                        {t('header.searchResults.registeredOn')} {driver.createdAt}
                                      </div>
                                    </div>
                                  </div>
                                )
                              })}
                            </Fragment>
                          )
                        }
                        
                        if (category.type === 'clients') {
                          return (
                            <Fragment key="clients">
                              {/* Clients */}
                              <div style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: themeColors.textSecondary, textTransform: 'uppercase', borderBottom: `1px solid ${themeColors.cardBorder}`, borderTop: categoryIndex > 0 ? `1px solid ${themeColors.cardBorder}` : 'none', marginTop: categoryIndex > 0 ? '8px' : '0' }}>
                                {t('header.searchResults.clients')} ({searchResults.data?.clients?.length || 0})
                              </div>
                              {((searchResults.data?.clients as SearchClient[]) || []).map((client: SearchClient) => {
                                const displayName = client.fullName || client.email
                                
                                return (
                                  <div
                                    key={client.id}
                                    style={searchResultItemStyle}
                                    onClick={() => handleSearchResultClick('client', client.id)}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.backgroundColor = themeColors.grayLight
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.backgroundColor = 'transparent'
                                    }}
                                  >
                                    <User size={20} style={{ color: '#10B981', flexShrink: 0 }} />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                        <div style={{ fontSize: '14px', fontWeight: 600, color: themeColors.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                          {displayName}
                                        </div>
                                        <span
                                          style={{
                                            padding: '2px 8px',
                                            borderRadius: '4px',
                                            fontSize: '11px',
                                            fontWeight: 600,
                                            backgroundColor: '#10B98120',
                                            color: '#10B981',
                                            flexShrink: 0,
                                          }}
                                        >
                                          {t('header.searchResults.client')}
                                        </span>
                                      </div>
                                      {client.fullName && (
                                        <div style={{ fontSize: '12px', color: themeColors.textSecondary, marginBottom: '2px' }}>
                                          {client.email}
                                        </div>
                                      )}
                                      <div style={{ fontSize: '12px', color: themeColors.textSecondary, marginBottom: '2px' }}>
                                        {client.phone}
                                      </div>
                                      <div style={{ fontSize: '11px', color: themeColors.textTertiary, marginTop: '2px' }}>
                                        {t('header.searchResults.registeredOn')} {client.createdAt}
                                      </div>
                                    </div>
                                  </div>
                                )
                              })}
                            </Fragment>
                          )
                        }
                        
                        return null
                      })}
                    </>
                  )
                })()}
              </>
            ) : (
              <div style={{ padding: '24px', textAlign: 'center', color: themeColors.textSecondary }}>
                {t('common.noResults')}
              </div>
            )}
          </div>
        )}
      </div>

      <div style={buttonsContainerStyle}>
        <div style={{ position: 'relative' }} ref={filtersRef}>
          <button
            style={showFilters ? activeFilterStyle : buttonStyle}
            onClick={() => {
              setShowFilters(!showFilters)
              setShowDatePicker(false)
              setShowNotifications(false)
            }}
            onMouseEnter={(e) => {
              if (!showFilters) {
                e.currentTarget.style.backgroundColor = themeColors.grayLight
              }
            }}
            onMouseLeave={(e) => {
              if (!showFilters) {
                e.currentTarget.style.backgroundColor = 'transparent'
              }
            }}
          >
            <SlidersHorizontal size={20} />
          </button>
          {showFilters && (
            <div style={dropdownStyle}>
              <div style={{ padding: '12px', fontSize: '14px', fontWeight: 600, color: themeColors.textPrimary, borderBottom: `1px solid ${themeColors.cardBorder}`, marginBottom: '8px' }}>
                {t('header.filters.title')}
              </div>
              <div
                style={dropdownItemStyle}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = themeColors.grayLight
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent'
                }}
                onClick={() => {
                  router.push('/orders?status=onProgress')
                  setShowFilters(false)
                }}
              >
                {t('header.filters.ongoingOrders')}
              </div>
              <div
                style={dropdownItemStyle}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = themeColors.grayLight
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent'
                }}
                onClick={() => {
                  router.push('/orders?status=successful')
                  setShowFilters(false)
                }}
              >
                {t('header.filters.completedOrders')}
              </div>
              <div
                style={dropdownItemStyle}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = themeColors.grayLight
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent'
                }}
                onClick={() => {
                  router.push('/users?role=driver')
                  setShowFilters(false)
                }}
              >
                {t('header.filters.activeDrivers')}
              </div>
            </div>
          )}
        </div>

        <div style={{ position: 'relative' }} ref={datePickerRef}>
          <button
            style={showDatePicker ? activeFilterStyle : monthButtonStyle}
            onClick={() => {
              setShowDatePicker(!showDatePicker)
              setShowFilters(false)
              setShowNotifications(false)
            }}
            onMouseEnter={(e) => {
              if (!showDatePicker) {
                e.currentTarget.style.backgroundColor = themeColors.grayLight
              }
            }}
            onMouseLeave={(e) => {
              if (!showDatePicker) {
                e.currentTarget.style.backgroundColor = 'transparent'
              }
            }}
          >
            <span style={{ color: showDatePicker ? '#FFFFFF' : themeColors.textSecondary }}>
              {dateOptions.find((opt) => opt.value === dateFilter)?.label || t('header.dateFilter.thisMonth')}
            </span>
            <ChevronDown size={16} style={{ color: showDatePicker ? '#FFFFFF' : themeColors.textSecondary }} />
          </button>
          {showDatePicker && (
            <div style={dropdownStyle}>
              {dateOptions.map((option) => (
                <div
                  key={option.value}
                  style={{
                    ...dropdownItemStyle,
                    backgroundColor: dateFilter === option.value ? `${themeColors.purplePrimary}20` : 'transparent',
                    color: dateFilter === option.value ? themeColors.purplePrimary : themeColors.textPrimary,
                    fontWeight: dateFilter === option.value ? 600 : 400,
                  }}
                  onMouseEnter={(e) => {
                    if (dateFilter !== option.value) {
                      e.currentTarget.style.backgroundColor = themeColors.grayLight
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (dateFilter !== option.value) {
                      e.currentTarget.style.backgroundColor = 'transparent'
                    }
                  }}
                  onClick={() => {
                    setDateFilter(option.value)
                    setShowDatePicker(false)
                  }}
                >
                  {option.label}
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ position: 'relative' }} ref={notificationsRef}>
          <button
            style={notificationButtonStyle}
            onClick={() => {
              setShowNotifications(!showNotifications)
              setShowFilters(false)
              setShowDatePicker(false)
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = themeColors.grayLight
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent'
            }}
          >
            <Bell size={20} />
            {unreadCount > 0 && (
              <span style={notificationBadgeStyle}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
          {showNotifications && (
            <div style={{ ...dropdownStyle, minWidth: '360px', maxHeight: '500px', overflowY: 'auto', padding: 0 }}>
              <div style={{ padding: '12px 16px', fontSize: '14px', fontWeight: 600, color: themeColors.textPrimary, borderBottom: `1px solid ${themeColors.cardBorder}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, backgroundColor: themeColors.cardBg, zIndex: 10 }}>
                <span>{t('header.notifications.title')} {unreadCount > 0 && `(${unreadCount})`}</span>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  {unreadCount > 0 && (
                    <button
                      onClick={() => {
                        markAllAsRead()
                      }}
                      style={{
                        padding: '4px 8px',
                        backgroundColor: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '12px',
                        color: themeColors.textSecondary,
                        borderRadius: '4px',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = themeColors.grayLight
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent'
                      }}
                    >
                      <CheckCheck size={14} />
                      {t('header.notifications.markAllRead')}
                    </button>
                  )}
                  <button
                    onClick={() => setShowNotifications(false)}
                    style={{
                      padding: '4px',
                      backgroundColor: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = themeColors.grayLight
                      e.currentTarget.style.borderRadius = '4px'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent'
                    }}
                  >
                    <X size={16} style={{ color: themeColors.textSecondary }} />
                  </button>
                </div>
              </div>
              {notifications.length === 0 ? (
                <div style={{ padding: '48px 24px', textAlign: 'center', color: themeColors.textSecondary }}>
                  <Bell size={48} style={{ color: themeColors.textTertiary, margin: '0 auto 16px', opacity: 0.5 }} />
                  <div style={{ fontSize: '14px', fontWeight: 500 }}>{t('header.notifications.noNotifications')}</div>
                  <div style={{ fontSize: '12px', color: themeColors.textTertiary, marginTop: '4px' }}>
                    {t('header.notifications.noNotificationsDesc')}
                  </div>
                </div>
              ) : (
                <div>
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      onClick={() => handleNotificationClick(notification)}
                      style={{
                        padding: '12px 16px',
                        borderBottom: `1px solid ${themeColors.cardBorder}`,
                        cursor: 'pointer',
                        backgroundColor: notification.read ? themeColors.cardBg : themeColors.grayLight,
                        transition: 'background-color 0.2s',
                        display: 'flex',
                        gap: '12px',
                        alignItems: 'flex-start',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = themeColors.cardBorder
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = notification.read ? themeColors.cardBg : themeColors.grayLight
                      }}
                    >
                      <div style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '8px',
                        backgroundColor: notification.read ? themeColors.grayLight : `${themeColors.purplePrimary}20`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}>
                        {getNotificationIcon(notification.type)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', marginBottom: '4px' }}>
                          <div style={{ fontSize: '13px', fontWeight: notification.read ? 500 : 600, color: themeColors.textPrimary }}>
                            {notification.title}
                          </div>
                          {!notification.read && (
                            <div style={{
                              width: '8px',
                              height: '8px',
                              borderRadius: '50%',
                              backgroundColor: '#3B82F6',
                              flexShrink: 0,
                              marginTop: '4px',
                            }} />
                          )}
                        </div>
                        <div style={{ fontSize: '12px', color: themeColors.textSecondary, lineHeight: '1.4', marginBottom: '4px' }}>
                          {notification.message}
                        </div>
                        <div style={{ fontSize: '11px', color: themeColors.textTertiary }}>
                          {formatNotificationTime(notification.createdAt)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
