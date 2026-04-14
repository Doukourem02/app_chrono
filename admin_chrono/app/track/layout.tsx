import type { Metadata } from 'next'
import { MapboxProvider } from '@/contexts/MapboxContext'

/** Page publique destinataire : ne pas réutiliser le titre « Dashboard Krono » du back-office. */
export const metadata: Metadata = {
  title: {
    absolute: 'Suivi de livraison — Krono',
  },
  description:
    'Suivez l’état de votre livraison en temps réel : étapes, livreur et carte.',
  openGraph: {
    title: 'Suivi de livraison — Krono',
    description:
      'Suivez l’état de votre livraison en temps réel : étapes, livreur et carte.',
  },
  twitter: {
    title: 'Suivi de livraison — Krono',
    description:
      'Suivez l’état de votre livraison en temps réel : étapes, livreur et carte.',
  },
  appleWebApp: {
    capable: true,
    title: 'Suivi Krono',
    statusBarStyle: 'default',
  },
}

export default function TrackLayout({ children }: { children: React.ReactNode }) {
  return (
    <MapboxProvider>
      <div className="flex min-h-dvh w-full flex-col">{children}</div>
    </MapboxProvider>
  )
}
