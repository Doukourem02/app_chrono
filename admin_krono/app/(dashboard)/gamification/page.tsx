'use client'

import React, { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  AlertTriangle,
  BarChart3,
  CheckCircle,
  Clock,
  DollarSign,
  MapPin,
  Package,
  Route,
  TrendingUp,
  Users,
} from 'lucide-react'
import { createClient } from '@supabase/supabase-js'
import { themeColors } from '@/utils/theme'
import { useTranslation } from '@/hooks/useTranslation'

const supabase = typeof window !== 'undefined'
  ? createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
    )
  : null

type Period = 'week' | 'month' | 'all'
type SortMode = 'traffic' | 'deliveries' | 'revenue' | 'risk'

interface ZoneCount {
  zone: string
  count: number
}

interface ZoneRoute {
  fromZone: string
  toZone: string
  count: number
}

interface PeakHour {
  hour: number
  count: number
}

interface ZoneDriver {
  driverId: string
  driverName: string
  completedOrders: number
  revenue: number
}

interface ActiveOrderPreview {
  id: string
  status: string
  createdAt: string | null
  driverName: string
  destinationZone: string
}

interface ZonePerformance {
  zone: string
  completed: number
  completedOrders: number
  revenue: number | string
  totalOrders: number
  activeOrders: number
  pendingOrders: number
  cancelledOrders: number
  successRate: number
  avgDeliveryMinutes: number
  activeDrivers: number
  availableDrivers: number
  trafficIndex: number
  topDestinations?: ZoneCount[]
  topRoutes?: ZoneRoute[]
  peakHours?: PeakHour[]
  topDrivers?: ZoneDriver[]
  activeOrdersList?: ActiveOrderPreview[]
}

interface PerformanceResponse {
  byZone?: ZonePerformance[]
  topPickupDropoffRoutes?: ZoneRoute[]
}

const SORT_OPTIONS: Array<{ value: SortMode; label: string }> = [
  { value: 'traffic', label: 'Plus de trafic' },
  { value: 'deliveries', label: 'Plus de livraisons' },
  { value: 'revenue', label: 'Plus de revenus' },
  { value: 'risk', label: 'Problèmes terrain' },
]

const ACTIVE_STATUS_LABELS: Record<string, string> = {
  accepted: 'Acceptée',
  enroute: 'Vers collecte',
  picked_up: 'Collectée',
  delivering: 'En livraison',
  in_progress: 'En cours',
}

