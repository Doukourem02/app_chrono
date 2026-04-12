'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import config from '@/lib/config'

const API_URL = config.apiUrl

/** Aligné sur les textes push / SMS backend (recipientOrderNotifyService). */
const FLOW_STEPS: { status: string; title: string; body: string }[] = [
  { status: 'pending', title: 'En attente', body: 'Recherche d’un livreur pour votre course.' },
  { status: 'accepted', title: 'Course acceptée', body: 'Un livreur a accepté votre commande.' },
  {
    status: 'enroute',
    title: 'En route',
    body: 'Le livreur est en route vers le point de collecte de colis.',
  },
  { status: 'picked_up', title: 'Colis récupéré', body: 'Votre colis a été récupéré.' },
  { status: 'delivering', title: 'En livraison', body: 'Le livreur est en route vers vous.' },
  { status: 'completed', title: 'Livraison terminée', body: 'Votre commande est livrée.' },
]

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const output = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) output[i] = rawData.charCodeAt(i)
  return output as Uint8Array<ArrayBuffer>
}

type TrackData = {
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
  webPushAvailable?: boolean
}

export default function TrackPage() {
  const params = useParams()
  const token = params?.token as string
  const [data, setData] = useState<TrackData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pushBusy, setPushBusy] = useState(false)
  const [pushMessage, setPushMessage] = useState<string | null>(null)
  const [pushEnabled, setPushEnabled] = useState(false)
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
  }, [])

  const fetchTrack = useCallback(async () => {
    if (!token) return
    try {
      const res = await fetch(`${API_URL}/api/track/${encodeURIComponent(token)}`)
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

  useEffect(() => {
    if (!token || typeof window === 'undefined') return
    setPushEnabled(localStorage.getItem(`krono-track-push-${token}`) === '1')
  }, [token])

  const handleEnablePush = async () => {
    if (!token || !data?.webPushAvailable) return
    if (typeof window === 'undefined' || !window.isSecureContext) {
      setPushMessage('Les notifications navigateur nécessitent HTTPS.')
      return
    }
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setPushMessage('Navigateur incompatible avec les notifications.')
      return
    }
    setPushBusy(true)
    setPushMessage(null)
    try {
      const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
      const perm = await Notification.requestPermission()
      if (perm !== 'granted') {
        setPushMessage('Permission refusée.')
        setPushBusy(false)
        return
      }
      const keyRes = await fetch(
        `${API_URL}/api/track/${encodeURIComponent(token)}/vapid-public-key`
      )
      const keyJson = await keyRes.json()
      if (!keyJson.success || !keyJson.publicKey) {
        setPushMessage(keyJson.message || 'Service indisponible.')
        setPushBusy(false)
        return
      }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(keyJson.publicKey),
      })
      const subRes = await fetch(
        `${API_URL}/api/track/${encodeURIComponent(token)}/push-subscribe`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(sub.toJSON()),
        }
      )
      const subJson = await subRes.json()
      if (!subRes.ok || !subJson.success) {
        setPushMessage(subJson.message || 'Inscription impossible.')
        setPushBusy(false)
        return
      }
      localStorage.setItem(`krono-track-push-${token}`, '1')
      setPushEnabled(true)
      setPushMessage('Alertes activées pour cette livraison.')
    } catch {
      setPushMessage('Erreur technique. Réessayez plus tard.')
    } finally {
      setPushBusy(false)
    }
  }

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

  const status = data.status
  const isTerminal = ['completed', 'cancelled', 'declined'].includes(status)
  const isActive = !isTerminal

  const flowIndex = FLOW_STEPS.findIndex((s) => s.status === status)
  const currentStepIndex = flowIndex >= 0 ? flowIndex : 0
  const allStepsDone = status === 'completed'

  const showPushCta =
    isClient &&
    Boolean(data.webPushAvailable) &&
    window.isSecureContext &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    !pushEnabled &&
    !['cancelled', 'declined'].includes(status)

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>Suivi de votre livraison</h1>
        <p style={styles.orderId}>Commande #{data.id.slice(0, 8).toUpperCase()}</p>

        {status === 'cancelled' && (
          <div style={styles.cancelledBanner}>Commande annulée. Votre commande a été annulée.</div>
        )}

        {status !== 'cancelled' && status !== 'declined' && (
          <div style={styles.timeline}>
            <h3 style={styles.timelineHeading}>Étapes</h3>
            {FLOW_STEPS.map((step, i) => {
              const done = allStepsDone || i < currentStepIndex
              const current =
                !allStepsDone && !['cancelled', 'declined'].includes(status) && i === currentStepIndex
              const future = !done && !current
              return (
                <div
                  key={step.status}
                  style={{
                    ...styles.timelineRow,
                    ...(future ? { opacity: 0.45 } : {}),
                  }}
                >
                  <div
                    style={{
                      ...styles.timelineDot,
                      ...(done ? styles.timelineDotDone : {}),
                      ...(current ? styles.timelineDotCurrent : {}),
                    }}
                  />
                  <div style={styles.timelineTextCol}>
                    <div style={styles.timelineTitle}>{step.title}</div>
                    <div style={styles.timelineBody}>{step.body}</div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <div
          style={{
            ...styles.statusBadge,
            ...(isActive ? styles.statusActive : styles.statusDone),
            marginTop: 16,
          }}
        >
          {FLOW_STEPS.find((s) => s.status === status)?.title ||
            (status === 'cancelled'
              ? 'Annulé'
              : status === 'declined'
                ? 'Refusé'
                : status)}
        </div>

        {showPushCta && (
          <div style={styles.pushSection}>
            <p style={styles.pushHint}>
              Recevez une alerte sur cet appareil quand le statut change (navigateur).
            </p>
            <button
              type="button"
              style={styles.pushButton}
              disabled={pushBusy}
              onClick={() => void handleEnablePush()}
            >
              {pushBusy ? 'Activation…' : 'Activer les alertes navigateur'}
            </button>
            {pushMessage && <p style={styles.pushFeedback}>{pushMessage}</p>}
          </div>
        )}

        {pushEnabled && !showPushCta && (
          <p style={styles.pushOk}>Alertes navigateur activées pour ce lien.</p>
        )}

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
          <div style={styles.completedBanner}>Votre commande est livrée.</div>
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
  timeline: {
    marginBottom: 8,
    paddingBottom: 16,
    borderBottom: '1px solid #E5E7EB',
  },
  timelineHeading: {
    fontSize: 12,
    fontWeight: 600,
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  timelineRow: {
    display: 'flex',
    gap: 12,
    marginBottom: 14,
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 4,
    flexShrink: 0,
    backgroundColor: '#E5E7EB',
  },
  timelineDotCurrent: {
    backgroundColor: '#8B5CF6',
    boxShadow: '0 0 0 3px rgba(139, 92, 246, 0.35)',
  },
  timelineDotDone: {
    backgroundColor: '#10B981',
  },
  timelineTextCol: {
    flex: 1,
    minWidth: 0,
  },
  timelineTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: '#111827',
  },
  timelineBody: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 1.45,
    marginTop: 2,
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
  cancelledBanner: {
    padding: 14,
    backgroundColor: '#FEE2E2',
    color: '#B91C1C',
    borderRadius: 12,
    fontWeight: 600,
    marginBottom: 16,
    fontSize: 14,
    lineHeight: 1.4,
  },
  pushSection: {
    marginBottom: 20,
    padding: 14,
    backgroundColor: '#F5F3FF',
    borderRadius: 12,
    border: '1px solid #DDD6FE',
  },
  pushHint: {
    fontSize: 13,
    color: '#5B21B6',
    marginBottom: 10,
    lineHeight: 1.45,
  },
  pushButton: {
    width: '100%',
    padding: '12px 16px',
    borderRadius: 10,
    border: 'none',
    backgroundColor: '#7C3AED',
    color: '#fff',
    fontWeight: 600,
    fontSize: 15,
    cursor: 'pointer',
  },
  pushFeedback: {
    marginTop: 8,
    fontSize: 13,
    color: '#6B7280',
  },
  pushOk: {
    fontSize: 13,
    color: '#059669',
    marginBottom: 16,
    fontWeight: 500,
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
