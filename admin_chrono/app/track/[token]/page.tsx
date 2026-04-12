'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { AlertTriangle, MapPin, UserRound } from 'lucide-react'
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
      <div className="flex min-h-dvh flex-1 items-center justify-center bg-gradient-to-br from-violet-500 to-violet-700 p-6">
        <div className="rounded-2xl bg-white p-10 text-center shadow-xl">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-violet-200 border-t-violet-600" />
          <p className="text-gray-600">Chargement du suivi…</p>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex min-h-dvh flex-1 items-center justify-center bg-gradient-to-br from-violet-500 to-violet-700 p-6">
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
    <div className="flex min-h-0 flex-1 flex-col bg-gradient-to-br from-violet-600 via-violet-600 to-violet-900 p-0 sm:p-3 md:p-5 lg:p-6">
      <div className="flex min-h-dvh w-full flex-1 flex-col overflow-hidden bg-white shadow-2xl sm:min-h-0 sm:rounded-2xl lg:min-h-[calc(100dvh-3rem)] lg:flex-row">
        {/* Carte en premier dans le DOM : haut sur mobile, droite sur desktop (lg:order-2) */}
        <div className="order-1 flex min-h-[38dvh] min-w-0 flex-1 flex-col border-b border-gray-200 bg-gray-50/80 sm:min-h-[40dvh] lg:order-2 lg:min-h-0 lg:min-w-0 lg:flex-1 lg:border-b-0 lg:border-l lg:border-gray-200">
          <div className="flex items-center justify-center gap-2 border-b border-gray-200/80 bg-gradient-to-r from-violet-50/80 to-white px-4 py-2.5 lg:hidden">
            <span className="h-1.5 w-1.5 rounded-full bg-violet-500" aria-hidden />
            <p className="text-center text-xs font-semibold uppercase tracking-wide text-violet-900/80">
              Carte & itinéraire
            </p>
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

        {/* Infos : bas sur mobile, gauche sur desktop (lg:order-1) */}
        <div className="order-2 flex w-full shrink-0 flex-col border-gray-100 p-4 sm:p-6 md:p-8 lg:order-1 lg:max-h-[calc(100dvh-3.5rem)] lg:max-w-md lg:shrink-0 lg:overflow-y-auto xl:max-w-lg">
          <header className="border-b border-gray-100 pb-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="text-xl font-bold tracking-tight text-gray-900 sm:text-2xl">
                  Suivi de votre livraison
                </h1>
                <p className="mt-1 font-mono text-xs text-gray-500 sm:text-sm">
                  Commande #{data.id.slice(0, 8).toUpperCase()}
                </p>
              </div>
              <span
                className={`inline-flex shrink-0 items-center rounded-full px-3 py-1.5 text-xs font-semibold shadow-sm sm:text-sm ${
                  status === 'completed'
                    ? 'bg-emerald-100 text-emerald-800'
                    : status === 'cancelled'
                      ? 'bg-red-100 text-red-800'
                      : status === 'declined'
                        ? 'bg-amber-100 text-amber-900'
                        : isActive
                          ? 'bg-violet-100 text-violet-800'
                          : 'bg-gray-100 text-gray-800'
                }`}
              >
                {FLOW_STEPS.find((s) => s.status === status)?.title ||
                  (status === 'cancelled' ? 'Annulé' : status === 'declined' ? 'Refusé' : status)}
              </span>
            </div>
          </header>

          {data.driver && (
            <div className="relative mt-5 overflow-hidden rounded-2xl border border-violet-200/90 bg-gradient-to-br from-violet-50 via-white to-violet-50/30 p-4 shadow-md ring-1 ring-violet-100/80 sm:p-5">
              <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-violet-200/40 blur-2xl" aria-hidden />
              <div className="relative flex items-center gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-violet-700 text-lg font-bold text-white shadow-lg ring-4 ring-white/90 sm:h-[4.5rem] sm:w-[4.5rem] sm:text-xl">
                  {driverInitials(data.driver.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-violet-600">
                    <UserRound className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    Livreur
                  </p>
                  <p className="mt-0.5 truncate text-lg font-semibold text-gray-900 sm:text-xl">
                    {data.driver.name}
                  </p>
                  <p className="mt-1 text-xs leading-snug text-gray-500">
                    Position mise à jour sur la carte ci-dessus
                  </p>
                </div>
              </div>
            </div>
          )}

          {status === 'cancelled' && (
            <div className="mt-5 flex gap-3 rounded-2xl border border-red-200 bg-red-50/90 p-4 shadow-sm">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" aria-hidden />
              <div>
                <p className="text-sm font-semibold text-red-900">Commande annulée</p>
                <p className="mt-1 text-sm leading-relaxed text-red-800/90">
                  Cette livraison ne sera pas effectuée. Les étapes ne sont plus affichées.
                </p>
              </div>
            </div>
          )}

          {status === 'declined' && (
            <div className="mt-5 flex gap-3 rounded-2xl border border-amber-200 bg-amber-50/90 p-4 shadow-sm">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden />
              <div>
                <p className="text-sm font-semibold text-amber-950">Commande refusée</p>
                <p className="mt-1 text-sm leading-relaxed text-amber-900/90">
                  Cette commande n’a pas été acceptée. Le détail des étapes n’est plus affiché.
                </p>
              </div>
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

          <div className="mt-6 space-y-3">
            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md sm:p-5">
              <h3 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-violet-600">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                  <MapPin className="h-4 w-4" aria-hidden />
                </span>
                Prise en charge
              </h3>
              <p className="mt-3 text-[15px] font-medium leading-relaxed text-gray-900">
                {data.pickup.address || '—'}
              </p>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md sm:p-5">
              <h3 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-violet-600">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-100 text-violet-700">
                  <MapPin className="h-4 w-4" aria-hidden />
                </span>
                Livraison
              </h3>
              <p className="mt-3 text-[15px] font-medium leading-relaxed text-gray-900">
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
      </div>
    </div>
  )
}
