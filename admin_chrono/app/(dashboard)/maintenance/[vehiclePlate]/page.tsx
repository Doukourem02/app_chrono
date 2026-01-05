'use client'

import React, { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft, Car, Truck, Package, Gauge, DollarSign, Wrench, FileText, TrendingUp, Calendar, MapPin, User, Fuel, AlertTriangle } from 'lucide-react'
import { adminApiService } from '@/lib/adminApiService'
import { ScreenTransition } from '@/components/animations'
import { SkeletonLoader } from '@/components/animations'
import { AnimatedCard } from '@/components/animations'
import { themeColors } from '@/utils/theme'

type TabType = 'overview' | 'finances' | 'mileage' | 'maintenance' | 'documents'

export default function VehicleDetailPage() {
  const router = useRouter()
  const params = useParams()
  const vehiclePlate = params?.vehiclePlate as string
  const [activeTab, setActiveTab] = useState<TabType>('overview')

  // Récupérer les détails du véhicule
  const { data: vehicleData, isLoading } = useQuery({
    queryKey: ['fleet-vehicle', vehiclePlate],
    queryFn: async () => {
      const result = await adminApiService.getFleetVehicleDetails(vehiclePlate)
      return result
    },
    enabled: !!vehiclePlate,
  })

  // Récupérer les données selon l'onglet actif
  const { data: fuelLogsData } = useQuery({
    queryKey: ['fleet-fuel-logs', vehiclePlate],
    queryFn: async () => {
      const result = await adminApiService.getVehicleFuelLogs(vehiclePlate, 50)
      return result
    },
    enabled: !!vehiclePlate && activeTab === 'overview',
  })

  const { data: maintenanceData } = useQuery({
    queryKey: ['fleet-maintenance', vehiclePlate],
    queryFn: async () => {
      const result = await adminApiService.getVehicleMaintenance(vehiclePlate)
      return result
    },
    enabled: !!vehiclePlate && (activeTab === 'overview' || activeTab === 'maintenance'),
  })

  const { data: mileageData } = useQuery({
    queryKey: ['fleet-mileage', vehiclePlate],
    queryFn: async () => {
      const result = await adminApiService.getVehicleMileage(vehiclePlate, 100)
      return result
    },
    enabled: !!vehiclePlate && activeTab === 'mileage',
  })

  const { data: financialData } = useQuery({
    queryKey: ['fleet-financial', vehiclePlate],
    queryFn: async () => {
      const result = await adminApiService.getVehicleFinancialSummary(vehiclePlate)
      return result
    },
    enabled: !!vehiclePlate && activeTab === 'finances',
  })

  const financial = useMemo(() => financialData?.data || [], [financialData])

  const vehicle = vehicleData?.data?.vehicle
  const documents = useMemo(() => vehicleData?.data?.documents || [], [vehicleData?.data?.documents])
  const maintenance = useMemo(() => maintenanceData?.data || [], [maintenanceData?.data])
  const fuelLogs = useMemo(() => fuelLogsData?.data || [], [fuelLogsData?.data])
  const mileageLogs = useMemo(() => mileageData?.data || [], [mileageData?.data])

  const formatCurrency = (amount: number | null | undefined) => {
    if (amount === undefined || amount === null) return 'N/A'
    return new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount) + ' FCFA'
  }

  const formatOdometer = (km: number | null | undefined) => {
    if (km === undefined || km === null) return 'N/A'
    return new Intl.NumberFormat('fr-FR').format(km) + ' km'
  }

  const formatDate = (date: string | null | undefined) => {
    if (!date) return 'N/A'
    return new Date(date).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  }

  const formatDateTime = (date: string | null | undefined) => {
    if (!date) return 'N/A'
    return new Date(date).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getVehicleTypeIcon = (type: string) => {
    switch (type) {
      case 'moto':
        return <Truck className="w-5 h-5" />
      case 'cargo':
        return <Package className="w-5 h-5" />
      default:
        return <Car className="w-5 h-5" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800'
      case 'maintenance':
        return 'bg-yellow-100 text-yellow-800'
      case 'retired':
        return 'bg-gray-100 text-gray-800'
      case 'reserved':
        return 'bg-blue-100 text-blue-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getDocumentTypeLabel = (type: string) => {
    switch (type) {
      case 'carte_grise':
        return 'Carte grise'
      case 'assurance':
        return 'Assurance'
      case 'controle_technique':
        return 'Contrôle technique'
      case 'permis_conduire':
        return 'Permis de conduire'
      default:
        return type
    }
  }

  const getMaintenanceTypeLabel = (type: string) => {
    switch (type) {
      case 'routine':
        return 'Révision périodique'
      case 'repair':
        return 'Réparation'
      case 'inspection':
        return 'Contrôle technique'
      case 'insurance':
        return 'Assurance'
      case 'registration':
        return 'Carte grise'
      case 'tire_change':
        return 'Changement pneus'
      case 'battery_replacement':
        return 'Changement batterie'
      case 'other':
        return 'Autre'
      default:
        return type
    }
  }

  // Dates pour vérifier l'expiration des documents
  const now = useMemo(() => new Date(), [])
  const thirtyDaysFromNow = useMemo(() => new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000), [now])

  // Statistiques calculées
  const stats = useMemo(() => {
    if (!vehicle) return null

    const totalFuelCost = fuelLogs.reduce((sum, log) => sum + (log.total_cost || 0), 0)
    const totalMaintenanceCost = maintenance
      .filter((m) => m.status === 'completed')
      .reduce((sum, m) => sum + (m.cost || 0), 0)
    const totalDistance = mileageLogs.reduce((sum, log) => sum + (log.distance_km || 0), 0)
    const totalRevenue = mileageLogs.reduce((sum, log) => sum + (log.revenue_generated || 0), 0)
    const totalDeliveries = mileageLogs.length

    const avgConsumption = fuelLogs.length > 0
      ? fuelLogs.reduce((sum, log) => sum + (log.consumption_per_100km || 0), 0) / fuelLogs.length
      : null

    const netProfit = totalRevenue - totalFuelCost - totalMaintenanceCost
    const roi = totalFuelCost + totalMaintenanceCost > 0
      ? ((netProfit / (totalFuelCost + totalMaintenanceCost)) * 100)
      : null

    return {
      totalFuelCost,
      totalMaintenanceCost,
      totalDistance,
      totalRevenue,
      totalDeliveries,
      avgConsumption,
      netProfit,
      roi,
    }
  }, [vehicle, fuelLogs, maintenance, mileageLogs])

  if (isLoading) {
    return (
      <ScreenTransition>
        <div className="p-6 space-y-6">
          <SkeletonLoader width="100%" height={200} borderRadius={12} />
          <SkeletonLoader width="100%" height={400} borderRadius={12} />
        </div>
      </ScreenTransition>
    )
  }

  if (!vehicle) {
    return (
      <ScreenTransition>
        <div className="p-6 text-center">
          <Car className="w-16 h-16 mx-auto mb-4" style={{ color: themeColors.textSecondary }} />
          <p className="text-lg font-medium" style={{ color: themeColors.textPrimary }}>
            Véhicule non trouvé
          </p>
        </div>
      </ScreenTransition>
    )
  }

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
    padding: '24px',
  }

  const cardStyle: React.CSSProperties = {
    backgroundColor: themeColors.cardBg,
    borderRadius: '16px',
    padding: '24px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    border: `1px solid ${themeColors.cardBorder}`,
  }

  const tabContainerStyle: React.CSSProperties = {
    display: 'flex',
    gap: '8px',
    borderBottom: `1px solid ${themeColors.cardBorder}`,
    marginBottom: '24px',
    flexWrap: 'wrap',
  }

  const tabButtonStyle = (active: boolean): React.CSSProperties => ({
    padding: '12px 20px',
    borderBottom: active ? `2px solid ${themeColors.purplePrimary}` : '2px solid transparent',
    color: active ? themeColors.purplePrimary : themeColors.textSecondary,
    fontSize: '14px',
    fontWeight: active ? 600 : 500,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    backgroundColor: 'transparent',
    border: 'none',
    transition: 'all 0.2s',
  })

  return (
    <ScreenTransition>
      <div style={containerStyle}>
        {/* Header */}
        <AnimatedCard index={0} delay={0} style={cardStyle}>
          <div className="flex items-center gap-4 mb-6">
            <button
              onClick={() => router.back()}
              className="p-2 rounded-lg border transition-all hover:opacity-80"
              style={{
                borderColor: themeColors.cardBorder,
                backgroundColor: themeColors.background,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = themeColors.purplePrimary
                e.currentTarget.style.backgroundColor = '#F9FAFB'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = themeColors.cardBorder
                e.currentTarget.style.backgroundColor = themeColors.background
              }}
            >
              <ArrowLeft className="w-5 h-5" style={{ color: themeColors.textPrimary }} />
            </button>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <div style={{
                  padding: '8px',
                  borderRadius: '12px',
                  backgroundColor: '#F3F4F6',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  {getVehicleTypeIcon(vehicle.vehicle_type)}
                </div>
                <h1 style={{
                  fontSize: '28px',
                  fontWeight: 700,
                  color: themeColors.textPrimary,
                }}>
                  {vehicle.vehicle_plate}
                </h1>
                <span
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold capitalize ${getStatusColor(vehicle.status)}`}
                >
                  {vehicle.status === 'active' ? 'Actif' : vehicle.status === 'maintenance' ? 'Maintenance' : vehicle.status === 'retired' ? 'Retiré' : 'Réservé'}
                </span>
              </div>
              <p style={{
                fontSize: '14px',
                color: themeColors.textSecondary,
                marginTop: '4px',
              }}>
                {vehicle.vehicle_brand && vehicle.vehicle_model
                  ? `${vehicle.vehicle_brand} ${vehicle.vehicle_model}`
                  : vehicle.vehicle_brand || vehicle.vehicle_model || 'Véhicule'}
                {vehicle.vehicle_color && ` • ${vehicle.vehicle_color}`}
              </p>
            </div>
          </div>

          {/* Informations principales */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <AnimatedCard index={1} delay={50} style={{
              padding: '20px',
              borderRadius: '12px',
              border: `1px solid ${themeColors.cardBorder}`,
              backgroundColor: themeColors.cardBg,
            }}>
              <div className="flex items-center gap-2 mb-3">
                <div style={{
                  padding: '6px',
                  borderRadius: '8px',
                  backgroundColor: '#EFF6FF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Gauge className="w-4 h-4" style={{ color: '#2563EB' }} />
                </div>
                <span style={{
                  fontSize: '13px',
                  fontWeight: 500,
                  color: themeColors.textSecondary,
                }}>
                  Kilométrage
                </span>
              </div>
              <p style={{
                fontSize: '24px',
                fontWeight: 700,
                color: themeColors.textPrimary,
                marginBottom: '4px',
              }}>
                {formatOdometer(vehicle.current_odometer)}
              </p>
              {vehicle.last_odometer_update && (
                <p style={{
                  fontSize: '12px',
                  color: themeColors.textSecondary,
                }}>
                  Mis à jour le {formatDate(vehicle.last_odometer_update)}
                </p>
              )}
            </AnimatedCard>

            <AnimatedCard index={2} delay={100} style={{
              padding: '20px',
              borderRadius: '12px',
              border: `1px solid ${themeColors.cardBorder}`,
              backgroundColor: themeColors.cardBg,
            }}>
              <div className="flex items-center gap-2 mb-3">
                <div style={{
                  padding: '6px',
                  borderRadius: '8px',
                  backgroundColor: '#F0FDF4',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <User className="w-4 h-4" style={{ color: '#16A34A' }} />
                </div>
                <span style={{
                  fontSize: '13px',
                  fontWeight: 500,
                  color: themeColors.textSecondary,
                }}>
                  Livreur actuel
                </span>
              </div>
              {vehicle.driver_first_name || vehicle.driver_last_name ? (
                <p style={{
                  fontSize: '18px',
                  fontWeight: 600,
                  color: themeColors.textPrimary,
                }}>
                  {vehicle.driver_first_name} {vehicle.driver_last_name}
                </p>
              ) : (
                <p style={{
                  fontSize: '14px',
                  color: themeColors.textSecondary,
                  fontStyle: 'italic',
                }}>
                  Non assigné
                </p>
              )}
            </AnimatedCard>

            <AnimatedCard index={3} delay={150} style={{
              padding: '20px',
              borderRadius: '12px',
              border: `1px solid ${themeColors.cardBorder}`,
              backgroundColor: themeColors.cardBg,
            }}>
              <div className="flex items-center gap-2 mb-3">
                <div style={{
                  padding: '6px',
                  borderRadius: '8px',
                  backgroundColor: '#FEF3C7',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Fuel className="w-4 h-4" style={{ color: '#F59E0B' }} />
                </div>
                <span style={{
                  fontSize: '13px',
                  fontWeight: 500,
                  color: themeColors.textSecondary,
                }}>
                  Type de carburant
                </span>
              </div>
              <p style={{
                fontSize: '18px',
                fontWeight: 600,
                textTransform: 'capitalize',
                color: themeColors.textPrimary,
              }}>
                {vehicle.fuel_type || 'Non spécifié'}
              </p>
            </AnimatedCard>
          </div>
        </AnimatedCard>

        {/* Onglets */}
        <AnimatedCard index={1} delay={200} style={cardStyle}>
          <div style={tabContainerStyle}>
            <button style={tabButtonStyle(activeTab === 'overview')} onClick={() => setActiveTab('overview')}>
              <Car size={16} />
              Vue d&apos;ensemble
            </button>
            <button style={tabButtonStyle(activeTab === 'finances')} onClick={() => setActiveTab('finances')}>
              <DollarSign size={16} />
              Finances
            </button>
            <button style={tabButtonStyle(activeTab === 'mileage')} onClick={() => setActiveTab('mileage')}>
              <Gauge size={16} />
              Kilométrage
            </button>
            <button style={tabButtonStyle(activeTab === 'maintenance')} onClick={() => setActiveTab('maintenance')}>
              <Wrench size={16} />
              Maintenance
            </button>
            <button style={tabButtonStyle(activeTab === 'documents')} onClick={() => setActiveTab('documents')}>
              <FileText size={16} />
              Documents
            </button>
          </div>

          {/* Contenu des onglets */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Statistiques rapides */}
              {stats && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="p-4 rounded-lg border" style={{ borderColor: themeColors.cardBorder }}>
                    <div className="flex items-center gap-2 mb-2">
                      <DollarSign className="w-4 h-4" style={{ color: themeColors.textSecondary }} />
                      <span className="text-sm font-medium" style={{ color: themeColors.textSecondary }}>
                        Revenus totaux
                      </span>
                    </div>
                    <p className="text-xl font-bold" style={{ color: themeColors.textPrimary }}>
                      {formatCurrency(stats.totalRevenue)}
                    </p>
                  </div>

                  <div className="p-4 rounded-lg border" style={{ borderColor: themeColors.cardBorder }}>
                    <div className="flex items-center gap-2 mb-2">
                      <Fuel className="w-4 h-4" style={{ color: themeColors.textSecondary }} />
                      <span className="text-sm font-medium" style={{ color: themeColors.textSecondary }}>
                        Coût carburant
                      </span>
                    </div>
                    <p className="text-xl font-bold" style={{ color: themeColors.textPrimary }}>
                      {formatCurrency(stats.totalFuelCost)}
                    </p>
                  </div>

                  <div className="p-4 rounded-lg border" style={{ borderColor: themeColors.cardBorder }}>
                    <div className="flex items-center gap-2 mb-2">
                      <Wrench className="w-4 h-4" style={{ color: themeColors.textSecondary }} />
                      <span className="text-sm font-medium" style={{ color: themeColors.textSecondary }}>
                        Coût maintenance
                      </span>
                    </div>
                    <p className="text-xl font-bold" style={{ color: themeColors.textPrimary }}>
                      {formatCurrency(stats.totalMaintenanceCost)}
                    </p>
                  </div>

                  <div className="p-4 rounded-lg border" style={{ borderColor: themeColors.cardBorder }}>
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="w-4 h-4" style={{ color: themeColors.textSecondary }} />
                      <span className="text-sm font-medium" style={{ color: themeColors.textSecondary }}>
                        Profit net
                      </span>
                    </div>
                    <p className="text-xl font-bold" style={{ color: stats.netProfit >= 0 ? '#10B981' : '#EF4444' }}>
                      {formatCurrency(stats.netProfit)}
                    </p>
                    {stats.roi !== null && (
                      <p className="text-xs mt-1" style={{ color: themeColors.textSecondary }}>
                        ROI: {stats.roi.toFixed(1)}%
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Ravitaillements récents */}
              {fuelLogs.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-4" style={{ color: themeColors.textPrimary }}>
                    Ravitaillements récents
                  </h3>
                  <div className="space-y-2">
                    {fuelLogs.slice(0, 5).map((log) => (
                      <div
                        key={log.id}
                        className="p-3 rounded-lg border flex items-center justify-between"
                        style={{ borderColor: themeColors.cardBorder }}
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium capitalize" style={{ color: themeColors.textPrimary }}>
                              {log.fuel_type}
                            </span>
                            <span className="text-sm" style={{ color: themeColors.textSecondary }}>
                              {log.quantity} {log.fuel_type === 'electric' ? 'kWh' : 'L'}
                            </span>
                          </div>
                          {log.consumption_per_100km && (
                            <p className="text-xs mt-1" style={{ color: themeColors.textSecondary }}>
                              Consommation: {log.consumption_per_100km.toFixed(2)} {log.fuel_type === 'electric' ? 'kWh/100km' : 'L/100km'}
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="font-semibold" style={{ color: themeColors.textPrimary }}>
                            {formatCurrency(log.total_cost)}
                          </p>
                          <p className="text-xs" style={{ color: themeColors.textSecondary }}>
                            {formatDate(log.created_at)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Maintenances à venir */}
              {maintenance.filter((m) => m.status === 'scheduled').length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-4" style={{ color: themeColors.textPrimary }}>
                    Maintenances planifiées
                  </h3>
                  <div className="space-y-2">
                    {maintenance
                      .filter((m) => m.status === 'scheduled')
                      .slice(0, 5)
                      .map((m) => (
                        <div
                          key={m.id}
                          className="p-3 rounded-lg border"
                          style={{ borderColor: themeColors.cardBorder }}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium" style={{ color: themeColors.textPrimary }}>
                                {getMaintenanceTypeLabel(m.maintenance_type)}
                              </p>
                              {m.scheduled_date && (
                                <p className="text-sm mt-1" style={{ color: themeColors.textSecondary }}>
                                  <Calendar className="w-3 h-3 inline mr-1" />
                                  {formatDate(m.scheduled_date)}
                                </p>
                              )}
                            </div>
                            {m.cost > 0 && (
                              <p className="font-semibold" style={{ color: themeColors.textPrimary }}>
                                {formatCurrency(m.cost)}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'finances' && (
            <div className="space-y-6">
              {financial && financial.length > 0 ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 rounded-lg border" style={{ borderColor: themeColors.cardBorder }}>
                      <h3 className="font-semibold mb-4" style={{ color: themeColors.textPrimary }}>
                        Résumé financier (dernière période)
                      </h3>
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span style={{ color: themeColors.textSecondary }}>Revenus:</span>
                          <span className="font-semibold" style={{ color: themeColors.textPrimary }}>
                            {formatCurrency(financial[0].total_revenue)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span style={{ color: themeColors.textSecondary }}>Coût carburant:</span>
                          <span className="font-semibold" style={{ color: themeColors.textPrimary }}>
                            {formatCurrency(financial[0].total_fuel_cost)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span style={{ color: themeColors.textSecondary }}>Coût maintenance:</span>
                          <span className="font-semibold" style={{ color: themeColors.textPrimary }}>
                            {formatCurrency(financial[0].total_maintenance_cost)}
                          </span>
                        </div>
                        <div className="flex justify-between pt-2 border-t" style={{ borderColor: themeColors.cardBorder }}>
                          <span className="font-semibold" style={{ color: themeColors.textPrimary }}>
                            Profit net:
                          </span>
                          <span
                            className="font-bold"
                            style={{ color: financial[0].net_profit >= 0 ? '#10B981' : '#EF4444' }}
                          >
                            {formatCurrency(financial[0].net_profit)}
                          </span>
                        </div>
                        {financial[0].roi_percentage !== null && (
                          <div className="flex justify-between">
                            <span style={{ color: themeColors.textSecondary }}>ROI:</span>
                            <span className="font-semibold" style={{ color: themeColors.textPrimary }}>
                              {financial[0].roi_percentage.toFixed(1)}%
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="p-4 rounded-lg border" style={{ borderColor: themeColors.cardBorder }}>
                      <h3 className="font-semibold mb-4" style={{ color: themeColors.textPrimary }}>
                        Statistiques
                      </h3>
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span style={{ color: themeColors.textSecondary }}>Distance totale:</span>
                          <span className="font-semibold" style={{ color: themeColors.textPrimary }}>
                            {formatOdometer(financial[0].total_distance_km)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span style={{ color: themeColors.textSecondary }}>Livraisons:</span>
                          <span className="font-semibold" style={{ color: themeColors.textPrimary }}>
                            {financial[0].total_deliveries}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span style={{ color: themeColors.textSecondary }}>Période:</span>
                          <span className="font-semibold" style={{ color: themeColors.textPrimary }}>
                            {formatDate(financial[0].period_start)} - {formatDate(financial[0].period_end)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-12">
                  <DollarSign className="w-16 h-16 mx-auto mb-4" style={{ color: themeColors.textSecondary }} />
                  <p className="text-lg font-medium" style={{ color: themeColors.textPrimary }}>
                    Aucune donnée financière disponible
                  </p>
                  <p className="text-sm mt-2" style={{ color: themeColors.textSecondary }}>
                    Les données financières seront calculées automatiquement après les premières livraisons
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'mileage' && (
            <div className="space-y-6">
              {mileageLogs.length > 0 ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 rounded-lg border" style={{ borderColor: themeColors.cardBorder }}>
                      <div className="flex items-center gap-2 mb-2">
                        <Gauge className="w-4 h-4" style={{ color: themeColors.textSecondary }} />
                        <span className="text-sm font-medium" style={{ color: themeColors.textSecondary }}>
                          Distance totale
                        </span>
                      </div>
                      <p className="text-xl font-bold" style={{ color: themeColors.textPrimary }}>
                        {formatOdometer(stats?.totalDistance)}
                      </p>
                    </div>

                    <div className="p-4 rounded-lg border" style={{ borderColor: themeColors.cardBorder }}>
                      <div className="flex items-center gap-2 mb-2">
                        <Package className="w-4 h-4" style={{ color: themeColors.textSecondary }} />
                        <span className="text-sm font-medium" style={{ color: themeColors.textSecondary }}>
                          Livraisons
                        </span>
                      </div>
                      <p className="text-xl font-bold" style={{ color: themeColors.textPrimary }}>
                        {stats?.totalDeliveries || 0}
                      </p>
                    </div>

                    <div className="p-4 rounded-lg border" style={{ borderColor: themeColors.cardBorder }}>
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className="w-4 h-4" style={{ color: themeColors.textSecondary }} />
                        <span className="text-sm font-medium" style={{ color: themeColors.textSecondary }}>
                          Distance moyenne
                        </span>
                      </div>
                      <p className="text-xl font-bold" style={{ color: themeColors.textPrimary }}>
                        {stats && stats.totalDeliveries > 0
                          ? formatOdometer(stats.totalDistance / stats.totalDeliveries)
                          : 'N/A'}
                      </p>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-4" style={{ color: themeColors.textPrimary }}>
                      Historique des livraisons
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b" style={{ borderColor: themeColors.cardBorder }}>
                            <th className="text-left p-3 text-sm font-semibold" style={{ color: themeColors.textSecondary }}>
                              Date
                            </th>
                            <th className="text-left p-3 text-sm font-semibold" style={{ color: themeColors.textSecondary }}>
                              Distance
                            </th>
                            <th className="text-left p-3 text-sm font-semibold" style={{ color: themeColors.textSecondary }}>
                              Kilométrage
                            </th>
                            <th className="text-left p-3 text-sm font-semibold" style={{ color: themeColors.textSecondary }}>
                              Revenu
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {mileageLogs.slice(0, 20).map((log) => (
                            <tr
                              key={log.id}
                              className="border-b hover:bg-gray-50 transition-colors"
                              style={{ borderColor: themeColors.cardBorder }}
                            >
                              <td className="p-3 text-sm" style={{ color: themeColors.textPrimary }}>
                                {formatDateTime(log.created_at)}
                              </td>
                              <td className="p-3 text-sm font-mono" style={{ color: themeColors.textPrimary }}>
                                {formatOdometer(log.distance_km)}
                              </td>
                              <td className="p-3 text-sm font-mono" style={{ color: themeColors.textPrimary }}>
                                {log.odometer_before && log.odometer_after
                                  ? `${formatOdometer(log.odometer_before)} → ${formatOdometer(log.odometer_after)}`
                                  : '-'}
                              </td>
                              <td className="p-3 text-sm font-semibold" style={{ color: themeColors.textPrimary }}>
                                {formatCurrency(log.revenue_generated)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-12">
                  <Gauge className="w-16 h-16 mx-auto mb-4" style={{ color: themeColors.textSecondary }} />
                  <p className="text-lg font-medium" style={{ color: themeColors.textPrimary }}>
                    Aucun kilométrage enregistré
                  </p>
                  <p className="text-sm mt-2" style={{ color: themeColors.textSecondary }}>
                    Le kilométrage sera enregistré automatiquement après chaque livraison
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'maintenance' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold" style={{ color: themeColors.textPrimary }}>
                  Historique des maintenances
                </h3>
                <button
                  className="px-4 py-2 rounded-lg text-sm font-medium text-white hover:opacity-80 transition-opacity"
                  style={{ backgroundColor: themeColors.purplePrimary }}
                >
                  + Planifier une maintenance
                </button>
              </div>

              {maintenance.length > 0 ? (
                <div className="space-y-3">
                  {maintenance.map((m) => (
                    <div
                      key={m.id}
                      className="p-4 rounded-lg border"
                      style={{ borderColor: themeColors.cardBorder }}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold" style={{ color: themeColors.textPrimary }}>
                              {getMaintenanceTypeLabel(m.maintenance_type)}
                            </span>
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-medium ${
                                m.status === 'completed'
                                  ? 'bg-green-100 text-green-800'
                                  : m.status === 'scheduled'
                                  ? 'bg-blue-100 text-blue-800'
                                  : m.status === 'overdue'
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-gray-100 text-gray-800'
                              }`}
                            >
                              {m.status === 'completed'
                                ? 'Terminée'
                                : m.status === 'scheduled'
                                ? 'Planifiée'
                                : m.status === 'overdue'
                                ? 'En retard'
                                : 'Annulée'}
                            </span>
                          </div>
                          {m.description && (
                            <p className="text-sm mt-1" style={{ color: themeColors.textSecondary }}>
                              {m.description}
                            </p>
                          )}
                        </div>
                        {m.cost > 0 && (
                          <p className="font-semibold" style={{ color: themeColors.textPrimary }}>
                            {formatCurrency(m.cost)}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-3 text-sm" style={{ color: themeColors.textSecondary }}>
                        {m.scheduled_date && (
                          <div className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            <span>Planifiée: {formatDate(m.scheduled_date)}</span>
                          </div>
                        )}
                        {m.completed_date && (
                          <div className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            <span>Terminée: {formatDate(m.completed_date)}</span>
                          </div>
                        )}
                        {m.odometer_at_maintenance && (
                          <div className="flex items-center gap-1">
                            <Gauge className="w-4 h-4" />
                            <span>{formatOdometer(m.odometer_at_maintenance)}</span>
                          </div>
                        )}
                        {m.service_provider && (
                          <div className="flex items-center gap-1">
                            <MapPin className="w-4 h-4" />
                            <span>{m.service_provider}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Wrench className="w-16 h-16 mx-auto mb-4" style={{ color: themeColors.textSecondary }} />
                  <p className="text-lg font-medium" style={{ color: themeColors.textPrimary }}>
                    Aucune maintenance enregistrée
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'documents' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold" style={{ color: themeColors.textPrimary }}>
                  Documents légaux
                </h3>
              </div>

              {documents.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {documents.map((doc) => {
                    const isExpiring = doc.expiry_date
                      ? new Date(doc.expiry_date) <= thirtyDaysFromNow
                      : false
                    const isExpired = doc.expiry_date ? new Date(doc.expiry_date) < now : false

                    return (
                      <div
                        key={doc.id}
                        className={`p-4 rounded-lg border ${
                          isExpired ? 'border-red-300 bg-red-50' : isExpiring ? 'border-yellow-300 bg-yellow-50' : ''
                        }`}
                        style={!isExpired && !isExpiring ? { borderColor: themeColors.cardBorder } : {}}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h4 className="font-semibold" style={{ color: themeColors.textPrimary }}>
                              {getDocumentTypeLabel(doc.document_type)}
                            </h4>
                            {doc.document_number && (
                              <p className="text-sm mt-1 font-mono" style={{ color: themeColors.textSecondary }}>
                                {doc.document_number}
                              </p>
                            )}
                          </div>
                          {(isExpired || isExpiring) && (
                            <AlertTriangle
                              className={`w-5 h-5 ${isExpired ? 'text-red-600' : 'text-yellow-600'}`}
                            />
                          )}
                        </div>

                        <div className="space-y-2 text-sm">
                          {doc.issue_date && (
                            <div className="flex justify-between">
                              <span style={{ color: themeColors.textSecondary }}>Date d&apos;émission:</span>
                              <span style={{ color: themeColors.textPrimary }}>{formatDate(doc.issue_date)}</span>
                            </div>
                          )}
                          {doc.expiry_date && (
                            <div className="flex justify-between">
                              <span style={{ color: themeColors.textSecondary }}>Date d&apos;expiration:</span>
                              <span
                                className={isExpired ? 'font-semibold text-red-600' : isExpiring ? 'font-semibold text-yellow-600' : ''}
                                style={!isExpired && !isExpiring ? { color: themeColors.textPrimary } : {}}
                              >
                                {formatDate(doc.expiry_date)}
                                {isExpired && ' (Expiré)'}
                                {isExpiring && !isExpired && ' (Expire bientôt)'}
                              </span>
                            </div>
                          )}
                          {doc.document_url && (
                            <div className="mt-3">
                              <a
                                href={doc.document_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm font-medium hover:underline inline-flex items-center gap-1"
                                style={{ color: themeColors.purplePrimary }}
                              >
                                <FileText className="w-4 h-4" />
                                Voir le document
                              </a>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="text-center py-12">
                  <FileText className="w-16 h-16 mx-auto mb-4" style={{ color: themeColors.textSecondary }} />
                  <p className="text-lg font-medium" style={{ color: themeColors.textPrimary }}>
                    Aucun document enregistré
                  </p>
                  <p className="text-sm mt-2" style={{ color: themeColors.textSecondary }}>
                    Les documents seront enregistrés par les livreurs dans leur application
                  </p>
                </div>
              )}
            </div>
          )}
        </AnimatedCard>
      </div>
    </ScreenTransition>
  )
}

