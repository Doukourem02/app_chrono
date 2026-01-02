import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { supabase } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'
import { logger } from '@/utils/logger'

interface AuthState {
  user: User | null
  loading: boolean
  isAdmin: boolean
  setUser: (user: User | null) => void
  setLoading: (loading: boolean) => void
  checkAdminRole: () => Promise<boolean>
  signOut: () => Promise<void>
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      loading: true,
      isAdmin: false,

      setUser: (user) => set({ user }),

      setLoading: (loading) => set({ loading }),

      checkAdminRole: async () => {
        const { user } = get()
        if (!user) {
          set({ isAdmin: false })
          return false
        }

        try {
          // Vérifier le rôle admin dans la table users
          // D'abord par ID (correspondance avec auth.users.id)
          let { data, error } = await supabase
            .from('users')
            .select('role, email')
            .eq('id', user.id)
            .single()

          // Si pas trouvé par ID, essayer par email (fallback)
          if (error || !data) {
            const { data: emailData, error: emailError } = await supabase
              .from('users')
              .select('role, email, id')
              .eq('email', user.email || '')
              .single()

            if (emailError || !emailData) {
              logger.error('Admin role check failed:', error || emailError)
              logger.warn('⚠️ User not found in users table. Make sure the user exists with the correct ID or email.')
              set({ isAdmin: false })
              return false
            }

            // Avertir si les IDs ne correspondent pas
            if (emailData.id !== user.id) {
              logger.warn(
                `⚠️ ID mismatch: auth.users.id (${user.id}) != users.id (${emailData.id}). ` +
                `Update users.id to match auth.users.id for proper authentication.`
              )
            }

            data = emailData
            error = null
          }

          if (!data) {
            set({ isAdmin: false })
            return false
          }

          const isAdmin = data.role === 'admin' || data.role === 'super_admin'
          set({ isAdmin })
          return isAdmin
        } catch (error) {
          logger.error('Error checking admin role:', error)
          set({ isAdmin: false })
          return false
        }
      },

      signOut: async () => {
        await supabase.auth.signOut()
        set({ user: null, isAdmin: false })
      },
    }),
    {
      name: 'admin-auth-storage',
      partialize: (state) => ({ user: state.user, isAdmin: state.isAdmin }),
    }
  )
)

