'use client'

import React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter, useParams } from 'next/navigation'
import Image from 'next/image'
import { adminApiService } from '@/lib/adminApiService'
import {
  ArrowLeft,
  Mail,
  Phone,
  Calendar,
  Truck,
  MapPin,
  Power,
  User,
  Shield,
  CreditCard,
  Download,
} from 'lucide-react'
import { exportData } from '@/utils/exportUtils'

interface User {
  id: string
  role?: string
  email?: string
  phone?: string
  first_name?: string | null
  last_name?: string | null
  avatarUrl?: string
  avatar_url?: string | null
  createdAt?: string
  created_at?: string
  [key: string]: unknown
}

interface UserProfile {
  isOnline?: boolean
  isAvailable?: boolean
  vehicleType?: string
  vehiclePlate?: string
  vehicleBrand?: string
  vehicleModel?: string
  vehicleColor?: string
  licenseNumber?: string
  currentLatitude?: number
  currentLongitude?: number
  lastLocationUpdate?: string
  [key: string]: unknown
}

interface UserStatistics {
  totalDeliveries?: number
  todayDeliveries?: number
  weekDeliveries?: number
  cancelledDeliveries?: number
  totalRevenue?: number
  averageRevenuePerDelivery?: number
  averageDeliveryTime?: number
  totalDistance?: number
  averageRating?: number
  totalRatings?: number
  acceptanceRate?: number
  totalOrders?: number
  weekOrders?: number
  monthOrders?: number
  completedOrders?: number
  totalSpent?: number
  loyaltyPoints?: number
  [key: string]: unknown
}

interface PendingPaymentOrder {
  orderId: string
  orderCreatedAt: string
  orderStatus: string
  orderAmount: number
  transactionId: string
  transactionAmount: number
  partialAmount: number
  remainingAmount: number
  isPartial: boolean
  paymentMethodType: string
  transactionStatus: string
  transactionCreatedAt: string
  client: {
    id: string
    firstName?: string | null
    lastName?: string | null
    email?: string | null
    phone?: string | null
  }
}

interface RecentOrder {
  id: string
  status: string
  createdAt: string
  acceptedAt?: string | null
  completedAt?: string | null
  cancelledAt?: string | null
  price: number
  distance: number
  deliveryMethod?: string
  client: {
    id: string
    firstName?: string | null
    lastName?: string | null
    email?: string | null
  }
  payment?: {
    status: 'paid' | 'partial' | 'pending' | 'none'
    partialAmount: number
    remainingAmount: number
    transactionStatus?: string | null
  }
}

interface DeferredPaymentTransaction {
  id: string
  orderId: string
  amount: number
  partialAmount: number
  remainingAmount: number
  isPartial: boolean
  paymentMethodType: string
  status: string
  createdAt: string
}

interface DeferredPayments {
  totalPaid: number
  totalRemaining: number
  totalDue: number
  globalStatus: 'paid' | 'partially_paid' | 'unpaid'
  transactions: DeferredPaymentTransaction[]
}

interface UserDetails {
  id?: string
  role?: string
  email?: string
  phone?: string
  first_name?: string | null
  last_name?: string | null
  avatarUrl?: string
  createdAt?: string
  profile?: UserProfile
  statistics?: UserStatistics
  deferredPayments?: DeferredPayments
  pendingPaymentOrders?: PendingPaymentOrder[]
  recentOrders?: RecentOrder[]
  [key: string]: unknown
}

