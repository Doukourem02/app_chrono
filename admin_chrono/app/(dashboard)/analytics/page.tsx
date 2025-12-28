'use client'

import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Download, TrendingUp, Package, DollarSign, Clock, CheckCircle, Star, ExternalLink } from 'lucide-react'
import Link from 'next/link'

interface ZoneData {
  zone: string
  completed: number
  revenue: string | number
}

export default function AnalyticsPage() {
  const [days, setDays] = useState(7)
  const [exportFormat, setExportFormat] = useState<'json' | 'csv'>('json')

  // KPIs en temps réel
  const { data: kpis, isLoading: kpisLoading } = useQuery({
    queryKey: ['analytics', 'kpis'],
    queryFn: async () => {
      const response = await fetch('/api/analytics/kpis')
      if (!response.ok) throw new Error('Erreur chargement KPIs')
      return response.json()
    },
    refetchInterval: 30000, // Mise à jour toutes les 30 secondes
  })

  // Données de performance
  const { data: performance } = useQuery({
    queryKey: ['analytics', 'performance', days],
    queryFn: async () => {
      const response = await fetch(`/api/analytics/performance?days=${days}`)
      if (!response.ok) throw new Error('Erreur chargement performance')
      return response.json()
    },
  })

  const handleExport = async () => {
    try {
      const response = await fetch(`/api/analytics/export?format=${exportFormat}&days=${days}`)
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

  return (
    <div style={{ padding: '24px' }}>
      <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '24px' }}>
        Analytics Avancés
      </h1>

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
            {kpisLoading ? '...' : kpis?.averageRating ? `${kpis.averageRating.toFixed(1)}/5` : 'N/A'}
          </div>
          {kpis?.totalRatings && (
            <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '4px' }}>
              {kpis.totalRatings} évaluations
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
      {kpis && (kpis.averageRating || kpis.totalRatings) && (
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
    </div>
  )
}

