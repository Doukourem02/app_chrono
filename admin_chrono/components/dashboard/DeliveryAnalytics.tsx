'use client'

import React from 'react'
import { useQuery } from '@tanstack/react-query'
import {BarChart,Bar,XAxis,YAxis,CartesianGrid,Tooltip,Legend,ResponsiveContainer,} from 'recharts'
import { getDeliveryAnalytics } from '@/lib/dashboardApi'
import { AnimatedCard } from '@/components/animations'
import { SkeletonLoader } from '@/components/animations'
import { useDateFilter } from '@/contexts/DateFilterContext'

export default function DeliveryAnalytics() {
  const { dateFilter, dateRange } = useDateFilter()
  const { startDate, endDate } = dateRange
  

  const latestKey = React.useMemo(
    () =>
      ['delivery-analytics', dateFilter, startDate, endDate] as [
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
      console.log('🔑 [DeliveryAnalytics] QueryKey calculated:', latestKey)
      return latestKey
    })
  }, [latestKey])
  
  const { data: analyticsData, isLoading } = useQuery({
    queryKey,
    queryFn: () => {
      console.log('🚀 [DeliveryAnalytics] queryFn CALLED - getDeliveryAnalytics', { startDate, endDate, timestamp: new Date().toISOString(), stack: new Error().stack })
      return getDeliveryAnalytics(startDate, endDate)
    },
    refetchInterval: false, // Pas de refresh automatique - les analytics changent rarement
    staleTime: Infinity, // Les données ne deviennent jamais "stale" - pas de refetch automatique
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    placeholderData: (previousData) => {
      if (previousData) {
        console.log('📦 [DeliveryAnalytics] Using cached data, skipping fetch')
      }
      return previousData
    },
    structuralSharing: true,
  })

  const chartData = React.useMemo(() => {
    if (Array.isArray(analyticsData)) {
      return analyticsData
    }
    return []
  }, [analyticsData])

  const hasData = chartData.length > 0

  const yDomain = React.useMemo(() => {
    if (!hasData) return [0, 1]
    const maxValue = chartData.reduce((max, item) => {
      const currentMax = Math.max(item.packageDelivered ?? 0, item.reported ?? 0)
      return Math.max(max, currentMax)
    }, 0)
    return [0, Math.max(maxValue * 1.1, 1)]
  }, [chartData, hasData])

  const cardStyle: React.CSSProperties = {
    backgroundColor: '#FFFFFF',
    borderRadius: '16px',
    padding: '16px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    border: '1px solid #F3F4F6',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
  }

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '12px',
  }

  const titleStyle: React.CSSProperties = {
    fontSize: '18px',
    fontWeight: 700,
    color: '#111827',
  }

  const legendContainerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  }

  const legendItemStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  }

  const legendDotStyle: React.CSSProperties = {
    width: '12px',
    height: '12px',
    borderRadius: '50%',
  }

  const legendTextStyle: React.CSSProperties = {
    fontSize: '12px',
    color: '#4B5563',
  }

  const loadingContainerStyle: React.CSSProperties = {
    height: '300px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  }

  const loadingTextStyle: React.CSSProperties = {
    color: '#6B7280',
  }

  return (
    <AnimatedCard index={0} delay={100} style={cardStyle}>
      <div style={headerStyle}>
        <h2 style={titleStyle}>Delivery Analytics</h2>
        <div style={legendContainerStyle}>
          <div style={legendItemStyle}>
            <div style={{ ...legendDotStyle, backgroundColor: '#2563EB' }}></div>
            <span style={legendTextStyle}>Package Delivered</span>
          </div>
          <div style={legendItemStyle}>
            <div style={{ ...legendDotStyle, backgroundColor: '#93C5FD' }}></div>
            <span style={legendTextStyle}>Reported</span>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div style={loadingContainerStyle}>
          <SkeletonLoader width="100%" height={300} borderRadius={8} />
        </div>
      ) : hasData ? (
        <div style={{ flex: 1, minHeight: '300px', height: '100%', width: '100%', position: 'relative' }}>
          <ResponsiveContainer width="100%" height="100%" minHeight={300} minWidth={0}>
          <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis 
              dataKey="month" 
              tick={{ fill: '#6b7280', fontSize: 12 }}
              axisLine={{ stroke: '#e5e7eb' }}
            />
            <YAxis 
              tick={{ fill: '#6b7280', fontSize: 12 }}
              axisLine={{ stroke: '#e5e7eb' }}
              domain={yDomain}
              tickFormatter={(value) => {
                if (value >= 1000) return `${value / 1000}K`
                return value.toString()
              }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                padding: '12px',
                boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
              }}
              formatter={(value: number, name: string) => {
                if (name === 'packageDelivered') {
                  return [value.toLocaleString(), 'Package Delivered']
                }
                return [value, 'Reported']
              }}
            />
            <Legend 
              wrapperStyle={{ paddingTop: '20px' }}
              iconType="circle"
            />
            <Bar 
              dataKey="packageDelivered" 
              fill="#2563eb" 
              radius={[8, 8, 0, 0]}
              name="Package Delivered"
            />
            <Bar 
              dataKey="reported" 
              fill="#93c5fd" 
              radius={[8, 8, 0, 0]}
              name="Reported"
            />
          </BarChart>
        </ResponsiveContainer>
        </div>
      ) : (
        <div style={loadingContainerStyle}>
          <div style={loadingTextStyle}>Aucune donnée disponible</div>
        </div>
      )}
    </AnimatedCard>
  )
}

