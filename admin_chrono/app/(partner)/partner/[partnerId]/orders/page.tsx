'use client'

import React, { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useParams, useRouter } from 'next/navigation'
import { Plus, Search, Package } from 'lucide-react'
import { partnerApiService } from '@/lib/partnerApiService'
import { SkeletonLoader } from '@/components/animations'
import { themeColors } from '@/utils/theme'

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  pending:     { label: 'En attente',  color: themeColors.yellowPrimary, bg: themeColors.yellowLight },
  assigned:    { label: 'Assignée',    color: themeColors.bluePrimary,   bg: themeColors.blueLight },
  in_progress: { label: 'En cours',   color: themeColors.purplePrimary,  bg: themeColors.purpleLight },
  completed:   { label: 'Livrée',      color: themeColors.greenPrimary,  bg: themeColors.greenLight },
  cancelled:   { label: 'Annulée',     color: themeColors.redPrimary,    bg: themeColors.redLight },
}

export default function PartnerOrdersPage() {
  const { partnerId } = useParams<{ partnerId: string }>()
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const { data, isLoading } = useQuery({
    queryKey: ['partner-portal-orders', partnerId, statusFilter],
    queryFn: () => partnerApiService.getOrders(partnerId, {
      status: statusFilter === 'all' ? undefined : statusFilter,
    }),
    refetchInterval: 30_000,
  })

  const filtered = useMemo(() => {
    const orders = (data?.data ?? []) as Record<string, unknown>[]
    if (!search.trim()) return orders
    const q = search.toLowerCase()
    return orders.filter((o) =>
      (o.dropoff_address as string ?? '').toLowerCase().includes(q) ||
      (o.orderId as string ?? '').toLowerCase().includes(q)
    )
  }, [data, search])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: themeColors.textPrimary }}>Mes commandes</h1>
          <p style={{ fontSize: 13, color: themeColors.textSecondary, marginTop: 2 }}>{filtered.length} commande{filtered.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => router.push(`/partner/${partnerId}/orders/new`)}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 10, border: 'none', backgroundColor: themeColors.purplePrimary, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
        >
          <Plus size={16} /> Nouvelle commande
        </button>
      </div>

      {/* Filtres */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: themeColors.textSecondary }} />
          <input
            placeholder="Rechercher une adresse, un n° commande…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: '100%', paddingLeft: 34, paddingRight: 12, paddingTop: 9, paddingBottom: 9, borderRadius: 8, border: `1px solid ${themeColors.cardBorder}`, backgroundColor: themeColors.cardBg, color: themeColors.textPrimary, fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ padding: '9px 12px', borderRadius: 8, border: `1px solid ${themeColors.cardBorder}`, backgroundColor: themeColors.cardBg, color: themeColors.textPrimary, fontSize: 14, cursor: 'pointer', outline: 'none' }}
        >
          <option value="all">Tous les statuts</option>
          {Object.entries(STATUS_LABELS).map(([v, { label }]) => (
            <option key={v} value={v}>{label}</option>
          ))}
        </select>
      </div>

      {/* Liste */}
      <div style={{ backgroundColor: themeColors.cardBg, borderRadius: 12, border: `1px solid ${themeColors.cardBorder}`, overflow: 'hidden' }}>
        {isLoading ? (
          <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[1,2,3].map(i => <SkeletonLoader key={i} width="100%" height={64} borderRadius={8} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: themeColors.textSecondary }}>
            <Package size={32} style={{ opacity: 0.3, marginBottom: 12 }} />
            <p style={{ fontSize: 14 }}>Aucune commande</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${themeColors.cardBorder}` }}>
                {['N° commande', 'Destination', 'Statut', 'Prix', 'Date'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: themeColors.textSecondary }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((o) => {
                const st = STATUS_LABELS[o.status as string] ?? STATUS_LABELS['pending']
                return (
                  <tr key={o.id as string} style={{ borderBottom: `1px solid ${themeColors.cardBorder}` }}>
                    <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600, color: themeColors.textPrimary }}>
                      {(o.orderId as string)?.slice(0, 8) ?? '—'}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: themeColors.textPrimary, maxWidth: 220 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {o.dropoff_address as string ?? '—'}
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, backgroundColor: st.bg, color: st.color }}>
                        {st.label}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: themeColors.textPrimary }}>
                      {o.price_cfa ? `${(o.price_cfa as number).toLocaleString('fr-FR')} FCFA` : '—'}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: themeColors.textSecondary }}>
                      {new Date(o.created_at as string).toLocaleDateString('fr-FR')}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
