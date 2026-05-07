'use client'

import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useParams, useRouter } from 'next/navigation'
import { Package, TrendingUp, AlertTriangle, CheckCircle, Navigation } from 'lucide-react'
import { partnerApiService } from '@/lib/partnerApiService'
import { SkeletonLoader } from '@/components/animations'
import { themeColors } from '@/utils/theme'

const ORDER_STATUS_BADGES: Record<string, { bg: string; color: string }> = {
  pending: { bg: themeColors.yellowLight, color: themeColors.yellowPrimary },
  accepted: { bg: themeColors.blueLight, color: themeColors.bluePrimary },
  assigned: { bg: themeColors.blueLight, color: themeColors.bluePrimary },
  enroute: { bg: themeColors.blueLight, color: themeColors.bluePrimary },
  in_progress: { bg: themeColors.purpleLight, color: themeColors.purplePrimary },
  picked_up: { bg: themeColors.purpleLight, color: themeColors.purplePrimary },
  delivering: { bg: themeColors.purpleLight, color: themeColors.purplePrimary },
  completed: { bg: themeColors.greenLight, color: themeColors.greenPrimary },
  delivered: { bg: themeColors.greenLight, color: themeColors.greenPrimary },
  cancelled: { bg: themeColors.redLight, color: themeColors.redPrimary },
  canceled: { bg: themeColors.redLight, color: themeColors.redPrimary },
  declined: { bg: themeColors.yellowLight, color: themeColors.yellowPrimary },
}

export default function PartnerDashboardPage() {
  const { partnerId } = useParams<{ partnerId: string }>()
  const router = useRouter()

  const { data: usageData, isLoading: usageLoading } = useQuery({
    queryKey: ['partner-portal-usage', partnerId],
    queryFn: () => partnerApiService.getUsage(partnerId),
    refetchInterval: 60_000,
  })

  const { data: ordersData, isLoading: ordersLoading } = useQuery({
    queryKey: ['partner-portal-orders-today', partnerId],
    queryFn: () => partnerApiService.getOrders(partnerId, { page: 1 }),
    refetchInterval: 30_000,
  })

  const usage = usageData?.data
  const orders = (ordersData?.data ?? []) as Record<string, unknown>[]
  const todayOrders = orders.filter((o) => {
    const d = new Date(o.created_at as string)
    const now = new Date()
    return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  })

  const quota = usage?.quota ?? null
  const count = usage?.deliveries_count ?? 0
  const pct = quota ? Math.min(100, Math.round((count / quota) * 100)) : null

  const kpis = [
    { label: 'Commandes aujourd\'hui', value: todayOrders.length, Icon: Package, color: themeColors.purplePrimary },
    { label: 'Courses ce mois', value: count, Icon: TrendingUp, color: themeColors.bluePrimary },
    { label: 'Quota restant', value: usage?.remaining !== null ? String(usage?.remaining ?? '—') : '∞', Icon: CheckCircle, color: themeColors.greenPrimary },
    { label: 'Plan actuel', value: usage?.plan ? usage.plan.charAt(0).toUpperCase() + usage.plan.slice(1) : 'Aucun', Icon: AlertTriangle, color: themeColors.yellowPrimary },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: themeColors.textPrimary }}>Tableau de bord</h1>
        <p style={{ fontSize: 13, color: themeColors.textSecondary, marginTop: 4 }}>
          {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        {usageLoading || ordersLoading
          ? [1,2,3,4].map(i => <SkeletonLoader key={i} width="100%" height={90} borderRadius={12} />)
          : kpis.map(({ label, value, Icon, color }) => (
            <div key={label} style={{ backgroundColor: themeColors.cardBg, border: `1px solid ${themeColors.cardBorder}`, borderRadius: 12, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: `${color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon size={18} color={color} />
              </div>
              <div>
                <p style={{ fontSize: 12, color: themeColors.textSecondary }}>{label}</p>
                <p style={{ fontSize: 20, fontWeight: 700, color: themeColors.textPrimary }}>{value}</p>
              </div>
            </div>
          ))
        }
      </div>

      {/* Quota bar */}
      {pct !== null && (
        <div style={{ backgroundColor: themeColors.cardBg, border: `1px solid ${themeColors.cardBorder}`, borderRadius: 12, padding: '16px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: themeColors.textPrimary }}>Utilisation du quota mensuel</span>
            <span style={{ fontSize: 13, color: themeColors.textSecondary }}>{count} / {quota} courses</span>
          </div>
          <div style={{ height: 10, borderRadius: 5, backgroundColor: themeColors.grayLight, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, borderRadius: 5, backgroundColor: pct >= 90 ? themeColors.redPrimary : pct >= 70 ? themeColors.yellowPrimary : themeColors.greenPrimary, transition: 'width 0.4s' }} />
          </div>
          {usage?.over_quota && (
            <p style={{ fontSize: 12, color: themeColors.redPrimary, marginTop: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
              <AlertTriangle size={12} /> Quota dépassé — les courses supplémentaires sont facturées au taux excédent
            </p>
          )}
        </div>
      )}

      {/* Commandes du jour */}
      <div style={{ backgroundColor: themeColors.cardBg, border: `1px solid ${themeColors.cardBorder}`, borderRadius: 12, padding: '16px 20px' }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: themeColors.textPrimary, marginBottom: 14 }}>Commandes du jour</h2>
        {ordersLoading ? (
          <SkeletonLoader width="100%" height={60} borderRadius={8} />
        ) : todayOrders.length === 0 ? (
          <p style={{ fontSize: 13, color: themeColors.textSecondary }}>{"Aucune commande aujourd'hui."}</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {todayOrders.slice(0, 8).map((o) => {
              const status = String(o.status ?? '')
              const badge = ORDER_STATUS_BADGES[status] ?? { bg: themeColors.purpleLight, color: themeColors.purplePrimary }

              return (
                <div key={o.id as string} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: 8, backgroundColor: themeColors.background, border: `1px solid ${themeColors.cardBorder}` }}>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: themeColors.textPrimary }}>{o.dropoff_address as string ?? '—'}</p>
                    <p style={{ fontSize: 12, color: themeColors.textSecondary }}>{o.orderId as string ?? o.id as string}</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 20, backgroundColor: badge.bg, color: badge.color }}>
                      {status}
                    </span>
                    <button
                      onClick={() => router.push(`/partner/${partnerId}/orders/${o.id as string}/tracking`)}
                      aria-label="Suivre la livraison"
                      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 8, border: `1px solid ${themeColors.cardBorder}`, backgroundColor: themeColors.cardBg, color: themeColors.purplePrimary, cursor: 'pointer' }}
                    >
                      <Navigation size={15} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
