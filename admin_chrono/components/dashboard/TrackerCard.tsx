'use client'

import { Phone, MessageSquare, MapPin, Navigation } from 'lucide-react'
import React, { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { adminApiService } from '@/lib/adminApiService'
import MapboxMiniMap from '@/components/dashboard/MapboxMiniMap'
import { AnimatedCard } from '@/components/animations'
import type { Delivery } from '@/hooks/types'
import { formatDeliveryId } from '@/utils/formatDeliveryId'
import { logger } from '@/utils/logger'
import { themeColors } from '@/utils/theme'

const statusSteps: Array<{ key: string; label: string }> = [
  { key: 'pending', label: 'Commande créée' },
  { key: 'accepted', label: 'Livreur assigné' },
  { key: 'enroute', label: 'Livreur en route pour récupérer le colis' },
  { key: 'picked_up', label: 'Colis pris en charge' },
  { key: 'delivering', label: 'En cours de livraison' },
  { key: 'completed', label: 'Colis livré' },
]

interface TrackerCardProps {
  deliveries?: Delivery[]
  isLoading?: boolean
}

export default function TrackerCard({ deliveries: providedDeliveries, isLoading: providedLoading }: TrackerCardProps = {}) {
  const useProvidedDeliveries = Array.isArray(providedDeliveries)

  // Récupérer les livraisons en cours (même source que la page Tracking)
  const { data: deliveriesResponse, isLoading: queryLoading } = useQuery({
    queryKey: ['ongoing-delivery-card'],
    queryFn: async () => {
      logger.warn('🚀🚀🚀 [TrackerCard] queryFn CALLED - getOngoingDeliveries', {
        timestamp: new Date().toISOString(),
        stack: new Error().stack?.split('\n').slice(2, 15).join('\n'),
      })
      const result = await adminApiService.getOngoingDeliveries()
      logger.debug('✅ [TrackerCard] getOngoingDeliveries SUCCESS', {
        hasData: !!result.data && (result.data as Delivery[]).length > 0,
        timestamp: new Date().toISOString(),
      })
      return result
    },
    refetchInterval: false,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchIntervalInBackground: false,
    retry: false,
    enabled: !useProvidedDeliveries,
  })

  const deliveries: Delivery[] = useMemo(() => {
    if (useProvidedDeliveries) {
      return providedDeliveries || []
    }
    const data = deliveriesResponse?.data as Delivery[] | undefined
    return Array.isArray(data) ? data : []
  }, [useProvidedDeliveries, providedDeliveries, deliveriesResponse])

  const isLoading = useProvidedDeliveries ? !!providedLoading : queryLoading

  const activeDelivery = useMemo(() => {
    if (deliveries.length === 0) return null
    return deliveries.reduce((latest, current) => {
      if (!latest) return current
      if (!latest.createdAt) return current
      if (!current.createdAt) return latest
      return new Date(current.createdAt).getTime() > new Date(latest.createdAt).getTime() ? current : latest
    }, deliveries[0])
  }, [deliveries])

  const trackerId = activeDelivery?.id
  const pickupAddress = activeDelivery?.pickup?.address || 'Adresse pickup inconnue'
  const dropoffAddress = activeDelivery?.dropoff?.address || 'Adresse destination inconnue'
  const driver = activeDelivery?.driver

  const statusStyles: Record<
    string,
    { label: string; backgroundColor: string; color: string }
  > = {
    pending: { label: 'En attente', backgroundColor: '#FEF3C7', color: '#D97706' },
    accepted: { label: 'Livreur assigné', backgroundColor: '#E0E7FF', color: '#4338CA' },
    enroute: { label: 'En route pour récupérer', backgroundColor: '#DBEAFE', color: '#1D4ED8' },
    picked_up: { label: 'Colis pris en charge', backgroundColor: '#E0F2FE', color: '#0369A1' },
    delivering: { label: 'En cours de livraison', backgroundColor: '#E9D5FF', color: '#7C3AED' },
    completed: { label: 'Colis livré', backgroundColor: '#DCFCE7', color: '#166534' },
    cancelled: { label: 'Annulée', backgroundColor: '#FEE2E2', color: '#B91C1C' },
    declined: { label: 'Refusée', backgroundColor: '#FEE2E2', color: '#B91C1C' },
  }

  const statusMeta =
    (activeDelivery?.status && statusStyles[activeDelivery.status]) ||
    statusStyles.pending

  const pickupCoordinates = activeDelivery?.pickup?.coordinates
  const dropoffCoordinates = activeDelivery?.dropoff?.coordinates

  const computedRoute = pickupCoordinates && dropoffCoordinates
    ? [
        { lat: pickupCoordinates.lat, lng: pickupCoordinates.lng },
        { lat: dropoffCoordinates.lat, lng: dropoffCoordinates.lng },
      ]
    : undefined

  const formatDateTime = (value?: string | null): string => {
    if (!value) return '—'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return '—'
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date)
  }

  const statusToStepIndex: Record<string, number> = {
    pending: 0,
    accepted: 1,
    enroute: 2,
    in_progress: 2,
    picked_up: 4, // Colis pris en charge = déjà en cours de livraison
    delivering: 4,
    completed: 5,
  }
  const rawIndex = activeDelivery
    ? (statusToStepIndex[activeDelivery.status] ?? statusSteps.findIndex((s) => s.key === activeDelivery.status))
    : 0
  const currentStepIndex = Math.max(0, Math.min(rawIndex, statusSteps.length - 1))

  const timelineItems = statusSteps.map((step, index) => ({
    ...step,
    active: index <= currentStepIndex,
    description:
      index === 0
        ? formatDateTime(activeDelivery?.createdAt || null)
        : index < currentStepIndex
          ? 'Terminé'
          : index === currentStepIndex
            ? 'En cours'
            : 'À venir',
  }))

  // Fonction pour obtenir le nom d'affichage du driver
  const getDisplayName = () => {
    if (driver?.full_name && driver.full_name.trim()) {
      return driver.full_name
    }
    if (driver?.email) {
      return driver.email
    }
    return 'Driver non assigné'
  }

  // Fonction pour obtenir l'initiale du driver
  const getInitial = () => {
    if (driver?.full_name && driver.full_name.trim()) {
      return driver.full_name.charAt(0).toUpperCase()
    }
    if (driver?.email) {
      return driver.email.charAt(0).toUpperCase()
    }
    return '—'
  }

  const cardStyle: React.CSSProperties = {
    backgroundColor: themeColors.cardBg,
    borderRadius: '16px',
    padding: '16px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    border: `1px solid ${themeColors.cardBorder}`,
    transition: 'background-color 0.3s ease, border-color 0.3s ease',
    flex: 1.5,
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
  }

  const sectionStyle: React.CSSProperties = {
    marginBottom: '12px',
    flexShrink: 0,
  }

  const trackerHeaderStyle: React.CSSProperties = {
    fontSize: '14px',
    color: themeColors.textSecondary,
    fontWeight: 500,
    marginBottom: '8px',
  }

  const trackerRowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  }

  const trackerIdStyle: React.CSSProperties = {
    fontSize: '20px',
    fontWeight: 700,
    color: themeColors.textPrimary,
  }

  const statusBadgeStyle: React.CSSProperties = {
    paddingLeft: '12px',
    paddingRight: '12px',
    paddingTop: '4px',
    paddingBottom: '4px',
    backgroundColor: statusMeta.backgroundColor,
    color: statusMeta.color,
    borderRadius: '8px',
    fontSize: '12px',
    fontWeight: 600,
  }

  const timelineStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  }

  const timelineItemStyle: React.CSSProperties = {
    display: 'flex',
    gap: '16px',
  }

  const timelineDotContainerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  }

  const timelineDotStyle = (active: boolean): React.CSSProperties => ({
    width: '12px',
    height: '12px',
    borderRadius: '50%',
    backgroundColor: active ? '#2563EB' : '#D1D5DB',
  })

  const timelineLineStyle: React.CSSProperties = {
    width: '2px',
    height: '24px',
    backgroundColor: '#E5E7EB',
    marginTop: '4px',
  }

  const timelineContentStyle: React.CSSProperties = {
    flex: 1,
  }

  const timelineTitleStyle: React.CSSProperties = {
    fontSize: '14px',
    fontWeight: 500,
    color: themeColors.textPrimary,
  }

  const timelineDateStyle: React.CSSProperties = {
    fontSize: '12px',
    color: themeColors.textSecondary,
  }

  const driverInfoStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px',
    backgroundColor: '#FEF9C3',
    borderRadius: '12px',
  }

  const driverLeftStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  }

  const avatarStyle: React.CSSProperties = {
    width: '48px',
    height: '48px',
    backgroundColor: '#9333EA',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#FFFFFF',
    fontWeight: 700,
    fontSize: '14px',
  }

  const driverNameStyle: React.CSSProperties = {
    fontSize: '14px',
    fontWeight: 600,
    color: themeColors.textPrimary,
  }

  const driverRoleStyle: React.CSSProperties = {
    fontSize: '12px',
    color: themeColors.textSecondary,
  }

  const driverActionsStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  }

  const actionButtonStyle: React.CSSProperties = {
    padding: '8px',
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  }

  const infoRowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    padding: '10px 12px',
    borderRadius: '12px',
    backgroundColor: '#F9FAFB',
    marginBottom: '8px',
  }

  const infoIconStyle: React.CSSProperties = {
    padding: '8px',
    borderRadius: '10px',
    backgroundColor: '#EEF2FF',
    color: '#4C1D95',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  }

  const infoContentStyle: React.CSSProperties = {
    flex: 1,
  }

  const infoTitleStyle: React.CSSProperties = {
    fontSize: '12px',
    textTransform: 'uppercase',
    color: themeColors.textSecondary,
    marginBottom: '4px',
  }

  const infoTextStyle: React.CSSProperties = {
    fontSize: '14px',
    fontWeight: 600,
    color: themeColors.textPrimary,
  }

  const renderEmpty = () => (
    <div
      style={{
        ...sectionStyle,
        padding: '16px',
        borderRadius: '12px',
        backgroundColor: '#F3F4F6',
        textAlign: 'center',
        color: themeColors.textSecondary,
      }}
    >
      {isLoading ? 'Chargement des livraisons en cours...' : 'Aucune livraison en cours'}
    </div>
  )

  const driverPhone = driver?.phone

  return (
    <AnimatedCard index={0} delay={150} style={cardStyle}>
      <div style={sectionStyle}>
        <MapboxMiniMap routePath={computedRoute} />
      </div>

      {activeDelivery ? (
        <>
          <div style={sectionStyle}>
            <h3 style={trackerHeaderStyle}>Tracker ID</h3>
            <div style={trackerRowStyle}>
              <p style={trackerIdStyle}>
                {trackerId ? formatDeliveryId(trackerId, activeDelivery?.createdAt) : '—'}
              </p>
              <span style={statusBadgeStyle}>{statusMeta.label}</span>
            </div>
          </div>

          <div style={{ ...sectionStyle, display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={infoRowStyle}>
              <div style={infoIconStyle}>
                <MapPin size={16} />
              </div>
              <div style={infoContentStyle}>
                <p style={infoTitleStyle}>Point de départ</p>
                <p style={infoTextStyle}>{pickupAddress}</p>
              </div>
            </div>
            <div style={infoRowStyle}>
              <div style={infoIconStyle}>
                <Navigation size={16} />
              </div>
              <div style={infoContentStyle}>
                <p style={infoTitleStyle}>Destination</p>
                <p style={infoTextStyle}>{dropoffAddress}</p>
              </div>
            </div>
          </div>

          <div style={{ ...sectionStyle, marginBottom: '12px', flex: 1, minHeight: 0, overflow: 'auto' }}>
            <div style={timelineStyle}>
              {timelineItems.map((item, index) => (
                <div key={item.key} style={timelineItemStyle}>
                  <div style={timelineDotContainerStyle}>
                    <div style={timelineDotStyle(item.active)}></div>
                    {index < timelineItems.length - 1 && <div style={timelineLineStyle}></div>}
                  </div>
                  <div style={timelineContentStyle}>
                    <p style={timelineTitleStyle}>{item.label}</p>
                    <p style={timelineDateStyle}>{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ ...driverInfoStyle, flexShrink: 0 }}>
            <div style={driverLeftStyle}>
              <div style={avatarStyle}>{getInitial()}</div>
              <div>
                <p style={driverNameStyle}>{getDisplayName()}</p>
                <p style={driverRoleStyle}>
                  {driver?.phone ? `+${driver.phone}` : 'Contact indisponible'}
                </p>
              </div>
            </div>
            <div style={driverActionsStyle}>
              <button
                style={{ ...actionButtonStyle, opacity: driverPhone ? 1 : 0.5, cursor: driverPhone ? 'pointer' : 'not-allowed' }}
                disabled={!driverPhone}
                onClick={() => {
                  if (driverPhone) {
                    window.open(`tel:${driverPhone}`, '_self')
                  }
                }}
                onMouseEnter={(e) => {
                  if (driverPhone) {
                    e.currentTarget.style.backgroundColor = '#FEF3C7'
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent'
                }}
              >
                <Phone size={20} style={{ color: '#4B5563' }} />
              </button>
              <button
                style={actionButtonStyle}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#FEF3C7'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent'
                }}
              >
                <MessageSquare size={20} style={{ color: '#4B5563' }} />
              </button>
            </div>
          </div>
        </>
      ) : (
        renderEmpty()
      )}
    </AnimatedCard>
  )
}

