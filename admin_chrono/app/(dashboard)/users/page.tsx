'use client'

import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, Search, User, Truck, Shield, Eye } from 'lucide-react'
import { adminApiService } from '@/lib/adminApiService'
import { ScreenTransition } from '@/components/animations'
import { SkeletonLoader } from '@/components/animations'
import { asApiArray } from '@/types/api'

interface UserData {
  id: string
  email: string
  phone: string
  first_name?: string | null
  last_name?: string | null
  role: string
  avatar_url?: string | null
  createdAt: string
}

export default function UsersPage() {
  const router = useRouter()
  const [currentPage, setCurrentPage] = useState(1)
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const itemsPerPage = 10

  const { data: usersData, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const result = await adminApiService.getUsers()
      return result
    },
    refetchInterval: false, // Pas de refresh automatique - les utilisateurs changent rarement
    staleTime: Infinity, // Les données ne deviennent jamais "stale" - pas de refetch automatique
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  })

  const users = React.useMemo(() => {
    if (!usersData) return []
    return asApiArray<UserData>(usersData)
  }, [usersData])
  const counts = usersData?.counts || {
    client: 0,
    driver: 0,
    admin: 0,
    total: 0,
  }

  // Filtrer les utilisateurs
  const filteredUsers = React.useMemo(() => {
    let filtered = users

    // Filtrer par rôle
    if (roleFilter !== 'all') {
      filtered = filtered.filter((user: UserData) => user.role === roleFilter)
    }

    // Filtrer par recherche
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (user: UserData) =>
          user.email.toLowerCase().includes(query) ||
          user.phone.toLowerCase().includes(query) ||
          user.role.toLowerCase().includes(query) ||
          (user.first_name && user.first_name.toLowerCase().includes(query)) ||
          (user.last_name && user.last_name.toLowerCase().includes(query)) ||
          ((user.first_name && user.last_name) && `${user.first_name} ${user.last_name}`.toLowerCase().includes(query))
      )
    }

    return filtered
  }, [users, roleFilter, searchQuery])

  // Calculer la pagination
  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / itemsPerPage))
  const paginatedUsers = filteredUsers.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  // Réinitialiser la page quand on change de filtre
  React.useEffect(() => {
    setCurrentPage(1)
  }, [roleFilter, searchQuery])

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
    gridTemplateColumns: 'repeat(4, 1fr)',
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
  }

  const searchContainerStyle: React.CSSProperties = {
    position: 'relative',
    flex: 1,
    maxWidth: '400px',
  }

  const searchIconStyle: React.CSSProperties = {
    position: 'absolute',
    left: '12px',
    top: '50%',
    transform: 'translateY(-50%)',
    color: '#6B7280',
    pointerEvents: 'none',
  }

  const searchInputStyle: React.CSSProperties = {
    width: '100%',
    paddingLeft: '40px',
    paddingRight: '12px',
    paddingTop: '10px',
    paddingBottom: '10px',
    backgroundColor: '#FFFFFF',
    borderRadius: '12px',
    border: '1px solid #E5E7EB',
    fontSize: '14px',
    outline: 'none',
  }

  const selectStyle: React.CSSProperties = {
    paddingLeft: '12px',
    paddingRight: '12px',
    paddingTop: '10px',
    paddingBottom: '10px',
    backgroundColor: '#FFFFFF',
    borderRadius: '12px',
    border: '1px solid #E5E7EB',
    fontSize: '14px',
    outline: 'none',
    cursor: 'pointer',
  }

  const tableContainerStyle: React.CSSProperties = {
    backgroundColor: '#FFFFFF',
    borderRadius: '16px',
    padding: '24px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    border: '1px solid #F3F4F6',
  }

  const tableStyle: React.CSSProperties = {
    width: '100%',
    borderCollapse: 'collapse',
  }

  const thStyle: React.CSSProperties = {
    textAlign: 'left',
    padding: '12px',
    fontSize: '12px',
    fontWeight: 600,
    color: '#4B5563',
    textTransform: 'uppercase',
    borderBottom: '1px solid #E5E7EB',
  }

  const tdStyle: React.CSSProperties = {
    padding: '12px',
    borderBottom: '1px solid #F3F4F6',
  }

  const roleBadgeStyle = (role: string): React.CSSProperties => {
    const config: Record<string, { bg: string; color: string }> = {
      client: { bg: '#DBEAFE', color: '#2563EB' },
      driver: { bg: '#D1FAE5', color: '#059669' },
      admin: { bg: '#F3E8FF', color: '#9333EA' },
      super_admin: { bg: '#FEF3C7', color: '#D97706' },
    }

    const style = config[role] || { bg: '#F3F4F6', color: '#4B5563' }

    return {
      paddingLeft: '12px',
      paddingRight: '12px',
      paddingTop: '4px',
      paddingBottom: '4px',
      backgroundColor: style.bg,
      color: style.color,
      borderRadius: '8px',
      fontSize: '12px',
      fontWeight: 600,
      textTransform: 'capitalize',
    }
  }

  const paginationStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: '16px',
    paddingTop: '16px',
    borderTop: '1px solid #E5E7EB',
  }

  const paginationTextStyle: React.CSSProperties = {
    color: '#6B7280',
    fontSize: '14px',
  }

  const paginationButtonsStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  }

  const paginationButtonStyle: React.CSSProperties = {
    padding: '8px',
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
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
    <ScreenTransition direction="fade" duration={0.3}>
      <div style={containerStyle}>
      <div style={headerStyle}>
        <h1 style={titleStyle}>Users</h1>
        <div style={statsContainerStyle}>
          <div style={statCardStyle}>
            <div style={statIconStyle('#DBEAFE')}>
              <User size={20} style={{ color: '#2563EB' }} />
            </div>
            <div>
              <div style={statValueStyle}>{counts.client}</div>
              <div style={statLabelStyle}>Clients</div>
            </div>
          </div>
          <div style={statCardStyle}>
            <div style={statIconStyle('#D1FAE5')}>
              <Truck size={20} style={{ color: '#059669' }} />
            </div>
            <div>
              <div style={statValueStyle}>{counts.driver}</div>
              <div style={statLabelStyle}>Livreurs</div>
            </div>
          </div>
          <div style={statCardStyle}>
            <div style={statIconStyle('#F3E8FF')}>
              <Shield size={20} style={{ color: '#9333EA' }} />
            </div>
            <div>
              <div style={statValueStyle}>{counts.admin}</div>
              <div style={statLabelStyle}>Admins</div>
            </div>
          </div>
          <div style={statCardStyle}>
            <div style={statIconStyle('#F3F4F6')}>
              <User size={20} style={{ color: '#4B5563' }} />
            </div>
            <div>
              <div style={statValueStyle}>{counts.total}</div>
              <div style={statLabelStyle}>Total</div>
            </div>
          </div>
        </div>
      </div>

      <div style={filtersContainerStyle}>
        <div style={searchContainerStyle}>
          <Search size={20} style={searchIconStyle} />
          <input
            type="text"
            placeholder="Rechercher par nom, prénom, email, téléphone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={searchInputStyle}
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          style={selectStyle}
        >
          <option value="all">Tous les rôles</option>
          <option value="client">Clients</option>
          <option value="driver">Livreurs</option>
          <option value="admin">Admins</option>
        </select>
      </div>

      <div style={tableContainerStyle}>
        {isLoading ? (
          <div style={{ padding: '48px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <SkeletonLoader width="100%" height={60} borderRadius={8} />
            <SkeletonLoader width="100%" height={60} borderRadius={8} />
            <SkeletonLoader width="100%" height={60} borderRadius={8} />
            <SkeletonLoader width="100%" height={60} borderRadius={8} />
            <SkeletonLoader width="100%" height={60} borderRadius={8} />
          </div>
        ) : filteredUsers.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center', color: '#6B7280' }}>
            Aucun utilisateur trouvé
          </div>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>Nom</th>
                    <th style={thStyle}>Prénom</th>
                    <th style={thStyle}>Email</th>
                    <th style={thStyle}>Téléphone</th>
                    <th style={thStyle}>Rôle</th>
                    <th style={thStyle}>Date de création</th>
                    <th style={thStyle}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedUsers.map((user: UserData, idx: number) => (
                    <tr
                      key={user.id || idx}
                      style={{
                        ...tdStyle,
                        transition: 'background-color 0.2s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#F9FAFB'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent'
                      }}
                    >
                      <td style={tdStyle}>
                        <span style={{ fontSize: '14px', color: '#374151' }}>
                          {user.last_name || 'N/A'}
                        </span>
                      </td>
                      <td style={tdStyle}>
                        <span style={{ fontSize: '14px', color: '#374151' }}>
                          {user.first_name || 'N/A'}
                        </span>
                      </td>
                      <td style={tdStyle}>
                        <span style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>
                          {user.email}
                        </span>
                      </td>
                      <td style={tdStyle}>
                        <span style={{ fontSize: '14px', color: '#374151' }}>{user.phone}</span>
                      </td>
                      <td style={tdStyle}>
                        <span style={roleBadgeStyle(user.role)}>{user.role}</span>
                      </td>
                      <td style={tdStyle}>
                        <span style={{ fontSize: '14px', color: '#374151' }}>{user.createdAt}</span>
                      </td>
                      <td style={tdStyle}>
                        <button
                          onClick={() => router.push(`/users/${user.id}`)}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '8px',
                            backgroundColor: '#8B5CF6',
                            color: '#FFFFFF',
                            border: 'none',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = '#7C3AED'
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = '#8B5CF6'
                          }}
                        >
                          <Eye size={14} />
                          Voir
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filteredUsers.length > 0 && (
              <div style={paginationStyle}>
                <p style={paginationTextStyle}>
                  Showing {((currentPage - 1) * itemsPerPage) + 1} to{' '}
                  {Math.min(currentPage * itemsPerPage, filteredUsers.length)} of{' '}
                  {filteredUsers.length} entries
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
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum: number
                    if (totalPages <= 5) {
                      pageNum = i + 1
                    } else if (currentPage <= 3) {
                      pageNum = i + 1
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i
                    } else {
                      pageNum = currentPage - 2 + i
                    }
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        style={pageButtonStyle(currentPage === pageNum)}
                        onMouseEnter={(e) => {
                          if (currentPage !== pageNum) {
                            e.currentTarget.style.backgroundColor = '#F3F4F6'
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (currentPage !== pageNum) {
                            e.currentTarget.style.backgroundColor = 'transparent'
                          }
                        }}
                      >
                        {pageNum}
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
          </>
        )}
      </div>
    </div>
    </ScreenTransition>
  )
}
