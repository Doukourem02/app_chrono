'use client'

import { useAuthStore } from '@/stores/authStore'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import Sidebar from '@/components/layout/Sidebar'
import Header from '@/components/layout/Header'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">Chargement...</div>
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="flex h-screen bg-[#F5F6FA] p-4">
      <Sidebar />

      <div className="flex-1 flex flex-col ml-6">
        <Header />

        <main className="flex-1 overflow-y-auto p-2">
          {children}
        </main>
      </div>
    </div>
  )
}