function numberValue(value: number | string | undefined): number {
  const parsed = Number(value || 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function formatMoney(value: number | string | undefined): string {
  return `${numberValue(value).toLocaleString('fr-FR')} FCFA`
}

function riskScore(zone: ZonePerformance): number {
  return zone.pendingOrders * 3 + zone.cancelledOrders * 2 + zone.activeOrders - zone.availableDrivers
}

function shortageScore(zone: ZonePerformance): number {
  return Math.max(0, zone.pendingOrders + zone.activeOrders - zone.availableDrivers)
}

function formatHour(hour: number): string {
  return `${String(hour).padStart(2, '0')}h`
}

function StatCard({
  icon,
  label,
  title,
  value,
  accent,
}: {
  icon: React.ReactNode
  label: string
  title: string
  value: string
  accent: string
}) {
  return (
    <div style={{ padding: '18px', backgroundColor: themeColors.cardBg, borderRadius: '8px', border: `1px solid ${themeColors.cardBorder}`, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', color: accent }}>
        {icon}
        <span style={{ fontSize: '12px', color: themeColors.textSecondary, fontWeight: 600 }}>{label}</span>
      </div>
      <div style={{ fontSize: '20px', color: themeColors.textPrimary, fontWeight: 800, marginBottom: '4px' }}>{title}</div>
      <div style={{ fontSize: '13px', color: themeColors.textTertiary }}>{value}</div>
    </div>
  )
}

export default function GamificationPage() {
  const t = useTranslation()
  const [period, setPeriod] = useState<Period>('week')
  const [zoneFilter, setZoneFilter] = useState('')
  const [sortMode, setSortMode] = useState<SortMode>('traffic')
  const [selectedZoneName, setSelectedZoneName] = useState<string>('')

  const days = period === 'week' ? 7 : period === 'month' ? 30 : 90
  const periodLabel =
    period === 'week'
      ? t('performance.period.thisWeek')
      : period === 'month'
        ? t('performance.period.thisMonth')
        : '90 derniers jours'

  const { data, isLoading, error } = useQuery({
    queryKey: ['performance-terrain', days],
    queryFn: async () => {
      if (!supabase) throw new Error('Supabase non configuré')
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) throw new Error('Non authentifié')

      const response = await fetch(`/api/analytics/performance?days=${days}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!response.ok) throw new Error('Erreur chargement performance terrain')
      return response.json() as Promise<PerformanceResponse>
    },
    refetchInterval: 30000,
  })

  const zones = useMemo(() => data?.byZone || [], [data?.byZone])
  const filteredZones = useMemo(() => {
    const query = zoneFilter.trim().toLowerCase()
    const visibleZones = query
      ? zones.filter((zone) => zone.zone.toLowerCase().includes(query))
      : zones

    return [...visibleZones].sort((a, b) => {
      if (sortMode === 'deliveries') return b.completedOrders - a.completedOrders
      if (sortMode === 'revenue') return numberValue(b.revenue) - numberValue(a.revenue)
      if (sortMode === 'risk') return riskScore(b) - riskScore(a)
      return b.trafficIndex - a.trafficIndex
    })
  }, [sortMode, zoneFilter, zones])

  const globalRoutes = data?.topPickupDropoffRoutes || []
  const hotZone = useMemo(() => [...zones].sort((a, b) => b.trafficIndex - a.trafficIndex)[0], [zones])
  const revenueZone = useMemo(() => [...zones].sort((a, b) => numberValue(b.revenue) - numberValue(a.revenue))[0], [zones])
  const riskyZone = useMemo(() => [...zones].sort((a, b) => riskScore(b) - riskScore(a))[0], [zones])
  const shortageZone = useMemo(() => [...zones].sort((a, b) => shortageScore(b) - shortageScore(a))[0], [zones])
  const selectedZone = filteredZones.find((zone) => zone.zone === selectedZoneName) || filteredZones[0] || zones[0]

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: themeColors.textPrimary, marginBottom: '6px' }}>
          {t('performance.title')}
        </h1>
        <p style={{ color: themeColors.textSecondary, fontSize: '14px', margin: 0 }}>
          {t('performance.description')}
        </p>
      </div>

      <div style={{ marginBottom: '24px', display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
        <select
          value={period}
          onChange={(event) => setPeriod(event.target.value as Period)}
          style={{ padding: '9px 12px', borderRadius: '6px', border: `1px solid ${themeColors.cardBorder}`, backgroundColor: themeColors.cardBg, color: themeColors.textPrimary }}
        >
          <option value="week">{t('performance.period.thisWeek')}</option>
          <option value="month">{t('performance.period.thisMonth')}</option>
          <option value="all">90 derniers jours</option>
        </select>

        <select
          value={sortMode}
          onChange={(event) => setSortMode(event.target.value as SortMode)}
          style={{ padding: '9px 12px', borderRadius: '6px', border: `1px solid ${themeColors.cardBorder}`, backgroundColor: themeColors.cardBg, color: themeColors.textPrimary }}
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>

        <input
          type="text"
          placeholder={t('performance.zonePlaceholder')}
          value={zoneFilter}
          onChange={(event) => setZoneFilter(event.target.value)}
          style={{ padding: '9px 12px', borderRadius: '6px', border: `1px solid ${themeColors.cardBorder}`, minWidth: '240px', backgroundColor: themeColors.cardBg, color: themeColors.textPrimary }}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <StatCard
          icon={<TrendingUp style={{ width: '18px', height: '18px' }} />}
          label="Commune chaude"
          title={hotZone?.zone || 'N/A'}
          value={hotZone ? `Indice trafic ${hotZone.trafficIndex} · ${hotZone.totalOrders} commandes` : periodLabel}
          accent="#2563EB"
        />
        <StatCard
          icon={<DollarSign style={{ width: '18px', height: '18px' }} />}
          label="Meilleur revenu"
          title={revenueZone?.zone || 'N/A'}
          value={revenueZone ? formatMoney(revenueZone.revenue) : periodLabel}
          accent="#D97706"
        />
        <StatCard
          icon={<AlertTriangle style={{ width: '18px', height: '18px' }} />}
          label="Commune à risque"
          title={riskyZone?.zone || 'N/A'}
          value={riskyZone ? `${riskyZone.pendingOrders} attente · ${riskyZone.cancelledOrders} annulées/refusées` : periodLabel}
          accent="#DC2626"
        />
        <StatCard
          icon={<Users style={{ width: '18px', height: '18px' }} />}
          label="Manque de livreurs"
          title={shortageZone?.zone || 'N/A'}
          value={shortageZone ? `${shortageScore(shortageZone)} course(s) sans marge · ${shortageZone.availableDrivers} libre(s)` : periodLabel}
          accent="#059669"
        />
      </div>

      <div style={{ backgroundColor: themeColors.cardBg, borderRadius: '8px', border: `1px solid ${themeColors.cardBorder}`, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', marginBottom: '24px' }}>
        <div style={{ padding: '18px 20px', borderBottom: `1px solid ${themeColors.cardBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 800, color: themeColors.textPrimary, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BarChart3 style={{ width: '18px', height: '18px', color: themeColors.purplePrimary }} />
            {t('performance.communeActivity')}
          </h2>
          <span style={{ fontSize: '12px', color: themeColors.textTertiary }}>
            {t('performance.activeOrdersHelp')}
          </span>
        </div>

        {isLoading ? (
          <div style={{ padding: '42px', textAlign: 'center', color: themeColors.textSecondary }}>{t('common.loading')}</div>
        ) : error ? (
          <div style={{ padding: '42px', textAlign: 'center', color: '#B91C1C' }}>Impossible de charger la performance terrain.</div>
        ) : filteredZones.length === 0 ? (
          <div style={{ padding: '42px', textAlign: 'center', color: themeColors.textSecondary }}>
            <p style={{ margin: 0, fontWeight: 700, color: themeColors.textPrimary }}>Aucune commune trouvée</p>
            <p style={{ margin: '8px 0 0', color: themeColors.textTertiary }}>Aucune commande exploitable sur cette période.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '980px' }}>
              <thead>
                <tr style={{ backgroundColor: themeColors.grayLight, borderBottom: `1px solid ${themeColors.cardBorder}` }}>
                  <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', color: themeColors.textSecondary }}>Commune</th>
                  <th style={{ padding: '12px', textAlign: 'right', fontSize: '12px', color: themeColors.textSecondary }}>Trafic</th>
                  <th style={{ padding: '12px', textAlign: 'right', fontSize: '12px', color: themeColors.textSecondary }}>Total</th>
                  <th style={{ padding: '12px', textAlign: 'right', fontSize: '12px', color: themeColors.textSecondary }}>Actives</th>
                  <th style={{ padding: '12px', textAlign: 'right', fontSize: '12px', color: themeColors.textSecondary }}>Attente</th>
                  <th style={{ padding: '12px', textAlign: 'right', fontSize: '12px', color: themeColors.textSecondary }}>Complétées</th>
                  <th style={{ padding: '12px', textAlign: 'right', fontSize: '12px', color: themeColors.textSecondary }}>Réussite</th>
                  <th style={{ padding: '12px', textAlign: 'right', fontSize: '12px', color: themeColors.textSecondary }}>Revenus</th>
                  <th style={{ padding: '12px', textAlign: 'right', fontSize: '12px', color: themeColors.textSecondary }}>Livreurs libres</th>
                  <th style={{ padding: '12px', textAlign: 'right', fontSize: '12px', color: themeColors.textSecondary }}>Temps moy.</th>
                </tr>
              </thead>
              <tbody>
                {filteredZones.map((zone) => {
                  const isSelected = selectedZone?.zone === zone.zone
                  return (
                    <tr key={zone.zone} style={{ borderBottom: `1px solid ${themeColors.cardBorder}`, backgroundColor: isSelected ? `${themeColors.purplePrimary}10` : 'transparent' }}>
                      <td style={{ padding: '12px' }}>
                        <button
                          type="button"
                          onClick={() => setSelectedZoneName(zone.zone)}
                          style={{ border: 'none', background: 'transparent', color: isSelected ? themeColors.purplePrimary : themeColors.textPrimary, fontWeight: 800, cursor: 'pointer', padding: 0, fontSize: '14px' }}
                        >
                          {zone.zone}
                        </button>
                      </td>
                      <td style={{ padding: '12px', textAlign: 'right', fontWeight: 800, color: themeColors.textPrimary }}>{zone.trafficIndex}</td>
                      <td style={{ padding: '12px', textAlign: 'right', color: themeColors.textPrimary }}>{zone.totalOrders}</td>
                      <td style={{ padding: '12px', textAlign: 'right', color: zone.activeOrders > 0 ? '#2563EB' : themeColors.textPrimary, fontWeight: zone.activeOrders > 0 ? 700 : 500 }}>{zone.activeOrders}</td>
                      <td style={{ padding: '12px', textAlign: 'right', color: zone.pendingOrders > 0 ? '#B45309' : themeColors.textPrimary, fontWeight: zone.pendingOrders > 0 ? 700 : 500 }}>{zone.pendingOrders}</td>
                      <td style={{ padding: '12px', textAlign: 'right', color: themeColors.textPrimary }}>{zone.completedOrders}</td>
                      <td style={{ padding: '12px', textAlign: 'right', color: zone.successRate >= 80 ? '#047857' : zone.successRate >= 55 ? '#B45309' : '#B91C1C', fontWeight: 700 }}>{zone.successRate}%</td>
                      <td style={{ padding: '12px', textAlign: 'right', color: themeColors.textPrimary }}>{formatMoney(zone.revenue)}</td>
                      <td style={{ padding: '12px', textAlign: 'right', color: shortageScore(zone) > 0 ? '#B91C1C' : themeColors.textPrimary, fontWeight: shortageScore(zone) > 0 ? 700 : 500 }}>{zone.availableDrivers}</td>
                      <td style={{ padding: '12px', textAlign: 'right', color: themeColors.textPrimary }}>{zone.avgDeliveryMinutes ? `${zone.avgDeliveryMinutes} min` : 'N/A'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {globalRoutes.length > 0 && (
        <div style={{ backgroundColor: themeColors.cardBg, borderRadius: '8px', border: `1px solid ${themeColors.cardBorder}`, padding: '16px 18px', marginBottom: '24px' }}>
          <h2 style={{ margin: '0 0 12px', fontSize: '15px', color: themeColors.textPrimary, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Route style={{ width: '17px', height: '17px', color: themeColors.purplePrimary }} />
            Flux principaux Krono
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
            {globalRoutes.slice(0, 5).map((route) => (
              <div key={`${route.fromZone}-${route.toZone}`} style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', padding: '10px 12px', backgroundColor: themeColors.grayLight, borderRadius: '6px' }}>
                <span style={{ color: themeColors.textPrimary, fontWeight: 700 }}>{route.fromZone} → {route.toZone}</span>
                <span style={{ color: themeColors.textSecondary, whiteSpace: 'nowrap' }}>{route.count} course(s)</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedZone && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '18px', alignItems: 'start' }}>
          <div style={{ backgroundColor: themeColors.cardBg, borderRadius: '8px', border: `1px solid ${themeColors.cardBorder}`, padding: '20px' }}>
            <h2 style={{ margin: '0 0 16px', fontSize: '17px', color: themeColors.textPrimary, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <MapPin style={{ width: '18px', height: '18px', color: themeColors.purplePrimary }} />
              {selectedZone.zone}
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '20px' }}>
              <div><PackageMetric icon={<Package />} label="Commandes" value={String(selectedZone.totalOrders)} /></div>
              <div><PackageMetric icon={<CheckCircle />} label="Complétées" value={String(selectedZone.completedOrders)} /></div>
              <div><PackageMetric icon={<DollarSign />} label="Revenus" value={formatMoney(selectedZone.revenue)} /></div>
              <div><PackageMetric icon={<Clock />} label="Temps moyen" value={selectedZone.avgDeliveryMinutes ? `${selectedZone.avgDeliveryMinutes} min` : 'N/A'} /></div>
            </div>

            <h3 style={{ fontSize: '14px', color: themeColors.textPrimary, margin: '0 0 10px' }}>Trajets pickup → dropoff</h3>
            <div style={{ display: 'grid', gap: '8px', marginBottom: '20px' }}>
              {(selectedZone.topRoutes || []).length > 0 ? selectedZone.topRoutes?.map((route) => (
                <div key={`${route.fromZone}-${route.toZone}`} style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', padding: '10px 12px', backgroundColor: themeColors.grayLight, borderRadius: '6px' }}>
                  <span style={{ color: themeColors.textPrimary, fontWeight: 700 }}>{route.fromZone} → {route.toZone}</span>
                  <span style={{ color: themeColors.textSecondary }}>{route.count} course(s)</span>
                </div>
              )) : <span style={{ color: themeColors.textTertiary, fontSize: '13px' }}>Aucun trajet exploitable.</span>}
            </div>

            <h3 style={{ fontSize: '14px', color: themeColors.textPrimary, margin: '0 0 10px' }}>Commandes actives</h3>
            <div style={{ display: 'grid', gap: '8px' }}>
              {(selectedZone.activeOrdersList || []).length > 0 ? selectedZone.activeOrdersList?.map((order) => (
                <div key={order.id} style={{ display: 'grid', gridTemplateColumns: '90px 1fr 1fr', gap: '10px', alignItems: 'center', padding: '10px 12px', border: `1px solid ${themeColors.cardBorder}`, borderRadius: '6px' }}>
                  <span style={{ fontWeight: 800, color: themeColors.textPrimary }}>#{order.id}</span>
                  <span style={{ color: themeColors.textSecondary }}>{ACTIVE_STATUS_LABELS[order.status] || order.status}</span>
                  <span style={{ color: themeColors.textSecondary, textAlign: 'right' }}>{order.destinationZone}</span>
                </div>
              )) : <span style={{ color: themeColors.textTertiary, fontSize: '13px' }}>Aucune commande active dans cette commune.</span>}
            </div>
          </div>

          <div style={{ display: 'grid', gap: '18px' }}>
            <SidePanel title="Pics horaires" icon={<Clock style={{ width: '16px', height: '16px' }} />}>
              {(selectedZone.peakHours || []).length > 0 ? selectedZone.peakHours?.map((hour) => (
                <MetricRow key={hour.hour} label={formatHour(hour.hour)} value={`${hour.count} commande(s)`} />
              )) : <EmptySmall />}
            </SidePanel>

            <SidePanel title="Top livreurs" icon={<Users style={{ width: '16px', height: '16px' }} />}>
              {(selectedZone.topDrivers || []).length > 0 ? selectedZone.topDrivers?.map((driver) => (
                <MetricRow key={driver.driverId} label={driver.driverName} value={`${driver.completedOrders} liv.`} />
              )) : <EmptySmall />}
            </SidePanel>

            <SidePanel title="Destinations fréquentes" icon={<Route style={{ width: '16px', height: '16px' }} />}>
              {(selectedZone.topDestinations || []).length > 0 ? selectedZone.topDestinations?.map((destination) => (
                <MetricRow key={destination.zone} label={destination.zone} value={`${destination.count} course(s)`} />
              )) : <EmptySmall />}
            </SidePanel>
          </div>
        </div>
      )}
    </div>
  )
}

function PackageMetric({ icon, label, value }: { icon: React.ReactElement<{ style?: React.CSSProperties }>; label: string; value: string }) {
  return (
    <div style={{ border: `1px solid ${themeColors.cardBorder}`, borderRadius: '8px', padding: '12px', minHeight: '82px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: themeColors.textSecondary, fontSize: '12px', marginBottom: '8px' }}>
        {React.cloneElement(icon, { style: { width: '15px', height: '15px', color: themeColors.purplePrimary } })}
        {label}
      </div>
      <div style={{ color: themeColors.textPrimary, fontWeight: 800, fontSize: '18px' }}>{value}</div>
    </div>
  )
}

function SidePanel({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ backgroundColor: themeColors.cardBg, borderRadius: '8px', border: `1px solid ${themeColors.cardBorder}`, padding: '16px' }}>
      <h3 style={{ margin: '0 0 12px', fontSize: '14px', color: themeColors.textPrimary, display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ color: themeColors.purplePrimary }}>{icon}</span>
        {title}
      </h3>
      <div style={{ display: 'grid', gap: '8px' }}>{children}</div>
    </div>
  )
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', fontSize: '13px' }}>
      <span style={{ color: themeColors.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
      <span style={{ color: themeColors.textPrimary, fontWeight: 700, whiteSpace: 'nowrap' }}>{value}</span>
    </div>
  )
}

function EmptySmall() {
  return <span style={{ color: themeColors.textTertiary, fontSize: '13px' }}>Aucune donnée</span>
}
