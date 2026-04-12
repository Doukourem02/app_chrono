import { MapboxProvider } from '@/contexts/MapboxContext'

export default function TrackLayout({ children }: { children: React.ReactNode }) {
  return <MapboxProvider>{children}</MapboxProvider>
}
