'use client'

import { Search, Bell, SlidersHorizontal, X, Package, User, ChevronDown } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { adminApiService } from '@/lib/adminApiService'
import { useDateFilter, type DateFilterType } from '@/contexts/DateFilterContext'

interface SearchOrder {
  id: string
  deliveryId: string
  pickup: string
  dropoff: string
  status: string
  clientName?: string
  driverName?: string
  createdAt: string
}

interface SearchUser {
  id: string
  email: string
  role: string
  phone: string
  first_name?: string | null
  last_name?: string | null
  fullName?: string | null
  createdAt: string
}

export default function Header() {
  const router = useRouter()
  const { dateFilter, setDateFilter } = useDateFilter()
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

  // Fermer les menus quand on clique en dehors
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
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
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSearchResultClick = (type: 'order' | 'user', id?: string) => {
    if (type === 'order' && id) {
      router.push(`/orders`)
      // Optionnel : on pourrait ajouter un paramètre pour pré-sélectionner la commande
    } else if (type === 'user' && id) {
      router.push(`/users/${id}`)
    } else {
      if (type === 'order') {
        router.push(`/orders`)
      } else if (type === 'user') {
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
        return '#8B5CF6'
      default:
        return '#6B7280'
    }
  }

  const getStatusLabel = (status: string) => {
    const statusMap: Record<string, string> = {
      completed: 'Complété',
      pending: 'En attente',
      accepted: 'Accepté',
      cancelled: 'Annulé',
      enroute: 'En route',
      picked_up: 'Récupéré',
    }
    return statusMap[status?.toLowerCase()] || status
  }

  const getRoleLabel = (role: string) => {
    const roleMap: Record<string, string> = {
      client: 'Client',
      driver: 'Livreur',
      admin: 'Admin',
    }
    return roleMap[role?.toLowerCase()] || role
  }

  const dateOptions: { value: DateFilterType; label: string }[] = [
    { value: 'today', label: "Aujourd'hui" },
    { value: 'thisWeek', label: 'Cette semaine' },
    { value: 'thisMonth', label: 'Ce mois' },
    { value: 'lastMonth', label: 'Mois dernier' },
    { value: 'all', label: 'Tout' },
  ]

  const headerStyle: React.CSSProperties = {
    backgroundColor: '#FFFFFF',
    borderRadius: '28px',
    boxShadow: '0 15px 35px rgba(15,23,42,0.08)',
    border: '1px solid #F3F4F6',
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
    color: '#9CA3AF',
    pointerEvents: 'none',
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    paddingLeft: '48px',
    paddingRight: '16px',
    paddingTop: '10px',
    paddingBottom: '10px',
    backgroundColor: '#F5F6FA',
    borderRadius: '16px',
    border: 'none',
    outline: 'none',
    fontSize: '14px',
    transition: 'all 0.2s',
  }

  const searchResultsStyle: React.CSSProperties = {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: '8px',
    backgroundColor: '#FFFFFF',
    borderRadius: '16px',
    boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
    border: '1px solid #E5E7EB',
    maxHeight: '400px',
    overflowY: 'auto',
    zIndex: 1000,
  }

  const searchResultItemStyle: React.CSSProperties = {
    padding: '12px 16px',
    borderBottom: '1px solid #F3F4F6',
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
    borderColor: '#E5E7EB',
    backgroundColor: 'transparent',
    color: '#6B7280',
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
    color: '#374151',
  }

  const notificationButtonStyle: React.CSSProperties = {
    ...buttonStyle,
    position: 'relative',
    color: '#4B5563',
  }

  const notificationDotStyle: React.CSSProperties = {
    position: 'absolute',
    top: '4px',
    right: '4px',
    width: '10px',
    height: '10px',
    backgroundColor: '#EF4444',
    borderRadius: '50%',
  }

  const dropdownStyle: React.CSSProperties = {
    position: 'absolute',
    top: '100%',
    right: 0,
    marginTop: '8px',
    backgroundColor: '#FFFFFF',
    borderRadius: '12px',
    boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
    border: '1px solid #E5E7EB',
    minWidth: '200px',
    zIndex: 1000,
    padding: '8px',
  }

  const dropdownItemStyle: React.CSSProperties = {
    padding: '10px 12px',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    color: '#374151',
    transition: 'background-color 0.2s',
  }

  const activeFilterStyle: React.CSSProperties = {
    ...buttonStyle,
    backgroundColor: '#8B5CF6',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#8B5CF6',
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
          placeholder="Search orders, drivers, customers..."
          style={inputStyle}
          onFocus={(e) => {
            e.target.style.boxShadow = '0 0 0 2px rgba(139, 92, 246, 0.2)'
            e.target.style.backgroundColor = '#FFFFFF'
            if (debouncedQuery.length > 2 || query.length > 2) {
              setShowSearchResults(true)
            }
          }}
          onBlur={(e) => {
            e.target.style.boxShadow = 'none'
            e.target.style.backgroundColor = '#F5F6FA'
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
              e.currentTarget.style.backgroundColor = '#F3F4F6'
              e.currentTarget.style.borderRadius = '8px'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent'
            }}
          >
            <X size={16} style={{ color: '#6B7280' }} />
          </button>
        )}
        {showSearchResults && (query.length > 2 || debouncedQuery.length > 2) && (
          <div style={searchResultsStyle}>
            {isSearching ? (
              <div style={{ padding: '24px', textAlign: 'center', color: '#6B7280' }}>
                Recherche en cours...
              </div>
            ) : searchResults?.data && (searchResults.data.orders.length > 0 || searchResults.data.users.length > 0) ? (
              <>
                {searchResults.data.orders.length > 0 && (
                  <>
                    <div style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', borderBottom: '1px solid #E5E7EB' }}>
                      Commandes ({searchResults.data.orders.length})
                    </div>
                    {((searchResults.data.orders as SearchOrder[]) || []).map((order: SearchOrder) => (
                      <div
                        key={order.id}
                        style={searchResultItemStyle}
                        onClick={() => handleSearchResultClick('order', order.id)}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = '#F9FAFB'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent'
                        }}
                      >
                        <Package size={20} style={{ color: '#8B5CF6', flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                            <div style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>
                              {order.deliveryId}
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
                          <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '2px' }}>
                            {order.pickup} → {order.dropoff}
                          </div>
                          {(order.clientName || order.driverName) && (
                            <div style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '4px' }}>
                              {order.clientName && `Client: ${order.clientName}`}
                              {order.clientName && order.driverName && ' • '}
                              {order.driverName && `Livreur: ${order.driverName}`}
                            </div>
                          )}
                          <div style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '2px' }}>
                            {order.createdAt}
                          </div>
                        </div>
                      </div>
                    ))}
                  </>
                )}
                {searchResults.data.users.length > 0 && (
                  <>
                    <div style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', borderBottom: '1px solid #E5E7EB' }}>
                      Utilisateurs ({searchResults.data.users.length})
                    </div>
                    {((searchResults.data.users as SearchUser[]) || []).map((user: SearchUser) => {
                      const displayName = user.fullName || user.email
                      const roleColor = user.role === 'driver' ? '#8B5CF6' : user.role === 'admin' ? '#EF4444' : '#10B981'
                      
                      return (
                        <div
                          key={user.id}
                          style={searchResultItemStyle}
                          onClick={() => handleSearchResultClick('user', user.id)}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = '#F9FAFB'
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent'
                          }}
                        >
                          <User size={20} style={{ color: roleColor, flexShrink: 0 }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                              <div style={{ fontSize: '14px', fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {displayName}
                              </div>
                              <span
                                style={{
                                  padding: '2px 8px',
                                  borderRadius: '4px',
                                  fontSize: '11px',
                                  fontWeight: 600,
                                  backgroundColor: roleColor + '20',
                                  color: roleColor,
                                  flexShrink: 0,
                                }}
                              >
                                {getRoleLabel(user.role)}
                              </span>
                            </div>
                            {user.fullName && (
                              <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '2px' }}>
                                {user.email}
                              </div>
                            )}
                            <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '2px' }}>
                              {user.phone}
                            </div>
                            <div style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '2px' }}>
                              Inscrit le {user.createdAt}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </>
                )}
              </>
            ) : (
              <div style={{ padding: '24px', textAlign: 'center', color: '#6B7280' }}>
                Aucun résultat trouvé
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
                e.currentTarget.style.backgroundColor = '#F9FAFB'
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
              <div style={{ padding: '12px', fontSize: '14px', fontWeight: 600, color: '#111827', borderBottom: '1px solid #E5E7EB', marginBottom: '8px' }}>
                Filtres
              </div>
              <div
                style={dropdownItemStyle}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#F9FAFB'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent'
                }}
                onClick={() => {
                  router.push('/orders?status=onProgress')
                  setShowFilters(false)
                }}
              >
                Commandes en cours
              </div>
              <div
                style={dropdownItemStyle}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#F9FAFB'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent'
                }}
                onClick={() => {
                  router.push('/orders?status=successful')
                  setShowFilters(false)
                }}
              >
                Commandes complétées
              </div>
              <div
                style={dropdownItemStyle}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#F9FAFB'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent'
                }}
                onClick={() => {
                  router.push('/users?role=driver')
                  setShowFilters(false)
                }}
              >
                Livreurs actifs
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
                e.currentTarget.style.backgroundColor = '#F9FAFB'
              }
            }}
            onMouseLeave={(e) => {
              if (!showDatePicker) {
                e.currentTarget.style.backgroundColor = 'transparent'
              }
            }}
          >
            <span style={{ color: showDatePicker ? '#FFFFFF' : '#6B7280' }}>
              {dateOptions.find((opt) => opt.value === dateFilter)?.label || 'Ce mois'}
            </span>
            <ChevronDown size={16} style={{ color: showDatePicker ? '#FFFFFF' : '#6B7280' }} />
          </button>
          {showDatePicker && (
            <div style={dropdownStyle}>
              {dateOptions.map((option) => (
                <div
                  key={option.value}
                  style={{
                    ...dropdownItemStyle,
                    backgroundColor: dateFilter === option.value ? '#F3E8FF' : 'transparent',
                    color: dateFilter === option.value ? '#8B5CF6' : '#374151',
                    fontWeight: dateFilter === option.value ? 600 : 400,
                  }}
                  onMouseEnter={(e) => {
                    if (dateFilter !== option.value) {
                      e.currentTarget.style.backgroundColor = '#F9FAFB'
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
              e.currentTarget.style.backgroundColor = '#F9FAFB'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent'
            }}
          >
            <Bell size={20} />
            <span style={notificationDotStyle}></span>
          </button>
          {showNotifications && (
            <div style={{ ...dropdownStyle, minWidth: '320px', maxHeight: '400px', overflowY: 'auto' }}>
              <div style={{ padding: '12px', fontSize: '14px', fontWeight: 600, color: '#111827', borderBottom: '1px solid #E5E7EB', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Notifications</span>
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
                    e.currentTarget.style.backgroundColor = '#F3F4F6'
                    e.currentTarget.style.borderRadius = '4px'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent'
                  }}
                >
                  <X size={16} style={{ color: '#6B7280' }} />
                </button>
              </div>
              <div style={{ padding: '24px', textAlign: 'center', color: '#6B7280' }}>
                <Bell size={32} style={{ color: '#D1D5DB', margin: '0 auto 12px' }} />
                <div style={{ fontSize: '14px' }}>Aucune notification</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
