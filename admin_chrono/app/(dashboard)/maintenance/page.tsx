'use client'

import React, { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { Search, Car, Truck, Package, AlertTriangle, TrendingUp, Gauge, Wrench } from 'lucide-react'
import { adminApiService } from '@/lib/adminApiService'
import { ScreenTransition } from '@/components/animations'
import { SkeletonLoader } from '@/components/animations'
import { AnimatedCard } from '@/components/animations'
import KPICard from '@/components/dashboard/KPICard'
import { themeColors } from '@/utils/theme'
import { useTranslation } from '@/hooks/useTranslation'

type VehicleStatus = 'all' | 'active' | 'maintenance' | 'retired' | 'reserved'
type VehicleType = 'all' | 'moto' | 'vehicule' | 'cargo'

interface FleetVehicle {
  id: string
  vehicle_plate: string
  vehicle_type: string
  vehicle_brand: string | null
  vehicle_model: string | null
  vehicle_color: string | null
  fuel_type: string | null
  current_driver_id: string | null
  current_odometer: number
  status: string
  driver_first_name: string | null
  driver_last_name: string | null
  driver_email: string | null
}

interface ExpiringDocument {
  id: string
  vehicle_plate: string
  document_type: string
  expiry_date: string
  vehicle_type: string
  vehicle_brand: string | null
}

export default function FleetPage() {
  const router = useRouter()
  const t = useTranslation()
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<VehicleStatus>('all')
  const [typeFilter, setTypeFilter] = useState<VehicleType>('all')

  // Debounce pour la recherche
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery)
    }, 300)

    return () => clearTimeout(timer)
  }, [searchQuery])

  // Récupérer les véhicules
  const { data: vehiclesData, isLoading } = useQuery({
    queryKey: ['fleet-vehicles', statusFilter, typeFilter, debouncedSearchQuery],
    queryFn: async () => {
      const result = await adminApiService.getFleetVehicles({
        status: statusFilter === 'all' ? undefined : statusFilter,
        vehicleType: typeFilter === 'all' ? undefined : typeFilter,
        search: debouncedSearchQuery || undefined,
      })
      return result
    },
    refetchInterval: 30000, // Rafraîchir toutes les 30 secondes
    staleTime: 5000,
    placeholderData: (previousData) => previousData,
  })

  // Récupérer les documents expirant
  const { data: expiringDocsData } = useQuery({
    queryKey: ['expiring-documents', 30],
    queryFn: async () => {
      const result = await adminApiService.getExpiringDocuments(30)
      return result
    },
    refetchInterval: 60000, // Rafraîchir toutes les minutes
    staleTime: 30000,
  })

  const vehicles = useMemo(() => {
    if (!vehiclesData?.data) return []
    return (vehiclesData.data as FleetVehicle[]) || []
  }, [vehiclesData])

  const expiringDocuments = useMemo(() => {
    if (!expiringDocsData?.data) return []
    return (expiringDocsData.data as ExpiringDocument[]) || []
  }, [expiringDocsData])

  // Statistiques globales
  const stats = useMemo(() => {
    const total = vehicles.length
    const active = vehicles.filter(v => v.status === 'active').length
    const maintenance = vehicles.filter(v => v.status === 'maintenance').length
    const totalOdometer = vehicles.reduce((sum, v) => sum + (v.current_odometer || 0), 0)
    const avgOdometer = total > 0 ? Math.round(totalOdometer / total) : 0

    return {
      total,
      active,
      maintenance,
      avgOdometer,
    }
  }, [vehicles])

  const getVehicleTypeIcon = (type: string) => {
    switch (type) {
      case 'moto':
        return <Truck className="w-4 h-4" />
      case 'cargo':
        return <Package className="w-4 h-4" />
      default:
        return <Car className="w-4 h-4" />
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

  const formatOdometer = (km: number) => {
    return new Intl.NumberFormat('fr-FR').format(km)
  }

  const pageContainerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    padding: '24px',
  }

  const headerRowStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '16px',
    marginBottom: '8px',
  }

  const titleStyle: React.CSSProperties = {
    fontSize: '30px',
    fontWeight: 700,
    color: themeColors.textPrimary,
    lineHeight: '1.2',
  }

  const subtitleStyle: React.CSSProperties = {
    fontSize: '14px',
    color: themeColors.textSecondary,
    marginTop: '4px',
  }

  return (
    <ScreenTransition>
      <div style={pageContainerStyle}>
        {/* Header */}
        <div style={headerRowStyle}>
          <div>
            <h1 style={titleStyle}>
              {t('sidebar.sections.maintenance.title')}
            </h1>
            <p style={subtitleStyle}>
              {t('sidebar.sections.maintenance.overview')}
            </p>
          </div>
        </div>

        {/* Statistiques globales avec KPICard */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <KPICard
            title={t('maintenance.stats.totalVehicles')}
            value={stats.total}
            change={0}
            subtitle="Total véhicules"
            icon={Car}
            iconColor="text-purple-600"
            isLoading={isLoading}
            index={0}
          />
          <KPICard
            title={t('maintenance.stats.active')}
            value={stats.active}
            change={0}
            subtitle="Véhicules actifs"
            icon={TrendingUp}
            iconColor="text-green-600"
            isLoading={isLoading}
            index={1}
          />
          <KPICard
            title={t('maintenance.stats.maintenance')}
            value={stats.maintenance}
            change={0}
            subtitle="En maintenance"
            icon={Wrench}
            iconColor="text-yellow-600"
            isLoading={isLoading}
            index={2}
          />
          <KPICard
            title={t('maintenance.stats.avgOdometer')}
            value={`${formatOdometer(stats.avgOdometer)} km`}
            change={0}
            subtitle="Kilométrage moyen"
            icon={Gauge}
            iconColor="text-blue-600"
            isLoading={isLoading}
            index={3}
          />
        </div>

        {/* Alertes documents expirant */}
        {expiringDocuments.length > 0 && (
          <AnimatedCard index={0} delay={0} style={{
            backgroundColor: '#FEF3C7',
            borderRadius: '16px',
            padding: '20px',
            border: '1px solid #FCD34D',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          }}>
            <div className="flex items-center gap-3 mb-4">
              <div style={{
                padding: '8px',
                borderRadius: '12px',
                backgroundColor: '#F59E0B',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <AlertTriangle className="w-5 h-5 text-white" />
              </div>
              <h3 style={{
                fontSize: '16px',
                fontWeight: 600,
                color: '#92400E',
              }}>
                {expiringDocuments.length} {t('maintenance.alerts.expiringDocuments')}
              </h3>
            </div>
            <div className="space-y-2">
              {expiringDocuments.slice(0, 5).map((doc) => (
                <div key={doc.id} style={{
                  fontSize: '14px',
                  color: '#78350F',
                  padding: '8px 12px',
                  backgroundColor: 'rgba(255, 255, 255, 0.5)',
                  borderRadius: '8px',
                }}>
                  <span style={{ fontWeight: 600 }}>{doc.vehicle_plate}</span> - {doc.document_type} expire le{' '}
                  {new Date(doc.expiry_date).toLocaleDateString('fr-FR')}
                </div>
              ))}
              {expiringDocuments.length > 5 && (
                <div style={{
                  fontSize: '13px',
                  color: '#92400E',
                  fontWeight: 600,
                  padding: '8px 12px',
                }}>
                  +{expiringDocuments.length - 5} autre{expiringDocuments.length - 5 > 1 ? 's' : ''}
                </div>
              )}
            </div>
          </AnimatedCard>
        )}

        {/* Filtres et recherche */}
        <AnimatedCard index={0} delay={0} style={{
          backgroundColor: themeColors.cardBg,
          borderRadius: '16px',
          padding: '20px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          border: `1px solid ${themeColors.cardBorder}`,
        }}>
          <div className="flex flex-col md:flex-row gap-4">
            {/* Recherche */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5" style={{ color: themeColors.textSecondary }} />
              <input
                type="text"
                placeholder={t('maintenance.filters.search')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-lg border transition-all focus:outline-none focus:ring-2"
                style={{
                  backgroundColor: themeColors.background,
                  borderColor: themeColors.cardBorder,
                  color: themeColors.textPrimary,
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = themeColors.purplePrimary
                  e.target.style.boxShadow = `0 0 0 3px ${themeColors.purplePrimary}20`
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = themeColors.cardBorder
                  e.target.style.boxShadow = 'none'
                }}
              />
            </div>

            {/* Filtre statut */}
            <div className="flex gap-2 flex-wrap">
              {(['all', 'active', 'maintenance', 'retired'] as VehicleStatus[]).map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className="px-4 py-2 rounded-lg text-sm font-medium transition-all hover:opacity-80"
                  style={
                    statusFilter === status
                      ? {
                          backgroundColor: themeColors.purplePrimary,
                          color: 'white',
                          boxShadow: `0 2px 8px ${themeColors.purplePrimary}40`,
                        }
                      : {
                          backgroundColor: '#F3F4F6',
                          color: themeColors.textSecondary,
                        }
                  }
                >
                  {status === 'all' ? t('maintenance.filters.all') : status === 'active' ? t('maintenance.filters.active') : status === 'maintenance' ? t('maintenance.filters.maintenance') : t('maintenance.filters.retired')}
                </button>
              ))}
            </div>

            {/* Filtre type */}
            <div className="flex gap-2 flex-wrap">
              {(['all', 'moto', 'vehicule', 'cargo'] as VehicleType[]).map((type) => (
                <button
                  key={type}
                  onClick={() => setTypeFilter(type)}
                  className="px-4 py-2 rounded-lg text-sm font-medium transition-all hover:opacity-80"
                  style={
                    typeFilter === type
                      ? {
                          backgroundColor: themeColors.purplePrimary,
                          color: 'white',
                          boxShadow: `0 2px 8px ${themeColors.purplePrimary}40`,
                        }
                      : {
                          backgroundColor: '#F3F4F6',
                          color: themeColors.textSecondary,
                        }
                  }
                >
                  {type === 'all' ? t('maintenance.filters.all') : type === 'moto' ? t('maintenance.filters.moto') : type === 'vehicule' ? t('maintenance.filters.vehicle') : t('maintenance.filters.cargo')}
                </button>
              ))}
            </div>
          </div>
        </AnimatedCard>

        {/* Liste des véhicules */}
        <AnimatedCard index={0} delay={0} style={{
          backgroundColor: themeColors.cardBg,
          borderRadius: '16px',
          padding: '0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          border: `1px solid ${themeColors.cardBorder}`,
          overflow: 'hidden',
        }}>
          {isLoading ? (
            <div className="p-6 space-y-4">
              <SkeletonLoader width="100%" height={60} borderRadius={8} />
              <SkeletonLoader width="100%" height={60} borderRadius={8} />
              <SkeletonLoader width="100%" height={60} borderRadius={8} />
              <SkeletonLoader width="100%" height={60} borderRadius={8} />
              <SkeletonLoader width="100%" height={60} borderRadius={8} />
            </div>
          ) : vehicles.length === 0 ? (
            <div className="p-12 text-center">
              <div style={{
                width: '80px',
                height: '80px',
                margin: '0 auto 16px',
                borderRadius: '50%',
                backgroundColor: '#F3F4F6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Car className="w-10 h-10" style={{ color: themeColors.textSecondary }} />
              </div>
              <p style={{
                fontSize: '18px',
                fontWeight: 600,
                color: themeColors.textPrimary,
                marginBottom: '8px',
              }}>
                {t('maintenance.table.noVehicles')}
              </p>
              <p style={{
                fontSize: '14px',
                color: themeColors.textSecondary,
              }}>
                {searchQuery || statusFilter !== 'all' || typeFilter !== 'all'
                  ? t('maintenance.table.tryFilters')
                  : t('maintenance.table.noVehiclesDesc')}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
                <thead>
                  <tr style={{
                    backgroundColor: '#F9FAFB',
                    borderBottom: `2px solid ${themeColors.cardBorder}`,
                  }}>
                    <th style={{
                      textAlign: 'left',
                      padding: '16px 20px',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: themeColors.textSecondary,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                    }}>
                      {t('maintenance.table.plate')}
                    </th>
                    <th style={{
                      textAlign: 'left',
                      padding: '16px 20px',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: themeColors.textSecondary,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                    }}>
                      {t('maintenance.table.type')}
                    </th>
                    <th style={{
                      textAlign: 'left',
                      padding: '16px 20px',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: themeColors.textSecondary,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                    }}>
                      {t('maintenance.table.vehicle')}
                    </th>
                    <th style={{
                      textAlign: 'left',
                      padding: '16px 20px',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: themeColors.textSecondary,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                    }}>
                      {t('maintenance.table.driver')}
                    </th>
                    <th style={{
                      textAlign: 'left',
                      padding: '16px 20px',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: themeColors.textSecondary,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                    }}>
                      {t('maintenance.table.odometer')}
                    </th>
                    <th style={{
                      textAlign: 'left',
                      padding: '16px 20px',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: themeColors.textSecondary,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                    }}>
                      {t('maintenance.table.status')}
                    </th>
                    <th style={{
                      textAlign: 'left',
                      padding: '16px 20px',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: themeColors.textSecondary,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                    }}>
                      {t('maintenance.table.actions')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {vehicles.map((vehicle) => (
                    <tr
                      key={vehicle.id}
                      style={{
                        borderBottom: `1px solid ${themeColors.cardBorder}`,
                        transition: 'background-color 0.2s',
                        cursor: 'pointer',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#F9FAFB'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent'
                      }}
                      onClick={() => router.push(`/maintenance/${encodeURIComponent(vehicle.vehicle_plate)}`)}
                    >
                      <td style={{ padding: '16px 20px' }}>
                        <span style={{
                          fontFamily: 'monospace',
                          fontWeight: 600,
                          fontSize: '14px',
                          color: themeColors.textPrimary,
                        }}>
                          {vehicle.vehicle_plate}
                        </span>
                      </td>
                      <td style={{ padding: '16px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {getVehicleTypeIcon(vehicle.vehicle_type)}
                          <span style={{
                            fontSize: '14px',
                            textTransform: 'capitalize',
                            color: themeColors.textPrimary,
                          }}>
                            {vehicle.vehicle_type}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: '16px 20px' }}>
                        <div style={{ fontSize: '14px', color: themeColors.textPrimary }}>
                          {vehicle.vehicle_brand && vehicle.vehicle_model
                            ? `${vehicle.vehicle_brand} ${vehicle.vehicle_model}`
                            : vehicle.vehicle_brand || vehicle.vehicle_model || '-'}
                          {vehicle.vehicle_color && (
                            <span style={{
                              fontSize: '12px',
                              marginLeft: '8px',
                              color: themeColors.textSecondary,
                            }}>
                              ({vehicle.vehicle_color})
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '16px 20px' }}>
                        {vehicle.driver_first_name || vehicle.driver_last_name ? (
                          <div style={{ fontSize: '14px', color: themeColors.textPrimary }}>
                            {vehicle.driver_first_name} {vehicle.driver_last_name}
                          </div>
                        ) : (
                          <span style={{
                            fontSize: '14px',
                            color: themeColors.textSecondary,
                            fontStyle: 'italic',
                          }}>
                            {t('maintenance.table.noDriver')}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '16px 20px' }}>
                        <span style={{
                          fontSize: '14px',
                          fontFamily: 'monospace',
                          color: themeColors.textPrimary,
                        }}>
                          {formatOdometer(vehicle.current_odometer)} km
                        </span>
                      </td>
                      <td style={{ padding: '16px 20px' }}>
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${getStatusColor(vehicle.status)}`}
                        >
                          {vehicle.status === 'active' ? t('maintenance.filters.active') : vehicle.status === 'maintenance' ? t('maintenance.filters.maintenance') : vehicle.status === 'retired' ? t('maintenance.filters.retired') : 'Réservé'}
                        </span>
                      </td>
                      <td style={{ padding: '16px 20px' }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            router.push(`/maintenance/${encodeURIComponent(vehicle.vehicle_plate)}`)
                          }}
                          style={{
                            fontSize: '13px',
                            fontWeight: 500,
                            padding: '6px 16px',
                            borderRadius: '8px',
                            backgroundColor: themeColors.purplePrimary,
                            color: 'white',
                            border: 'none',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            boxShadow: `0 2px 4px ${themeColors.purplePrimary}30`,
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.opacity = '0.9'
                            e.currentTarget.style.transform = 'translateY(-1px)'
                            e.currentTarget.style.boxShadow = `0 4px 8px ${themeColors.purplePrimary}40`
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.opacity = '1'
                            e.currentTarget.style.transform = 'translateY(0)'
                            e.currentTarget.style.boxShadow = `0 2px 4px ${themeColors.purplePrimary}30`
                          }}
                        >
                          {t('maintenance.table.viewDetails')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </AnimatedCard>
      </div>
    </ScreenTransition>
  )
}

