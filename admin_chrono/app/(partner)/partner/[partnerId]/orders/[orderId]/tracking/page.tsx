'use client'

import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  MapPin,
  Navigation,
  PackageCheck,
  Phone,
  Route,
  ShieldCheck,
  Truck,
  UserRound,
  Wallet,
} from 'lucide-react'
import PublicTrackMap from '@/components/track/PublicTrackMap'
import { partnerApiService, type PartnerOrderTracking } from '@/lib/partnerApiService'
import { PUBLIC_TRACK_FLOW_STEPS, publicTrackStatusTitle } from '@/lib/orderProductRules'
import { SkeletonLoader } from '@/components/animations'
import { themeColors } from '@/utils/theme'

const TERMINAL_STATUSES = new Set(['completed', 'cancelled', 'declined'])

const statusTone: Record<string, { bg: string; color: string }> = {
  pending: { bg: themeColors.yellowLight, color: themeColors.yellowPrimary },
  accepted: { bg: themeColors.blueLight, color: themeColors.bluePrimary },
  enroute: { bg: themeColors.blueLight, color: themeColors.bluePrimary },
  in_progress: { bg: themeColors.purpleLight, color: themeColors.purplePrimary },
  picked_up: { bg: themeColors.purpleLight, color: themeColors.purplePrimary },
  delivering: { bg: themeColors.purpleLight, color: themeColors.purplePrimary },
  completed: { bg: themeColors.greenLight, color: themeColors.greenPrimary },
  cancelled: { bg: themeColors.redLight, color: themeColors.redPrimary },
  declined: { bg: themeColors.yellowLight, color: themeColors.yellowPrimary },
}

function formatCurrency(value: number | null): string {
  if (value == null) return '-'
  return `${value.toLocaleString('fr-FR')} FCFA`
}

function formatDate(value?: string | null): string {
  if (!value) return '-'
  return new Date(value).toLocaleString('fr-FR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function vehicleLabel(value?: string | null): string {
  switch (value) {
    case 'vehicule':
      return 'Véhicule'
    case 'cargo':
      return 'Cargo'
    case 'moto':
      return 'Moto'
    default:
      return 'Livreur Krono'
  }
}

function proofLabel(method?: string | null): string {
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
      return 'En attente'
  }
}

function currentStepIndex(status: string): number {
  if (status === 'cancelled' || status === 'declined') return 0
  const idx = PUBLIC_TRACK_FLOW_STEPS.findIndex((step) => step.status === status)
  return idx >= 0 ? idx : 0
}

function Metric({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div style={{ border: `1px solid ${themeColors.cardBorder}`, borderRadius: 8, padding: 12, backgroundColor: themeColors.cardBg }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: themeColors.textSecondary, fontSize: 12 }}>
        {icon}
        <span>{label}</span>
      </div>
      <p style={{ marginTop: 6, color: themeColors.textPrimary, fontSize: 14, fontWeight: 700 }}>{value}</p>
    </div>
  )
}

function RoutePoint({ label, name, address, color }: { label: string; name?: string; address: string; color: string }) {
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
      <span style={{ width: 12, height: 12, marginTop: 4, borderRadius: 999, backgroundColor: color, flexShrink: 0 }} />
      <div style={{ minWidth: 0 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: themeColors.textSecondary, textTransform: 'uppercase' }}>{label}</p>
        <p style={{ marginTop: 3, fontSize: 14, fontWeight: 700, color: themeColors.textPrimary }}>{name || address || '-'}</p>
        <p style={{ marginTop: 2, fontSize: 13, color: themeColors.textSecondary, lineHeight: 1.45 }}>{address || '-'}</p>
      </div>
    </div>
  )
}