export default function UserDetailsPage() {
  const router = useRouter()
  const params = useParams()
  const userId = params?.userId as string
  const queryClient = useQueryClient()

  const { data: userData, isLoading } = useQuery({
    queryKey: ['user-details', userId],
    queryFn: async (): Promise<{ data: UserDetails } | null> => {
      if (!userId) return null

      // D'abord, récupérer les infos de base depuis la liste des utilisateurs pour connaître le rôle
      let user: User | undefined
      try {
        const usersResult = await adminApiService.getUsers()
        const users: User[] = (usersResult.data as User[]) || []
        user = users.find((u: User) => u.id === userId)
      } catch (error) {
        console.error('[UserDetails] Error fetching users list:', error)
      }

      // Si on a trouvé l'utilisateur, essayer de récupérer les détails selon son rôle
      if (user) {
        if (user.role === 'driver') {
          try {
            const driverResult = await adminApiService.getDriverDetails(userId)
            if (driverResult.success && driverResult.data) {
              return driverResult as { data: UserDetails }
            }
          } catch (error) {
            console.warn('[UserDetails] Error fetching driver details, using basic info:', error)
          }
          // Si les détails du driver échouent, utiliser les infos de base
        } else if (user.role === 'client') {
          try {
            const clientResult = await adminApiService.getClientDetails(userId)
            if (clientResult.success && clientResult.data) {
              return clientResult as { data: UserDetails }
            }
          } catch (error) {
            console.warn('[UserDetails] Error fetching client details, using basic info:', error)
          }
          // Si les détails du client échouent, utiliser les infos de base
        }

        // Pour les admins ou si les détails spécifiques ont échoué, retourner les informations de base
        return {
          data: {
            id: user.id,
            role: user.role,
            email: user.email,
            phone: user.phone,
            first_name: user.first_name,
            last_name: user.last_name,
            avatarUrl: user.avatarUrl || user.avatar_url || (user as { avatar_url?: string | null }).avatar_url || null,
            createdAt: user.createdAt || (user as { created_at?: string }).created_at || (user as { createdAt?: string }).createdAt,
          } as UserDetails
        }
      }

      // Si l'utilisateur n'a pas été trouvé dans la liste, essayer quand même les endpoints spécifiques
      try {
        const driverResult = await adminApiService.getDriverDetails(userId)
        if (driverResult.success && driverResult.data) {
          return driverResult as { data: UserDetails }
        }
      } catch {
        // Ignorer
      }

      try {
        const clientResult = await adminApiService.getClientDetails(userId)
        if (clientResult.success && clientResult.data) {
          return clientResult as { data: UserDetails }
        }
      } catch {
        // Ignorer
      }

      // Si rien n'a fonctionné, retourner null
      return null
    },
    enabled: !!userId,
    staleTime: Infinity, // Les données ne deviennent jamais "stale" - pas de refetch automatique
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchInterval: false,
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

  const formatDate = (dateString: string | undefined | null) => {
    if (!dateString) return 'N/A'
    
    // Si c'est au format "JJ/MM/AAAA" (retourné par le backend)
    if (dateString.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
      const [day, month, year] = dateString.split('/')
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
      if (!isNaN(date.getTime())) {
        return date.toLocaleDateString('fr-FR', {
          day: '2-digit',
          month: 'long',
          year: 'numeric',
        })
      }
    }
    
    // Sinon, essayer de parser comme date ISO ou autre format
    const date = new Date(dateString)
    if (isNaN(date.getTime())) {
      return 'N/A'
    }
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    })
  }

  const user: UserDetails | undefined = userData?.data
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin'
  const isDriver = user?.role === 'driver' || user?.profile !== undefined
  const isClient = user?.role === 'client' || (!isDriver && !isAdmin && user?.statistics)

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
    overflow: 'hidden',
    position: 'relative',
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

  const handleExport = () => {
    if (!user) return

    const userName = (user.first_name && user.last_name)
      ? `${user.first_name} ${user.last_name}`
      : user.email || 'Utilisateur'

    if (isClient) {
      // Export pour client
      const headers = ['Information', 'Valeur']
      const rows: (string | number)[][] = [
        ['Nom', user.last_name || 'N/A'],
        ['Prénom', user.first_name || 'N/A'],
        ['Email', user.email || 'N/A'],
        ['Téléphone', user.phone || 'N/A'],
        ['Date d\'inscription', user.createdAt ? formatDate(user.createdAt) : 'N/A'],
        ['', ''],
        ['STATISTIQUES', ''],
        ['Total commandes', user.statistics?.totalOrders || 0],
        ['Commandes cette semaine', user.statistics?.weekOrders || 0],
        ['Commandes ce mois', user.statistics?.monthOrders || 0],
        ['Commandes complétées', user.statistics?.completedOrders || 0],
        ['Total dépensé', formatCurrency(user.statistics?.totalSpent || 0)],
        ['Points de fidélité', user.statistics?.loyaltyPoints || 0],
      ]

      // Ajouter les paiements différés si disponibles
      if (user.deferredPayments) {
        rows.push(['', ''])
        rows.push(['PAIEMENTS DIFFÉRÉS', ''])
        rows.push(['Montant total payé', formatCurrency(user.deferredPayments.totalPaid || 0)])
        rows.push(['Montant total restant', formatCurrency(user.deferredPayments.totalRemaining || 0)])
        rows.push(['Total dû', formatCurrency(user.deferredPayments.totalDue || 0)])
        rows.push(['Statut global', 
          user.deferredPayments.globalStatus === 'paid' 
            ? 'Payé' 
            : user.deferredPayments.globalStatus === 'partially_paid'
            ? 'Partiellement payé'
            : 'Non payé'
        ])

        // Ajouter l'historique des transactions
        if (user.deferredPayments.transactions && user.deferredPayments.transactions.length > 0) {
          rows.push(['', ''])
          rows.push(['HISTORIQUE DES TRANSACTIONS', ''])
          rows.push(['ID Commande', 'Montant total', 'Payé', 'Restant', 'Statut', 'Date'])
          user.deferredPayments.transactions.forEach((tx) => {
            rows.push([
              tx.orderId ? tx.orderId.slice(0, 8) + '...' : 'N/A',
              formatCurrency(tx.amount),
              formatCurrency(tx.partialAmount),
              formatCurrency(tx.remainingAmount),
              tx.status === 'paid' 
                ? 'Payé' 
                : tx.status === 'pending'
                ? 'En attente'
                : tx.status === 'delayed'
                ? 'Différé'
                : tx.status,
              formatDate(tx.createdAt),
            ])
          })
        }
      }

      exportData({
        title: `Détails Client - ${userName}`,
        headers,
        rows,
        filename: `details_client_${user.id?.slice(0, 8) || 'unknown'}_${new Date().toISOString().split('T')[0]}`,
      })
    } else if (isDriver) {
      // Export pour driver
      const headers = ['Information', 'Valeur']
      const rows: (string | number)[][] = [
        ['Nom', user.last_name || 'N/A'],
        ['Prénom', user.first_name || 'N/A'],
        ['Email', user.email || 'N/A'],
        ['Téléphone', user.phone || 'N/A'],
        ['Date d\'inscription', user.createdAt ? formatDate(user.createdAt) : 'N/A'],
        ['', ''],
        ['INFORMATIONS VÉHICULE', ''],
        ['Type de véhicule', user.profile?.vehicleType || 'N/A'],
        ['Plaque d\'immatriculation', user.profile?.vehiclePlate || 'N/A'],
        ['Marque', user.profile?.vehicleBrand || 'N/A'],
        ['Modèle', user.profile?.vehicleModel || 'N/A'],
        ['Couleur', user.profile?.vehicleColor || 'N/A'],
        ['Numéro de permis', user.profile?.licenseNumber || 'N/A'],
        ['Statut', user.profile?.isOnline ? 'En ligne' : 'Hors ligne'],
        ['Disponibilité', user.profile?.isAvailable ? 'Disponible' : 'Occupé'],
        ['', ''],
        ['STATISTIQUES', ''],
        ['Livraisons totales', user.statistics?.totalDeliveries || 0],
        ['Livraisons aujourd\'hui', user.statistics?.todayDeliveries || 0],
        ['Livraisons cette semaine', user.statistics?.weekDeliveries || 0],
        ['Revenus totaux', formatCurrency(user.statistics?.totalRevenue || 0)],
        ['Moyenne par livraison', formatCurrency(user.statistics?.averageRevenuePerDelivery || 0)],
        ['Temps moyen', `${user.statistics?.averageDeliveryTime || 0} min`],
        ['Distance totale', `${(user.statistics?.totalDistance || 0).toFixed(1)} km`],
        ['Note moyenne', `${user.statistics?.averageRating?.toFixed(1) || 'N/A'} ⭐`],
        ['Taux d\'acceptation', `${user.statistics?.acceptanceRate?.toFixed(1) || 0}%`],
        ['Livraisons annulées', user.statistics?.cancelledDeliveries || 0],
      ]

      // Ajouter les courses en attente de paiement si disponibles
      if (user.pendingPaymentOrders && user.pendingPaymentOrders.length > 0) {
        rows.push(['', ''])
        rows.push(['COURSES EN ATTENTE DE PAIEMENT', ''])
        rows.push(['Numéro de commande', 'Client', 'Montant payé', 'Montant restant', 'Statut', 'Date'])
        user.pendingPaymentOrders.forEach((order) => {
          const clientName = (order.client.firstName && order.client.lastName)
            ? `${order.client.firstName} ${order.client.lastName}`
            : order.client.email || 'N/A'
          rows.push([
            order.orderId ? order.orderId.slice(0, 8) + '...' : 'N/A',
            clientName,
            formatCurrency(order.partialAmount),
            formatCurrency(order.remainingAmount),
            'En attente du client',
            formatDate(order.orderCreatedAt),
          ])
        })
      }

      // Ajouter l'historique des courses si disponible
      if (user.recentOrders && user.recentOrders.length > 0) {
        rows.push(['', ''])
        rows.push(['HISTORIQUE DES COURSES', ''])
        rows.push(['ID Commande', 'Client', 'Montant', 'Distance', 'Statut', 'Date'])
        user.recentOrders.forEach((order) => {
          const clientName = (order.client.firstName && order.client.lastName)
            ? `${order.client.firstName} ${order.client.lastName}`
            : order.client.email || 'N/A'
          const statusLabel = order.status === 'completed' ? 'Livré'
            : order.status === 'cancelled' ? 'Annulé'
            : order.status === 'declined' ? 'Refusé'
            : order.status === 'pending' ? 'En attente'
            : order.status === 'accepted' ? 'Accepté'
            : order.status === 'enroute' ? 'En route'
            : order.status === 'picked_up' ? 'Récupéré'
            : order.status
          const displayDate = order.completedAt || order.cancelledAt || order.acceptedAt || order.createdAt
          rows.push([
            order.id ? order.id.slice(0, 8) + '...' : 'N/A',
            clientName,
            formatCurrency(order.price),
            order.distance ? `${order.distance.toFixed(1)} km` : 'N/A',
            statusLabel,
            displayDate ? formatDate(displayDate) : 'N/A',
          ])
        })
      }

      exportData({
        title: `Détails Livreur - ${userName}`,
        headers,
        rows,
        filename: `details_livreur_${user.id?.slice(0, 8) || 'unknown'}_${new Date().toISOString().split('T')[0]}`,
      })
    } else if (isAdmin) {
      // Export pour admin
      const headers = ['Information', 'Valeur']
      const rows: (string | number)[][] = [
        ['Nom', user.last_name || 'N/A'],
        ['Prénom', user.first_name || 'N/A'],
        ['Email', user.email || 'N/A'],
        ['Téléphone', user.phone || 'N/A'],
        ['Rôle', user.role === 'super_admin' ? 'Super Administrateur' : 'Administrateur'],
        ['Date d\'inscription', user.createdAt ? formatDate(user.createdAt) : 'N/A'],
      ]

      exportData({
        title: `Détails Admin - ${userName}`,
        headers,
        rows,
        filename: `details_admin_${user.id?.slice(0, 8) || 'unknown'}_${new Date().toISOString().split('T')[0]}`,
      })
    }
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
          {isDriver ? 'Détails Livreur' : isClient ? 'Détails Client' : isAdmin ? 'Détails Admin' : 'Détails Livreur'}
        </h1>
        <button
          onClick={handleExport}
          style={{
            padding: '10px 20px',
            borderRadius: '8px',
            backgroundColor: '#8B5CF6',
            color: '#FFFFFF',
            border: 'none',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#7C3AED'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#8B5CF6'
          }}
        >
          <Download size={16} />
          Exporter
        </button>
      </div>

      {/* Profil */}
      <div style={cardStyle}>
        <div style={profileHeaderStyle}>
          <div style={{
            ...avatarStyle,
            backgroundColor: user.avatarUrl ? 'transparent' : avatarStyle.backgroundColor,
          }}>
            {user.avatarUrl ? (
              <Image
                src={user.avatarUrl}
                alt="Avatar"
                width={80}
                height={80}
                style={{ 
                  width: '100%', 
                  height: '100%', 
                  borderRadius: '50%', 
                  objectFit: 'cover',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                }}
              />
            ) : (
              (user.first_name && user.last_name)
                ? `${(user.first_name[0] || '').toUpperCase()}${(user.last_name[0] || '').toUpperCase()}`
                : (user.email?.[0] || 'U').toUpperCase()
            )}
          </div>
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: '24px', fontWeight: 700, color: '#111827', marginBottom: '8px' }}>
              {(user.first_name && user.last_name)
                ? `${user.first_name} ${user.last_name}`
                : user.email || 'Utilisateur'}
            </h2>
          </div>
          {isDriver && user.profile && (
            <button
              onClick={() => {
                if (!user.profile) return
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

        {/* Section Informations générales - pour tous les utilisateurs */}
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px', color: '#111827' }}>
            Informations générales
          </h3>
          <div style={infoGridStyle}>
            {user.last_name && (
              <div style={infoItemStyle}>
                <User size={16} style={{ color: '#6B7280' }} />
                <div>
                  <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '4px' }}>Nom</div>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>
                    {user.last_name}
                  </div>
                </div>
              </div>
            )}
            {user.first_name && (
              <div style={infoItemStyle}>
                <User size={16} style={{ color: '#6B7280' }} />
                <div>
                  <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '4px' }}>Prénom</div>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>
                    {user.first_name}
                  </div>
                </div>
              </div>
            )}
            <div style={infoItemStyle}>
              <Mail size={16} style={{ color: '#6B7280' }} />
              <div>
                <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '4px' }}>Email</div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>{user.email}</div>
              </div>
            </div>
            {user.phone && (
              <div style={infoItemStyle}>
                <Phone size={16} style={{ color: '#6B7280' }} />
                <div>
                  <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '4px' }}>Téléphone</div>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>{user.phone}</div>
                </div>
              </div>
            )}
            {isDriver && user.profile && (
              <>
                <div style={infoItemStyle}>
                  <Power size={16} style={{ color: '#6B7280' }} />
                  <div>
                    <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '4px' }}>Statut</div>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>
                      {user.profile.isOnline ? 'En ligne' : 'Hors ligne'}
                    </div>
                  </div>
                </div>
                <div style={infoItemStyle}>
                  <Power size={16} style={{ color: '#6B7280' }} />
                  <div>
                    <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '4px' }}>Disponibilité</div>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>
                      {user.profile.isAvailable ? 'Disponible' : 'En livraison'}
                    </div>
                  </div>
                </div>
              </>
            )}
            <div style={infoItemStyle}>
              <Calendar size={16} style={{ color: '#6B7280' }} />
              <div>
                <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '4px' }}>Date d&apos;inscription</div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>
                  {user.createdAt ? formatDate(user.createdAt) : 'N/A'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Informations du profil driver */}
        {isDriver && user.profile && (
          <>
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
                {user.profile?.vehiclePlate && (
                  <div style={infoItemStyle}>
                    <Truck size={16} style={{ color: '#6B7280' }} />
                    <div>
                      <div style={{ fontSize: '12px', color: '#6B7280' }}>Plaque d&apos;immatriculation</div>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>
                        {user.profile.vehiclePlate}
                      </div>
                    </div>
                  </div>
                )}
                {user.profile?.vehicleBrand && (
                  <div style={infoItemStyle}>
                    <Truck size={16} style={{ color: '#6B7280' }} />
                    <div>
                      <div style={{ fontSize: '12px', color: '#6B7280' }}>Marque</div>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>
                        {user.profile.vehicleBrand}
                      </div>
                    </div>
                  </div>
                )}
                {user.profile?.vehicleModel && (
                  <div style={infoItemStyle}>
                    <Truck size={16} style={{ color: '#6B7280' }} />
                    <div>
                      <div style={{ fontSize: '12px', color: '#6B7280' }}>Modèle</div>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>
                        {user.profile.vehicleModel}
                      </div>
                    </div>
                  </div>
                )}
                {user.profile?.vehicleColor && (
                  <div style={infoItemStyle}>
                    <Truck size={16} style={{ color: '#6B7280' }} />
                    <div>
                      <div style={{ fontSize: '12px', color: '#6B7280' }}>Couleur</div>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>
                        {user.profile.vehicleColor}
                      </div>
                    </div>
                  </div>
                )}
                {user.profile?.licenseNumber && (
                  <div style={infoItemStyle}>
                    <Truck size={16} style={{ color: '#6B7280' }} />
                    <div>
                      <div style={{ fontSize: '12px', color: '#6B7280' }}>Numéro de permis</div>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>
                        {user.profile.licenseNumber}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            {(user.profile.currentLatitude && user.profile.currentLongitude) || user.profile.lastLocationUpdate ? (
              <div style={{ marginBottom: '24px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px', color: '#111827' }}>
                  Localisation
                </h3>
                <div style={infoGridStyle}>
                  {user.profile.currentLatitude && user.profile.currentLongitude && (
                    <div style={infoItemStyle}>
                      <MapPin size={16} style={{ color: '#6B7280' }} />
                      <div>
                        <div style={{ fontSize: '12px', color: '#6B7280' }}>Position actuelle</div>
                        <div style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>
                          {user.profile.currentLatitude.toFixed(4)}, {user.profile.currentLongitude.toFixed(4)}
                        </div>
                      </div>
                    </div>
                  )}
                  {user.profile.lastLocationUpdate && (
                    <div style={infoItemStyle}>
                      <Calendar size={16} style={{ color: '#6B7280' }} />
                      <div>
                        <div style={{ fontSize: '12px', color: '#6B7280' }}>Dernière mise à jour</div>
                        <div style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>
                          {formatDate(user.profile.lastLocationUpdate)}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </>
        )}

        {/* Informations pour les admins */}
        {isAdmin && (
          <div style={{ marginBottom: '24px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px', color: '#111827' }}>
              Informations administratives
            </h3>
            <div style={infoGridStyle}>
              <div style={infoItemStyle}>
                <Shield size={16} style={{ color: '#6B7280' }} />
                <div>
                  <div style={{ fontSize: '12px', color: '#6B7280' }}>Rôle</div>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>
                    {user.role === 'super_admin' ? 'Super Administrateur' : 'Administrateur'}
                  </div>
                </div>
              </div>
              <div style={infoItemStyle}>
                <Calendar size={16} style={{ color: '#6B7280' }} />
                <div>
                  <div style={{ fontSize: '12px', color: '#6B7280' }}>Compte créé le</div>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>
                    {user.createdAt ? formatDate(user.createdAt) : 'N/A'}
                  </div>
                </div>
              </div>
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
                    <div style={statLabelStyle}>Aujourd&apos;hui</div>
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
                    <div style={statLabelStyle}>Taux d&apos;acceptation</div>
                  </div>
                  <div style={statCardStyle}>
                    <div style={statValueStyle}>{user.statistics.cancelledDeliveries || 0}</div>
                    <div style={statLabelStyle}>Livraisons annulées</div>
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

        {/* Section Courses en attente de paiement - uniquement pour les livreurs */}
        {isDriver && (
          <div style={{ marginBottom: '24px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px', color: '#111827' }}>
              Courses en attente de paiement client
            </h3>
            {user.pendingPaymentOrders && user.pendingPaymentOrders.length > 0 ? (
              <div style={{
                backgroundColor: '#F9FAFB',
                borderRadius: '12px',
                border: '1px solid #E5E7EB',
                overflow: 'hidden',
              }}>
                <table style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                }}>
                  <thead>
                    <tr style={{
                      backgroundColor: '#F3F4F6',
                      borderBottom: '1px solid #E5E7EB',
                    }}>
                      <th style={{
                        padding: '12px',
                        textAlign: 'left',
                        fontSize: '12px',
                        fontWeight: 600,
                        color: '#4B5563',
                        textTransform: 'uppercase',
                      }}>Numéro de commande</th>
                      <th style={{
                        padding: '12px',
                        textAlign: 'left',
                        fontSize: '12px',
                        fontWeight: 600,
                        color: '#4B5563',
                        textTransform: 'uppercase',
                      }}>Client</th>
                      <th style={{
                        padding: '12px',
                        textAlign: 'left',
                        fontSize: '12px',
                        fontWeight: 600,
                        color: '#4B5563',
                        textTransform: 'uppercase',
                      }}>Montant payé</th>
                      <th style={{
                        padding: '12px',
                        textAlign: 'left',
                        fontSize: '12px',
                        fontWeight: 600,
                        color: '#4B5563',
                        textTransform: 'uppercase',
                      }}>Montant restant</th>
                      <th style={{
                        padding: '12px',
                        textAlign: 'left',
                        fontSize: '12px',
                        fontWeight: 600,
                        color: '#4B5563',
                        textTransform: 'uppercase',
                      }}>Statut</th>
                      <th style={{
                        padding: '12px',
                        textAlign: 'left',
                        fontSize: '12px',
                        fontWeight: 600,
                        color: '#4B5563',
                        textTransform: 'uppercase',
                      }}>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {user.pendingPaymentOrders.map((order: PendingPaymentOrder, index: number) => (
                      <tr
                        key={order.orderId}
                        style={{
                          borderBottom: index < user.pendingPaymentOrders!.length - 1 ? '1px solid #E5E7EB' : 'none',
                        }}
                      >
                        <td style={{ padding: '12px', fontSize: '14px', color: '#374151' }}>
                          {order.orderId ? order.orderId.slice(0, 8) + '...' : 'N/A'}
                        </td>
                        <td style={{ padding: '12px', fontSize: '14px', color: '#111827' }}>
                          <div>
                            {(order.client.firstName && order.client.lastName)
                              ? `${order.client.firstName} ${order.client.lastName}`
                              : order.client.email || 'N/A'}
                          </div>
                          {order.client.phone && (
                            <div style={{ fontSize: '12px', color: '#6B7280' }}>
                              {order.client.phone}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '12px', fontSize: '14px', color: '#10B981', fontWeight: 600 }}>
                          {formatCurrency(order.partialAmount)}
                        </td>
                        <td style={{ padding: '12px', fontSize: '14px', color: '#EF4444', fontWeight: 600 }}>
                          {formatCurrency(order.remainingAmount)}
                        </td>
                        <td style={{ padding: '12px' }}>
                          <span style={{
                            padding: '4px 8px',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: 600,
                            backgroundColor: '#FEF3C7',
                            color: '#D97706',
                          }}>
                            En attente du client
                          </span>
                        </td>
                        <td style={{ padding: '12px', fontSize: '14px', color: '#6B7280' }}>
                          {formatDate(order.orderCreatedAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{
                padding: '24px',
                textAlign: 'center',
                color: '#6B7280',
                backgroundColor: '#F9FAFB',
                borderRadius: '12px',
                border: '1px solid #E5E7EB',
              }}>
                <CreditCard size={32} style={{ margin: '0 auto 12px', color: '#9CA3AF' }} />
                <p style={{ fontSize: '14px', margin: 0 }}>Aucune course en attente de paiement</p>
              </div>
            )}
          </div>
        )}

        {/* Section Historique des courses - uniquement pour les livreurs */}
        {isDriver && (
          <div style={{ marginBottom: '24px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px', color: '#111827' }}>
              Historique des courses
            </h3>
            {user.recentOrders && user.recentOrders.length > 0 ? (
              <div style={{
                backgroundColor: '#F9FAFB',
                borderRadius: '12px',
                border: '1px solid #E5E7EB',
                overflow: 'hidden',
              }}>
                <table style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                }}>
                  <thead>
                    <tr style={{
                      backgroundColor: '#F3F4F6',
                      borderBottom: '1px solid #E5E7EB',
                    }}>
                      <th style={{
                        padding: '12px',
                        textAlign: 'left',
                        fontSize: '12px',
                        fontWeight: 600,
                        color: '#4B5563',
                        textTransform: 'uppercase',
                      }}>ID Commande</th>
                      <th style={{
                        padding: '12px',
                        textAlign: 'left',
                        fontSize: '12px',
                        fontWeight: 600,
                        color: '#4B5563',
                        textTransform: 'uppercase',
                      }}>Client</th>
                      <th style={{
                        padding: '12px',
                        textAlign: 'left',
                        fontSize: '12px',
                        fontWeight: 600,
                        color: '#4B5563',
                        textTransform: 'uppercase',
                      }}>Montant</th>
                      <th style={{
                        padding: '12px',
                        textAlign: 'left',
                        fontSize: '12px',
                        fontWeight: 600,
                        color: '#4B5563',
                        textTransform: 'uppercase',
                      }}>Distance</th>
                      <th style={{
                        padding: '12px',
                        textAlign: 'left',
                        fontSize: '12px',
                        fontWeight: 600,
                        color: '#4B5563',
                        textTransform: 'uppercase',
                      }}>Statut</th>
                      <th style={{
                        padding: '12px',
                        textAlign: 'left',
                        fontSize: '12px',
                        fontWeight: 600,
                        color: '#4B5563',
                        textTransform: 'uppercase',
                      }}>Paiement</th>
                      <th style={{
                        padding: '12px',
                        textAlign: 'left',
                        fontSize: '12px',
                        fontWeight: 600,
                        color: '#4B5563',
                        textTransform: 'uppercase',
                      }}>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {user.recentOrders.map((order: RecentOrder, index: number) => {
                      const getStatusLabel = (status: string) => {
                        const statusMap: Record<string, { label: string; color: string; bg: string }> = {
                          completed: { label: 'Livré', color: '#059669', bg: '#D1FAE5' },
                          cancelled: { label: 'Annulé', color: '#DC2626', bg: '#FEE2E2' },
                          declined: { label: 'Refusé', color: '#DC2626', bg: '#FEE2E2' },
                          pending: { label: 'En attente', color: '#D97706', bg: '#FEF3C7' },
                          accepted: { label: 'Accepté', color: '#2563EB', bg: '#DBEAFE' },
                          enroute: { label: 'En route', color: '#7C3AED', bg: '#E9D5FF' },
                          picked_up: { label: 'Récupéré', color: '#7C3AED', bg: '#E9D5FF' },
                        }
                        return statusMap[status] || { label: status, color: '#6B7280', bg: '#F3F4F6' }
                      }
                      const statusInfo = getStatusLabel(order.status)
                      const displayDate = order.completedAt || order.cancelledAt || order.acceptedAt || order.createdAt
                      
                      // Fonction pour obtenir le statut de paiement
                      const getPaymentStatus = () => {
                        if (!order.payment || order.status !== 'completed') {
                          return { label: 'N/A', color: '#6B7280', bg: '#F3F4F6' }
                        }
                        const payment = order.payment
                        if (payment.status === 'paid') {
                          return { label: 'Payé', color: '#059669', bg: '#D1FAE5' }
                        } else if (payment.status === 'partial') {
                          return { 
                            label: `Partiel (${formatCurrency(payment.partialAmount)}/${formatCurrency(order.price)})`, 
                            color: '#D97706', 
                            bg: '#FEF3C7' 
                          }
                        } else if (payment.status === 'pending') {
                          return { 
                            label: `En attente (${formatCurrency(payment.remainingAmount)})`, 
                            color: '#DC2626', 
                            bg: '#FEE2E2' 
                          }
                        }
                        return { label: 'N/A', color: '#6B7280', bg: '#F3F4F6' }
                      }
                      const paymentInfo = getPaymentStatus()
                      
                      return (
                        <tr
                          key={order.id}
                          style={{
                            borderBottom: index < (user.recentOrders?.length || 0) - 1 ? '1px solid #E5E7EB' : 'none',
                          }}
                        >
                          <td style={{ padding: '12px', fontSize: '14px', color: '#374151' }}>
                            {order.id ? order.id.slice(0, 8) + '...' : 'N/A'}
                          </td>
                          <td style={{ padding: '12px', fontSize: '14px', color: '#111827' }}>
                            {(order.client.firstName && order.client.lastName)
                              ? `${order.client.firstName} ${order.client.lastName}`
                              : order.client.email || 'N/A'}
                          </td>
                          <td style={{ padding: '12px', fontSize: '14px', fontWeight: 600, color: '#111827' }}>
                            {formatCurrency(order.price)}
                          </td>
                          <td style={{ padding: '12px', fontSize: '14px', color: '#6B7280' }}>
                            {order.distance ? `${order.distance.toFixed(1)} km` : 'N/A'}
                          </td>
                          <td style={{ padding: '12px' }}>
                            <span style={{
                              padding: '4px 8px',
                              borderRadius: '6px',
                              fontSize: '12px',
                              fontWeight: 600,
                              backgroundColor: statusInfo.bg,
                              color: statusInfo.color,
                            }}>
                              {statusInfo.label}
                            </span>
                          </td>
                          <td style={{ padding: '12px' }}>
                            <span style={{
                              padding: '4px 8px',
                              borderRadius: '6px',
                              fontSize: '12px',
                              fontWeight: 600,
                              backgroundColor: paymentInfo.bg,
                              color: paymentInfo.color,
                            }}>
                              {paymentInfo.label}
                            </span>
                          </td>
                          <td style={{ padding: '12px', fontSize: '14px', color: '#6B7280' }}>
                            {displayDate ? formatDate(displayDate) : 'N/A'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{
                padding: '24px',
                textAlign: 'center',
                color: '#6B7280',
                backgroundColor: '#F9FAFB',
                borderRadius: '12px',
                border: '1px solid #E5E7EB',
              }}>
                <Truck size={32} style={{ margin: '0 auto 12px', color: '#9CA3AF' }} />
                <p style={{ fontSize: '14px', margin: 0 }}>Aucune course dans l&apos;historique</p>
              </div>
            )}
          </div>
        )}

        {/* Section Paiements différés - uniquement pour les clients */}
        {isClient && user.deferredPayments && (
          <div style={{ marginBottom: '24px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px', color: '#111827' }}>
              Paiements différés
            </h3>
            
            {/* Résumé des paiements différés */}
            <div style={statsGridStyle}>
              <div style={statCardStyle}>
                <div style={statValueStyle}>
                  {formatCurrency(user.deferredPayments.totalPaid || 0)}
                </div>
                <div style={statLabelStyle}>Montant total payé</div>
              </div>
              <div style={statCardStyle}>
                <div style={statValueStyle}>
                  {formatCurrency(user.deferredPayments.totalRemaining || 0)}
                </div>
                <div style={statLabelStyle}>Montant total restant</div>
              </div>
              <div style={statCardStyle}>
                <div style={statValueStyle}>
                  {formatCurrency(user.deferredPayments.totalDue || 0)}
                </div>
                <div style={statLabelStyle}>Total dû</div>
              </div>
              <div style={statCardStyle}>
                <div style={{
                  ...statValueStyle,
                  color: user.deferredPayments.globalStatus === 'paid' 
                    ? '#10B981' 
                    : user.deferredPayments.globalStatus === 'partially_paid'
                    ? '#F59E0B'
                    : '#EF4444',
                }}>
                  {user.deferredPayments.globalStatus === 'paid' 
                    ? 'Payé' 
                    : user.deferredPayments.globalStatus === 'partially_paid'
                    ? 'Partiellement payé'
                    : 'Non payé'}
                </div>
                <div style={statLabelStyle}>Statut global</div>
              </div>
            </div>

            {/* Historique détaillé des transactions */}
            {user.deferredPayments.transactions && user.deferredPayments.transactions.length > 0 && (
              <div style={{ marginTop: '24px' }}>
                <h4 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px', color: '#111827' }}>
                  Historique détaillé
                </h4>
                <div style={{
                  backgroundColor: '#F9FAFB',
                  borderRadius: '12px',
                  border: '1px solid #E5E7EB',
                  overflow: 'hidden',
                }}>
                  <table style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                  }}>
                    <thead>
                      <tr style={{
                        backgroundColor: '#F3F4F6',
                        borderBottom: '1px solid #E5E7EB',
                      }}>
                        <th style={{
                          padding: '12px',
                          textAlign: 'left',
                          fontSize: '12px',
                          fontWeight: 600,
                          color: '#4B5563',
                          textTransform: 'uppercase',
                        }}>ID Commande</th>
                        <th style={{
                          padding: '12px',
                          textAlign: 'left',
                          fontSize: '12px',
                          fontWeight: 600,
                          color: '#4B5563',
                          textTransform: 'uppercase',
                        }}>Montant total</th>
                        <th style={{
                          padding: '12px',
                          textAlign: 'left',
                          fontSize: '12px',
                          fontWeight: 600,
                          color: '#4B5563',
                          textTransform: 'uppercase',
                        }}>Payé</th>
                        <th style={{
                          padding: '12px',
                          textAlign: 'left',
                          fontSize: '12px',
                          fontWeight: 600,
                          color: '#4B5563',
                          textTransform: 'uppercase',
                        }}>Restant</th>
                        <th style={{
                          padding: '12px',
                          textAlign: 'left',
                          fontSize: '12px',
                          fontWeight: 600,
                          color: '#4B5563',
                          textTransform: 'uppercase',
                        }}>Statut</th>
                        <th style={{
                          padding: '12px',
                          textAlign: 'left',
                          fontSize: '12px',
                          fontWeight: 600,
                          color: '#4B5563',
                          textTransform: 'uppercase',
                        }}>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {user.deferredPayments.transactions.map((tx: DeferredPaymentTransaction, index: number) => (
                        <tr
                          key={tx.id}
                          style={{
                            borderBottom: index < user.deferredPayments!.transactions.length - 1 ? '1px solid #E5E7EB' : 'none',
                          }}
                        >
                          <td style={{ padding: '12px', fontSize: '14px', color: '#374151' }}>
                            {tx.orderId ? tx.orderId.slice(0, 8) + '...' : 'N/A'}
                          </td>
                          <td style={{ padding: '12px', fontSize: '14px', fontWeight: 600, color: '#111827' }}>
                            {formatCurrency(tx.amount)}
                          </td>
                          <td style={{ padding: '12px', fontSize: '14px', color: '#10B981', fontWeight: 600 }}>
                            {formatCurrency(tx.partialAmount)}
                          </td>
                          <td style={{ padding: '12px', fontSize: '14px', color: '#EF4444', fontWeight: 600 }}>
                            {formatCurrency(tx.remainingAmount)}
                          </td>
                          <td style={{ padding: '12px' }}>
                            <span style={{
                              padding: '4px 8px',
                              borderRadius: '6px',
                              fontSize: '12px',
                              fontWeight: 600,
                              backgroundColor: tx.status === 'paid' 
                                ? '#D1FAE5' 
                                : tx.status === 'pending' || tx.status === 'delayed'
                                ? '#FEF3C7'
                                : '#FEE2E2',
                              color: tx.status === 'paid' 
                                ? '#059669' 
                                : tx.status === 'pending' || tx.status === 'delayed'
                                ? '#D97706'
                                : '#DC2626',
                            }}>
                              {tx.status === 'paid' 
                                ? 'Payé' 
                                : tx.status === 'pending'
                                ? 'En attente'
                                : tx.status === 'delayed'
                                ? 'Différé'
                                : tx.status}
                            </span>
                          </td>
                          <td style={{ padding: '12px', fontSize: '14px', color: '#6B7280' }}>
                            {formatDate(tx.createdAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {(!user.deferredPayments.transactions || user.deferredPayments.transactions.length === 0) && (
              <div style={{
                padding: '24px',
                textAlign: 'center',
                color: '#6B7280',
                backgroundColor: '#F9FAFB',
                borderRadius: '12px',
                border: '1px solid #E5E7EB',
              }}>
                <CreditCard size={32} style={{ margin: '0 auto 12px', color: '#9CA3AF' }} />
                <p style={{ fontSize: '14px', margin: 0 }}>Aucun paiement différé</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

