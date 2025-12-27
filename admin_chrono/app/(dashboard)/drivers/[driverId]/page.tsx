'use client'

import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft, User, Briefcase, Wallet, CreditCard, Package, Star } from 'lucide-react'
import { adminApiService } from '@/lib/adminApiService'
import { ScreenTransition } from '@/components/animations'
import { SkeletonLoader } from '@/components/animations'
import type { Driver } from '@/types'

type TabType = 'overview' | 'commission' | 'deliveries' | 'ratings'

export default function DriverDetailPage() {
  const router = useRouter()
  const params = useParams()
  const driverId = params?.driverId as string
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<TabType>('overview')
  const [showRechargeModal, setShowRechargeModal] = useState(false)
  const [rechargeAmount, setRechargeAmount] = useState('')
  const [rechargeNotes, setRechargeNotes] = useState('')

  const { data: driverData, isLoading } = useQuery({
    queryKey: ['driver', driverId],
    queryFn: async () => {
      const result = await adminApiService.getDriverFullDetails(driverId)
      return result
    },
    enabled: !!driverId,
  })

  const { data: transactionsData } = useQuery({
    queryKey: ['driver-transactions', driverId],
    queryFn: async () => {
      const result = await adminApiService.getDriverCommissionTransactions(driverId, { limit: 50 })
      return result
    },
    enabled: !!driverId && activeTab === 'commission',
  })

  const rechargeMutation = useMutation({
    mutationFn: async (amount: number) => {
      return await adminApiService.rechargeDriverCommission(driverId, amount, 'admin_manual', rechargeNotes)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['driver', driverId] })
      queryClient.invalidateQueries({ queryKey: ['driver-transactions', driverId] })
      setShowRechargeModal(false)
      setRechargeAmount('')
      setRechargeNotes('')
    },
  })

  const driver = driverData?.data as (Driver & {
    commission_account?: {
      balance: number
      commission_rate: number
      is_suspended: boolean
      last_updated: string
    }
  }) | undefined

  const transactions = transactionsData?.data || []

  const formatCurrency = (amount: number | undefined) => {
    if (amount === undefined || amount === null) return 'N/A'
    return new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount) + ' FCFA'
  }

  const formatDate = (date: string | undefined) => {
    if (!date) return 'N/A'
    return new Date(date).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getBalanceColor = (balance: number | undefined, isSuspended: boolean | undefined) => {
    if (isSuspended || balance === 0) return '#EF4444'
    if (balance !== undefined && balance < 1000) return '#F59E0B'
    if (balance !== undefined && balance < 3000) return '#FBBF24'
    return '#10B981'
  }

  if (isLoading) {
    return (
      <ScreenTransition>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <SkeletonLoader width="100%" height={200} borderRadius={12} />
          <SkeletonLoader width="100%" height={400} borderRadius={12} />
        </div>
      </ScreenTransition>
    )
  }

  if (!driver) {
    return (
      <ScreenTransition>
        <div style={{ textAlign: 'center', padding: '40px', color: '#6B7280' }}>
          Livreur non trouvé
        </div>
      </ScreenTransition>
    )
  }

  const driverName =
    driver.first_name && driver.last_name
      ? `${driver.first_name} ${driver.last_name}`
      : driver.full_name || driver.email || 'N/A'
  const isPartner = driver.driver_type === 'partner'
  const commissionAccount = driver.commission_account
  const balance = commissionAccount?.balance ?? 0
  const isSuspended = commissionAccount?.is_suspended ?? false
  const balanceColor = getBalanceColor(balance, isSuspended)

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  }

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  }

  const backButtonStyle: React.CSSProperties = {
    padding: '8px',
    borderRadius: '8px',
    border: '1px solid #E5E7EB',
    backgroundColor: '#FFFFFF',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  }

  const titleStyle: React.CSSProperties = {
    fontSize: '24px',
    fontWeight: 700,
    color: '#111827',
  }

  const cardStyle: React.CSSProperties = {
    backgroundColor: '#FFFFFF',
    borderRadius: '12px',
    padding: '24px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    border: '1px solid #F3F4F6',
  }

  const tabContainerStyle: React.CSSProperties = {
    display: 'flex',
    gap: '8px',
    borderBottom: '1px solid #E5E7EB',
    marginBottom: '24px',
  }

  const tabButtonStyle = (active: boolean): React.CSSProperties => ({
    padding: '12px 20px',
    borderBottom: active ? '2px solid #8B5CF6' : '2px solid transparent',
    color: active ? '#8B5CF6' : '#6B7280',
    fontSize: '14px',
    fontWeight: active ? 600 : 500,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    backgroundColor: 'transparent',
    border: 'none',
  })

  const badgeStyle = (type: 'partner' | 'internal'): React.CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 12px',
    borderRadius: '8px',
    fontSize: '12px',
    fontWeight: 600,
    backgroundColor: type === 'partner' ? '#D1FAE5' : '#DBEAFE',
    color: type === 'partner' ? '#065F46' : '#1E40AF',
  })

  const handleRecharge = () => {
    const amount = parseFloat(rechargeAmount)
    if (amount < 10000) {
      alert('Le montant minimum est de 10 000 FCFA')
      return
    }
    rechargeMutation.mutate(amount)
  }

  return (
    <ScreenTransition>
      <div style={containerStyle}>
        {/* Header */}
        <div style={headerStyle}>
          <button style={backButtonStyle} onClick={() => router.back()}>
            <ArrowLeft size={20} color="#6B7280" />
          </button>
          <h1 style={titleStyle}>{driverName}</h1>
          {driver.driver_type && (
            <span style={badgeStyle(driver.driver_type)}>
              {driver.driver_type === 'partner' ? (
                <>
                  <Briefcase size={14} />
                  Partenaire
                </>
              ) : (
                <>
                  <User size={14} />
                  Interne
                </>
              )}
            </span>
          )}
        </div>

        {/* Informations générales */}
        <div style={cardStyle}>
          <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px' }}>
            Informations générales
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
            <div>
              <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '4px' }}>Email</div>
              <div style={{ fontSize: '14px', color: '#111827' }}>{driver.email || 'N/A'}</div>
            </div>
            <div>
              <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '4px' }}>Téléphone</div>
              <div style={{ fontSize: '14px', color: '#111827' }}>{driver.phone || 'N/A'}</div>
            </div>
            <div>
              <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '4px' }}>Statut</div>
              <div style={{ fontSize: '14px', color: driver.is_online ? '#10B981' : '#9CA3AF' }}>
                {driver.is_online ? 'En ligne' : 'Hors ligne'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '4px' }}>Livraisons</div>
              <div style={{ fontSize: '14px', color: '#111827' }}>
                {driver.completed_deliveries || 0} / {driver.total_deliveries || 0}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '4px' }}>Rating</div>
              <div style={{ fontSize: '14px', color: '#111827' }}>
                {driver.average_rating ? `${driver.average_rating.toFixed(1)} ⭐` : 'N/A'}
              </div>
            </div>
          </div>
        </div>

        {/* Onglets */}
        <div style={cardStyle}>
          <div style={tabContainerStyle}>
            <button style={tabButtonStyle(activeTab === 'overview')} onClick={() => setActiveTab('overview')}>
              <User size={16} />
              Vue d&apos;ensemble
            </button>
            {isPartner && (
              <button style={tabButtonStyle(activeTab === 'commission')} onClick={() => setActiveTab('commission')}>
                <Wallet size={16} />
                Commission
              </button>
            )}
            <button style={tabButtonStyle(activeTab === 'deliveries')} onClick={() => setActiveTab('deliveries')}>
              <Package size={16} />
              Livraisons
            </button>
            <button style={tabButtonStyle(activeTab === 'ratings')} onClick={() => setActiveTab('ratings')}>
              <Star size={16} />
              Évaluations
            </button>
          </div>

          {/* Contenu des onglets */}
          {activeTab === 'overview' && (
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>Statistiques</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                <div style={{ padding: '16px', backgroundColor: '#F9FAFB', borderRadius: '8px' }}>
                  <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '4px' }}>Livraisons totales</div>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: '#111827' }}>
                    {driver.completed_deliveries || 0}
                  </div>
                </div>
                <div style={{ padding: '16px', backgroundColor: '#F9FAFB', borderRadius: '8px' }}>
                  <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '4px' }}>Revenus totaux</div>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: '#111827' }}>
                    {formatCurrency(driver.total_revenue)}
                  </div>
                </div>
                <div style={{ padding: '16px', backgroundColor: '#F9FAFB', borderRadius: '8px' }}>
                  <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '4px' }}>Rating moyen</div>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: '#111827' }}>
                    {driver.average_rating ? `${driver.average_rating.toFixed(1)} ⭐` : 'N/A'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'commission' && isPartner && (
            <div>
              {/* Carte Solde */}
              <div style={{ marginBottom: '24px', padding: '20px', backgroundColor: '#F9FAFB', borderRadius: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <div>
                    <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '4px' }}>Solde Commission</div>
                    <div style={{ fontSize: '32px', fontWeight: 700, color: balanceColor }}>
                      {formatCurrency(balance)}
                    </div>
                    <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '4px' }}>
                      Taux: {commissionAccount?.commission_rate || 10}%
                    </div>
                  </div>
                  <div>
                    {isSuspended ? (
                      <span style={{ padding: '6px 12px', borderRadius: '6px', backgroundColor: '#FEE2E2', color: '#DC2626', fontSize: '12px', fontWeight: 600 }}>
                        Suspendu
                      </span>
                    ) : (
                      <span style={{ padding: '6px 12px', borderRadius: '6px', backgroundColor: '#D1FAE5', color: '#065F46', fontSize: '12px', fontWeight: 600 }}>
                        Actif
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setShowRechargeModal(true)}
                  style={{
                    padding: '10px 20px',
                    borderRadius: '8px',
                    backgroundColor: '#8B5CF6',
                    color: '#FFFFFF',
                    fontSize: '14px',
                    fontWeight: 600,
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  <CreditCard size={16} style={{ display: 'inline', marginRight: '8px' }} />
                  Recharger
                </button>
              </div>

              {/* Historique des transactions */}
              <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>Historique des transactions</h3>
              {transactions.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#6B7280' }}>
                  Aucune transaction
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #E5E7EB' }}>
                      <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#6B7280' }}>Date</th>
                      <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#6B7280' }}>Type</th>
                      <th style={{ padding: '12px', textAlign: 'right', fontSize: '12px', fontWeight: 600, color: '#6B7280' }}>Montant</th>
                      <th style={{ padding: '12px', textAlign: 'right', fontSize: '12px', fontWeight: 600, color: '#6B7280' }}>Solde après</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((tx) => (
                      <tr key={tx.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                        <td style={{ padding: '12px', fontSize: '14px', color: '#111827' }}>{formatDate(tx.created_at)}</td>
                        <td style={{ padding: '12px', fontSize: '14px', color: '#111827' }}>
                          {tx.type === 'recharge' ? 'Recharge' : tx.type === 'deduction' ? 'Prélèvement' : 'Remboursement'}
                        </td>
                        <td style={{ padding: '12px', fontSize: '14px', color: tx.type === 'recharge' ? '#10B981' : '#EF4444', textAlign: 'right', fontWeight: 600 }}>
                          {tx.type === 'recharge' ? '+' : '-'}{formatCurrency(tx.amount)}
                        </td>
                        <td style={{ padding: '12px', fontSize: '14px', color: '#111827', textAlign: 'right' }}>
                          {formatCurrency(tx.balance_after)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {activeTab === 'deliveries' && (
            <div>
              <div style={{ textAlign: 'center', padding: '40px', color: '#6B7280' }}>
                Historique des livraisons (à implémenter)
              </div>
            </div>
          )}

          {activeTab === 'ratings' && (
            <div>
              <div style={{ textAlign: 'center', padding: '40px', color: '#6B7280' }}>
                Historique des évaluations (à implémenter)
              </div>
            </div>
          )}
        </div>

        {/* Modal de recharge */}
        {showRechargeModal && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
            }}
            onClick={() => setShowRechargeModal(false)}
          >
            <div
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: '12px',
                padding: '24px',
                width: '90%',
                maxWidth: '400px',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px' }}>Recharger le compte</h3>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>
                  Montant (FCFA)
                </label>
                <input
                  type="number"
                  value={rechargeAmount}
                  onChange={(e) => setRechargeAmount(e.target.value)}
                  placeholder="10000"
                  min="10000"
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '8px',
                    border: '1px solid #E5E7EB',
                    fontSize: '14px',
                  }}
                />
                <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '4px' }}>
                  Minimum: 10 000 FCFA
                </div>
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>
                  Notes (optionnel)
                </label>
                <textarea
                  value={rechargeNotes}
                  onChange={(e) => setRechargeNotes(e.target.value)}
                  placeholder="Raison de la recharge..."
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '8px',
                    border: '1px solid #E5E7EB',
                    fontSize: '14px',
                    resize: 'vertical',
                  }}
                />
              </div>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setShowRechargeModal(false)}
                  style={{
                    padding: '10px 20px',
                    borderRadius: '8px',
                    border: '1px solid #E5E7EB',
                    backgroundColor: '#FFFFFF',
                    color: '#111827',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Annuler
                </button>
                <button
                  onClick={handleRecharge}
                  disabled={rechargeMutation.isPending || !rechargeAmount || parseFloat(rechargeAmount) < 10000}
                  style={{
                    padding: '10px 20px',
                    borderRadius: '8px',
                    backgroundColor: rechargeMutation.isPending || !rechargeAmount || parseFloat(rechargeAmount) < 10000 ? '#9CA3AF' : '#8B5CF6',
                    color: '#FFFFFF',
                    fontSize: '14px',
                    fontWeight: 600,
                    border: 'none',
                    cursor: rechargeMutation.isPending || !rechargeAmount || parseFloat(rechargeAmount) < 10000 ? 'not-allowed' : 'pointer',
                  }}
                >
                  {rechargeMutation.isPending ? 'Rechargement...' : 'Recharger'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ScreenTransition>
  )
}

