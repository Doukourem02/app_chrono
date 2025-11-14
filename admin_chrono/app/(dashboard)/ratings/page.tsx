'use client'

import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { adminApiService } from '@/lib/adminApiService'
import { Star, Search, Filter, Trash2, User, Truck } from 'lucide-react'

export default function RatingsPage() {
  const [currentPage, setCurrentPage] = useState(1)
  const [driverFilter, setDriverFilter] = useState<string>('')
  const [clientFilter, setClientFilter] = useState<string>('')
  const [minRatingFilter, setMinRatingFilter] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState('')
  const itemsPerPage = 20
  const queryClient = useQueryClient()

  const { data: ratingsData, isLoading } = useQuery({
    queryKey: ['ratings', currentPage, driverFilter, clientFilter, minRatingFilter],
    queryFn: () =>
      adminApiService.getRatings({
        page: currentPage,
        limit: itemsPerPage,
        driverId: driverFilter || undefined,
        clientId: clientFilter || undefined,
        minRating: minRatingFilter ? parseInt(minRatingFilter) : undefined,
      }),
    refetchInterval: 30000,
  })

  const deleteMutation = useMutation({
    mutationFn: async (ratingId: string) => {
      return await adminApiService.deleteRating(ratingId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ratings'] })
    },
  })

  const ratings = ratingsData?.data || []
  const pagination = ratingsData?.pagination

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A'
    const date = new Date(dateString)
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        size={16}
        style={{
          color: i < rating ? '#FBBF24' : '#E5E7EB',
          fill: i < rating ? '#FBBF24' : 'transparent',
        }}
      />
    ))
  }

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

  const filtersStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'row',
    gap: '12px',
    marginBottom: '16px',
    flexWrap: 'wrap',
  }

  const inputStyle: React.CSSProperties = {
    padding: '10px 16px',
    borderRadius: '8px',
    border: '1px solid #E5E7EB',
    fontSize: '14px',
    flex: 1,
    minWidth: '200px',
  }

  const selectStyle: React.CSSProperties = {
    padding: '10px 16px',
    borderRadius: '8px',
    border: '1px solid #E5E7EB',
    fontSize: '14px',
    backgroundColor: '#FFFFFF',
    cursor: 'pointer',
  }

  const cardStyle: React.CSSProperties = {
    backgroundColor: '#FFFFFF',
    borderRadius: '12px',
    padding: '20px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    border: '1px solid #F3F4F6',
  }

  const tableStyle: React.CSSProperties = {
    width: '100%',
    borderCollapse: 'collapse',
  }

  const thStyle: React.CSSProperties = {
    padding: '12px',
    textAlign: 'left',
    fontSize: '12px',
    fontWeight: 600,
    color: '#6B7280',
    textTransform: 'uppercase',
    borderBottom: '1px solid #E5E7EB',
  }

  const tdStyle: React.CSSProperties = {
    padding: '12px',
    fontSize: '14px',
    color: '#111827',
    borderBottom: '1px solid #F3F4F6',
  }

  const paginationStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: '16px',
    paddingTop: '16px',
    borderTop: '1px solid #E5E7EB',
  }

  const paginationButtonStyle: React.CSSProperties = {
    padding: '8px 16px',
    borderRadius: '8px',
    border: '1px solid #E5E7EB',
    backgroundColor: '#FFFFFF',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    color: '#374151',
  }

  const paginationButtonActiveStyle: React.CSSProperties = {
    ...paginationButtonStyle,
    backgroundColor: '#8B5CF6',
    color: '#FFFFFF',
    borderColor: '#8B5CF6',
  }

  // Calculer les statistiques
  const totalRatings = ratings.length
  const averageRating =
    totalRatings > 0
      ? ratings.reduce((sum: number, r: any) => sum + (parseInt(r.rating) || 0), 0) / totalRatings
      : 0
  const ratingDistribution = Array.from({ length: 5 }, (_, i) => {
    const count = ratings.filter((r: any) => parseInt(r.rating) === 5 - i).length
    return { rating: 5 - i, count }
  })

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <h1 style={titleStyle}>Évaluations</h1>
      </div>

      {/* Statistiques */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '16px' }}>
        <div style={cardStyle}>
          <div style={{ fontSize: '14px', color: '#6B7280', marginBottom: '8px' }}>Note moyenne</div>
          <div style={{ fontSize: '32px', fontWeight: 700, color: '#111827', display: 'flex', alignItems: 'center', gap: '8px' }}>
            {averageRating.toFixed(1)} ⭐
          </div>
        </div>
        <div style={cardStyle}>
          <div style={{ fontSize: '14px', color: '#6B7280', marginBottom: '8px' }}>Total évaluations</div>
          <div style={{ fontSize: '32px', fontWeight: 700, color: '#111827' }}>{totalRatings}</div>
        </div>
      </div>

      {/* Distribution des notes */}
      {ratingDistribution.length > 0 && (
        <div style={cardStyle}>
          <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px', color: '#111827' }}>
            Distribution des notes
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {ratingDistribution.map((dist) => (
              <div key={dist.rating} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', minWidth: '80px' }}>
                  {renderStars(dist.rating)}
                </div>
                <div style={{ flex: 1, height: '8px', backgroundColor: '#E5E7EB', borderRadius: '4px', overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${totalRatings > 0 ? (dist.count / totalRatings) * 100 : 0}%`,
                      height: '100%',
                      backgroundColor: '#8B5CF6',
                    }}
                  />
                </div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#111827', minWidth: '40px', textAlign: 'right' }}>
                  {dist.count}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filtres */}
      <div style={filtersStyle}>
        <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#6B7280' }} />
          <input
            type="text"
            placeholder="Rechercher par ID commande..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ ...inputStyle, paddingLeft: '40px' }}
          />
        </div>
        <input
          type="text"
          placeholder="ID Driver"
          value={driverFilter}
          onChange={(e) => {
            setDriverFilter(e.target.value)
            setCurrentPage(1)
          }}
          style={inputStyle}
        />
        <input
          type="text"
          placeholder="ID Client"
          value={clientFilter}
          onChange={(e) => {
            setClientFilter(e.target.value)
            setCurrentPage(1)
          }}
          style={inputStyle}
        />
        <select
          value={minRatingFilter}
          onChange={(e) => {
            setMinRatingFilter(e.target.value)
            setCurrentPage(1)
          }}
          style={selectStyle}
        >
          <option value="">Toutes les notes</option>
          <option value="5">5 étoiles</option>
          <option value="4">4+ étoiles</option>
          <option value="3">3+ étoiles</option>
          <option value="2">2+ étoiles</option>
          <option value="1">1+ étoiles</option>
        </select>
      </div>

      {/* Table */}
      <div style={cardStyle}>
        <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px', color: '#111827' }}>
          Liste des évaluations
        </h3>
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>Chargement...</div>
        ) : ratings.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#6B7280' }}>
            Aucune évaluation trouvée
          </div>
        ) : (
          <>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Note</th>
                  <th style={thStyle}>Client</th>
                  <th style={thStyle}>Driver</th>
                  <th style={thStyle}>Commande</th>
                  <th style={thStyle}>Commentaire</th>
                  <th style={thStyle}>Date</th>
                  <th style={thStyle}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {ratings
                  .filter((rating: any) => {
                    if (!searchQuery) return true
                    const query = searchQuery.toLowerCase()
                    return (
                      rating.order_id?.toLowerCase().includes(query) ||
                      rating.order_id_full?.toLowerCase().includes(query)
                    )
                  })
                  .map((rating: any) => (
                    <tr key={rating.id}>
                      <td style={tdStyle}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          {renderStars(parseInt(rating.rating) || 0)}
                          <span style={{ marginLeft: '8px', fontWeight: 600 }}>
                            {rating.rating}/5
                          </span>
                        </div>
                      </td>
                      <td style={tdStyle}>
                        <div>
                          <div style={{ fontWeight: 600 }}>{rating.user_email || 'N/A'}</div>
                          <div style={{ fontSize: '12px', color: '#6B7280' }}>
                            {rating.user_phone || ''}
                          </div>
                        </div>
                      </td>
                      <td style={tdStyle}>
                        <div>
                          <div style={{ fontWeight: 600 }}>{rating.driver_email || 'N/A'}</div>
                          <div style={{ fontSize: '12px', color: '#6B7280' }}>
                            {rating.driver_phone || ''}
                          </div>
                        </div>
                      </td>
                      <td style={tdStyle}>
                        <span style={{ fontSize: '12px', fontFamily: 'monospace' }}>
                          {rating.order_id_full?.slice(0, 8) || rating.order_id?.slice(0, 8) || 'N/A'}...
                        </span>
                      </td>
                      <td style={tdStyle}>
                        <div style={{ maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {rating.comment || 'Aucun commentaire'}
                        </div>
                      </td>
                      <td style={tdStyle}>{formatDate(rating.created_at)}</td>
                      <td style={tdStyle}>
                        <button
                          onClick={() => {
                            if (confirm('Êtes-vous sûr de vouloir supprimer cette évaluation ?')) {
                              deleteMutation.mutate(rating.id)
                            }
                          }}
                          disabled={deleteMutation.isPending}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '8px',
                            backgroundColor: '#EF4444',
                            color: '#FFFFFF',
                            border: 'none',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            opacity: deleteMutation.isPending ? 0.5 : 1,
                          }}
                        >
                          <Trash2 size={14} />
                          Supprimer
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>

            {/* Pagination */}
            {pagination && pagination.totalPages > 1 && (
              <div style={paginationStyle}>
                <div style={{ fontSize: '14px', color: '#6B7280' }}>
                  Affichage {((currentPage - 1) * itemsPerPage + 1)} à{' '}
                  {Math.min(currentPage * itemsPerPage, pagination.total)} sur {pagination.total}
                </div>
                <div style={{ display: 'flex', flexDirection: 'row', gap: '8px' }}>
                  <button
                    style={currentPage === 1 ? { ...paginationButtonStyle, opacity: 0.5, cursor: 'not-allowed' } : paginationButtonStyle}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    Précédent
                  </button>
                  {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
                    .filter(
                      (page) =>
                        page === 1 ||
                        page === pagination.totalPages ||
                        (page >= currentPage - 1 && page <= currentPage + 1)
                    )
                    .map((page, idx, arr) => (
                      <React.Fragment key={page}>
                        {idx > 0 && arr[idx - 1] !== page - 1 && (
                          <span style={{ padding: '8px' }}>...</span>
                        )}
                        <button
                          style={currentPage === page ? paginationButtonActiveStyle : paginationButtonStyle}
                          onClick={() => setCurrentPage(page)}
                        >
                          {page}
                        </button>
                      </React.Fragment>
                    ))}
                  <button
                    style={currentPage === pagination.totalPages ? { ...paginationButtonStyle, opacity: 0.5, cursor: 'not-allowed' } : paginationButtonStyle}
                    onClick={() => setCurrentPage((p) => Math.min(pagination.totalPages, p + 1))}
                    disabled={currentPage === pagination.totalPages}
                  >
                    Suivant
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

