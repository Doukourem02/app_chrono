'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import config from '@/lib/config'
import PublicTrackMap from '@/components/track/PublicTrackMap'

const API_URL = config.apiUrl

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

function driverInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return (name.slice(0, 2) || '?').toUpperCase()
}

type TrackData = {
  id: string
  status: string
  pickup: { address: string; coordinates: { latitude: number; longitude: number } | null }
  dropoff: { address: string; coordinates: { latitude: number; longitude: number } | null }
  driver: {
    id: string
    name: string
    latitude: number | null
    longitude: number | null
    heading?: number | null
  } | null
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
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-violet-500 to-violet-700 p-6">
        <div className="rounded-2xl bg-white p-10 text-center shadow-xl">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-violet-200 border-t-violet-600" />
          <p className="text-gray-600">Chargement du suivi…</p>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-violet-500 to-violet-700 p-6">
        <div className="max-w-md rounded-2xl bg-white p-8 text-center shadow-xl">
          <h1 className="text-xl font-bold text-gray-900">Suivi Krono</h1>
          <p className="mt-3 text-red-600">{error || 'Commande introuvable'}</p>
        </div>
      </div>
    )
  }

  const status = data.status
  const isActive = !['completed', 'cancelled', 'declined'].includes(status)

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
    <div className="min-h-screen bg-gradient-to-br from-violet-500 to-violet-700 p-4 md:p-8">
      <div className="mx-auto flex max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl lg:min-h-[560px] lg:flex-row">
        {/* Colonne infos */}
        <div className="flex min-w-0 flex-1 flex-col border-gray-100 p-6 md:p-8 lg:max-w-[28rem] xl:max-w-md">
          <h1 className="text-2xl font-bold text-gray-900">Suivi de votre livraison</h1>
          <p className="mt-1 text-sm text-gray-500">
            Commande #{data.id.slice(0, 8).toUpperCase()}
          </p>

          {data.driver && (
            <div className="mt-6 flex items-center gap-4 rounded-xl border border-violet-100 bg-violet-50/80 p-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-violet-200 text-lg font-bold text-violet-800">
                {driverInitials(data.driver.name)}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-violet-600">
                  Livreur
                </p>
                <p className="truncate text-lg font-semibold text-gray-900">{data.driver.name}</p>
                <p className="text-xs text-gray-500">Mise à jour de la position sur la carte</p>
              </div>
            </div>
          )}

          {status === 'cancelled' && (
            <div className="mt-6 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
              Commande annulée. Votre commande a été annulée.
            </div>
          )}

          {status !== 'cancelled' && status !== 'declined' && (
            <div className="mt-6 border-b border-gray-100 pb-6">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Étapes
              </h3>
              <div className="mt-3 space-y-3">
                {FLOW_STEPS.map((step, i) => {
                  const done = allStepsDone || i < currentStepIndex
                  const current =
                    !allStepsDone &&
                    !['cancelled', 'declined'].includes(status) &&
                    i === currentStepIndex
                  const future = !done && !current
                  return (
                    <div
                      key={step.status}
                      className={`flex gap-3 ${future ? 'opacity-45' : ''}`}
                    >
                      <div
                        className={`mt-1.5 h-3 w-3 shrink-0 rounded-full ${
                          done
                            ? 'bg-emerald-500'
                            : current
                              ? 'bg-violet-600 shadow-[0_0_0_3px_rgba(124,58,237,0.35)]'
                              : 'bg-gray-200'
                        }`}
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900">{step.title}</p>
                        <p className="text-xs leading-snug text-gray-500">{step.body}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <div
            className={`mt-4 inline-flex w-fit rounded-xl px-4 py-2.5 text-sm font-semibold ${
              isActive ? 'bg-violet-100 text-violet-800' : 'bg-emerald-100 text-emerald-800'
            }`}
          >
            {FLOW_STEPS.find((s) => s.status === status)?.title ||
              (status === 'cancelled' ? 'Annulé' : status === 'declined' ? 'Refusé' : status)}
          </div>

          {showPushCta && (
            <div className="mt-6 rounded-xl border border-violet-200 bg-violet-50 p-4">
              <p className="text-sm text-violet-900">
                Recevez une alerte sur cet appareil quand le statut change (navigateur).
              </p>
              <button
                type="button"
                className="mt-3 w-full rounded-lg bg-violet-600 py-3 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:opacity-60"
                disabled={pushBusy}
                onClick={() => void handleEnablePush()}
              >
                {pushBusy ? 'Activation…' : 'Activer les alertes navigateur'}
              </button>
              {pushMessage && <p className="mt-2 text-xs text-gray-600">{pushMessage}</p>}
            </div>
          )}

          {pushEnabled && !showPushCta && (
            <p className="mt-4 text-sm font-medium text-emerald-700">
              Alertes navigateur activées pour ce lien.
            </p>
          )}

          <div className="mt-6 space-y-5">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Prise en charge
              </h3>
              <p className="mt-1 text-[15px] leading-relaxed text-gray-900">
                {data.pickup.address || '—'}
              </p>
            </div>
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Livraison
              </h3>
              <p className="mt-1 text-[15px] leading-relaxed text-gray-900">
                {data.dropoff.address || '—'}
              </p>
            </div>
          </div>

          {data.showQRCode && data.qrCodeImage && (
            <div className="mt-8 border-t border-gray-100 pt-6 text-center">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Montrez ce code au livreur
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                Le livreur scannera ce QR code pour confirmer la livraison.
              </p>
              <div className="mt-4 inline-flex rounded-xl border-2 border-gray-100 p-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={data.qrCodeImage}
                  alt="QR Code de livraison"
                  width={220}
                  height={220}
                  className="block"
                />
              </div>
            </div>
          )}

          {data.status === 'completed' && (
            <div className="mt-8 rounded-xl bg-emerald-100 py-4 text-center text-sm font-semibold text-emerald-800">
              Votre commande est livrée.
            </div>
          )}
        </div>

        {/* Carte */}
        <div className="flex min-h-[320px] min-w-0 flex-1 flex-col border-t border-gray-200 lg:min-h-0 lg:border-l lg:border-t-0">
          <div className="border-b border-gray-100 bg-gray-50 px-4 py-2 lg:hidden">
            <p className="text-center text-xs font-medium text-gray-600">Itinéraire</p>
          </div>
          <PublicTrackMap
            pickup={data.pickup}
            dropoff={data.dropoff}
            driver={
              data.driver
                ? {
                    latitude: data.driver.latitude,
                    longitude: data.driver.longitude,
                    heading: data.driver.heading ?? null,
                  }
                : null
            }
          />
        </div>
      </div>
    </div>
  )
}
