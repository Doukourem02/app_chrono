'use client'

import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Download, TrendingUp, Package, DollarSign, Clock, CheckCircle, Star, ExternalLink, Search, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { adminApiService } from '@/lib/adminApiService'
import { supabase } from '@/lib/supabase'

interface ZoneData {
  zone: string
  completed: number
  revenue: string | number
}

type TabType = 'overview' | 'ratings'

export default function AnalyticsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('overview')
  const [days, setDays] = useState(7)
  const [exportFormat, setExportFormat] = useState<'json' | 'csv'>('json')
  
  // État pour l'onglet Ratings
  const [ratingsPage, setRatingsPage] = useState(1)
  const driverFilter = ''
  const clientFilter = ''
  const [minRatingFilter, setMinRatingFilter] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState('')
  const ratingsItemsPerPage = 20
  const queryClient = useQueryClient()

  // KPIs en temps réel
  const { data: kpis, isLoading: kpisLoading } = useQuery({
    queryKey: ['analytics', 'kpis'],
    queryFn: async () => {
      // Récupérer le token depuis Supabase
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      
      if (!token) {
        throw new Error('Non authentifié')
      }

      const response = await fetch('/api/analytics/kpis', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })
      if (!response.ok) {
        const errorText = await response.text()
        console.error('[Analytics] Erreur KPIs:', response.status, errorText)
        throw new Error(`Erreur chargement KPIs: ${response.status}`)
      }
      const data = await response.json()
      console.log('[Analytics] KPIs reçus:', {
        averageRating: data.averageRating,
        totalRatings: data.totalRatings,
        hasAverageRating: data.averageRating != null,
        typeAverageRating: typeof data.averageRating
      })
      return data
    },
    refetchInterval: 30000, // Mise à jour toutes les 30 secondes
  })

  // Données de performance
  const { data: performance } = useQuery({
    queryKey: ['analytics', 'performance', days],
    queryFn: async () => {
      // Récupérer le token depuis Supabase
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      
      if (!token) {
        throw new Error('Non authentifié')
      }

      const response = await fetch(`/api/analytics/performance?days=${days}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })
      if (!response.ok) throw new Error('Erreur chargement performance')
      return response.json()
    },
  })

  const handleExport = async () => {
    try {
      // Récupérer le token depuis Supabase
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      
      if (!token) {
        alert('Vous devez être connecté pour exporter les données')
        return
      }

      const response = await fetch(`/api/analytics/export?format=${exportFormat}&days=${days}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })
      if (!response.ok) throw new Error('Erreur export')
      
      if (exportFormat === 'csv') {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `analytics-${Date.now()}.csv`
        a.click()
      } else {
        const data = await response.json()
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `analytics-${Date.now()}.json`
        a.click()
      }
    } catch (error) {
      console.error('Error exporting:', error)
      alert('Erreur lors de l\'export')
    }
  }

  // Requête pour les évaluations (onglet Ratings)
  const { data: ratingsData, isLoading: ratingsLoading } = useQuery({
    queryKey: ['ratings', ratingsPage, driverFilter, clientFilter, minRatingFilter],
    queryFn: () =>
      adminApiService.getRatings({
        page: ratingsPage,
        limit: ratingsItemsPerPage,
        driverId: driverFilter || undefined,
        clientId: clientFilter || undefined,
        minRating: minRatingFilter ? parseInt(minRatingFilter) : undefined,
      }),
    enabled: activeTab === 'ratings',
  })

  const deleteRatingMutation = useMutation({
    mutationFn: async (ratingId: string) => {
      return await adminApiService.deleteRating(ratingId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ratings'] })
    },
  })

  const ratings = (ratingsData?.data || []) as Array<{
    id: string
    rating: string | number
    user_email?: string
    user_phone?: string
    user_first_name?: string
    user_last_name?: string
    driver_email?: string
    driver_phone?: string
    driver_first_name?: string
    driver_last_name?: string
    order_id?: string
    order_id_full?: string
    comment?: string
    created_at?: string
  }>

  const formatDate = (dateString: string | undefined) => {
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

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 'bold' }}>
          Analytics Avancés
        </h1>
      </div>

      {/* Onglets */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', borderBottom: '1px solid #E5E7EB' }}>
        <button
          onClick={() => setActiveTab('overview')}
          style={{
            padding: '12px 20px',
            border: 'none',
            backgroundColor: 'transparent',
            borderBottom: activeTab === 'overview' ? '2px solid #8B5CF6' : '2px solid transparent',
            color: activeTab === 'overview' ? '#8B5CF6' : '#6B7280',
            fontWeight: activeTab === 'overview' ? 600 : 500,
            cursor: 'pointer',
            fontSize: '14px',
            transition: 'all 0.2s',
          }}
        >
          Vue d&apos;ensemble
        </button>
        <button
          onClick={() => setActiveTab('ratings')}
          style={{
            padding: '12px 20px',
            border: 'none',
            backgroundColor: 'transparent',
            borderBottom: activeTab === 'ratings' ? '2px solid #8B5CF6' : '2px solid transparent',
            color: activeTab === 'ratings' ? '#8B5CF6' : '#6B7280',
            fontWeight: activeTab === 'ratings' ? 600 : 500,
            cursor: 'pointer',
            fontSize: '14px',
            transition: 'all 0.2s',
          }}
        >
          Évaluations
        </button>
      </div>

      {/* Contenu onglet Overview */}
      {activeTab === 'overview' && (
        <>

      {/* KPIs en temps réel */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '32px' }}>
        <div style={{ padding: '20px', backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <Package style={{ width: '20px', height: '20px', color: '#3B82F6' }} />
            <span style={{ fontSize: '14px', color: '#6B7280' }}>Commandes actives</span>
          </div>
          <div style={{ fontSize: '32px', fontWeight: 'bold' }}>
            {kpisLoading ? '...' : kpis?.activeOrders || 0}
          </div>
        </div>

        <div style={{ padding: '20px', backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <CheckCircle style={{ width: '20px', height: '20px', color: '#10B981' }} />
            <span style={{ fontSize: '14px', color: '#6B7280' }}>Complétées aujourd&apos;hui</span>
          </div>
          <div style={{ fontSize: '32px', fontWeight: 'bold' }}>
            {kpisLoading ? '...' : kpis?.completedToday || 0}
          </div>
        </div>

        <div style={{ padding: '20px', backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <DollarSign style={{ width: '20px', height: '20px', color: '#F59E0B' }} />
            <span style={{ fontSize: '14px', color: '#6B7280' }}>Revenus aujourd&apos;hui</span>
          </div>
          <div style={{ fontSize: '32px', fontWeight: 'bold' }}>
            {kpisLoading ? '...' : `${(kpis?.revenueToday || 0).toLocaleString()} FCFA`}
          </div>
        </div>

        <div style={{ padding: '20px', backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <Clock style={{ width: '20px', height: '20px', color: '#8B5CF6' }} />
            <span style={{ fontSize: '14px', color: '#6B7280' }}>Temps moyen</span>
          </div>
          <div style={{ fontSize: '32px', fontWeight: 'bold' }}>
            {kpisLoading ? '...' : `${Math.round(kpis?.avgDeliveryTime || 0)} min`}
          </div>
        </div>

        <div style={{ padding: '20px', backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <TrendingUp style={{ width: '20px', height: '20px', color: '#EC4899' }} />
            <span style={{ fontSize: '14px', color: '#6B7280' }}>Taux acceptation</span>
          </div>
          <div style={{ fontSize: '32px', fontWeight: 'bold' }}>
            {kpisLoading ? '...' : `${Math.round(kpis?.acceptanceRate || 0)}%`}
          </div>
        </div>

        <div style={{ padding: '20px', backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <Star style={{ width: '20px', height: '20px', color: '#FBBF24' }} />
            <span style={{ fontSize: '14px', color: '#6B7280' }}>Note moyenne</span>
          </div>
          <div style={{ fontSize: '32px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
            {kpisLoading ? '...' : (() => {
              // Debug: log pour voir les valeurs reçues
              if (kpis && !kpisLoading) {
                console.log('[Analytics] KPIs reçus:', {
                  averageRating: kpis.averageRating,
                  totalRatings: kpis.totalRatings,
                  typeAverageRating: typeof kpis.averageRating,
                  isNull: kpis.averageRating === null,
                  isUndefined: kpis.averageRating === undefined,
                  fullKpis: kpis
                });
              }
              
              // Afficher la note si on a des ratings
              const hasRatings = kpis?.totalRatings && kpis.totalRatings > 0;
              const avgRating = kpis?.averageRating;
              
              // Si on a des ratings, essayer d'afficher la note même si elle est 0
              if (hasRatings) {
                // Si averageRating est null/undefined, essayer de le calculer depuis ratingDistribution
                if (avgRating == null && kpis?.ratingDistribution) {
                  const dist = kpis.ratingDistribution;
                  const total = (dist['5'] || 0) + (dist['4'] || 0) + (dist['3'] || 0) + (dist['2'] || 0) + (dist['1'] || 0);
                  if (total > 0) {
                    const calculatedAvg = ((dist['5'] || 0) * 5 + (dist['4'] || 0) * 4 + (dist['3'] || 0) * 3 + (dist['2'] || 0) * 2 + (dist['1'] || 0) * 1) / total;
                    console.log('[Analytics] Note calculée depuis distribution:', calculatedAvg);
                    return `${calculatedAvg.toFixed(1)}/5`;
                  }
                }
                
                // Si averageRating est disponible, l'utiliser
                if (avgRating != null && !isNaN(Number(avgRating))) {
                  return `${Number(avgRating).toFixed(1)}/5`;
                }
              }
              
              return 'N/A';
            })()}
          </div>
          {kpis?.totalRatings && kpis.totalRatings > 0 && (
            <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '4px' }}>
              {kpis.totalRatings} évaluation{kpis.totalRatings > 1 ? 's' : ''}
            </div>
          )}
        </div>
      </div>

      {/* Export */}
      <div style={{ marginBottom: '32px', padding: '20px', backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '16px' }}>Export des données</h2>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <select
            value={days}
            onChange={(e) => setDays(parseInt(e.target.value))}
            style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #D1D5DB' }}
          >
            <option value={7}>7 derniers jours</option>
            <option value={30}>30 derniers jours</option>
            <option value={90}>90 derniers jours</option>
          </select>
          <select
            value={exportFormat}
            onChange={(e) => setExportFormat(e.target.value as 'json' | 'csv')}
            style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #D1D5DB' }}
          >
            <option value="json">JSON</option>
            <option value="csv">CSV</option>
          </select>
          <button
            onClick={handleExport}
            style={{
              padding: '8px 16px',
              backgroundColor: '#3B82F6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <Download style={{ width: '16px', height: '16px' }} />
            Exporter
          </button>
        </div>
      </div>

      {/* Statistiques de ratings */}
      {kpis && kpis.totalRatings && kpis.totalRatings > 0 && (
        <div style={{ marginBottom: '32px', padding: '20px', backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 'bold' }}>Statistiques des évaluations</h2>
            <Link 
              href="/ratings" 
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '6px', 
                color: '#8B5CF6', 
                textDecoration: 'none',
                fontSize: '14px',
                fontWeight: 600
              }}
            >
              Voir le détail
              <ExternalLink style={{ width: '14px', height: '14px' }} />
            </Link>
          </div>

          {/* Distribution des notes */}
          {kpis.ratingDistribution && (
            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#6B7280', marginBottom: '12px' }}>
                Distribution des notes
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {[5, 4, 3, 2, 1].map((rating) => {
                  const count = kpis.ratingDistribution?.[String(rating) as keyof typeof kpis.ratingDistribution] || 0;
                  const total = kpis.totalRatings || 1;
                  const percentage = (count / total) * 100;
                  
                  return (
                    <div key={rating} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', minWidth: '60px' }}>
                        <Star 
                          style={{ 
                            width: '14px', 
                            height: '14px', 
                            color: '#FBBF24',
                            fill: '#FBBF24'
                          }} 
                        />
                        <span style={{ fontSize: '14px', fontWeight: 600 }}>{rating}</span>
                      </div>
                      <div style={{ flex: 1, height: '8px', backgroundColor: '#E5E7EB', borderRadius: '4px', overflow: 'hidden' }}>
                        <div
                          style={{
                            width: `${percentage}%`,
                            height: '100%',
                            backgroundColor: rating >= 4 ? '#10B981' : rating >= 3 ? '#F59E0B' : '#EF4444',
                            transition: 'width 0.3s ease',
                          }}
                        />
                      </div>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: '#111827', minWidth: '50px', textAlign: 'right' }}>
                        {count} ({percentage.toFixed(1)}%)
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Évolution des notes */}
          {performance?.ratingTrend && performance.ratingTrend.length > 0 && (
            <div>
              <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#6B7280', marginBottom: '12px' }}>
                Évolution de la note moyenne ({days} derniers jours)
              </h3>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', height: '120px', marginBottom: '8px' }}>
                {performance.ratingTrend.map((point: { date: string; average: number; count: number }, index: number) => {
                  const maxRating = 5;
                  const height = (point.average / maxRating) * 100;
                  const date = new Date(point.date);
                  const dayLabel = date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
                  
                  return (
                    <div key={index} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                      <div 
                        style={{ 
                          width: '100%',
                          height: `${height}%`,
                          backgroundColor: point.average >= 4 ? '#10B981' : point.average >= 3 ? '#F59E0B' : '#EF4444',
                          borderRadius: '4px 4px 0 0',
                          minHeight: '4px',
                          display: 'flex',
                          alignItems: 'flex-end',
                          justifyContent: 'center',
                          paddingBottom: '4px',
                        }}
                        title={`${point.average.toFixed(1)}/5 (${point.count} éval.)`}
                      >
                        <span style={{ fontSize: '10px', color: 'white', fontWeight: 600 }}>
                          {point.average.toFixed(1)}
                        </span>
                      </div>
                      <span style={{ fontSize: '10px', color: '#6B7280' }}>{dayLabel}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Données par zone */}
      {performance && (
        <div style={{ padding: '20px', backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '16px' }}>Performance par zone</h2>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #E5E7EB' }}>
                  <th style={{ padding: '12px', textAlign: 'left', fontWeight: 'bold' }}>Zone</th>
                  <th style={{ padding: '12px', textAlign: 'right', fontWeight: 'bold' }}>Livraisons</th>
                  <th style={{ padding: '12px', textAlign: 'right', fontWeight: 'bold' }}>Revenus</th>
                </tr>
              </thead>
              <tbody>
                {performance.byZone?.map((zone: ZoneData, index: number) => (
                  <tr key={index} style={{ borderBottom: '1px solid #F3F4F6' }}>
                    <td style={{ padding: '12px' }}>{zone.zone}</td>
                    <td style={{ padding: '12px', textAlign: 'right' }}>{zone.completed}</td>
                    <td style={{ padding: '12px', textAlign: 'right' }}>
                      {parseFloat(String(zone.revenue || 0)).toLocaleString()} FCFA
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      </>)}

      {/* Contenu onglet Évaluations */}
      {activeTab === 'ratings' && (
        <div>
          {/* Filtres */}
          <div style={{ marginBottom: '24px', padding: '20px', backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
                <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} />
                <input
                  type="text"
                  placeholder="Rechercher..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px 10px 36px',
                    borderRadius: '8px',
                    border: '1px solid #E5E7EB',
                    fontSize: '14px',
                  }}
                />
              </div>
              <select
                value={minRatingFilter}
                onChange={(e) => setMinRatingFilter(e.target.value)}
                style={{
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid #E5E7EB',
                  fontSize: '14px',
                  backgroundColor: '#FFFFFF',
                  cursor: 'pointer',
                }}
              >
                <option value="">Toutes les notes</option>
                <option value="5">5 étoiles</option>
                <option value="4">4+ étoiles</option>
                <option value="3">3+ étoiles</option>
                <option value="2">2+ étoiles</option>
                <option value="1">1+ étoiles</option>
              </select>
            </div>
          </div>

          {/* Liste des évaluations */}
          <div style={{ backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
            {ratingsLoading ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#6B7280' }}>
                Chargement...
              </div>
            ) : ratings.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#6B7280' }}>
                Aucune évaluation trouvée
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                    <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#6B7280' }}>Note</th>
                    <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#6B7280' }}>Client</th>
                    <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#6B7280' }}>Livreur</th>
                    <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#6B7280' }}>Commande</th>
                    <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#6B7280' }}>Commentaire</th>
                    <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#6B7280' }}>Date</th>
                    <th style={{ padding: '12px', textAlign: 'center', fontSize: '12px', fontWeight: 600, color: '#6B7280' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {ratings
                    .filter((rating) => {
                      if (!searchQuery) return true
                      const query = searchQuery.toLowerCase()
                      return (
                        rating.user_email?.toLowerCase().includes(query) ||
                        rating.driver_email?.toLowerCase().includes(query) ||
                        rating.order_id?.toLowerCase().includes(query) ||
                        rating.comment?.toLowerCase().includes(query)
                      )
                    })
                    .map((rating) => {
                      const ratingNum = typeof rating.rating === 'string' ? parseFloat(rating.rating) : rating.rating
                      return (
                        <tr key={rating.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                          <td style={{ padding: '12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              {renderStars(ratingNum)}
                              <span style={{ marginLeft: '4px', fontWeight: 600 }}>{ratingNum}/5</span>
                            </div>
                          </td>
                          <td style={{ padding: '12px' }}>
                            <div>
                              <div style={{ fontWeight: 600 }}>
                                {rating.user_first_name || ''} {rating.user_last_name || ''}
                              </div>
                              <div style={{ fontSize: '12px', color: '#6B7280' }}>{rating.user_email}</div>
                            </div>
                          </td>
                          <td style={{ padding: '12px' }}>
                            <div>
                              <div style={{ fontWeight: 600 }}>
                                {rating.driver_first_name || ''} {rating.driver_last_name || ''}
                              </div>
                              <div style={{ fontSize: '12px', color: '#6B7280' }}>{rating.driver_email}</div>
                            </div>
                          </td>
                          <td style={{ padding: '12px' }}>
                            {rating.order_id_full ? (
                              <Link
                                href={`/orders?search=${rating.order_id_full}`}
                                style={{
                                  color: '#8B5CF6',
                                  textDecoration: 'none',
                                  fontSize: '12px',
                                  fontWeight: 600,
                                }}
                              >
                                {rating.order_id_full}
                                <ExternalLink size={12} style={{ marginLeft: '4px', display: 'inline' }} />
                              </Link>
                            ) : (
                              <span style={{ color: '#9CA3AF', fontSize: '12px' }}>-</span>
                            )}
                          </td>
                          <td style={{ padding: '12px', maxWidth: '300px' }}>
                            <div style={{ fontSize: '13px', color: '#111827' }}>
                              {rating.comment || <span style={{ color: '#9CA3AF', fontStyle: 'italic' }}>Aucun commentaire</span>}
                            </div>
                          </td>
                          <td style={{ padding: '12px', fontSize: '12px', color: '#6B7280' }}>
                            {formatDate(rating.created_at)}
                          </td>
                          <td style={{ padding: '12px', textAlign: 'center' }}>
                            <button
                              onClick={() => {
                                if (confirm('Êtes-vous sûr de vouloir supprimer cette évaluation ?')) {
                                  deleteRatingMutation.mutate(rating.id)
                                }
                              }}
                              style={{
                                padding: '6px 10px',
                                borderRadius: '6px',
                                backgroundColor: '#FEE2E2',
                                border: 'none',
                                cursor: 'pointer',
                                color: '#DC2626',
                              }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            )}

            {/* Pagination */}
            {ratingsData?.pagination && (
              <div style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #E5E7EB' }}>
                <div style={{ fontSize: '14px', color: '#6B7280' }}>
                  Page {ratingsPage} sur {ratingsData.pagination.totalPages || 1}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => setRatingsPage((p) => Math.max(1, p - 1))}
                    disabled={ratingsPage === 1}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: '1px solid #E5E7EB',
                      backgroundColor: ratingsPage === 1 ? '#F9FAFB' : '#FFFFFF',
                      cursor: ratingsPage === 1 ? 'not-allowed' : 'pointer',
                      color: ratingsPage === 1 ? '#9CA3AF' : '#111827',
                    }}
                  >
                    Précédent
                  </button>
                  <button
                    onClick={() => setRatingsPage((p) => p + 1)}
                    disabled={ratingsPage >= (ratingsData.pagination.totalPages || 1)}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: '1px solid #E5E7EB',
                      backgroundColor: ratingsPage >= (ratingsData.pagination.totalPages || 1) ? '#F9FAFB' : '#FFFFFF',
                      cursor: ratingsPage >= (ratingsData.pagination.totalPages || 1) ? 'not-allowed' : 'pointer',
                      color: ratingsPage >= (ratingsData.pagination.totalPages || 1) ? '#9CA3AF' : '#111827',
                    }}
                  >
                    Suivant
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

