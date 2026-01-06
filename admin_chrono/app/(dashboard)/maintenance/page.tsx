'use client'

import React, { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { Search, Car, CarFront, Truck, Package, AlertTriangle, TrendingUp, Gauge, Wrench } from 'lucide-react'
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

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  }

  const headerRowStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  }

  const titleStyle: React.CSSProperties = {
    fontSize: '24px',
    fontWeight: 700,
    color: themeColors.textPrimary,
  }

  const subtitleStyle: React.CSSProperties = {
    fontSize: '14px',
    color: themeColors.textSecondary,
    marginTop: '4px',
  }

  const filtersContainerStyle: React.CSSProperties = {
    display: 'flex',
    gap: '16px',
    alignItems: 'center',
    flexWrap: 'wrap',
  }

  const searchContainerStyle: React.CSSProperties = {
    position: 'relative',
    flex: 1,
    minWidth: '250px',
  }

  const searchInputStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px 16px 12px 44px',
    borderRadius: '12px',
    border: `1px solid ${themeColors.cardBorder}`,
    fontSize: '14px',
    backgroundColor: themeColors.cardBg,
    color: themeColors.textPrimary,
    outline: 'none',
    transition: 'all 0.2s',
  }

  const selectStyle: React.CSSProperties = {
    padding: '10px 16px',
    paddingRight: '40px',
    borderRadius: '8px',
    border: `1px solid ${themeColors.cardBorder}`,
    backgroundColor: themeColors.cardBg,
    color: themeColors.textPrimary,
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer',
    outline: 'none',
    appearance: 'none',
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%236B7280' d='M6 9L1 4h10z'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 12px center',
    transition: 'all 0.2s',
  }

  return (
    <ScreenTransition>
      <div style={containerStyle}>
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
            icon={CarFront}
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
        <div style={filtersContainerStyle}>
            {/* Recherche */}
            <div style={searchContainerStyle}>
              <Search
                size={20}
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: themeColors.textTertiary,
                  pointerEvents: 'none',
                }}
              />
              <input
                type="text"
                placeholder={t('maintenance.filters.search')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={searchInputStyle}
              />
            </div>

            {/* Filtre statut */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as VehicleStatus)}
              style={selectStyle}
            >
              <option value="all">Tous les statuts</option>
              <option value="active">{t('maintenance.filters.active')}</option>
              <option value="maintenance">{t('maintenance.filters.maintenance')}</option>
              <option value="retired">{t('maintenance.filters.retired')}</option>
            </select>

            {/* Filtre type */}
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as VehicleType)}
              style={selectStyle}
            >
              <option value="all">Tous les types</option>
              <option value="moto">{t('maintenance.filters.moto')}</option>
              <option value="vehicule">{t('maintenance.filters.vehicule')}</option>
              <option value="cargo">{t('maintenance.filters.cargo')}</option>
            </select>
        </div>

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

