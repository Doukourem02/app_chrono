import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Language = 'fr' | 'en'

interface LanguageStore {
  language: Language
  setLanguage: (language: Language) => void
  toggleLanguage: () => void
}

export const useLanguageStore = create<LanguageStore>()(
  persist(
    (set) => ({
      language: 'fr', // Français par défaut
      setLanguage: (language: Language) => {
        set({ language })
        // Appliquer la langue au document
        if (typeof window !== 'undefined') {
          document.documentElement.lang = language
        }
      },
      toggleLanguage: () => {
        set((state) => {
          const newLanguage = state.language === 'fr' ? 'en' : 'fr'
          // Appliquer la langue au document
          if (typeof window !== 'undefined') {
            document.documentElement.lang = newLanguage
          }
          return { language: newLanguage }
        })
      },
    }),
    {
      name: 'language-storage',
      onRehydrateStorage: () => (state) => {
        // Appliquer la langue au chargement
        if (state && typeof window !== 'undefined') {
          document.documentElement.lang = state.language
        }
      },
    }
  )
)

