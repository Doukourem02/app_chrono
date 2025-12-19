'use client'

import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { adminApiService } from '@/lib/adminApiService'
import { Download, TrendingUp, Users, Truck, CreditCard, LucideIcon } from 'lucide-react'
import { ScreenTransition } from '@/components/animations'
import { exportData } from '@/utils/exportUtils'
import {BarChart,Bar,XAxis,YAxis,CartesianGrid,Tooltip,Legend,ResponsiveContainer,LineChart,Line,} from 'recharts'

type ReportType = 'deliveries' | 'revenues' | 'clients' | 'drivers' | 'payments'
type PeriodPreset = 'today' | 'week' | 'month' | 'year' | 'custom'

interface Delivery {
  id: string
  created_at?: string
  status?: string
  user_id?: string
  driver_id?: string
  price?: number | string
  price_cfa?: number | string
  user_first_name?: string
  user_last_name?: string
  user_email?: string
  user_phone?: string
  driver_first_name?: string
  driver_last_name?: string
  driver_email?: string
  driver_phone?: string
}

interface Revenue {
  date?: string
  revenue?: string | number
  deliveries?: string | number
  delivery_method?: string
}

interface Client {
  id: string
  email?: string
  phone?: string
  first_name?: string
  last_name?: string
  created_at?: string
  total_orders?: number
  completed_orders?: number
}

interface Driver {
  id: string
  email?: string
  phone?: string
  first_name?: string
  last_name?: string
  created_at?: string
  total_deliveries?: number
  completed_deliveries?: number
  total_revenue?: string | number
  averageRating?: number
  totalRatings?: number
}

interface Payment {
  date?: string
  payment_method_type?: string
  status?: string
  count?: number
  total_amount?: string | number
}

