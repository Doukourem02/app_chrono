'use client'

import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Download, Search, TrendingDown, TrendingUp, ExternalLink } from 'lucide-react'
import { adminApiService } from '@/lib/adminApiService'
import { ScreenTransition } from '@/components/animations'
import type { Driver } from '@/types'
import { logger } from '@/utils/logger'
import { themeColors } from '@/utils/theme'

interface CommissionTransaction {
  id: string
  driverId: string
  driverName: string
  driverEmail: string
  type: 'recharge' | 'deduction' | 'refund'
  amount: number
  balance_before: number
  balance_after: number
  order_id?: string
  created_at: string
}

export default function CommissionsPage() {
  const router = useRouter()
  const [searchTerm, setSearchTerm] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | 'recharge' | 'deduction' | 'refund'>('all')
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('month')

  const { data: driversData } = useQuery({
    queryKey: ['all-drivers-commissions'],
    queryFn: async () => {
      const result = await adminApiService.getDrivers({ type: 'partner' })
      return result
    },
  })

  const drivers = (driversData?.data || []) as Driver[]

  // Charger les transactions pour chaque livreur
  const { data: allTransactionsData } = useQuery({
    queryKey: ['all-commission-transactions', drivers.map((d) => d.id || (d as { user_id?: string }).user_id).join(',')],
    queryFn: async () => {
      const transactionPromises = drivers.map(async (driver) => {
        const driverId = driver.id || (driver as { user_id?: string }).user_id
        if (!driverId) return []
        
        try {
          const result = await adminApiService.getDriverCommissionTransactions(driverId, { limit: 100 })
          if (result.success && result.data) {
            return result.data.map((tx) => ({
              ...tx,
              driverId,
              driverName: `${driver.first_name || ''} ${driver.last_name || ''}`.trim() || driver.email || 'Livreur inconnu',
              driverEmail: driver.email || '',
            })) as CommissionTransaction[]
          }
        } catch (error) {
          logger.error(`Error loading transactions for driver ${driverId}:`, error)
        }
        return []
      })
      
      const results = await Promise.all(transactionPromises)
      return results.flat()
    },
    enabled: drivers.length > 0,
  })

  const allTransactions = React.useMemo(() => {
    const transactions = (allTransactionsData || []) as CommissionTransaction[]
    return transactions.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  }, [allTransactionsData])

  const filteredTransactions = React.useMemo(() => {
    let filtered = allTransactions

    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase()
      filtered = filtered.filter(
        (tx) =>
          tx.driverName.toLowerCase().includes(searchLower) ||
          tx.driverEmail.toLowerCase().includes(searchLower) ||
          tx.order_id?.toLowerCase().includes(searchLower) ||
          tx.id.toLowerCase().includes(searchLower)
      )
    }

    if (typeFilter !== 'all') {
      filtered = filtered.filter((tx) => tx.type === typeFilter)
    }

    if (dateFilter !== 'all') {
      const now = new Date()
      let startDate: Date

      switch (dateFilter) {
        case 'today':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
          break
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          break
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1)
          break
        default:
          startDate = new Date(0)
      }

      filtered = filtered.filter((tx) => new Date(tx.created_at) >= startDate)
    }

    return filtered
  }, [allTransactions, searchTerm, typeFilter, dateFilter])

  const stats = React.useMemo(() => {
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    const monthlyTransactions = filteredTransactions.filter(
      (tx) => new Date(tx.created_at) >= startOfMonth
    )

    const totalDeductions = monthlyTransactions
      .filter((tx) => tx.type === 'deduction')
      .reduce((sum, tx) => sum + tx.amount, 0)

    const totalRecharges = monthlyTransactions
      .filter((tx) => tx.type === 'recharge')
      .reduce((sum, tx) => sum + tx.amount, 0)

    return {
      totalDeductions,
      totalRecharges,
      deductionCount: monthlyTransactions.filter((tx) => tx.type === 'deduction').length,
      rechargeCount: monthlyTransactions.filter((tx) => tx.type === 'recharge').length,
      netCommission: totalRecharges - totalDeductions,
    }
  }, [filteredTransactions])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount) + ' FCFA'
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const handleExport = () => {
    const csv = [
      ['Date', 'Livreur', 'Email', 'Type', 'Montant', 'Solde avant', 'Solde après', 'Commande ID'].join(','),
      ...filteredTransactions.map((tx) =>
        [
          formatDate(tx.created_at),
          `"${tx.driverName}"`,
          tx.driverEmail,
          tx.type,
          tx.amount,
          tx.balance_before,
          tx.balance_after,
          tx.order_id || '',
        ].join(',')
      ),
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `commissions_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  return (
    <ScreenTransition>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: themeColors.background }}>
        {/* Header */}
        <div style={{ backgroundColor: themeColors.cardBg, borderBottom: `1px solid ${themeColors.cardBorder}`, padding: '16px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
            <button
              onClick={() => router.back()}
              style={{
                padding: '8px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: 'transparent',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ArrowLeft size={20} color={themeColors.textPrimary} />
            </button>
            <h1 style={{ fontSize: '24px', fontWeight: 700, color: themeColors.textPrimary, margin: 0 }}>
              Commissions
            </h1>
          </div>

          {/* Statistiques */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            <div style={{ padding: '16px', backgroundColor: themeColors.grayLight, borderRadius: '8px' }}>
              <div style={{ fontSize: '12px', color: themeColors.textSecondary, marginBottom: '4px' }}>
                Commissions prélevées (mois)
              </div>
              <div style={{ fontSize: '20px', fontWeight: 700, color: '#EF4444', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <TrendingDown size={16} />
                {formatCurrency(stats.totalDeductions)}
              </div>
              <div style={{ fontSize: '11px', color: themeColors.textSecondary, marginTop: '4px' }}>
                {stats.deductionCount} prélèvements
              </div>
            </div>

            <div style={{ padding: '16px', backgroundColor: themeColors.grayLight, borderRadius: '8px' }}>
              <div style={{ fontSize: '12px', color: themeColors.textSecondary, marginBottom: '4px' }}>
                Recharges totales (mois)
              </div>
              <div style={{ fontSize: '20px', fontWeight: 700, color: '#10B981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <TrendingUp size={16} />
                {formatCurrency(stats.totalRecharges)}
              </div>
              <div style={{ fontSize: '11px', color: themeColors.textSecondary, marginTop: '4px' }}>
                {stats.rechargeCount} recharges
              </div>
            </div>

            <div style={{ padding: '16px', backgroundColor: themeColors.grayLight, borderRadius: '8px' }}>
              <div style={{ fontSize: '12px', color: themeColors.textSecondary, marginBottom: '4px' }}>
                Solde net (mois)
              </div>
              <div style={{ fontSize: '20px', fontWeight: 700, color: stats.netCommission >= 0 ? '#10B981' : '#EF4444' }}>
                {formatCurrency(stats.netCommission)}
              </div>
            </div>
          </div>
        </div>

        {/* Filtres */}
        <div style={{ backgroundColor: themeColors.cardBg, padding: '16px 24px', borderBottom: `1px solid ${themeColors.cardBorder}` }}>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: themeColors.textTertiary }} />
              <input
                type="text"
                placeholder="Rechercher (livreur, email, commande...)"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px 10px 36px',
                  borderRadius: '8px',
                  border: `1px solid ${themeColors.cardBorder}`,
                  fontSize: '14px',
                  backgroundColor: themeColors.background,
                  color: themeColors.textPrimary,
                }}
              />
            </div>

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as 'all' | 'recharge' | 'deduction' | 'refund')}
              style={{
                padding: '10px 12px',
                borderRadius: '8px',
                border: `1px solid ${themeColors.cardBorder}`,
                fontSize: '14px',
                backgroundColor: themeColors.cardBg,
                color: themeColors.textPrimary,
                cursor: 'pointer',
              }}
            >
              <option value="all">Tous les types</option>
              <option value="recharge">Recharges</option>
              <option value="deduction">Prélèvements</option>
              <option value="refund">Remboursements</option>
            </select>

            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as 'all' | 'today' | 'week' | 'month')}
              style={{
                padding: '10px 12px',
                borderRadius: '8px',
                border: `1px solid ${themeColors.cardBorder}`,
                fontSize: '14px',
                backgroundColor: themeColors.cardBg,
                color: themeColors.textPrimary,
                cursor: 'pointer',
              }}
            >
              <option value="all">Toutes les dates</option>
              <option value="today">Aujourd&apos;hui</option>
              <option value="week">7 derniers jours</option>
              <option value="month">Ce mois</option>
            </select>

            <button
              onClick={handleExport}
              style={{
                padding: '10px 16px',
                borderRadius: '8px',
                backgroundColor: themeColors.purplePrimary,
                color: '#FFFFFF',
                fontSize: '14px',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <Download size={16} />
              Exporter CSV
            </button>
          </div>
        </div>

        {/* Table */}
        <div style={{ flex: 1, overflow: 'auto', padding: '24px' }}>
          {filteredTransactions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: themeColors.textSecondary }}>
              Aucune transaction trouvée
            </div>
          ) : (
            <div style={{ backgroundColor: themeColors.cardBg, borderRadius: '12px', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: themeColors.grayLight, borderBottom: `1px solid ${themeColors.cardBorder}` }}>
                    <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: themeColors.textSecondary }}>
                      Date
                    </th>
                    <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: themeColors.textSecondary }}>
                      Livreur
                    </th>
                    <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: themeColors.textSecondary }}>
                      Type
                    </th>
                    <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: themeColors.textSecondary }}>
                      Commande
                    </th>
                    <th style={{ padding: '12px', textAlign: 'right', fontSize: '12px', fontWeight: 600, color: themeColors.textSecondary }}>
                      Montant
                    </th>
                    <th style={{ padding: '12px', textAlign: 'right', fontSize: '12px', fontWeight: 600, color: themeColors.textSecondary }}>
                      Solde après
                    </th>
                    <th style={{ padding: '12px', textAlign: 'center', fontSize: '12px', fontWeight: 600, color: themeColors.textSecondary }}>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTransactions.map((tx) => (
                    <tr key={tx.id} style={{ borderBottom: `1px solid ${themeColors.cardBorder}` }}>
                      <td style={{ padding: '12px', fontSize: '14px', color: themeColors.textPrimary }}>
                        {formatDate(tx.created_at)}
                      </td>
                      <td style={{ padding: '12px', fontSize: '14px', color: themeColors.textPrimary }}>
                        <div>
                          <div style={{ fontWeight: 600 }}>{tx.driverName}</div>
                          <div style={{ fontSize: '12px', color: themeColors.textSecondary }}>{tx.driverEmail}</div>
                        </div>
                      </td>
                      <td style={{ padding: '12px', fontSize: '14px', color: themeColors.textPrimary }}>
                        <span
                          style={{
                            padding: '4px 8px',
                            borderRadius: '4px',
                            fontSize: '12px',
                            fontWeight: 600,
                            backgroundColor:
                              tx.type === 'recharge'
                                ? '#D1FAE5'
                                : tx.type === 'deduction'
                                ? '#FEE2E2'
                                : '#FEF3C7',
                            color:
                              tx.type === 'recharge'
                                ? '#065F46'
                                : tx.type === 'deduction'
                                ? '#DC2626'
                                : '#92400E',
                          }}
                        >
                          {tx.type === 'recharge' ? 'Recharge' : tx.type === 'deduction' ? 'Prélèvement' : 'Remboursement'}
                        </span>
                      </td>
                      <td style={{ padding: '12px', fontSize: '14px', color: themeColors.textPrimary }}>
                        {tx.order_id ? (
                          <button
                            onClick={() => router.push(`/orders?search=${tx.order_id}`)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '4px 8px',
                              borderRadius: '4px',
                              backgroundColor: themeColors.grayLight,
                              border: 'none',
                              cursor: 'pointer',
                              fontSize: '12px',
                              color: themeColors.purplePrimary,
                              fontWeight: 600,
                            }}
                          >
                            {tx.order_id.slice(0, 8)}...
                            <ExternalLink size={12} />
                          </button>
                        ) : (
                          <span style={{ color: themeColors.textTertiary, fontSize: '12px' }}>-</span>
                        )}
                      </td>
                      <td
                        style={{
                          padding: '12px',
                          fontSize: '14px',
                          color: tx.type === 'recharge' ? '#10B981' : '#EF4444',
                          textAlign: 'right',
                          fontWeight: 600,
                        }}
                      >
                        {tx.type === 'recharge' ? '+' : '-'}
                        {formatCurrency(tx.amount)}
                      </td>
                      <td style={{ padding: '12px', fontSize: '14px', color: themeColors.textPrimary, textAlign: 'right' }}>
                        {formatCurrency(tx.balance_after)}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'center' }}>
                        <button
                          onClick={() => router.push(`/drivers/${tx.driverId}`)}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '6px',
                            backgroundColor: themeColors.grayLight,
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: '12px',
                            color: themeColors.purplePrimary,
                            fontWeight: 600,
                          }}
                        >
                          Voir livreur
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </ScreenTransition>
  )
}

