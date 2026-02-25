'use client'

import KPICard from '@/components/dashboard/KPICard'
import DeliveryAnalytics from '@/components/dashboard/DeliveryAnalytics'
import ActivityTable from '@/components/dashboard/ActivityTable'
import TrackerCard from '@/components/dashboard/TrackerCard'
import QuickMessage from '@/components/dashboard/QuickMessage'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import React, { useState, useEffect } from 'react'
import { adminSocketService } from '@/lib/adminSocketService'
import { getDashboardStats } from '@/lib/dashboardApi'
import { adminApiService } from '@/lib/adminApiService'
import { Truck, ShieldCheck, DollarSign, Calendar, Star, Clock, XCircle, Users, UserCheck } from 'lucide-react'
import { AnimatedButton } from '@/components/animations'
import { ScreenTransition } from '@/components/animations'
import { useDateFilter } from '@/contexts/DateFilterContext'
import type { Delivery } from '@/hooks/types'
import NewShippingModal from '@/components/orders/NewShippingModal'
import { logger } from '@/utils/logger'
import { themeColors } from '@/utils/theme'
import { useTranslation } from '@/hooks/useTranslation'

export default function DashboardPage() {
  const queryClient = useQueryClient()
  const { dateFilter, dateRange } = useDateFilter()
  const { startDate, endDate } = dateRange
  const [isNewShippingModalOpen, setIsNewShippingModalOpen] = useState(false)
  const t = useTranslation()

  // Rafraîchir les livraisons en cours dès qu'un statut change (sync temps réel)
  useEffect(() => {
    const unsubscribe = adminSocketService.on('order:status:update', () => {
      queryClient.invalidateQueries({ queryKey: ['ongoing-delivery-card'] })
    })
    return () => unsubscribe()
  }, [queryClient])

  const getPeriodLabel = () => {
    switch (dateFilter) {
      case 'today':
        return t('header.dateFilter.today')
      case 'thisWeek':
        return t('header.dateFilter.thisWeek')
      case 'thisMonth':
        return t('header.dateFilter.thisMonth')
      case 'lastMonth':
        return t('header.dateFilter.lastMonth')
      case 'all':
        return t('header.dateFilter.all')
      default:
        return t('header.dateFilter.thisWeek')
    }
  }
  
  // Stabiliser la queryKey avec useRef pour éviter les recalculs inutiles
  const latestKey = React.useMemo(
    () =>
      ['dashboard-stats', dateFilter, startDate, endDate] as [
        string,
        string,
        string,
        string
      ],
    [dateFilter, startDate, endDate]
  )

  const [queryKey, setQueryKey] = React.useState(latestKey)

  React.useEffect(() => {
    setQueryKey((prev) => {
      if (
        prev &&
        prev.length === latestKey.length &&
        prev.every((value, index) => value === latestKey[index])
      ) {
        return prev
      }

      logger.debug(' [DashboardPage] QueryKey calculated:', latestKey)
      return latestKey
    })
  }, [latestKey])
  
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey,
    queryFn: () => {
      logger.warn(' [DashboardPage] queryFn CALLED - getDashboardStats', { 
        startDate, 
        endDate, 
        timestamp: new Date().toISOString(), 
        stack: new Error().stack?.split('\n').slice(2, 15).join('\n')
      })
      return getDashboardStats(startDate, endDate)
    },
    refetchInterval: false,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchIntervalInBackground: false,
    placeholderData: (previousData) => {
      if (previousData) {
        logger.debug(' [DashboardPage] Using cached data, skipping fetch')
        return previousData
      }
      return undefined
    },
    gcTime: 30 * 60 * 1000,
    retry: false,
    structuralSharing: true,
    enabled: true,
  })

  const formatRevenue = (amount: number) => {
    return `${amount.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} FCFA`
  }

  const { data: ongoingDeliveriesResponse, isLoading: ongoingDeliveriesLoading } = useQuery({
    queryKey: ['ongoing-delivery-card'],
    queryFn: async () => {
      logger.warn(' [DashboardPage] queryFn CALLED - getOngoingDeliveries', {
        timestamp: new Date().toISOString(),
        stack: new Error().stack?.split('\n').slice(2, 15).join('\n'),
      })
      const result = await adminApiService.getOngoingDeliveries()
      logger.debug(' [DashboardPage] getOngoingDeliveries SUCCESS', {
        hasData: !!result.data && (result.data as Delivery[]).length > 0,
        timestamp: new Date().toISOString(),
      })
      return result
    },
    refetchInterval: 15000,
    staleTime: 5000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  })

  const ongoingDeliveries = React.useMemo(() => {
    const data = ongoingDeliveriesResponse?.data as Delivery[] | undefined
    return Array.isArray(data) ? data : []
  }, [ongoingDeliveriesResponse])

  const liveOnDeliveryCount = ongoingDeliveries.length

  const pageContainerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  }

  const headerRowStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '16px',
  }

  const titleStyle: React.CSSProperties = {
    fontSize: '30px',
    fontWeight: 700,
    color: themeColors.textPrimary,
  }

  const actionsContainerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: '12px',
  }

  const dateButtonStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    paddingLeft: '16px',
    paddingRight: '16px',
    paddingTop: '10px',
    paddingBottom: '10px',
    borderRadius: '16px',
    border: '1px solid #E5E7EB',
    fontSize: '14px',
    fontWeight: 500,
    color: '#374151',
    backgroundColor: 'transparent',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  }

  const newShippingButtonStyle: React.CSSProperties = {
    paddingLeft: '20px',
    paddingRight: '20px',
    paddingTop: '10px',
    paddingBottom: '10px',
    borderRadius: '16px',
    backgroundColor: '#8B5CF6',
    color: '#FFFFFF',
    fontSize: '14px',
    fontWeight: 600,
    boxShadow: '0 12px 20px rgba(139,92,246,0.25)',
    border: 'none',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  }

  const mainGridStyle: React.CSSProperties = {
    display: 'grid',
    gap: '12px',
    gridTemplateColumns: 'auto 1fr 380px',
    gridTemplateRows: 'auto 1fr',
    alignItems: 'stretch',
  }

  const leftColumnStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    minWidth: '240px',
    maxWidth: '240px',
    gridRow: '1 / 2',
  }

  const middleColumnTopStyle: React.CSSProperties = {
    gridRow: '1 / 2',
    minWidth: 0,
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
  }

  const middleColumnBottomStyle: React.CSSProperties = {
    gridColumn: '1 / 3',
    gridRow: '2 / 3',
    minWidth: 0,
  }

  const rightColumnStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    width: '380px',
    gridRow: '1 / 3',
    height: '100%',
  }

  return (
    <ScreenTransition direction="fade" duration={0.3}>
      <div style={pageContainerStyle}>
      <div style={headerRowStyle}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h1 style={titleStyle}>Dashboard</h1>
        </div>
        <div style={actionsContainerStyle}>
          <AnimatedButton
            onClick={() => {}}
            variant="outline"
            style={dateButtonStyle}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Calendar size={16} style={{ color: themeColors.textSecondary }} />
              {new Date().toLocaleDateString('fr-FR', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </div>
          </AnimatedButton>
          <AnimatedButton
            onClick={() => setIsNewShippingModalOpen(true)}
            variant="primary"
            style={newShippingButtonStyle}
          >
            + Nouvelle livraison
          </AnimatedButton>
        </div>
      </div>

      {/* Nouveaux KPIs supplémentaires - Toujours affichés, même pendant le chargement */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '12px',
        marginBottom: '16px',
      }}>
        <KPICard
          title={t('dashboard.kpis.satisfactionRate.title')}
          value={stats?.averageRating ? `${stats.averageRating.toFixed(1)} ⭐` : 'N/A'}
          change={0}
          subtitle={statsLoading ? t('common.loading') : `${stats?.totalRatings || 0} ${t('dashboard.kpis.satisfactionRate.subtitle')}`}
          icon={Star}
          iconColor="text-yellow-600"
          isLoading={statsLoading}
          index={0}
        />
        <KPICard
          title={t('dashboard.kpis.averageTime.title')}
          value={stats?.averageDeliveryTime ? `${stats.averageDeliveryTime} min` : 'N/A'}
          change={0}
          subtitle={t('dashboard.kpis.averageTime.subtitle')}
          icon={Clock}
          iconColor="text-blue-600"
          isLoading={statsLoading}
          index={1}
        />
          <KPICard
            title={t('dashboard.kpis.cancellationRate.title')}
            value={stats?.cancellationRate ? `${stats.cancellationRate.toFixed(1)}%` : '0%'}
            change={0}
            subtitle={getPeriodLabel()}
            icon={XCircle}
            iconColor="text-red-600"
            isLoading={statsLoading}
            index={2}
          />
          <KPICard
            title={t('dashboard.kpis.activeClients.title')}
            value={stats?.activeClients || 0}
            change={0}
            subtitle={getPeriodLabel()}
            icon={Users}
            iconColor="text-green-600"
            isLoading={statsLoading}
            index={3}
          />
          <KPICard
            title={t('dashboard.kpis.activeDrivers.title')}
            value={stats?.activeDrivers || 0}
            change={0}
            subtitle={getPeriodLabel()}
            icon={UserCheck}
            iconColor="text-purple-600"
            isLoading={statsLoading}
            index={4}
          />
      </div>

      <div style={mainGridStyle}>
        {/* Colonne gauche : 3 cartes KPI empilées */}
        <div style={leftColumnStyle}>
          <KPICard
            title={t('dashboard.kpis.onDelivery.title')}
          value={ongoingDeliveriesLoading ? '...' : liveOnDeliveryCount}
          change={stats?.onDeliveryChange || 0}
          subtitle={
            ongoingDeliveriesLoading
              ? t('dashboard.kpis.onDelivery.updating')
              : liveOnDeliveryCount === 1
                ? `1 ${t('dashboard.kpis.onDelivery.subtitle')}`
                : `${liveOnDeliveryCount} ${t('dashboard.kpis.onDelivery.subtitle')}`
          }
            icon={Truck}
            iconColor="text-blue-600"
          isLoading={ongoingDeliveriesLoading}
            index={0}
          />
          <KPICard
            title={t('dashboard.kpis.successDeliveries.title')}
            value={statsLoading ? '...' : stats?.successDeliveries || 0}
            change={stats?.successDeliveriesChange || 0}
            subtitle={t('dashboard.kpis.successDeliveries.subtitle')}
            icon={ShieldCheck}
            iconColor="text-green-600"
            isLoading={statsLoading}
            index={1}
          />
          <KPICard
            title={t('dashboard.kpis.revenue.title')}
            value={statsLoading ? '...' : formatRevenue(stats?.revenue || 0)}
            change={stats?.revenueChange || 0}
            subtitle={t('dashboard.kpis.revenue.subtitle')}
            icon={DollarSign}
            iconColor="text-purple-600"
            isLoading={statsLoading}
            index={2}
          />
        </div>

        {/* Colonne du milieu : Delivery Analytics */}
        <div style={middleColumnTopStyle}>
          <DeliveryAnalytics />
        </div>

        {/* Activity Data : Rectangle qui s'étend sous les KPI et Analytics */}
        <div style={middleColumnBottomStyle}>
          <ActivityTable />
        </div>

        {/* Colonne droite : Tracker + Quick Message */}
        <div style={rightColumnStyle}>
          <TrackerCard deliveries={ongoingDeliveries} isLoading={ongoingDeliveriesLoading} />
          <QuickMessage />
        </div>
      </div>

      <NewShippingModal
        isOpen={isNewShippingModalOpen}
        onClose={() => setIsNewShippingModalOpen(false)}
      />
    </div>
    </ScreenTransition>
  )
}
