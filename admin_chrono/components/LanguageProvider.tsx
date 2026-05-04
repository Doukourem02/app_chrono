'use client'

import { useEffect } from 'react'
import { useLanguageStore } from '@/stores/languageStore'

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const language = useLanguageStore((state) => state.language)
  const setLanguage = useLanguageStore((state) => state.setLanguage)

  useEffect(() => {
    // Appliquer la langue au document
    if (typeof window !== 'undefined') {
      document.documentElement.lang = language
    }
  }, [language])

  // Première visite : aligner le store (donc les traductions) avec la langue du navigateur.
  // Avant la correction, on ne mettait que document.lang, ce qui désynchronisait l’UI.
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (localStorage.getItem('language-storage')) return

    const browserLang = navigator.language.split('-')[0]
    const defaultLang = browserLang === 'en' ? 'en' : 'fr'
    if (useLanguageStore.getState().language !== defaultLang) {
      setLanguage(defaultLang)
    }
  }, [setLanguage])

  return <>{children}</>
}

