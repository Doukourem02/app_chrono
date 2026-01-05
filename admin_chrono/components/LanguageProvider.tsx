'use client'

import { useEffect } from 'react'
import { useLanguageStore } from '@/stores/languageStore'

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const language = useLanguageStore((state) => state.language)

  useEffect(() => {
    // Appliquer la langue au document
    if (typeof window !== 'undefined') {
      document.documentElement.lang = language
    }
  }, [language])

  // Initialiser la langue au premier rendu
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedLanguage = localStorage.getItem('language-storage')
      if (storedLanguage) {
        try {
          const parsed = JSON.parse(storedLanguage)
          if (parsed.state?.language) {
            document.documentElement.lang = parsed.state.language
          }
        } catch {
          // Ignorer les erreurs de parsing
        }
      } else {
        // Si aucune langue n'est stockée, détecter la langue du navigateur
        const browserLang = navigator.language.split('-')[0]
        const defaultLang = browserLang === 'en' ? 'en' : 'fr'
        document.documentElement.lang = defaultLang
      }
    }
  }, [])

  return <>{children}</>
}

