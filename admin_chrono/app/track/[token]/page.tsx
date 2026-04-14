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
          <h1 className="text-xl font-bold text-gray-900">Suivi de livraison</h1>
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
    <div className="flex min-h-0 flex-1 flex-col bg-gradient-to-br from-violet-700 via-violet-600 to-indigo-900 p-0 lg:p-5 xl:p-6">
      {/* Mobile : h-dvh pour que flex-1 remplisse vraiment l’écran ; carte hauteur fixe svh ; bas scroll */}
      <div className="flex h-dvh max-h-dvh w-full flex-col overflow-hidden bg-white shadow-[0_25px_80px_-20px_rgba(49,46,129,0.45)] lg:h-auto lg:max-h-none lg:min-h-[calc(100dvh-2.5rem)] lg:flex-row lg:overflow-hidden lg:rounded-3xl">
        {/* Carte : hauteur garantie sur mobile (visible sans scroll), flex-1 sur desktop */}
        <div className="order-1 flex h-[40svh] min-h-[220px] max-h-[48svh] w-full shrink-0 flex-col border-b border-slate-200/90 bg-slate-200/40 lg:order-2 lg:h-auto lg:max-h-none lg:min-h-0 lg:min-w-0 lg:flex-1 lg:border-b-0 lg:border-l lg:border-slate-200">
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/20 bg-gradient-to-r from-violet-700 via-violet-600 to-indigo-600 px-4 py-2.5 text-white shadow-md lg:hidden">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/60 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-300" />
              </span>
              <p className="text-[11px] font-bold uppercase tracking-[0.12em]">Suivi en direct</p>
            </div>
            <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-[10px] font-semibold backdrop-blur-sm">
              Carte
            </span>
          </div>
          <div className="min-h-0 flex-1">
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

        {/* Infos : occupe tout l’espace sous la carte (flex-1 + scroll), gauche sur desktop */}
        <div className="order-2 flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-t-[1.35rem] border-t border-slate-200/90 bg-gradient-to-b from-slate-100/95 via-white to-slate-50/90 shadow-[0_-16px_48px_-20px_rgba(15,23,42,0.18)] lg:order-1 lg:max-h-[calc(100dvh-3rem)] lg:max-w-md lg:flex-none lg:rounded-none lg:border-t-0 lg:bg-white lg:shadow-none xl:max-w-lg">
          <header className="shrink-0 border-b border-slate-200/80 bg-white/90 px-4 pb-3 pt-4 backdrop-blur-md sm:px-5 lg:px-8 lg:pt-8">
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h1 className="text-lg font-bold leading-snug tracking-tight text-slate-900 sm:text-xl lg:text-2xl">
                    Votre livraison
                  </h1>
                </div>
                <p className="mt-1 font-mono text-[11px] text-slate-500 sm:text-xs">
                  #{data.id.slice(0, 8).toUpperCase()}
                </p>
              </div>
              <span
                className={`inline-flex shrink-0 items-center rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide shadow-md ring-1 ring-black/5 sm:text-xs ${
                  status === 'completed'
                    ? 'bg-emerald-500 text-white'
                    : status === 'cancelled'
                      ? 'bg-red-500 text-white'
                      : status === 'declined'
                        ? 'bg-amber-500 text-white'
                        : isActive
                          ? 'bg-violet-600 text-white'
                          : 'bg-slate-500 text-white'
                }`}
              >
                {FLOW_STEPS.find((s) => s.status === status)?.title ||
                  (status === 'cancelled' ? 'Annulé' : status === 'declined' ? 'Refusé' : status)}
              </span>
            </div>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-4 py-4 pb-8 sm:px-5 lg:px-8 lg:py-6 lg:pb-8 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300/80">
            <p className="mb-4 hidden text-xs text-slate-500 lg:block">
              Suivi de votre livraison — détail de la commande
            </p>

            {data.driver && (
              <div className="relative overflow-hidden rounded-2xl border border-violet-200/80 bg-white p-4 shadow-lg shadow-violet-100/40 ring-1 ring-slate-100 sm:p-5">
                <div
                  className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-gradient-to-br from-violet-400/30 to-indigo-400/20 blur-2xl"
                  aria-hidden
                />
                <div className="relative flex items-center gap-4">
                  <div className="flex h-[4.25rem] w-[4.25rem] shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-700 text-lg font-bold text-white shadow-lg shadow-violet-500/30 ring-[3px] ring-white">
                    {driverInitials(data.driver.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-violet-600">
                      <UserRound className="h-3.5 w-3.5 shrink-0 stroke-[2.5]" aria-hidden />
                      Livreur assigné
                    </p>
                    <p className="mt-1 truncate text-lg font-bold text-slate-900">{data.driver.name}</p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-500">
                      Dernière position affichée sur la carte (zone du haut de l’écran).
                    </p>
                  </div>
                </div>
              </div>
            )}

            {status === 'cancelled' && (
              <div className="mt-4 flex gap-3 rounded-2xl border border-red-200/90 bg-gradient-to-br from-red-50 to-white p-4 shadow-lg shadow-red-100/50 ring-1 ring-red-100/60">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-600">
                  <AlertTriangle className="h-5 w-5" aria-hidden />
                </div>
                <div>
                  <p className="text-sm font-bold text-red-900">Commande annulée</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-red-800/90">
                    Cette livraison ne sera pas effectuée. L’historique des étapes n’est plus affiché.
                  </p>
                </div>
              </div>
            )}

            {status === 'declined' && (
              <div className="mt-4 flex gap-3 rounded-2xl border border-amber-200/90 bg-gradient-to-br from-amber-50 to-white p-4 shadow-lg shadow-amber-100/50 ring-1 ring-amber-100/60">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                  <AlertTriangle className="h-5 w-5" aria-hidden />
                </div>
                <div>
                  <p className="text-sm font-bold text-amber-950">Commande refusée</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-amber-900/90">
                    Cette commande n’a pas été acceptée. Les étapes ne sont plus affichées.
                  </p>
                </div>
              </div>
            )}

          {status !== 'cancelled' && status !== 'declined' && (
            <div className="mt-5 rounded-2xl border border-slate-200/90 bg-white p-4 shadow-md ring-1 ring-slate-100/80 sm:p-5">
              <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
                Étapes de la livraison
              </h3>
              <div className="relative mt-4 space-y-0 pl-1">
                {FLOW_STEPS.map((step, i) => {
                  const done = allStepsDone || i < currentStepIndex
                  const current =
                    !allStepsDone &&
                    !['cancelled', 'declined'].includes(status) &&
                    i === currentStepIndex
                  const future = !done && !current
                  const isLast = i === FLOW_STEPS.length - 1
                  return (
                    <div key={step.status} className={`relative flex gap-3.5 ${future ? 'opacity-45' : ''}`}>
                      {!isLast && (
                        <div
                          className={`absolute left-[0.4rem] top-3 h-[calc(100%+0.5rem)] w-0.5 ${
                            done ? 'bg-emerald-200' : 'bg-slate-200'
                          }`}
                          aria-hidden
                        />
                      )}
                      <div
                        className={`relative z-[1] mt-0.5 h-3.5 w-3.5 shrink-0 rounded-full border-2 border-white shadow-sm ${
                          done
                            ? 'bg-emerald-500'
                            : current
                              ? 'bg-violet-600 shadow-[0_0_0_4px_rgba(124,58,237,0.25)]'
                              : 'bg-slate-200'
                        }`}
                      />
                      <div className="min-w-0 pb-5">
                        <p className="text-sm font-bold text-slate-900">{step.title}</p>
                        <p className="mt-0.5 text-xs leading-relaxed text-slate-600">{step.body}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {showPushCta && (
            <div className="mt-5 rounded-2xl border border-violet-200/90 bg-gradient-to-br from-violet-50 to-white p-4 shadow-lg shadow-violet-100/40 ring-1 ring-violet-100/50 sm:p-5">
              <p className="text-sm font-medium leading-snug text-violet-950">
                Recevez une alerte sur cet appareil quand le statut change.
              </p>
              <button
                type="button"
                className="mt-4 w-full rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-violet-500/25 transition hover:from-violet-700 hover:to-indigo-700 active:scale-[0.99] disabled:opacity-60"
                disabled={pushBusy}
                onClick={() => void handleEnablePush()}
              >
                {pushBusy ? 'Activation…' : 'Activer les alertes navigateur'}
              </button>
              {pushMessage && <p className="mt-2 text-xs text-slate-600">{pushMessage}</p>}
            </div>
          )}

          {pushEnabled && !showPushCta && (
            <p className="mt-4 flex items-center gap-2 text-sm font-semibold text-emerald-700">
              <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden />
              Alertes navigateur activées pour ce lien.
            </p>
          )}

          <div className="mt-5 space-y-3">
            <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-lg ring-1 ring-slate-100/80 sm:p-5">
              <h3 className="flex items-center gap-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-emerald-700">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 shadow-inner">
                  <MapPin className="h-5 w-5" aria-hidden strokeWidth={2.25} />
                </span>
                Prise en charge
              </h3>
              <p className="mt-3 text-[15px] font-semibold leading-relaxed text-slate-900">
                {data.pickup.address || '—'}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-lg ring-1 ring-slate-100/80 sm:p-5">
              <h3 className="flex items-center gap-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-violet-700">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-100 text-violet-700 shadow-inner">
                  <MapPin className="h-5 w-5" aria-hidden strokeWidth={2.25} />
                </span>
                Livraison
              </h3>
              <p className="mt-3 text-[15px] font-semibold leading-relaxed text-slate-900">
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
            <div className="mt-6 rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50 to-white py-5 text-center text-sm font-bold text-emerald-900 shadow-md ring-1 ring-emerald-100/60">
              Votre commande est livrée.
            </div>
          )}
          </div>
        </div>
      </div>
    </div>
  )
}
