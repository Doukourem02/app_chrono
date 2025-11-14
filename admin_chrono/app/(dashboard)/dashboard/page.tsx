'use client'

import { Truck, ShieldCheck, DollarSign } from 'lucide-react'
import KPICard from '@/components/dashboard/KPICard'
import DeliveryAnalytics from '@/components/dashboard/DeliveryAnalytics'
import TrackerCard from '@/components/dashboard/TrackerCard'
import ActivityTable from '@/components/dashboard/ActivityTable'
import QuickMessage from '@/components/dashboard/QuickMessage'

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Dashboard</h1>
        <p className="text-gray-600">
          Bienvenue sur le tableau de bord de la console Admin
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <KPICard
          title="On Delivery"
          value={1354}
          change={16.5}
          subtitle="Since last week"
          icon={Truck}
          iconColor="text-blue-600"
        />
        <KPICard
          title="Success Deliveries"
          value={40523}
          change={-0.5}
          subtitle="Since last week"
          icon={ShieldCheck}
          iconColor="text-green-600"
        />
        <KPICard
          title="Revenue"
          value="$ 140,854"
          change={5.2}
          subtitle="Since last week"
          icon={DollarSign}
          iconColor="text-purple-600"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Analytics */}
        <div className="lg:col-span-2 space-y-6">
          <DeliveryAnalytics />
          <ActivityTable />
        </div>

        {/* Right Column - Tracker & Messages */}
        <div className="space-y-6">
          <TrackerCard />
          <QuickMessage />
        </div>
      </div>
    </div>
  )
}
