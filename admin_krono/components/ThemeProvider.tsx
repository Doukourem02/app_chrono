'use client'

import { useEffect } from 'react'
import { useThemeStore } from '@/stores/themeStore'

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useThemeStore((state) => state.theme)

  useEffect(() => {
    // Appliquer le thème au chargement et à chaque changement
    if (typeof window !== 'undefined') {
      document.documentElement.classList.remove('light', 'dark')
      document.documentElement.classList.add(theme)
    }
  }, [theme])

  // Initialiser le thème au premier rendu
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedTheme = localStorage.getItem('theme-storage')
      if (storedTheme) {
        try {
          const parsed = JSON.parse(storedTheme)
          if (parsed.state?.theme) {
            document.documentElement.classList.remove('light', 'dark')
            document.documentElement.classList.add(parsed.state.theme)
          }
        } catch {
          // Ignorer les erreurs de parsing
        }
      }
    }
  }, [])

  return <>{children}</>
}

