'use client'

import React from 'react'
import { Truck, Package, CheckSquare, User } from 'lucide-react'
import { AnimatedCard } from '@/components/animations'
import { themeColors } from '@/utils/theme'
import { useTranslation } from '@/hooks/useTranslation'

interface StatusKPICardProps {
  type: 'onProgress' | 'successful' | 'onHold' | 'canceled'
  count: number
  change?: number
  index?: number
}

export default function StatusKPICard({ type, count, change = 0, index = 0 }: StatusKPICardProps) {
  const t = useTranslation()
  const config = {
    onProgress: {
      icon: Truck,
      color: '#8B5CF6',
      label: t('ordersPage.kpi.onProgress'),
    },
    successful: {
      icon: CheckSquare,
      color: '#10B981',
      label: t('ordersPage.kpi.successful'),
    },
    onHold: {
      icon: User,
      color: '#EF4444',
      label: t('ordersPage.kpi.onHold'),
    },
    canceled: {
      icon: Package,
      color: '#F59E0B',
      label: t('ordersPage.kpi.canceled'),
    },
  }

  const { icon: Icon, color, label } = config[type]

  const cardStyle: React.CSSProperties = {
    backgroundColor: themeColors.cardBg,
    borderRadius: '16px',
    padding: '24px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    border: `1px solid ${themeColors.cardBorder}`,
    display: 'flex',
    flexDirection: 'column',
    minHeight: '200px',
    position: 'relative',
  }

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '16px',
  }

  const titleStyle: React.CSSProperties = {
    fontSize: '14px',
    fontWeight: 500,
    color: themeColors.textSecondary,
  }

  const iconContainerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    top: '24px',
    right: '24px',
  }

  const iconStyle: React.CSSProperties = {
    color: color,
    width: '60px',
    height: '60px',
  }

  const valueStyle: React.CSSProperties = {
    fontSize: '32px',
    fontWeight: 700,
    color: themeColors.textPrimary,
    marginBottom: '8px',
  }

  const comparisonStyle: React.CSSProperties = {
    fontSize: '12px',
    fontWeight: 500,
    color: change >= 0 ? '#10B981' : '#EF4444',
  }

  const formatChange = (changeValue: number): string => {
    if (changeValue === 0) return `0% ${t('ordersPage.kpi.vsPastMonth')}`
    const sign = changeValue > 0 ? '+' : ''
    return `${sign}${changeValue}% ${t('ordersPage.kpi.vsPastMonth')}`
  }

  return (
    <AnimatedCard index={index} delay={index * 50} style={cardStyle}>
      <div style={headerStyle}>
        <div style={{ flex: 1 }}>
          <div style={titleStyle}>{label}</div>
        </div>
        <div style={iconContainerStyle}>
          <Icon size={60} style={iconStyle} />
        </div>
      </div>
      <div style={{ marginTop: 'auto' }}>
        <div style={valueStyle}>{count} {count === 1 ? t('ordersPage.kpi.order') : t('ordersPage.kpi.orders')}</div>
        <div style={comparisonStyle}>{formatChange(change)}</div>
      </div>
    </AnimatedCard>
  )
}
