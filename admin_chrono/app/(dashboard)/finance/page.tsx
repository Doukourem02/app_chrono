'use client'

import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { adminApiService } from '@/lib/adminApiService'
import { Wallet, TrendingUp, CreditCard, DollarSign, Users, BarChart3, Download } from 'lucide-react'
import { ScreenTransition } from '@/components/animations'
import { SkeletonLoader } from '@/components/animations'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts'

type Period = 'today' | 'week' | 'month' | 'year'

export default function FinancePage() {
  const [selectedPeriod, setSelectedPeriod] = useState<Period>('month')
  const [currentPage, setCurrentPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [methodFilter, setMethodFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const itemsPerPage = 20

  const { data: financialStats, isLoading: statsLoading } = useQuery({
    queryKey: ['financial-stats'],
    queryFn: () => adminApiService.getFinancialStats(),
    refetchInterval: 60000,
  })

  const { data: transactionsData, isLoading: transactionsLoading } = useQuery({
    queryKey: ['transactions', currentPage, statusFilter, methodFilter, searchQuery],
    queryFn: () =>
      adminApiService.getTransactions({
        page: currentPage,
        limit: itemsPerPage,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        method: methodFilter !== 'all' ? methodFilter : undefined,
        search: searchQuery || undefined,
      }),
    refetchInterval: 30000,
  })

  const formatCurrency = (amount: number) => {
    return `${amount.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} FCFA`
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getStatusBadgeStyle = (status: string): React.CSSProperties => {
    const baseStyle: React.CSSProperties = {
      padding: '4px 12px',
      borderRadius: '12px',
      fontSize: '12px',
      fontWeight: 600,
    }

    switch (status) {
      case 'paid':
        return { ...baseStyle, backgroundColor: '#D1FAE5', color: '#065F46' }
      case 'pending':
        return { ...baseStyle, backgroundColor: '#FEF3C7', color: '#92400E' }
      case 'refused':
        return { ...baseStyle, backgroundColor: '#FEE2E2', color: '#991B1B' }
      case 'delayed':
        return { ...baseStyle, backgroundColor: '#E0E7FF', color: '#3730A3' }
      default:
        return { ...baseStyle, backgroundColor: '#F3F4F6', color: '#374151' }
    }
  }

  const getMethodLabel = (method: string) => {
    const labels: Record<string, string> = {
      orange_money: 'Orange Money',
      wave: 'Wave',
      cash: 'Espèces',
      deferred: 'Différé',
    }
    return labels[method] || method
  }

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      paid: 'Payé',
      pending: 'En attente',
      refused: 'Refusé',
      delayed: 'Différé',
      cancelled: 'Annulé',
    }
    return labels[status] || status
  }

  const periods: { key: Period; label: string }[] = [
    { key: 'today', label: "Aujourd'hui" },
    { key: 'week', label: 'Cette semaine' },
    { key: 'month', label: 'Ce mois' },
    { key: 'year', label: 'Cette année' },
  ]

  const stats = financialStats?.data
  const transactions = transactionsData?.data || []
  const pagination = transactionsData?.pagination

  // Données pour le graphique des revenus par période
  const revenueChartData = stats
    ? [
        { period: "Aujourd'hui", revenue: stats.totalRevenue.today },
        { period: 'Semaine', revenue: stats.totalRevenue.week },
        { period: 'Mois', revenue: stats.totalRevenue.month },
        { period: 'Année', revenue: stats.totalRevenue.year },
      ]
    : []

  // Données pour le graphique en camembert des méthodes de paiement
  const paymentMethodData = stats
    ? Object.entries(stats.transactionsByMethod)
        .filter(([_, value]) => value > 0)
        .map(([method, value]) => ({
          name: getMethodLabel(method),
          value,
        }))
    : []

  const COLORS = ['#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#3B82F6']

  // Données pour le graphique des revenus par driver (top 5)
  const topDriversData = stats?.revenueByDriver.slice(0, 5) || []

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

  const periodTabsStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'row',
    gap: '8px',
    marginBottom: '16px',
  }

  const periodTabStyle: React.CSSProperties = {
    padding: '8px 16px',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    border: '1px solid #E5E7EB',
    backgroundColor: '#FFFFFF',
    color: '#6B7280',
  }

  const periodTabActiveStyle: React.CSSProperties = {
    ...periodTabStyle,
    backgroundColor: '#8B5CF6',
    color: '#FFFFFF',
    borderColor: '#8B5CF6',
  }

  const kpiGridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '16px',
    marginBottom: '16px',
  }

  const kpiCardStyle: React.CSSProperties = {
    backgroundColor: '#FFFFFF',
    borderRadius: '12px',
    padding: '20px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    border: '1px solid #F3F4F6',
  }

  const kpiCardHeaderStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '12px',
  }

  const kpiIconStyle: React.CSSProperties = {
    width: '40px',
    height: '40px',
    borderRadius: '10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  }

  const kpiValueStyle: React.CSSProperties = {
    fontSize: '24px',
    fontWeight: 700,
    color: '#111827',
    marginBottom: '4px',
  }

  const kpiLabelStyle: React.CSSProperties = {
    fontSize: '14px',
    color: '#6B7280',
    fontWeight: 500,
  }

  const chartCardStyle: React.CSSProperties = {
    backgroundColor: '#FFFFFF',
    borderRadius: '12px',
    padding: '20px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    border: '1px solid #F3F4F6',
    marginBottom: '16px',
  }

  const chartTitleStyle: React.CSSProperties = {
    fontSize: '18px',
    fontWeight: 700,
    color: '#111827',
    marginBottom: '20px',
  }

  const filtersStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'row',
    gap: '12px',
    marginBottom: '16px',
    flexWrap: 'wrap',
  }

  const filterInputStyle: React.CSSProperties = {
    padding: '10px 16px',
    borderRadius: '8px',
    border: '1px solid #E5E7EB',
    fontSize: '14px',
    flex: 1,
    minWidth: '200px',
  }

  const filterSelectStyle: React.CSSProperties = {
    padding: '10px 16px',
    borderRadius: '8px',
    border: '1px solid #E5E7EB',
    fontSize: '14px',
    backgroundColor: '#FFFFFF',
    cursor: 'pointer',
  }

  const tableCardStyle: React.CSSProperties = {
    backgroundColor: '#FFFFFF',
    borderRadius: '12px',
    padding: '20px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    border: '1px solid #F3F4EB',
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
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#E5E7EB',
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

  const paginationButtonDisabledStyle: React.CSSProperties = {
    ...paginationButtonStyle,
    opacity: 0.5,
    cursor: 'not-allowed',
  }

  if (statsLoading) {
    return (
      <div style={containerStyle}>
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <div>Chargement...</div>
        </div>
      </div>
    )
  }

  return (
    <ScreenTransition direction="fade" duration={0.3}>
      <div style={containerStyle}>
      <div style={headerStyle}>
        <h1 style={titleStyle}>Finance</h1>
        <button
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
          Exporter
        </button>
      </div>

      {/* Filtres de période */}
      <div style={periodTabsStyle}>
        {periods.map((period) => (
          <button
            key={period.key}
            style={selectedPeriod === period.key ? periodTabActiveStyle : periodTabStyle}
            onClick={() => setSelectedPeriod(period.key)}
          >
            {period.label}
          </button>
        ))}
      </div>

      {/* KPIs */}
      <div style={kpiGridStyle}>
        <div style={kpiCardStyle}>
          <div style={kpiCardHeaderStyle}>
            <div style={{ ...kpiIconStyle, backgroundColor: '#EEF2FF' }}>
              <Wallet size={20} color="#8B5CF6" />
            </div>
            <div>
              <div style={kpiValueStyle}>
                {formatCurrency(
                  selectedPeriod === 'today'
                    ? stats?.totalRevenue.today || 0
                    : selectedPeriod === 'week'
                    ? stats?.totalRevenue.week || 0
                    : selectedPeriod === 'month'
                    ? stats?.totalRevenue.month || 0
                    : stats?.totalRevenue.year || 0
                )}
              </div>
              <div style={kpiLabelStyle}>Revenus totaux</div>
            </div>
          </div>
        </div>

        <div style={kpiCardStyle}>
          <div style={kpiCardHeaderStyle}>
            <div style={{ ...kpiIconStyle, backgroundColor: '#D1FAE5' }}>
              <TrendingUp size={20} color="#10B981" />
            </div>
            <div>
              <div style={kpiValueStyle}>{stats?.conversionRate.toFixed(1) || 0}%</div>
              <div style={kpiLabelStyle}>Taux de conversion</div>
            </div>
          </div>
        </div>

        <div style={kpiCardStyle}>
          <div style={kpiCardHeaderStyle}>
            <div style={{ ...kpiIconStyle, backgroundColor: '#FEF3C7' }}>
              <CreditCard size={20} color="#F59E0B" />
            </div>
            <div>
              <div style={kpiValueStyle}>
                {stats?.paymentStatus.paid || 0} / {Object.values(stats?.paymentStatus || {}).reduce((a: number, b: number) => a + b, 0)}
              </div>
              <div style={kpiLabelStyle}>Paiements complétés</div>
            </div>
          </div>
        </div>

        <div style={kpiCardStyle}>
          <div style={kpiCardHeaderStyle}>
            <div style={{ ...kpiIconStyle, backgroundColor: '#E0E7FF' }}>
              <DollarSign size={20} color="#6366F1" />
            </div>
            <div>
              <div style={kpiValueStyle}>{stats?.paymentStatus.pending || 0}</div>
              <div style={kpiLabelStyle}>En attente</div>
            </div>
          </div>
        </div>
      </div>

      {/* Graphiques */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
        <div style={chartCardStyle}>
          <h3 style={chartTitleStyle}>Revenus par période</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={revenueChartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="period" />
              <YAxis />
              <Tooltip formatter={(value: number) => formatCurrency(value)} />
              <Bar dataKey="revenue" fill="#8B5CF6" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div style={chartCardStyle}>
          <h3 style={chartTitleStyle}>Répartition par méthode de paiement</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={paymentMethodData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {paymentMethodData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value: number) => formatCurrency(value)} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top 5 Drivers */}
      {topDriversData.length > 0 && (
        <div style={chartCardStyle}>
          <h3 style={chartTitleStyle}>Top 5 Drivers par revenus</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={topDriversData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="driverId" type="category" width={100} />
              <Tooltip formatter={(value: number) => formatCurrency(value)} />
              <Bar dataKey="revenue" fill="#8B5CF6" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Filtres et recherche */}
      <div style={filtersStyle}>
        <input
          type="text"
          placeholder="Rechercher par ID transaction, commande, email..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value)
            setCurrentPage(1)
          }}
          style={filterInputStyle}
        />
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value)
            setCurrentPage(1)
          }}
          style={filterSelectStyle}
        >
          <option value="all">Tous les statuts</option>
          <option value="paid">Payé</option>
          <option value="pending">En attente</option>
          <option value="refused">Refusé</option>
          <option value="delayed">Différé</option>
        </select>
        <select
          value={methodFilter}
          onChange={(e) => {
            setMethodFilter(e.target.value)
            setCurrentPage(1)
          }}
          style={filterSelectStyle}
        >
          <option value="all">Toutes les méthodes</option>
          <option value="orange_money">Orange Money</option>
          <option value="wave">Wave</option>
          <option value="cash">Espèces</option>
          <option value="deferred">Différé</option>
        </select>
      </div>

      {/* Table des transactions */}
      <div style={tableCardStyle}>
        <h3 style={{ ...chartTitleStyle, marginBottom: '16px' }}>Transactions</h3>
        {transactionsLoading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>Chargement...</div>
        ) : transactions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#6B7280' }}>
            Aucune transaction trouvée
          </div>
        ) : (
          <>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>ID Transaction</th>
                  <th style={thStyle}>Commande</th>
                  <th style={thStyle}>Client</th>
                  <th style={thStyle}>Montant</th>
                  <th style={thStyle}>Méthode</th>
                  <th style={thStyle}>Statut</th>
                  <th style={thStyle}>Date</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((transaction: any) => (
                  <tr key={transaction.id}>
                    <td style={tdStyle}>{transaction.id.slice(0, 8)}...</td>
                    <td style={tdStyle}>{transaction.order_id_full?.slice(0, 8) || 'N/A'}...</td>
                    <td style={tdStyle}>
                      <div>{transaction.user_email || 'N/A'}</div>
                      <div style={{ fontSize: '12px', color: '#6B7280' }}>
                        {transaction.user_phone || ''}
                      </div>
                    </td>
                    <td style={tdStyle}>{formatCurrency(transaction.amount || 0)}</td>
                    <td style={tdStyle}>{getMethodLabel(transaction.payment_method_type || '')}</td>
                    <td style={tdStyle}>
                      <span style={getStatusBadgeStyle(transaction.status || '')}>
                        {getStatusLabel(transaction.status || '')}
                      </span>
                    </td>
                    <td style={tdStyle}>{formatDate(transaction.created_at || '')}</td>
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
                    style={
                      currentPage === 1 ? paginationButtonDisabledStyle : paginationButtonStyle
                    }
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
                          style={
                            currentPage === page
                              ? paginationButtonActiveStyle
                              : paginationButtonStyle
                          }
                          onClick={() => setCurrentPage(page)}
                        >
                          {page}
                        </button>
                      </React.Fragment>
                    ))}
                  <button
                    style={
                      currentPage === pagination.totalPages
                        ? paginationButtonDisabledStyle
                        : paginationButtonStyle
                    }
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
    </ScreenTransition>
  )
}
