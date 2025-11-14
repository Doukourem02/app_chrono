'use client'

import React from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { getDeliveryAnalytics } from '@/lib/dashboardApi'

const mockData = [
  { month: 'Jul', packageDelivered: 8500, reported: 45 },
  { month: 'Aug', packageDelivered: 9200, reported: 52 },
  { month: 'Sept', packageDelivered: 10123, reported: 56 },
  { month: 'Oct', packageDelivered: 11200, reported: 48 },
  { month: 'Nov', packageDelivered: 12500, reported: 62 },
]

export default function DeliveryAnalytics() {
  const { data: analyticsData, isLoading } = useQuery({
    queryKey: ['delivery-analytics'],
    queryFn: getDeliveryAnalytics,
    refetchInterval: 60000,
  })

  const data = analyticsData && analyticsData.length > 0 ? analyticsData : mockData

  // Debug: vérifier les données
  React.useEffect(() => {
    console.debug('🔍 [DeliveryAnalytics] Data:', data)
    console.debug('🔍 [DeliveryAnalytics] Data length:', data?.length)
    console.debug('🔍 [DeliveryAnalytics] Is loading:', isLoading)
  }, [data, isLoading])

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
    <div style={cardStyle}>
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
          <div style={loadingTextStyle}>Chargement des données...</div>
        </div>
      ) : data && data.length > 0 ? (
        <div style={{ flex: 1, minHeight: '300px', height: '100%', width: '100%' }}>
          <ResponsiveContainer width="100%" height="100%" minHeight={300}>
          <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis 
              dataKey="month" 
              tick={{ fill: '#6b7280', fontSize: 12 }}
              axisLine={{ stroke: '#e5e7eb' }}
            />
            <YAxis 
              tick={{ fill: '#6b7280', fontSize: 12 }}
              axisLine={{ stroke: '#e5e7eb' }}
              domain={[500, 15000]}
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
    </div>
  )
}

