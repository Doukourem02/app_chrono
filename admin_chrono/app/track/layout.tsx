import { MapboxProvider } from '@/contexts/MapboxContext'

export default function TrackLayout({ children }: { children: React.ReactNode }) {
  return (
    <MapboxProvider>
      <div className="flex min-h-dvh w-full flex-col">{children}</div>
    </MapboxProvider>
  )
}
