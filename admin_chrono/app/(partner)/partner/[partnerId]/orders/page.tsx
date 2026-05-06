'use client'

import React, { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useParams, useRouter } from 'next/navigation'
import { Plus, Search, Package, ShieldCheck, Navigation } from 'lucide-react'
import { partnerApiService } from '@/lib/partnerApiService'
import { SkeletonLoader } from '@/components/animations'
import { themeColors } from '@/utils/theme'

type PartnerOrderListItem = {
  id: string
  orderId?: string
  status?: string
  pickup_address?: string
  dropoff_address?: string
  price_cfa?: number | null
  created_at?: string
  delivery_proof_method?: string | null
}

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  pending:     { label: 'En attente',  color: themeColors.yellowPrimary, bg: themeColors.yellowLight },
  accepted:    { label: 'Acceptée',    color: themeColors.bluePrimary,   bg: themeColors.blueLight },
  enroute:     { label: 'Vers collecte', color: themeColors.bluePrimary, bg: themeColors.blueLight },
  assigned:    { label: 'Assignée',    color: themeColors.bluePrimary,   bg: themeColors.blueLight },
  in_progress: { label: 'En cours',   color: themeColors.purplePrimary,  bg: themeColors.purpleLight },
  picked_up:   { label: 'Récupérée',   color: themeColors.purplePrimary,  bg: themeColors.purpleLight },
  delivering:  { label: 'Livraison',   color: themeColors.purplePrimary,  bg: themeColors.purpleLight },
  completed:   { label: 'Livrée',      color: themeColors.greenPrimary,  bg: themeColors.greenLight },
  cancelled:   { label: 'Annulée',     color: themeColors.redPrimary,    bg: themeColors.redLight },
  declined:    { label: 'Refusée',     color: themeColors.yellowPrimary, bg: themeColors.yellowLight },
}

const TERMINAL_STATUSES = new Set(['completed', 'cancelled', 'canceled', 'declined', 'delivered'])

function isTrackableOrder(status?: string) {
  return Boolean(status && !TERMINAL_STATUSES.has(status))
}

const proofLabel = (method?: unknown) => {
  switch (method) {
    case 'qr_scan':
      return 'QR validé'
    case 'manual_code':
      return 'Code validé'
    case 'photo_signature':
      return 'Preuve alternative'
    case 'batch_driver_confirmation':
      return 'Confirmation livreur'
    case 'delivery':
      return 'QR classique'
    default:
      return 'À valider'
  }
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
    const orders = (data?.data ?? []) as PartnerOrderListItem[]
    if (!search.trim()) return orders
    const q = search.toLowerCase()
    return orders.filter((o) =>
      (o.dropoff_address ?? '').toLowerCase().includes(q) ||
      (o.orderId ?? '').toLowerCase().includes(q)
    )
  }, [data, search])

  const activeOrders = useMemo(
    () => filtered.filter((order) => isTrackableOrder(order.status)).slice(0, 3),
    [filtered]
  )

  const openTracking = (orderId: string) => {
    router.push(`/partner/${partnerId}/orders/${orderId}/tracking`)
  }

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

      {!isLoading && activeOrders.length > 0 && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <h2 style={{ fontSize: 15, fontWeight: 800, color: themeColors.textPrimary }}>Livraisons en cours</h2>
              <p style={{ marginTop: 2, fontSize: 12, color: themeColors.textSecondary }}>
                Reprendre le suivi d’une commande active.
              </p>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 10 }}>
            {activeOrders.map((order) => {
              const st = STATUS_LABELS[order.status ?? 'pending'] ?? STATUS_LABELS.pending
              return (
                <article
                  key={order.id}
                  style={{
                    border: `1px solid ${themeColors.cardBorder}`,
                    borderRadius: 8,
                    backgroundColor: themeColors.cardBg,
                    padding: 14,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <p style={{ fontSize: 13, fontWeight: 800, color: themeColors.textPrimary }}>
                        #{(order.orderId ?? order.id).slice(0, 8).toUpperCase()}
                      </p>
                      <span style={{ padding: '3px 9px', borderRadius: 999, fontSize: 11, fontWeight: 700, backgroundColor: st.bg, color: st.color }}>
                        {st.label}
                      </span>
                    </div>
                    <p style={{ marginTop: 6, fontSize: 12, color: themeColors.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {order.dropoff_address || 'Destination à confirmer'}
                    </p>
                  </div>
                  <button
                    onClick={() => openTracking(order.id)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 7,
                      flexShrink: 0,
                      padding: '9px 12px',
                      borderRadius: 8,
                      border: 'none',
                      backgroundColor: themeColors.purplePrimary,
                      color: '#fff',
                      fontSize: 13,
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    <Navigation size={15} />
                    Suivre
                  </button>
                </article>
              )
            })}
          </div>
        </section>
      )}

      {/* Liste */}
      <div style={{ backgroundColor: themeColors.cardBg, borderRadius: 12, border: `1px solid ${themeColors.cardBorder}`, overflowX: 'auto', overflowY: 'hidden' }}>
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
          <table style={{ width: '100%', minWidth: 920, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${themeColors.cardBorder}` }}>
                {['N° commande', 'Destination', 'Statut', 'Preuve', 'Prix', 'Date', 'Action'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: themeColors.textSecondary }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((o) => {
                const st = STATUS_LABELS[o.status ?? 'pending'] ?? STATUS_LABELS.pending
                const canTrack = isTrackableOrder(o.status)
                return (
                  <tr key={o.id} style={{ borderBottom: `1px solid ${themeColors.cardBorder}` }}>
                    <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600, color: themeColors.textPrimary }}>
                      {(o.orderId ?? o.id).slice(0, 8)}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: themeColors.textPrimary, maxWidth: 220 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {o.dropoff_address ?? '—'}
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, backgroundColor: st.bg, color: st.color }}>
                        {st.label}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                          padding: '3px 9px',
                          borderRadius: 20,
                          fontSize: 12,
                          fontWeight: 600,
                          backgroundColor: o.delivery_proof_method ? themeColors.greenLight : themeColors.yellowLight,
                          color: o.delivery_proof_method ? themeColors.greenPrimary : themeColors.yellowPrimary,
                        }}
                      >
                        <ShieldCheck size={13} />
                        {proofLabel(o.delivery_proof_method)}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: themeColors.textPrimary }}>
                      {o.price_cfa ? `${o.price_cfa.toLocaleString('fr-FR')} FCFA` : '—'}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: themeColors.textSecondary }}>
                      {o.created_at ? new Date(o.created_at).toLocaleDateString('fr-FR') : '—'}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {canTrack ? (
                        <button
                          onClick={() => openTracking(o.id)}
                          aria-label="Suivre la livraison"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 7,
                            minWidth: 112,
                            padding: '8px 11px',
                            borderRadius: 8,
                            border: `1px solid ${themeColors.purplePrimary}`,
                            backgroundColor: themeColors.purplePrimary,
                            color: '#fff',
                            cursor: 'pointer',
                            fontSize: 13,
                            fontWeight: 800,
                          }}
                        >
                          <Navigation size={15} />
                          Suivre
                        </button>
                      ) : (
                        <span style={{ fontSize: 12, color: themeColors.textSecondary }}>Terminé</span>
                      )}
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
