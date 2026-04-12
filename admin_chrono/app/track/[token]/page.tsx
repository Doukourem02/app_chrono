'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import config from '@/lib/config'

const API_URL = config.apiUrl

const STATUS_LABELS: Record<string, string> = {
  pending: 'En attente de livreur',
  accepted: 'Livreur assigné',
  enroute: 'Livreur en route pour récupérer le colis',
  picked_up: 'Colis pris en charge',
  delivering: 'En cours de livraison',
  completed: 'Livré',
  cancelled: 'Annulé',
  declined: 'Refusé',
}

export default function TrackPage() {
  const params = useParams()
  const token = params?.token as string
  const [data, setData] = useState<{
    id: string
    status: string
    pickup: { address: string; coordinates: { latitude: number; longitude: number } | null }
    dropoff: { address: string; coordinates: { latitude: number; longitude: number } | null }
    driver: { id: string; name: string; latitude: number | null; longitude: number | null } | null
    price: number | null
    deliveryMethod: string
    distance: number | null
    createdAt: string
    qrCodeImage: string | null
    showQRCode: boolean
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchTrack = useCallback(async () => {
    if (!token) return
    try {
      const res = await fetch(`${API_URL}/api/track/${token}`)
      const json = await res.json()
      if (!json.success) {
        setError(json.message || 'Lien invalide')
        setData(null)
        return
      }
      setData(json.data)
      setError(null)
    } catch {
      setError('Impossible de charger le suivi')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    fetchTrack()
  }, [fetchTrack])

  useEffect(() => {
    if (!data || ['completed', 'cancelled', 'declined'].includes(data.status)) return
    const interval = setInterval(fetchTrack, 5000)
    return () => clearInterval(interval)
  }, [data, fetchTrack])

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.spinner} />
          <p style={styles.loadingText}>Chargement du suivi...</p>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <h1 style={styles.title}>Suivi Krono</h1>
          <p style={styles.errorText}>{error || 'Commande introuvable'}</p>
        </div>
      </div>
    )
  }

  const statusLabel = STATUS_LABELS[data.status] || data.status
  const isActive = !['completed', 'cancelled', 'declined'].includes(data.status)

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>Suivi de votre livraison</h1>
        <p style={styles.orderId}>Commande #{data.id.slice(0, 8).toUpperCase()}</p>

        <div style={{ ...styles.statusBadge, ...(isActive ? styles.statusActive : styles.statusDone) }}>
          {statusLabel}
        </div>

        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Prise en charge</h3>
          <p style={styles.address}>{data.pickup.address || '—'}</p>
        </div>

        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Livraison</h3>
          <p style={styles.address}>{data.dropoff.address || '—'}</p>
        </div>

        {data.driver && (
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>Livreur</h3>
            <p style={styles.driverName}>{data.driver.name}</p>
          </div>
        )}

        {data.showQRCode && data.qrCodeImage && (
          <div style={styles.qrSection}>
            <h3 style={styles.sectionTitle}>Montrez ce code au livreur</h3>
            <p style={styles.qrHint}>Le livreur scannera ce QR code pour confirmer la livraison.</p>
            <div style={styles.qrWrapper}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={data.qrCodeImage}
                alt="QR Code de livraison"
                width={220}
                height={220}
                style={{ display: 'block' }}
              />
            </div>
          </div>
        )}

        {data.status === 'completed' && (
          <div style={styles.completedBanner}>
            ✓ Votre colis a été livré
          </div>
        )}
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)',
    padding: 24,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    maxWidth: 420,
    width: '100%',
    boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
  },
  title: {
    fontSize: 22,
    fontWeight: 700,
    color: '#111827',
    marginBottom: 4,
  },
  orderId: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
  },
  statusBadge: {
    padding: '10px 16px',
    borderRadius: 12,
    fontSize: 15,
    fontWeight: 600,
    marginBottom: 24,
  },
  statusActive: {
    backgroundColor: '#EDE9FE',
    color: '#7C3AED',
  },
  statusDone: {
    backgroundColor: '#D1FAE5',
    color: '#059669',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 600,
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  address: {
    fontSize: 15,
    color: '#111827',
    lineHeight: 1.5,
  },
  driverName: {
    fontSize: 15,
    color: '#111827',
    fontWeight: 500,
  },
  qrSection: {
    marginTop: 24,
    paddingTop: 24,
    borderTop: '1px solid #E5E7EB',
    textAlign: 'center',
  },
  qrHint: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
  },
  qrWrapper: {
    display: 'inline-flex',
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    border: '2px solid #E5E7EB',
  },
  completedBanner: {
    marginTop: 24,
    padding: 16,
    backgroundColor: '#D1FAE5',
    color: '#059669',
    borderRadius: 12,
    fontWeight: 600,
    textAlign: 'center',
  },
  spinner: {
    width: 40,
    height: 40,
    border: '3px solid #E5E7EB',
    borderTopColor: '#8B5CF6',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
    margin: '0 auto 16px',
  },
  loadingText: {
    color: '#6B7280',
    fontSize: 14,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 15,
  },
}