function TrackingContent({ order }: { order: PartnerOrderTracking }) {
  const tone = statusTone[order.status] ?? { bg: themeColors.grayLight, color: themeColors.textSecondary }
  const stepIndex = currentStepIndex(order.status)
  const progress = typeof order.progress === 'number' ? Math.round(Math.max(0, Math.min(1, order.progress)) * 100) : 0
  const isTerminal = TERMINAL_STATUSES.has(order.status)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 18,
          alignItems: 'stretch',
        }}
      >
        <div style={{ minHeight: 430, overflow: 'hidden', borderRadius: 12, border: `1px solid ${themeColors.cardBorder}`, backgroundColor: themeColors.cardBg }}>
          <PublicTrackMap
            pickup={{ address: order.pickup.address, coordinates: order.pickup.coordinates }}
            dropoff={{ address: order.dropoff.address, coordinates: order.dropoff.coordinates }}
            driver={
              order.driver
                ? {
                    latitude: order.driver.latitude,
                    longitude: order.driver.longitude,
                    heading: order.driver.heading ?? null,
                  }
                : null
            }
          />
        </div>

        <aside style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ border: `1px solid ${themeColors.cardBorder}`, borderRadius: 12, padding: 18, backgroundColor: themeColors.cardBg }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
              <div>
                <p style={{ color: themeColors.textSecondary, fontSize: 12, fontWeight: 700, textTransform: 'uppercase' }}>Commande</p>
                <h1 style={{ marginTop: 5, fontSize: 24, fontWeight: 800, color: themeColors.textPrimary }}>
                  #{order.id.slice(0, 8).toUpperCase()}
                </h1>
              </div>
              <span style={{ borderRadius: 999, padding: '7px 11px', backgroundColor: tone.bg, color: tone.color, fontSize: 12, fontWeight: 800 }}>
                {publicTrackStatusTitle(order.status)}
              </span>
            </div>

            <p style={{ marginTop: 14, color: themeColors.textPrimary, fontSize: 16, fontWeight: 750, lineHeight: 1.35 }}>
              {order.statusLabel || publicTrackStatusTitle(order.status)}
            </p>
            {order.etaLabel && (
              <p style={{ marginTop: 5, color: themeColors.textSecondary, fontSize: 13 }}>
                Estimation actuelle : <strong style={{ color: tone.color }}>{order.etaLabel}</strong>
              </p>
            )}
            {!isTerminal && (
              <div style={{ marginTop: 16 }}>
                <div style={{ height: 8, borderRadius: 999, backgroundColor: themeColors.grayLight, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${progress}%`, borderRadius: 999, backgroundColor: tone.color, transition: 'width 0.4s ease' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, color: themeColors.textSecondary, fontSize: 12 }}>
                  <span>Progression</span>
                  <span>{progress}%</span>
                </div>
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
            <Metric icon={<Route size={15} />} label="Distance" value={order.distance != null ? `${order.distance.toFixed(1)} km` : '-'} />
            <Metric icon={<Wallet size={15} />} label="Prix" value={formatCurrency(order.price)} />
            <Metric icon={<Truck size={15} />} label="Service" value={vehicleLabel(order.deliveryMethod)} />
            <Metric icon={<ShieldCheck size={15} />} label="Preuve" value={proofLabel(order.proof?.method)} />
          </div>

          <div style={{ border: `1px solid ${themeColors.cardBorder}`, borderRadius: 12, padding: 16, backgroundColor: themeColors.cardBg }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 42, height: 42, borderRadius: 8, backgroundColor: themeColors.purpleLight, display: 'flex', alignItems: 'center', justifyContent: 'center', color: themeColors.purplePrimary }}>
                <UserRound size={20} />
              </div>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: 12, color: themeColors.textSecondary }}>Livreur</p>
                <p style={{ marginTop: 2, fontSize: 14, fontWeight: 800, color: themeColors.textPrimary }}>
                  {order.driver?.name || (order.driver ? 'Livreur assigné' : 'En attente d’assignation')}
                </p>
                {order.driver?.vehiclePlate && (
                  <p style={{ marginTop: 1, fontSize: 12, color: themeColors.textSecondary }}>{order.driver.vehiclePlate}</p>
                )}
              </div>
            </div>
            {order.driver?.phone && (
              <a
                href={`tel:${order.driver.phone}`}
                style={{ marginTop: 14, display: 'inline-flex', alignItems: 'center', gap: 8, borderRadius: 8, padding: '9px 12px', backgroundColor: themeColors.background, border: `1px solid ${themeColors.cardBorder}`, color: themeColors.textPrimary, textDecoration: 'none', fontSize: 13, fontWeight: 700 }}
              >
                <Phone size={15} />
                Appeler
              </a>
            )}
          </div>
        </aside>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 18 }}>
        <div style={{ border: `1px solid ${themeColors.cardBorder}`, borderRadius: 12, padding: 18, backgroundColor: themeColors.cardBg }}>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: themeColors.textPrimary, marginBottom: 16 }}>Itinéraire</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <RoutePoint label="Collecte" name={order.pickup.name} address={order.pickup.address} color={themeColors.greenPrimary} />
            <div style={{ width: 2, height: 20, marginLeft: 5, backgroundColor: themeColors.cardBorder }} />
            <RoutePoint label="Destination" name={order.dropoff.name || order.recipient.name || undefined} address={order.dropoff.address} color={themeColors.purplePrimary} />
          </div>
          {order.recipient.name || order.recipient.phone ? (
            <div style={{ marginTop: 18, borderTop: `1px solid ${themeColors.cardBorder}`, paddingTop: 14 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: themeColors.textSecondary, textTransform: 'uppercase' }}>Destinataire</p>
              <p style={{ marginTop: 4, color: themeColors.textPrimary, fontWeight: 750 }}>{order.recipient.name || '-'}</p>
              <p style={{ marginTop: 2, color: themeColors.textSecondary, fontSize: 13 }}>{order.recipient.phone || '-'}</p>
            </div>
          ) : null}
        </div>

        <div style={{ border: `1px solid ${themeColors.cardBorder}`, borderRadius: 12, padding: 18, backgroundColor: themeColors.cardBg }}>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: themeColors.textPrimary, marginBottom: 16 }}>Progression</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {PUBLIC_TRACK_FLOW_STEPS.map((step, index) => {
              const done = order.status === 'completed' || index < stepIndex
              const active = index === stepIndex && !TERMINAL_STATUSES.has(order.status)
              const Icon = done ? CheckCircle2 : active ? Navigation : Clock3
              return (
                <div key={step.status} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <div
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: 8,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: done || active ? tone.bg : themeColors.grayLight,
                      color: done || active ? tone.color : themeColors.textSecondary,
                      flexShrink: 0,
                    }}
                  >
                    <Icon size={16} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 14, fontWeight: 800, color: active ? tone.color : themeColors.textPrimary }}>
                      {step.title}
                    </p>
                    <p style={{ marginTop: 2, fontSize: 13, color: themeColors.textSecondary, lineHeight: 1.45 }}>{step.body}</p>
                  </div>
                </div>
              )
            })}
          </div>
          <div style={{ marginTop: 18, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10, borderTop: `1px solid ${themeColors.cardBorder}`, paddingTop: 14 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: themeColors.textSecondary, fontSize: 12 }}>
                <PackageCheck size={15} />
                <span>Créée</span>
              </div>
              <p style={{ marginTop: 6, color: themeColors.textPrimary, fontSize: 14, fontWeight: 700 }}>{formatDate(order.createdAt)}</p>
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: themeColors.textSecondary, fontSize: 12 }}>
                <Clock3 size={15} />
                <span>Mise à jour</span>
              </div>
              <p style={{ marginTop: 6, color: themeColors.textPrimary, fontSize: 14, fontWeight: 700 }}>{formatDate(order.updatedAt)}</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

export default function PartnerOrderTrackingPage() {
  const { partnerId, orderId } = useParams<{ partnerId: string; orderId: string }>()
  const router = useRouter()

  const { data, isLoading, isError } = useQuery({
    queryKey: ['partner-order-tracking', partnerId, orderId],
    queryFn: () => partnerApiService.getOrderTracking(partnerId, orderId),
    refetchInterval: 5_000,
  })

  const order = data?.data

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => router.push(`/partner/${partnerId}/orders`)}
            aria-label="Retour aux commandes"
            style={{ width: 38, height: 38, borderRadius: 8, border: `1px solid ${themeColors.cardBorder}`, backgroundColor: themeColors.cardBg, color: themeColors.textPrimary, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: themeColors.textPrimary }}>Suivi de livraison</h1>
            <p style={{ marginTop: 3, fontSize: 13, color: themeColors.textSecondary }}>
              {order ? `${order.pickup.address || 'Collecte'} vers ${order.dropoff.address || 'destination'}` : 'Chargement de la commande'}
            </p>
          </div>
        </div>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, borderRadius: 999, padding: '8px 12px', backgroundColor: themeColors.greenLight, color: themeColors.greenPrimary, fontSize: 12, fontWeight: 800 }}>
          <MapPin size={14} />
          Portail partenaire
        </span>
      </div>

      {isLoading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 18 }}>
          <SkeletonLoader width="100%" height={430} borderRadius={12} />
          <SkeletonLoader width="100%" height={430} borderRadius={12} />
        </div>
      ) : isError || !data?.success || !order ? (
        <div style={{ border: `1px solid ${themeColors.cardBorder}`, borderRadius: 12, backgroundColor: themeColors.cardBg, padding: 28, color: themeColors.textPrimary }}>
          <h2 style={{ fontSize: 18, fontWeight: 800 }}>Commande introuvable</h2>
          <p style={{ marginTop: 8, fontSize: 14, color: themeColors.textSecondary }}>
            Cette commande n’est pas accessible depuis ce compte partenaire.
          </p>
        </div>
      ) : (
        <TrackingContent order={order} />
      )}
    </div>
  )
}
