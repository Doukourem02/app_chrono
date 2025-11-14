'use client'

import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter, useParams } from 'next/navigation'
import { adminApiService } from '@/lib/adminApiService'
import {
  ArrowLeft,
  User,
  Mail,
  Phone,
  Calendar,
  Truck,
  TrendingUp,
  DollarSign,
  Clock,
  Star,
  MapPin,
  Power,
  Package,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
} from 'recharts'

export default function UserDetailsPage() {
  const router = useRouter()
  const params = useParams()
  const userId = params?.userId as string
  const queryClient = useQueryClient()

  const { data: userData, isLoading } = useQuery({
    queryKey: ['user-details', userId],
    queryFn: async () => {
      // Détecter le type d'utilisateur en récupérant d'abord les infos de base
      const usersResult = await adminApiService.getUsers()
      const user = usersResult.data?.find((u: any) => u.id === userId)
      
      if (!user) return null

      if (user.role === 'driver') {
        return await adminApiService.getDriverDetails(userId)
      } else if (user.role === 'client') {
        return await adminApiService.getClientDetails(userId)
      }
      return null
    },
    enabled: !!userId,
  })

  const updateStatusMutation = useMutation({
    mutationFn: async (isActive: boolean) => {
      return await adminApiService.updateDriverStatus(userId, isActive)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-details', userId] })
    },
  })

  const formatCurrency = (amount: number) => {
    return `${amount.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} FCFA`
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A'
    const date = new Date(dateString)
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    })
  }

  const user = userData?.data
  const isDriver = user?.profile !== undefined
  const isClient = !isDriver && user?.statistics

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  }

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: '16px',
  }

  const backButtonStyle: React.CSSProperties = {
    padding: '8px',
    borderRadius: '8px',
    border: '1px solid #E5E7EB',
    backgroundColor: '#FFFFFF',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  }

  const titleStyle: React.CSSProperties = {
    fontSize: '28px',
    fontWeight: 700,
    color: '#111827',
  }

  const cardStyle: React.CSSProperties = {
    backgroundColor: '#FFFFFF',
    borderRadius: '12px',
    padding: '24px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    border: '1px solid #F3F4F6',
  }

  const profileHeaderStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: '20px',
    marginBottom: '24px',
    paddingBottom: '24px',
    borderBottom: '1px solid #E5E7EB',
  }

  const avatarStyle: React.CSSProperties = {
    width: '80px',
    height: '80px',
    borderRadius: '50%',
    backgroundColor: '#8B5CF6',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#FFFFFF',
    fontSize: '32px',
    fontWeight: 700,
  }

  const infoGridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '16px',
    marginBottom: '24px',
  }

  const infoItemStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: '12px',
  }

  const statsGridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '16px',
    marginBottom: '24px',
  }

  const statCardStyle: React.CSSProperties = {
    padding: '16px',
    borderRadius: '12px',
    backgroundColor: '#F9FAFB',
    border: '1px solid #E5E7EB',
  }

  const statValueStyle: React.CSSProperties = {
    fontSize: '24px',
    fontWeight: 700,
    color: '#111827',
    marginBottom: '4px',
  }

  const statLabelStyle: React.CSSProperties = {
    fontSize: '14px',
    color: '#6B7280',
  }

  if (isLoading) {
    return (
      <div style={containerStyle}>
        <div style={{ textAlign: 'center', padding: '40px' }}>Chargement...</div>
      </div>
    )
  }

  if (!user) {
    return (
      <div style={containerStyle}>
        <div style={{ textAlign: 'center', padding: '40px', color: '#6B7280' }}>
          Utilisateur non trouvé
        </div>
      </div>
    )
  }

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <button
          onClick={() => router.back()}
          style={backButtonStyle}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#F9FAFB'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#FFFFFF'
          }}
        >
          <ArrowLeft size={20} style={{ color: '#374151' }} />
        </button>
        <h1 style={titleStyle}>
          {isDriver ? 'Détails Driver' : isClient ? 'Détails Client' : 'Détails Utilisateur'}
        </h1>
      </div>

      {/* Profil */}
      <div style={cardStyle}>
        <div style={profileHeaderStyle}>
          <div style={avatarStyle}>
            {user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt="Avatar"
                style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
              />
            ) : (
              (user.email?.[0] || 'U').toUpperCase()
            )}
          </div>
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: '24px', fontWeight: 700, color: '#111827', marginBottom: '8px' }}>
              {user.email}
            </h2>
            <div style={infoGridStyle}>
              <div style={infoItemStyle}>
                <Mail size={16} style={{ color: '#6B7280' }} />
                <span style={{ fontSize: '14px', color: '#374151' }}>{user.email}</span>
              </div>
              {user.phone && (
                <div style={infoItemStyle}>
                  <Phone size={16} style={{ color: '#6B7280' }} />
                  <span style={{ fontSize: '14px', color: '#374151' }}>{user.phone}</span>
                </div>
              )}
              <div style={infoItemStyle}>
                <Calendar size={16} style={{ color: '#6B7280' }} />
                <span style={{ fontSize: '14px', color: '#374151' }}>
                  Inscrit le {formatDate(user.createdAt)}
                </span>
              </div>
            </div>
          </div>
          {isDriver && user.profile && (
            <button
              onClick={() => {
                const newStatus = !user.profile.isOnline
                updateStatusMutation.mutate(newStatus)
              }}
              disabled={updateStatusMutation.isPending}
              style={{
                padding: '10px 20px',
                borderRadius: '8px',
                backgroundColor: user.profile.isOnline ? '#10B981' : '#6B7280',
                color: '#FFFFFF',
                border: 'none',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <Power size={16} />
              {user.profile.isOnline ? 'En ligne' : 'Hors ligne'}
            </button>
          )}
        </div>

        {/* Informations du profil driver */}
        {isDriver && user.profile && (
          <div style={{ marginBottom: '24px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px', color: '#111827' }}>
              Informations du véhicule
            </h3>
            <div style={infoGridStyle}>
              <div style={infoItemStyle}>
                <Truck size={16} style={{ color: '#6B7280' }} />
                <div>
                  <div style={{ fontSize: '12px', color: '#6B7280' }}>Type de véhicule</div>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>
                    {user.profile.vehicleType || 'N/A'}
                  </div>
                </div>
              </div>
              {user.profile.vehiclePlate && (
                <div style={infoItemStyle}>
                  <Truck size={16} style={{ color: '#6B7280' }} />
                  <div>
                    <div style={{ fontSize: '12px', color: '#6B7280' }}>Plaque</div>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>
                      {user.profile.vehiclePlate}
                    </div>
                  </div>
                </div>
              )}
              {user.profile.currentLatitude && user.profile.currentLongitude && (
                <div style={infoItemStyle}>
                  <MapPin size={16} style={{ color: '#6B7280' }} />
                  <div>
                    <div style={{ fontSize: '12px', color: '#6B7280' }}>Position</div>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>
                      {user.profile.currentLatitude.toFixed(4)}, {user.profile.currentLongitude.toFixed(4)}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Statistiques */}
        {user.statistics && (
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px', color: '#111827' }}>
              Statistiques
            </h3>
            <div style={statsGridStyle}>
              {isDriver ? (
                <>
                  <div style={statCardStyle}>
                    <div style={statValueStyle}>{user.statistics.totalDeliveries || 0}</div>
                    <div style={statLabelStyle}>Livraisons totales</div>
                  </div>
                  <div style={statCardStyle}>
                    <div style={statValueStyle}>{user.statistics.todayDeliveries || 0}</div>
                    <div style={statLabelStyle}>Aujourd'hui</div>
                  </div>
                  <div style={statCardStyle}>
                    <div style={statValueStyle}>{user.statistics.weekDeliveries || 0}</div>
                    <div style={statLabelStyle}>Cette semaine</div>
                  </div>
                  <div style={statCardStyle}>
                    <div style={statValueStyle}>
                      {formatCurrency(user.statistics.totalRevenue || 0)}
                    </div>
                    <div style={statLabelStyle}>Revenus totaux</div>
                  </div>
                  <div style={statCardStyle}>
                    <div style={statValueStyle}>
                      {formatCurrency(user.statistics.averageRevenuePerDelivery || 0)}
                    </div>
                    <div style={statLabelStyle}>Moyenne par livraison</div>
                  </div>
                  <div style={statCardStyle}>
                    <div style={statValueStyle}>
                      {user.statistics.averageDeliveryTime || 0} min
                    </div>
                    <div style={statLabelStyle}>Temps moyen</div>
                  </div>
                  <div style={statCardStyle}>
                    <div style={statValueStyle}>
                      {(user.statistics.totalDistance || 0).toFixed(1)} km
                    </div>
                    <div style={statLabelStyle}>Distance totale</div>
                  </div>
                  <div style={statCardStyle}>
                    <div style={statValueStyle}>
                      {user.statistics.averageRating?.toFixed(1) || 'N/A'} ⭐
                    </div>
                    <div style={statLabelStyle}>
                      Rating ({user.statistics.totalRatings || 0} évaluations)
                    </div>
                  </div>
                  <div style={statCardStyle}>
                    <div style={statValueStyle}>
                      {user.statistics.acceptanceRate?.toFixed(1) || 0}%
                    </div>
                    <div style={statLabelStyle}>Taux d'acceptation</div>
                  </div>
                </>
              ) : (
                <>
                  <div style={statCardStyle}>
                    <div style={statValueStyle}>{user.statistics.totalOrders || 0}</div>
                    <div style={statLabelStyle}>Commandes totales</div>
                  </div>
                  <div style={statCardStyle}>
                    <div style={statValueStyle}>{user.statistics.weekOrders || 0}</div>
                    <div style={statLabelStyle}>Cette semaine</div>
                  </div>
                  <div style={statCardStyle}>
                    <div style={statValueStyle}>{user.statistics.monthOrders || 0}</div>
                    <div style={statLabelStyle}>Ce mois</div>
                  </div>
                  <div style={statCardStyle}>
                    <div style={statValueStyle}>{user.statistics.completedOrders || 0}</div>
                    <div style={statLabelStyle}>Complétées</div>
                  </div>
                  <div style={statCardStyle}>
                    <div style={statValueStyle}>
                      {formatCurrency(user.statistics.totalSpent || 0)}
                    </div>
                    <div style={statLabelStyle}>Total dépensé</div>
                  </div>
                  {user.statistics.loyaltyPoints !== undefined && (
                    <div style={statCardStyle}>
                      <div style={statValueStyle}>{user.statistics.loyaltyPoints || 0}</div>
                      <div style={statLabelStyle}>Points de fidélité</div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

