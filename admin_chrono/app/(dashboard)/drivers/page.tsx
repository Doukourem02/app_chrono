'use client'

import React, { useState, useMemo, useTransition } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { Search, Filter, User, Briefcase, Wallet, AlertCircle, Eye, ChevronLeft, ChevronRight } from 'lucide-react'
import { adminApiService } from '@/lib/adminApiService'
import { ScreenTransition } from '@/components/animations'
import { SkeletonLoader } from '@/components/animations'
import type { Driver } from '@/types'

type DriverType = 'all' | 'partner' | 'internal'
type BalanceStatus = 'all' | 'active' | 'suspended' | 'low_balance'

export default function DriversPage() {
  const router = useRouter()
  const [currentPage, setCurrentPage] = useState(1)
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<DriverType>('all')
  const [balanceStatusFilter, setBalanceStatusFilter] = useState<BalanceStatus>('all')
  const [, startTransition] = useTransition()
  const itemsPerPage = 20

  // Debounce pour la recherche
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery)
    }, 300)

    return () => clearTimeout(timer)
  }, [searchQuery])

  const { data: driversData, isLoading, isFetching } = useQuery({
    queryKey: ['drivers', typeFilter, balanceStatusFilter, debouncedSearchQuery],
    queryFn: async () => {
      const result = await adminApiService.getDrivers({
        type: typeFilter === 'all' ? undefined : typeFilter,
        status: balanceStatusFilter === 'all' ? undefined : balanceStatusFilter,
        search: debouncedSearchQuery || undefined,
      })
      return result
    },
    refetchInterval: 30000, // Rafraîchir toutes les 30 secondes
    staleTime: 5000, // Considérer les données comme fraîches pendant 5 secondes
    placeholderData: (previousData) => previousData, // Garder les données précédentes pendant le chargement
  })

  const drivers = useMemo(() => {
    if (!driversData?.data) return []
    return (driversData.data as Driver[]) || []
  }, [driversData])

  const counts = driversData?.counts || {
    total: 0,
    partners: 0,
    internals: 0,
    active: 0,
    suspended: 0,
  }

  const filteredDrivers = useMemo(() => {
    return drivers
  }, [drivers])

  const totalPages = Math.max(1, Math.ceil(filteredDrivers.length / itemsPerPage))
  const paginatedDrivers = filteredDrivers.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  React.useEffect(() => {
    setCurrentPage(1)
  }, [typeFilter, balanceStatusFilter, searchQuery])

  // Réinitialiser balanceStatusFilter quand on passe à 'internal' (pas de commission pour internes)
  React.useEffect(() => {
    if (typeFilter === 'internal') {
      setBalanceStatusFilter('all')
    }
  }, [typeFilter])

  const formatCurrency = (amount: number | undefined) => {
    if (amount === undefined || amount === null) return 'N/A'
    return new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount) + ' FCFA'
  }

  const getBalanceColor = (balance: number | undefined, isSuspended: boolean | undefined, isInactive: boolean | undefined) => {
    // Suspendu manuellement (sanction) = Rouge foncé
    if (isSuspended) return '#DC2626' // Rouge foncé pour sanction
    // Non actif (solde à 0) = Orange
    if (isInactive || balance === 0) return '#F59E0B' // Orange pour solde insuffisant
    if (balance !== undefined && balance < 1000) return '#FBBF24' // Jaune
    if (balance !== undefined && balance < 3000) return '#FCD34D' // Jaune clair
    return '#10B981' // Vert
  }

  const getBalanceStatus = (balance: number | undefined, isSuspended: boolean | undefined, isInactive: boolean | undefined) => {
    // Suspendu manuellement (sanction)
    if (isSuspended) return 'Suspendu'
    // Non actif (solde insuffisant, pas une sanction)
    if (isInactive || balance === 0) return 'Non actif'
    if (balance !== undefined && balance < 1000) return 'Très faible'
    if (balance !== undefined && balance < 3000) return 'Faible'
    return 'Actif'
  }

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  }

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  }

  const titleStyle: React.CSSProperties = {
    fontSize: '24px',
    fontWeight: 700,
    color: '#111827',
  }

  const statsContainerStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(5, 1fr)',
    gap: '16px',
  }

  const statCardStyle: React.CSSProperties = {
    backgroundColor: '#FFFFFF',
    borderRadius: '12px',
    padding: '16px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    border: '1px solid #F3F4F6',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  }

  const statIconStyle = (color: string): React.CSSProperties => ({
    width: '40px',
    height: '40px',
    borderRadius: '10px',
    backgroundColor: color,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  })

  const statValueStyle: React.CSSProperties = {
    fontSize: '24px',
    fontWeight: 700,
    color: '#111827',
  }

  const statLabelStyle: React.CSSProperties = {
    fontSize: '12px',
    color: '#6B7280',
  }

  const filtersContainerStyle: React.CSSProperties = {
    display: 'flex',
    gap: '16px',
    alignItems: 'center',
    flexWrap: 'wrap',
  }

  const searchContainerStyle: React.CSSProperties = {
    position: 'relative',
    flex: 1,
    minWidth: '250px',
  }

  const searchInputStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px 16px 12px 44px',
    borderRadius: '12px',
    border: '1px solid #E5E7EB',
    fontSize: '14px',
    backgroundColor: '#FFFFFF',
    color: '#111827',
  }

  const filterButtonStyle = (active: boolean): React.CSSProperties => ({
    padding: '10px 16px',
    borderRadius: '8px',
    border: `1px solid ${active ? '#8B5CF6' : '#E5E7EB'}`,
    backgroundColor: active ? '#F3F0FF' : '#FFFFFF',
    color: active ? '#8B5CF6' : '#6B7280',
    fontSize: '14px',
    fontWeight: active ? 600 : 500,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  })

  const tableContainerStyle: React.CSSProperties = {
    backgroundColor: '#FFFFFF',
    borderRadius: '12px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    border: '1px solid #F3F4F6',
    overflow: 'hidden',
  }

  const tableStyle: React.CSSProperties = {
    width: '100%',
    borderCollapse: 'collapse',
  }

  const thStyle: React.CSSProperties = {
    padding: '16px',
    textAlign: 'left',
    fontSize: '12px',
    fontWeight: 600,
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    borderBottom: '1px solid #E5E7EB',
    backgroundColor: '#F9FAFB',
  }

  const tdStyle: React.CSSProperties = {
    padding: '16px',
    fontSize: '14px',
    color: '#111827',
    borderBottom: '1px solid #F3F4F6',
  }

  const badgeStyle = (type: 'partner' | 'internal'): React.CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '4px 12px',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: 600,
    backgroundColor: type === 'partner' ? '#D1FAE5' : '#DBEAFE',
    color: type === 'partner' ? '#065F46' : '#1E40AF',
  })

  const actionButtonStyle: React.CSSProperties = {
    padding: '8px',
    borderRadius: '8px',
    border: '1px solid #E5E7EB',
    backgroundColor: '#FFFFFF',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  }

  const paginationStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '8px',
    marginTop: '24px',
  }

  const paginationButtonStyle = (disabled: boolean): React.CSSProperties => ({
    padding: '8px 16px',
    borderRadius: '8px',
    border: '1px solid #E5E7EB',
    backgroundColor: disabled ? '#F9FAFB' : '#FFFFFF',
    color: disabled ? '#9CA3AF' : '#111827',
    fontSize: '14px',
    fontWeight: 500,
    cursor: disabled ? 'not-allowed' : 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  })

  // Afficher le skeleton uniquement lors du premier chargement, pas lors des changements de filtre
  if (isLoading && !driversData) {
    return (
      <ScreenTransition>
        <div style={containerStyle}>
          <SkeletonLoader width="100%" height={200} borderRadius={12} />
          <SkeletonLoader width="100%" height={400} borderRadius={12} />
        </div>
      </ScreenTransition>
    )
  }

  return (
    <ScreenTransition>
      <div style={containerStyle}>
        <div style={headerStyle}>
          <h1 style={titleStyle}>Gestion des Livreurs</h1>

          {/* Statistiques */}
          <div style={statsContainerStyle}>
            <div style={statCardStyle}>
              <div style={statIconStyle('#8B5CF6')}>
                <User size={20} color="#FFFFFF" />
              </div>
              <div>
                <div style={statValueStyle}>{counts.total}</div>
                <div style={statLabelStyle}>Total Livreurs</div>
              </div>
            </div>
            <div style={statCardStyle}>
              <div style={statIconStyle('#10B981')}>
                <Briefcase size={20} color="#FFFFFF" />
              </div>
              <div>
                <div style={statValueStyle}>{counts.partners}</div>
                <div style={statLabelStyle}>Partenaires</div>
              </div>
            </div>
            <div style={statCardStyle}>
              <div style={statIconStyle('#3B82F6')}>
                <User size={20} color="#FFFFFF" />
              </div>
              <div>
                <div style={statValueStyle}>{counts.internals}</div>
                <div style={statLabelStyle}>Internes</div>
              </div>
            </div>
            <div style={statCardStyle}>
              <div style={statIconStyle('#10B981')}>
                <Wallet size={20} color="#FFFFFF" />
              </div>
              <div>
                <div style={statValueStyle}>{counts.active}</div>
                <div style={statLabelStyle}>Actifs</div>
              </div>
            </div>
            <div style={statCardStyle}>
              <div style={statIconStyle('#EF4444')}>
                <AlertCircle size={20} color="#FFFFFF" />
              </div>
              <div>
                <div style={statValueStyle}>{counts.suspended}</div>
                <div style={statLabelStyle}>Suspendus</div>
              </div>
            </div>
          </div>

          {/* Filtres */}
          <div style={filtersContainerStyle}>
            <div style={searchContainerStyle}>
              <Search
                size={20}
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#9CA3AF',
                }}
              />
              <input
                type="text"
                placeholder="Rechercher par nom, email, téléphone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={searchInputStyle}
              />
            </div>

            <button
              style={filterButtonStyle(typeFilter === 'all')}
              onClick={() => {
                startTransition(() => {
                  setTypeFilter('all')
                })
              }}
            >
              <Filter size={16} />
              Tous
            </button>
            <button
              style={filterButtonStyle(typeFilter === 'partner')}
              onClick={() => {
                startTransition(() => {
                  setTypeFilter('partner')
                })
              }}
            >
              <Briefcase size={16} />
              Partenaires
            </button>
            <button
              style={filterButtonStyle(typeFilter === 'internal')}
              onClick={() => {
                startTransition(() => {
                  setTypeFilter('internal')
                })
              }}
            >
              <User size={16} />
              Internes
            </button>

            {typeFilter === 'partner' || typeFilter === 'all' ? (
              <>
                <button
                  style={filterButtonStyle(balanceStatusFilter === 'active')}
                  onClick={() => {
                    startTransition(() => {
                      setBalanceStatusFilter('active')
                    })
                  }}
                >
                  <Wallet size={16} />
                  Actifs
                </button>
                <button
                  style={filterButtonStyle(balanceStatusFilter === 'suspended')}
                  onClick={() => {
                    startTransition(() => {
                      setBalanceStatusFilter('suspended')
                    })
                  }}
                >
                  <AlertCircle size={16} />
                  Suspendus
                </button>
                <button
                  style={filterButtonStyle(balanceStatusFilter === 'low_balance')}
                  onClick={() => {
                    startTransition(() => {
                      setBalanceStatusFilter('low_balance')
                    })
                  }}
                >
                  <AlertCircle size={16} />
                  Solde faible
                </button>
              </>
            ) : null}
          </div>
        </div>

        {/* Tableau */}
        <div style={{ ...tableContainerStyle, position: 'relative' }}>
          {isFetching && driversData && (
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '2px',
                backgroundColor: '#8B5CF6',
                zIndex: 10,
                opacity: 0.6,
              }}
            />
          )}
          <table style={{ ...tableStyle, opacity: isFetching && driversData ? 0.85 : 1, transition: 'opacity 0.15s ease' }}>
            <thead>
              <tr>
                <th style={thStyle}>Nom</th>
                <th style={thStyle}>Type</th>
                <th style={thStyle}>Email</th>
                <th style={thStyle}>Téléphone</th>
                <th style={thStyle}>Solde Commission</th>
                <th style={thStyle}>Statut</th>
                <th style={thStyle}>Livraisons</th>
                <th style={thStyle}>Rating</th>
                <th style={thStyle}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedDrivers.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ ...tdStyle, textAlign: 'center', padding: '40px' }}>
                    <div style={{ color: '#6B7280' }}>Aucun livreur trouvé</div>
                  </td>
                </tr>
              ) : (
                paginatedDrivers.map((driver: Driver) => {
                  const driverName =
                    driver.first_name && driver.last_name
                      ? `${driver.first_name} ${driver.last_name}`
                      : driver.full_name || driver.email || 'N/A'
                  const isPartner = driver.driver_type === 'partner'
                  const balance = driver.commission_balance ?? 0
                  const isSuspended = driver.is_suspended ?? false // Suspension manuelle (sanction)
                  const isInactive = driver.is_inactive ?? false // Solde insuffisant (pas une sanction)
                  const balanceColor = getBalanceColor(balance, isSuspended, isInactive)
                  const balanceStatus = getBalanceStatus(balance, isSuspended, isInactive)

                  return (
                    <tr key={driver.id}>
                      <td style={tdStyle}>{driverName}</td>
                      <td style={tdStyle}>
                        {driver.driver_type ? (
                          <span style={badgeStyle(driver.driver_type)}>
                            {driver.driver_type === 'partner' ? (
                              <>
                                <Briefcase size={12} />
                                Partenaire
                              </>
                            ) : (
                              <>
                                <User size={12} />
                                Interne
                              </>
                            )}
                          </span>
                        ) : (
                          'N/A'
                        )}
                      </td>
                      <td style={tdStyle}>{driver.email || 'N/A'}</td>
                      <td style={tdStyle}>{driver.phone || 'N/A'}</td>
                      <td style={tdStyle}>
                        {isPartner ? (
                          <div>
                            <div style={{ color: balanceColor, fontWeight: 600 }}>
                              {formatCurrency(balance)}
                            </div>
                            <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '2px' }}>
                              {balanceStatus}
                            </div>
                          </div>
                        ) : (
                          <span style={{ color: '#9CA3AF' }}>—</span>
                        )}
                      </td>
                      <td style={tdStyle}>
                        {driver.is_online ? (
                          <span style={{ color: '#10B981', fontWeight: 600 }}>En ligne</span>
                        ) : (
                          <span style={{ color: '#9CA3AF' }}>Hors ligne</span>
                        )}
                      </td>
                      <td style={tdStyle}>
                        {driver.completed_deliveries || 0} / {driver.total_deliveries || 0}
                      </td>
                      <td style={tdStyle}>
                        {driver.average_rating
                          ? `${driver.average_rating.toFixed(1)} ⭐`
                          : 'N/A'}
                      </td>
                      <td style={tdStyle}>
                        <button
                          style={actionButtonStyle}
                          onClick={() => router.push(`/drivers/${driver.id}`)}
                          title="Voir détails"
                        >
                          <Eye size={16} color="#6B7280" />
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={paginationStyle}>
            <button
              style={paginationButtonStyle(currentPage === 1)}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft size={16} />
              Précédent
            </button>
            <span style={{ padding: '8px 16px', color: '#6B7280' }}>
              Page {currentPage} sur {totalPages}
            </span>
            <button
              style={paginationButtonStyle(currentPage === totalPages)}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              Suivant
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>
    </ScreenTransition>
  )
}

