'use client'

import { LucideIcon } from 'lucide-react'
import { AnimatedCard } from '@/components/animations'
import { SkeletonLoader } from '@/components/animations'
import { themeColors } from '@/utils/theme'

interface KPICardProps {
  title: string
  value: string | number
  change: number
  subtitle: string
  icon: LucideIcon
  iconColor?: string
  isLoading?: boolean
  index?: number
  compact?: boolean
  style?: React.CSSProperties
}

export default function KPICard({
  title,
  value,
  change,
  subtitle,
  icon: Icon,
  iconColor = 'text-blue-600',
  isLoading = false,
  index = 0,
  compact = false,
  style,
}: KPICardProps) {
  const isPositive = change >= 0
  const formattedValue = typeof value === 'number' 
    ? value.toLocaleString('en-US', { maximumFractionDigits: 0 })
    : value

  const cardStyle: React.CSSProperties = {
    backgroundColor: themeColors.cardBg,
    borderRadius: '16px',
    padding: compact ? '14px' : '16px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    border: `1px solid ${themeColors.cardBorder}`,
    transition: 'background-color 0.3s ease, border-color 0.3s ease',
    overflow: 'hidden',
    ...style,
  }

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: compact ? '6px' : '12px',
  }

  const getIconBgColor = () => {
    if (iconColor === 'text-blue-600') return '#EFF6FF'
    if (iconColor === 'text-green-600') return '#F0FDF4'
    if (iconColor === 'text-yellow-600') return '#FEFCE8'
    if (iconColor === 'text-red-600') return '#FEF2F2'
    if (iconColor === 'text-purple-600') return '#FAF5FF'
    return '#FAF5FF'
  }

  const getIconColor = () => {
    if (iconColor === 'text-blue-600') return '#2563EB'
    if (iconColor === 'text-green-600') return '#16A34A'
    if (iconColor === 'text-yellow-600') return '#CA8A04'
    if (iconColor === 'text-red-600') return '#DC2626'
    if (iconColor === 'text-purple-600') return '#9333EA'
    return '#9333EA'
  }

  const iconContainerStyle: React.CSSProperties = {
    padding: compact ? '7px' : '8px',
    borderRadius: compact ? '10px' : '12px',
    backgroundColor: getIconBgColor(),
  }

  const iconStyle: React.CSSProperties = {
    width: compact ? '18px' : '20px',
    height: compact ? '18px' : '20px',
    color: getIconColor(),
  }

  const changeStyle: React.CSSProperties = {
    fontSize: compact ? '13px' : '14px',
    fontWeight: 600,
    color: isPositive ? '#16A34A' : '#DC2626',
    lineHeight: 1.2,
  }

  const contentStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: compact ? '2px' : '4px',
    minHeight: 0,
  }

  const titleStyle: React.CSSProperties = {
    fontSize: compact ? '13px' : '14px',
    color: themeColors.textSecondary,
    fontWeight: 500,
    lineHeight: 1.2,
  }

  const valueStyle: React.CSSProperties = {
    fontSize: compact ? '28px' : '30px',
    fontWeight: 700,
    color: themeColors.textPrimary,
    lineHeight: 1.12,
  }

  const subtitleStyle: React.CSSProperties = {
    fontSize: '12px',
    color: themeColors.textSecondary,
    lineHeight: 1.2,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }

  return (
    <AnimatedCard index={index} delay={0} style={cardStyle}>
      <div style={headerStyle}>
        <div style={iconContainerStyle}>
          <Icon style={iconStyle} />
        </div>
        {!isLoading && (
          <div style={changeStyle}>
            {isPositive ? '+' : ''}{change.toFixed(1).replace('.', ',')}%
          </div>
        )}
        {isLoading && (
          <SkeletonLoader width={50} height={16} borderRadius={4} />
        )}
      </div>
      
      <div style={contentStyle}>
        <h3 style={titleStyle}>{title}</h3>
        <div style={valueStyle}>
          {isLoading ? (
            <SkeletonLoader width={80} height={32} borderRadius={4} />
          ) : (
            formattedValue
          )}
        </div>
        <div style={subtitleStyle}>
          {isLoading ? (
            <SkeletonLoader width={100} height={14} borderRadius={4} />
          ) : (
            subtitle
          )}
        </div>
      </div>
    </AnimatedCard>
  )
}
