'use client'

import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { adminApiService } from '@/lib/adminApiService'
import { FileText, Download, Calendar, TrendingUp, Users, Truck, CreditCard } from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
} from 'recharts'

type ReportType = 'deliveries' | 'revenues' | 'clients' | 'drivers' | 'payments'
type PeriodPreset = 'today' | 'week' | 'month' | 'year' | 'custom'

export default function ReportsPage() {
  const [reportType, setReportType] = useState<ReportType>('deliveries')
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('month')
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const [additionalFilter, setAdditionalFilter] = useState<string>('')

  // Calculer les dates selon le preset
  React.useEffect(() => {
    const now = new Date()
    let start: Date
    let end: Date = now

    switch (periodPreset) {
      case 'today':
        start = new Date(now)
        start.setHours(0, 0, 0, 0)
        break
      case 'week':
        start = new Date(now)
        start.setDate(now.getDate() - 7)
        start.setHours(0, 0, 0, 0)
        break
      case 'month':
        start = new Date(now.getFullYear(), now.getMonth(), 1)
        break
      case 'year':
        start = new Date(now.getFullYear(), 0, 1)
        break
      default:
        return // custom - ne pas modifier
    }

    if (periodPreset !== 'custom') {
      setStartDate(start.toISOString().split('T')[0])
      setEndDate(end.toISOString().split('T')[0])
    }
  }, [periodPreset])

  const { data: deliveriesData, isLoading: deliveriesLoading } = useQuery({
    queryKey: ['report-deliveries', startDate, endDate, additionalFilter],
    queryFn: () =>
      adminApiService.getReportDeliveries({
        startDate,
        endDate,
        status: additionalFilter || undefined,
      }),
    enabled: reportType === 'deliveries' && !!startDate && !!endDate,
  })

  const { data: revenuesData, isLoading: revenuesLoading } = useQuery({
    queryKey: ['report-revenues', startDate, endDate, additionalFilter],
    queryFn: () =>
      adminApiService.getReportRevenues({
        startDate,
        endDate,
        deliveryType: additionalFilter || undefined,
      }),
    enabled: reportType === 'revenues' && !!startDate && !!endDate,
  })

  const { data: clientsData, isLoading: clientsLoading } = useQuery({
    queryKey: ['report-clients', startDate, endDate],
    queryFn: () =>
      adminApiService.getReportClients({
        startDate,
        endDate,
      }),
    enabled: reportType === 'clients' && !!startDate && !!endDate,
  })

  const { data: driversData, isLoading: driversLoading } = useQuery({
    queryKey: ['report-drivers', startDate, endDate],
    queryFn: () =>
      adminApiService.getReportDrivers({
        startDate,
        endDate,
      }),
    enabled: reportType === 'drivers' && !!startDate && !!endDate,
  })

  const { data: paymentsData, isLoading: paymentsLoading } = useQuery({
    queryKey: ['report-payments', startDate, endDate],
    queryFn: () =>
      adminApiService.getReportPayments({
        startDate,
        endDate,
      }),
    enabled: reportType === 'payments' && !!startDate && !!endDate,
  })

  const isLoading =
    deliveriesLoading || revenuesLoading || clientsLoading || driversLoading || paymentsLoading

  const formatCurrency = (amount: number) => {
    return `${amount.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} FCFA`
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  }

  const handleExport = () => {
    // TODO: Implémenter l'export PDF/Excel
    alert('Fonctionnalité d\'export à venir')
  }

  const reportTypes: { key: ReportType; label: string; icon: any }[] = [
    { key: 'deliveries', label: 'Livraisons', icon: Truck },
    { key: 'revenues', label: 'Revenus', icon: TrendingUp },
    { key: 'clients', label: 'Clients', icon: Users },
    { key: 'drivers', label: 'Drivers', icon: Truck },
    { key: 'payments', label: 'Paiements', icon: CreditCard },
  ]

  const periodPresets: { key: PeriodPreset; label: string }[] = [
    { key: 'today', label: "Aujourd'hui" },
    { key: 'week', label: 'Cette semaine' },
    { key: 'month', label: 'Ce mois' },
    { key: 'year', label: 'Cette année' },
    { key: 'custom', label: 'Personnalisé' },
  ]

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

  const tabsStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'row',
    gap: '8px',
    marginBottom: '16px',
    flexWrap: 'wrap',
  }

  const tabStyle: React.CSSProperties = {
    padding: '12px 20px',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    color: '#6B7280',
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: '8px',
  }

  const tabActiveStyle: React.CSSProperties = {
    ...tabStyle,
    backgroundColor: '#8B5CF6',
    color: '#FFFFFF',
    borderColor: '#8B5CF6',
  }

  const filtersCardStyle: React.CSSProperties = {
    backgroundColor: '#FFFFFF',
    borderRadius: '12px',
    padding: '20px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    border: '1px solid #F3F4F6',
    marginBottom: '16px',
  }

  const filtersGridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '16px',
  }

  const inputStyle: React.CSSProperties = {
    padding: '10px 16px',
    borderRadius: '8px',
    border: '1px solid #E5E7EB',
    fontSize: '14px',
    width: '100%',
  }

  const selectStyle: React.CSSProperties = {
    padding: '10px 16px',
    borderRadius: '8px',
    border: '1px solid #E5E7EB',
    fontSize: '14px',
    backgroundColor: '#FFFFFF',
    cursor: 'pointer',
    width: '100%',
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

  const renderReportContent = () => {
    if (isLoading) {
      return (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <div>Chargement du rapport...</div>
        </div>
      )
    }

    switch (reportType) {
      case 'deliveries':
        const deliveries = deliveriesData?.data || []
        return (
          <div style={cardStyle}>
            <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px' }}>
              Rapport des Livraisons ({deliveries.length} résultats)
            </h3>
            {deliveries.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#6B7280' }}>
                Aucune livraison trouvée pour cette période
              </div>
            ) : (
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>ID</th>
                    <th style={thStyle}>Date</th>
                    <th style={thStyle}>Statut</th>
                    <th style={thStyle}>Client</th>
                    <th style={thStyle}>Driver</th>
                    <th style={thStyle}>Montant</th>
                  </tr>
                </thead>
                <tbody>
                  {deliveries.slice(0, 50).map((order: any) => (
                    <tr key={order.id}>
                      <td style={tdStyle}>{order.id.slice(0, 8)}...</td>
                      <td style={tdStyle}>{formatDate(order.created_at || '')}</td>
                      <td style={tdStyle}>{order.status || 'N/A'}</td>
                      <td style={tdStyle}>{order.user_id?.slice(0, 8) || 'N/A'}...</td>
                      <td style={tdStyle}>{order.driver_id?.slice(0, 8) || 'N/A'}...</td>
                      <td style={tdStyle}>
                        {formatCurrency(order.price || order.price_cfa || 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )

      case 'revenues':
        const revenues = revenuesData?.data || []
        const revenueChartData = revenues.map((r: any) => ({
          date: formatDate(r.date),
          revenue: parseFloat(r.revenue || 0),
          deliveries: parseInt(r.deliveries || 0),
        }))

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={cardStyle}>
              <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px' }}>
                Rapport des Revenus
              </h3>
              {revenueChartData.length > 0 && (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={revenueChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    <Legend />
                    <Line type="monotone" dataKey="revenue" stroke="#8B5CF6" name="Revenus" />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
            <div style={cardStyle}>
              <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px' }}>
                Détails ({revenues.length} jours)
              </h3>
              {revenues.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#6B7280' }}>
                  Aucun revenu trouvé pour cette période
                </div>
              ) : (
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Date</th>
                      <th style={thStyle}>Type</th>
                      <th style={thStyle}>Livraisons</th>
                      <th style={thStyle}>Revenus</th>
                    </tr>
                  </thead>
                  <tbody>
                    {revenues.map((r: any, idx: number) => (
                      <tr key={idx}>
                        <td style={tdStyle}>{formatDate(r.date)}</td>
                        <td style={tdStyle}>{r.delivery_method || 'N/A'}</td>
                        <td style={tdStyle}>{r.deliveries || 0}</td>
                        <td style={tdStyle}>{formatCurrency(parseFloat(r.revenue || 0))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )

      case 'clients':
        const clients = clientsData?.data || []
        return (
          <div style={cardStyle}>
            <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px' }}>
              Rapport des Clients ({clients.length} clients)
            </h3>
            {clients.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#6B7280' }}>
                Aucun client trouvé pour cette période
              </div>
            ) : (
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>Email</th>
                    <th style={thStyle}>Téléphone</th>
                    <th style={thStyle}>Date d'inscription</th>
                    <th style={thStyle}>Commandes totales</th>
                    <th style={thStyle}>Commandes complétées</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map((client: any) => (
                    <tr key={client.id}>
                      <td style={tdStyle}>{client.email || 'N/A'}</td>
                      <td style={tdStyle}>{client.phone || 'N/A'}</td>
                      <td style={tdStyle}>{formatDate(client.created_at || '')}</td>
                      <td style={tdStyle}>{client.total_orders || 0}</td>
                      <td style={tdStyle}>{client.completed_orders || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )

      case 'drivers':
        const drivers = driversData?.data || []
        return (
          <div style={cardStyle}>
            <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px' }}>
              Rapport des Drivers ({drivers.length} drivers)
            </h3>
            {drivers.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#6B7280' }}>
                Aucun driver trouvé pour cette période
              </div>
            ) : (
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>Email</th>
                    <th style={thStyle}>Téléphone</th>
                    <th style={thStyle}>Date d'inscription</th>
                    <th style={thStyle}>Livraisons totales</th>
                    <th style={thStyle}>Livraisons complétées</th>
                    <th style={thStyle}>Revenus totaux</th>
                    <th style={thStyle}>Rating moyen</th>
                  </tr>
                </thead>
                <tbody>
                  {drivers.map((driver: any) => (
                    <tr key={driver.id}>
                      <td style={tdStyle}>{driver.email || 'N/A'}</td>
                      <td style={tdStyle}>{driver.phone || 'N/A'}</td>
                      <td style={tdStyle}>{formatDate(driver.created_at || '')}</td>
                      <td style={tdStyle}>{driver.total_deliveries || 0}</td>
                      <td style={tdStyle}>{driver.completed_deliveries || 0}</td>
                      <td style={tdStyle}>
                        {formatCurrency(parseFloat(driver.total_revenue || 0))}
                      </td>
                      <td style={tdStyle}>
                        {driver.averageRating
                          ? `${driver.averageRating.toFixed(1)} ⭐ (${driver.totalRatings || 0})`
                          : 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )

      case 'payments':
        const payments = paymentsData?.data || []
        const paymentChartData = payments.reduce((acc: any[], p: any) => {
          const existing = acc.find((a) => a.date === formatDate(p.date))
          if (existing) {
            existing[p.payment_method_type] = (existing[p.payment_method_type] || 0) + parseFloat(p.total_amount || 0)
          } else {
            acc.push({
              date: formatDate(p.date),
              [p.payment_method_type]: parseFloat(p.total_amount || 0),
            })
          }
          return acc
        }, [])

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={cardStyle}>
              <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px' }}>
                Rapport des Paiements
              </h3>
              {paymentChartData.length > 0 && (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={paymentChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    <Legend />
                    <Bar dataKey="orange_money" stackId="a" fill="#F59E0B" name="Orange Money" />
                    <Bar dataKey="wave" stackId="a" fill="#10B981" name="Wave" />
                    <Bar dataKey="cash" stackId="a" fill="#6366F1" name="Espèces" />
                    <Bar dataKey="deferred" stackId="a" fill="#EF4444" name="Différé" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
            <div style={cardStyle}>
              <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px' }}>
                Détails ({payments.length} entrées)
              </h3>
              {payments.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#6B7280' }}>
                  Aucun paiement trouvé pour cette période
                </div>
              ) : (
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Date</th>
                      <th style={thStyle}>Méthode</th>
                      <th style={thStyle}>Statut</th>
                      <th style={thStyle}>Nombre</th>
                      <th style={thStyle}>Montant total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((p: any, idx: number) => (
                      <tr key={idx}>
                        <td style={tdStyle}>{formatDate(p.date)}</td>
                        <td style={tdStyle}>{p.payment_method_type || 'N/A'}</td>
                        <td style={tdStyle}>{p.status || 'N/A'}</td>
                        <td style={tdStyle}>{p.count || 0}</td>
                        <td style={tdStyle}>{formatCurrency(parseFloat(p.total_amount || 0))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <h1 style={titleStyle}>Rapports</h1>
        <button
          onClick={handleExport}
          style={{
            padding: '10px 20px',
            borderRadius: '8px',
            backgroundColor: '#8B5CF6',
            color: '#FFFFFF',
            border: 'none',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Download size={16} />
          Exporter (PDF/Excel)
        </button>
      </div>

      {/* Tabs pour sélectionner le type de rapport */}
      <div style={tabsStyle}>
        {reportTypes.map((type) => {
          const Icon = type.icon
          return (
            <button
              key={type.key}
              style={reportType === type.key ? tabActiveStyle : tabStyle}
              onClick={() => setReportType(type.key)}
            >
              <Icon size={16} />
              {type.label}
            </button>
          )
        })}
      </div>

      {/* Filtres */}
      <div style={filtersCardStyle}>
        <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>
          Filtres de période
        </h3>
        <div style={filtersGridStyle}>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500 }}>
              Période
            </label>
            <select
              value={periodPreset}
              onChange={(e) => setPeriodPreset(e.target.value as PeriodPreset)}
              style={selectStyle}
            >
              {periodPresets.map((preset) => (
                <option key={preset.key} value={preset.key}>
                  {preset.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500 }}>
              Date début
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value)
                setPeriodPreset('custom')
              }}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500 }}>
              Date fin
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value)
                setPeriodPreset('custom')
              }}
              style={inputStyle}
            />
          </div>
          {(reportType === 'deliveries' || reportType === 'revenues') && (
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500 }}>
                {reportType === 'deliveries' ? 'Statut' : 'Type de livraison'}
              </label>
              <select
                value={additionalFilter}
                onChange={(e) => setAdditionalFilter(e.target.value)}
                style={selectStyle}
              >
                <option value="">Tous</option>
                {reportType === 'deliveries' ? (
                  <>
                    <option value="pending">En attente</option>
                    <option value="accepted">Accepté</option>
                    <option value="completed">Complété</option>
                    <option value="cancelled">Annulé</option>
                  </>
                ) : (
                  <>
                    <option value="moto">Moto</option>
                    <option value="vehicule">Véhicule</option>
                    <option value="cargo">Cargo</option>
                  </>
                )}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Contenu du rapport */}
      {renderReportContent()}
    </div>
  )
}
