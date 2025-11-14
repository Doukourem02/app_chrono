'use client'

import React from 'react'
import { Truck, Package, CheckSquare, User } from 'lucide-react'

interface StatusKPICardProps {
  type: 'onProgress' | 'successful' | 'onHold' | 'canceled'
  count: number
  change?: number
}

export default function StatusKPICard({ type, count, change = 0 }: StatusKPICardProps) {
  const config = {
    onProgress: {
      icon: Truck,
      color: '#8B5CF6',
      label: 'On Progress Delivery',
    },
    successful: {
      icon: CheckSquare,
      color: '#10B981',
      label: 'Successful',
    },
    onHold: {
      icon: User,
      color: '#EF4444',
      label: 'On Hold Delivery',
    },
    canceled: {
      icon: Package,
      color: '#F59E0B',
      label: 'Canceled Delivery',
    },
  }

  const { icon: Icon, color, label } = config[type]

  const cardStyle: React.CSSProperties = {
    backgroundColor: '#FFFFFF',
    borderRadius: '16px',
    padding: '24px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    border: '1px solid #F3F4F6',
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
    color: '#6B7280',
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
    color: '#111827',
    marginBottom: '8px',
  }

  const comparisonStyle: React.CSSProperties = {
    fontSize: '12px',
    fontWeight: 500,
    color: change >= 0 ? '#10B981' : '#EF4444',
  }

  const formatChange = (changeValue: number): string => {
    if (changeValue === 0) return '0% vs past month'
    const sign = changeValue > 0 ? '+' : ''
    return `${sign}${changeValue}% vs past month`
  }

  return (
    <div style={cardStyle}>
      <div style={headerStyle}>
        <div style={{ flex: 1 }}>
          <div style={titleStyle}>{label}</div>
        </div>
        <div style={iconContainerStyle}>
          <Icon size={60} style={iconStyle} />
        </div>
      </div>
      <div style={{ marginTop: 'auto' }}>
        <div style={valueStyle}>{count} {count === 1 ? 'Order' : 'Orders'}</div>
        <div style={comparisonStyle}>{formatChange(change)}</div>
      </div>
    </div>
  )
}

