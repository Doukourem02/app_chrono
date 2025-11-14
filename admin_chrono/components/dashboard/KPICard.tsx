'use client'

import { LucideIcon } from 'lucide-react'

interface KPICardProps {
  title: string
  value: string | number
  change: number
  subtitle: string
  icon: LucideIcon
  iconColor?: string
}

export default function KPICard({
  title,
  value,
  change,
  subtitle,
  icon: Icon,
  iconColor = 'text-purple-600',
}: KPICardProps) {
  const isPositive = change >= 0
  const formattedValue = typeof value === 'number' ? value.toLocaleString() : value

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
      <div className="flex items-start justify-between mb-4">
        <div className={`p-3 rounded-xl bg-gray-50 ${iconColor}`}>
          <Icon className="w-6 h-6" />
        </div>
        <div className={`text-sm font-semibold ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
          {isPositive ? '+' : ''}{change}%
        </div>
      </div>
      
      <div className="space-y-1">
        <h3 className="text-sm text-gray-600 font-medium">{title}</h3>
        <p className="text-2xl font-bold text-gray-900">{formattedValue}</p>
        <p className="text-xs text-gray-500">{subtitle}</p>
      </div>
    </div>
  )
}

