'use client'

import { useAuthStore } from '@/stores/authStore'
import { supabase } from '@/lib/supabase'
import { useRouter, usePathname } from 'next/navigation'
import { useEffect } from 'react'
import Sidebar from '@/components/layout/Sidebar'
import Header from '@/components/layout/Header'
import { GoogleMapsProvider } from '@/contexts/GoogleMapsContext'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { user, loading, setUser, setLoading, checkAdminRole } = useAuthStore()

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const { data } = await supabase.auth.getSession()
      if (!data.session) {
        setLoading(false)
        return router.push('/login')
      }

      setUser(data.session.user)

      const isAdmin = await checkAdminRole()
      if (!isAdmin) {
        setLoading(false)
        return router.push('/login')
      }

      setLoading(false)
    }

    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Les fonctions du store sont stables, pas besoin de les inclure

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div style={{ color: '#4B5563' }}>Chargement...</div>
      </div>
    )
  }

  if (!user) return null

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    height: '100vh',
    backgroundColor: '#F5F6FA',
  }

  const contentWrapperStyle: React.CSSProperties = {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  }

  const scrollableStyle: React.CSSProperties = {
    flex: 1,
    overflowY: 'auto',
  }

  const innerContainerStyle: React.CSSProperties = {
    paddingLeft: '16px',
    paddingRight: '24px',
    paddingTop: '16px',
    paddingBottom: '16px',
    minHeight: '100%',
  }

  const maxWidthContainerStyle: React.CSSProperties = {
    maxWidth: '1152px',
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  }

  // Vérifier si on est sur la page tracking pour ajuster le layout
  const isTrackingPage = pathname?.includes('/tracking')

  return (
    <GoogleMapsProvider>
      <div style={containerStyle}>
        <Sidebar />
        <div style={contentWrapperStyle}>
          <div style={scrollableStyle}>
            {isTrackingPage ? (
              <main style={{ height: '100%', padding: 0 }}>
                {children}
              </main>
            ) : (
              <div style={innerContainerStyle}>
                <div style={maxWidthContainerStyle}>
                  <Header />
                  <main>
                    {children}
                  </main>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </GoogleMapsProvider>
  )
}
