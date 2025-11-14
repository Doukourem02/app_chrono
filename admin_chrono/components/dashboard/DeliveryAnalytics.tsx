'use client'

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

interface AnalyticsData {
  month: string
  packageDelivered: number
  reported: number
}

const data: AnalyticsData[] = [
  { month: 'Jul', packageDelivered: 8500, reported: 45 },
  { month: 'Aug', packageDelivered: 9200, reported: 52 },
  { month: 'Sept', packageDelivered: 10123, reported: 56 },
  { month: 'Oct', packageDelivered: 9800, reported: 48 },
  { month: 'November', packageDelivered: 11200, reported: 62 },
]

export default function DeliveryAnalytics() {
  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold text-gray-900">Delivery Analytics</h2>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-600"></div>
            <span className="text-xs text-gray-600">Package Delivered</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-300"></div>
            <span className="text-xs text-gray-600">Reported</span>
          </div>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={300}>
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
  )
}