interface PaymentChartData {
  date: string
  [key: string]: string | number
}

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
    const end: Date = now

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
      case 'custom':
        return // custom - ne pas modifier
      default:
        return
    }

    if (periodPreset !== 'custom' as PeriodPreset) {
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
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchInterval: false,
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
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchInterval: false,
  })

  const { data: clientsData, isLoading: clientsLoading } = useQuery({
    queryKey: ['report-clients', startDate, endDate],
    queryFn: () =>
      adminApiService.getReportClients({
        startDate,
        endDate,
      }),
    enabled: reportType === 'clients' && !!startDate && !!endDate,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchInterval: false,
  })

  const { data: driversData, isLoading: driversLoading } = useQuery({
    queryKey: ['report-drivers', startDate, endDate],
    queryFn: () =>
      adminApiService.getReportDrivers({
        startDate,
        endDate,
      }),
    enabled: reportType === 'drivers' && !!startDate && !!endDate,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchInterval: false,
  })

  const { data: paymentsData, isLoading: paymentsLoading } = useQuery({
    queryKey: ['report-payments', startDate, endDate],
    queryFn: () =>
      adminApiService.getReportPayments({
        startDate,
        endDate,
      }),
    enabled: reportType === 'payments' && !!startDate && !!endDate,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchInterval: false,
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
    switch (reportType) {
      case 'deliveries': {
        const deliveries: Delivery[] = (deliveriesData?.data as Delivery[]) || []
        if (deliveries.length === 0) {
          alert('Aucune donnée à exporter')
          return
        }

        exportData(
          {
            title: `Rapport des Livraisons - ${periodPresets.find((p) => p.key === periodPreset)?.label || 'Période personnalisée'}`,
            headers: ['ID', 'Date', 'Statut', 'Client', 'Driver ID', 'Montant (FCFA)'],
            rows: deliveries.map((order: Delivery) => {
              const clientName = (order.user_first_name && order.user_last_name)
                ? `${order.user_first_name} ${order.user_last_name}`
                : order.user_email || order.user_id?.slice(0, 8) + '...' || 'N/A'
              const driverName = (order.driver_first_name && order.driver_last_name)
                ? `${order.driver_first_name} ${order.driver_last_name}`
                : order.driver_email || order.driver_id?.slice(0, 8) + '...' || 'N/A'
              return [
                order.id.slice(0, 8) + '...',
                formatDate(order.created_at || ''),
                order.status || 'N/A',
                clientName,
                driverName,
                typeof order.price === 'number'
                  ? order.price
                  : typeof order.price_cfa === 'number'
                  ? order.price_cfa
                  : parseFloat(String(order.price || order.price_cfa || 0)),
              ]
            }),
            filename: `rapport_livraisons_${new Date().toISOString().split('T')[0]}`,
          }
        )
        break
      }

      case 'revenues': {
        const revenues: Revenue[] = (revenuesData?.data as Revenue[]) || []
        if (revenues.length === 0) {
          alert('Aucune donnée à exporter')
          return
        }

        exportData(
          {
            title: `Rapport des Revenus - ${periodPresets.find((p) => p.key === periodPreset)?.label || 'Période personnalisée'}`,
            headers: ['Date', 'Type de livraison', 'Nombre de livraisons', 'Revenus (FCFA)'],
            rows: revenues.map((r: Revenue) => [
              formatDate(r.date || ''),
              r.delivery_method || 'N/A',
              typeof r.deliveries === 'number' ? r.deliveries : parseInt(String(r.deliveries || 0)),
              typeof r.revenue === 'number' ? r.revenue : parseFloat(String(r.revenue || 0)),
            ]),
            filename: `rapport_revenus_${new Date().toISOString().split('T')[0]}`,
          }
        )
        break
      }

      case 'clients': {
        const clients: Client[] = (clientsData?.data as Client[]) || []
        if (clients.length === 0) {
          alert('Aucune donnée à exporter')
          return
        }

        exportData(
          {
            title: `Rapport des Clients - ${periodPresets.find((p) => p.key === periodPreset)?.label || 'Période personnalisée'}`,
            headers: ['Nom et Prénom', 'Téléphone', "Date d'inscription", 'Commandes totales', 'Commandes complétées'],
            rows: clients.map((client: Client) => {
              const clientName = (client.first_name && client.last_name)
                ? `${client.first_name} ${client.last_name}`
                : client.email || 'N/A'
              return [
                clientName,
                client.phone || 'N/A',
                formatDate(client.created_at || ''),
                client.total_orders || 0,
                client.completed_orders || 0,
              ]
            }),
            filename: `rapport_clients_${new Date().toISOString().split('T')[0]}`,
          }
        )
        break
      }

      case 'drivers': {
        const drivers: Driver[] = (driversData?.data as Driver[]) || []
        if (drivers.length === 0) {
          alert('Aucune donnée à exporter')
          return
        }

        exportData(
          {
            title: `Rapport des Drivers - ${periodPresets.find((p) => p.key === periodPreset)?.label || 'Période personnalisée'}`,
            headers: ['Nom et Prénom', 'Email', 'Téléphone', "Date d'inscription", 'Livraisons totales', 'Livraisons complétées', 'Revenus totaux (FCFA)', 'Rating moyen'],
            rows: drivers.map((driver: Driver) => {
              const driverName = (driver.first_name && driver.last_name)
                ? `${driver.first_name} ${driver.last_name}`
                : driver.email || 'N/A'
              return [
                driverName,
                driver.email || 'N/A',
                driver.phone || 'N/A',
                formatDate(driver.created_at || ''),
                driver.total_deliveries || 0,
                driver.completed_deliveries || 0,
                typeof driver.total_revenue === 'number'
                  ? driver.total_revenue
                  : parseFloat(String(driver.total_revenue || 0)),
                driver.averageRating
                  ? `${driver.averageRating.toFixed(1)} ⭐ (${driver.totalRatings || 0})`
                  : 'N/A',
              ]
            }),
            filename: `rapport_drivers_${new Date().toISOString().split('T')[0]}`,
          }
        )
        break
      }

      case 'payments': {
        const payments: Payment[] = (paymentsData?.data as Payment[]) || []
        if (payments.length === 0) {
          alert('Aucune donnée à exporter')
          return
        }

        exportData(
          {
            title: `Rapport des Paiements - ${periodPresets.find((p) => p.key === periodPreset)?.label || 'Période personnalisée'}`,
            headers: ['Date', 'Méthode de paiement', 'Statut', 'Nombre', 'Montant total (FCFA)'],
            rows: payments.map((p: Payment) => [
              formatDate(p.date || ''),
              p.payment_method_type || 'N/A',
              p.status || 'N/A',
              p.count || 0,
              typeof p.total_amount === 'number'
                ? p.total_amount
                : parseFloat(String(p.total_amount || 0)),
            ]),
            filename: `rapport_paiements_${new Date().toISOString().split('T')[0]}`,
          }
        )
        break
      }

      default:
        alert('Type de rapport non supporté pour l\'export')
    }
  }

  const reportTypes: { key: ReportType; label: string; icon: LucideIcon }[] = [
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
    border: '1px solid #E5E7EB',
    backgroundColor: '#FFFFFF',
    color: '#6B7280',
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: '8px',
  }

  const tabActiveStyle: React.CSSProperties = {
    padding: '12px 20px',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    border: '1px solid #8B5CF6',
    backgroundColor: '#8B5CF6',
    color: '#FFFFFF',
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: '8px',
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
        const deliveries: Delivery[] = (deliveriesData?.data as Delivery[]) || []
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
                  {deliveries.slice(0, 50).map((order: Delivery) => {
                    const clientName = (order.user_first_name && order.user_last_name)
                      ? `${order.user_first_name} ${order.user_last_name}`
                      : order.user_email || order.user_id?.slice(0, 8) + '...' || 'N/A'
                    const driverName = (order.driver_first_name && order.driver_last_name)
                      ? `${order.driver_first_name} ${order.driver_last_name}`
                      : order.driver_email || order.driver_id?.slice(0, 8) + '...' || 'N/A'
                    return (
                      <tr key={order.id}>
                        <td style={tdStyle}>{order.id.slice(0, 8)}...</td>
                        <td style={tdStyle}>{formatDate(order.created_at || '')}</td>
                        <td style={tdStyle}>{order.status || 'N/A'}</td>
                        <td style={tdStyle}>{clientName}</td>
                        <td style={tdStyle}>{driverName}</td>
                        <td style={tdStyle}>
                          {formatCurrency(
                            typeof order.price === 'number' 
                              ? order.price 
                              : typeof order.price_cfa === 'number'
                              ? order.price_cfa
                              : parseFloat(String(order.price || order.price_cfa || 0))
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        )

      case 'revenues':
        const revenues: Revenue[] = (revenuesData?.data as Revenue[]) || []
        const revenueChartData = revenues.map((r: Revenue) => ({
          date: formatDate(r.date || ''),
          revenue: typeof r.revenue === 'number' ? r.revenue : parseFloat(String(r.revenue || 0)),
          deliveries: typeof r.deliveries === 'number' ? r.deliveries : parseInt(String(r.deliveries || 0)),
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
                    {revenues.map((r: Revenue, idx: number) => (
                      <tr key={idx}>
                        <td style={tdStyle}>{formatDate(r.date || '')}</td>
                        <td style={tdStyle}>{r.delivery_method || 'N/A'}</td>
                        <td style={tdStyle}>{r.deliveries || 0}</td>
                        <td style={tdStyle}>
                          {formatCurrency(
                            typeof r.revenue === 'number' ? r.revenue : parseFloat(String(r.revenue || 0))
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )

      case 'clients':
        const clients: Client[] = (clientsData?.data as Client[]) || []
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
                    <th style={thStyle}>Nom et Prénom</th>
                    <th style={thStyle}>Téléphone</th>
                    <th style={thStyle}>Date d&apos;inscription</th>
                    <th style={thStyle}>Commandes totales</th>
                    <th style={thStyle}>Commandes complétées</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map((client: Client) => {
                    const clientName = (client.first_name && client.last_name)
                      ? `${client.first_name} ${client.last_name}`
                      : client.email || 'N/A'
                    return (
                      <tr key={client.id}>
                        <td style={tdStyle}>{clientName}</td>
                        <td style={tdStyle}>{client.phone || 'N/A'}</td>
                        <td style={tdStyle}>{formatDate(client.created_at || '')}</td>
                        <td style={tdStyle}>{client.total_orders || 0}</td>
                        <td style={tdStyle}>{client.completed_orders || 0}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        )

      case 'drivers':
        const drivers: Driver[] = (driversData?.data as Driver[]) || []
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
                    <th style={thStyle}>Nom et Prénom</th>
                    <th style={thStyle}>Email</th>
                    <th style={thStyle}>Téléphone</th>
                    <th style={thStyle}>Date d&apos;inscription</th>
                    <th style={thStyle}>Livraisons totales</th>
                    <th style={thStyle}>Livraisons complétées</th>
                    <th style={thStyle}>Revenus totaux</th>
                    <th style={thStyle}>Rating moyen</th>
                  </tr>
                </thead>
                <tbody>
                  {drivers.map((driver: Driver) => {
                    const driverName = (driver.first_name && driver.last_name)
                      ? `${driver.first_name} ${driver.last_name}`
                      : driver.email || 'N/A'
                    return (
                      <tr key={driver.id}>
                        <td style={tdStyle}>{driverName}</td>
                        <td style={tdStyle}>{driver.email || 'N/A'}</td>
                        <td style={tdStyle}>{driver.phone || 'N/A'}</td>
                        <td style={tdStyle}>{formatDate(driver.created_at || '')}</td>
                        <td style={tdStyle}>{driver.total_deliveries || 0}</td>
                        <td style={tdStyle}>{driver.completed_deliveries || 0}</td>
                        <td style={tdStyle}>
                          {formatCurrency(
                            typeof driver.total_revenue === 'number' 
                              ? driver.total_revenue 
                              : parseFloat(String(driver.total_revenue || 0))
                          )}
                        </td>
                        <td style={tdStyle}>
                          {driver.averageRating
                            ? `${driver.averageRating.toFixed(1)} ⭐ (${driver.totalRatings || 0})`
                            : 'N/A'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        )

      case 'payments':
        const payments: Payment[] = (paymentsData?.data as Payment[]) || []
        const paymentChartData: PaymentChartData[] = payments.reduce((acc: PaymentChartData[], p: Payment) => {
          const dateKey = formatDate(p.date || '')
          const methodType = p.payment_method_type || 'unknown'
          const existing = acc.find((a) => a.date === dateKey)
          const amount = typeof p.total_amount === 'number' 
            ? p.total_amount 
            : parseFloat(String(p.total_amount || 0))
          
          if (existing) {
            existing[methodType] = (typeof existing[methodType] === 'number' ? existing[methodType] : 0) + amount
          } else {
            acc.push({
              date: dateKey,
              [methodType]: amount,
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
                    {payments.map((p: Payment, idx: number) => (
                      <tr key={idx}>
                        <td style={tdStyle}>{formatDate(p.date || '')}</td>
                        <td style={tdStyle}>{p.payment_method_type || 'N/A'}</td>
                        <td style={tdStyle}>{p.status || 'N/A'}</td>
                        <td style={tdStyle}>{p.count || 0}</td>
                        <td style={tdStyle}>
                          {formatCurrency(
                            typeof p.total_amount === 'number' 
                              ? p.total_amount 
                              : parseFloat(String(p.total_amount || 0))
                          )}
                        </td>
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
    <ScreenTransition direction="fade" duration={0.3}>
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
    </ScreenTransition>
  )
}
