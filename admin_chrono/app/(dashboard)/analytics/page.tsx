'use client'

import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Download, TrendingUp, Package, DollarSign, Clock, CheckCircle } from 'lucide-react'

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

