import type { Language } from '@/stores/languageStore'

// Import des traductions
import frTranslations from '@/locales/fr.json'
import enTranslations from '@/locales/en.json'

const translations = {
  fr: frTranslations,
  en: enTranslations,
} as const

export type TranslationKey = string

// Type pour les valeurs de traduction (peut être un objet ou une chaîne)
type TranslationValue = string | Record<string, TranslationValue>

/**
 * Récupère une traduction pour une clé donnée
 * @param language - La langue actuelle
 * @param key - La clé de traduction (ex: "settings.title")
 * @param params - Paramètres optionnels pour remplacer des valeurs dans la traduction
 * @returns La traduction ou la clé si non trouvée
 */
export function getTranslation(
  language: Language,
  key: TranslationKey,
  params?: Record<string, string | number>
): string {
  const keys = key.split('.')
  let value: TranslationValue = translations[language]

  // Naviguer dans l'objet de traduction
  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = value[k]
    } else {
      // Si la clé n'existe pas, essayer en français comme fallback
      if (language !== 'fr') {
        let fallbackValue: TranslationValue = translations.fr
        for (const fallbackKey of keys) {
          if (fallbackValue && typeof fallbackValue === 'object' && fallbackKey in fallbackValue) {
            fallbackValue = fallbackValue[fallbackKey]
          } else {
            return key // Retourner la clé si même le fallback échoue
          }
        }
        value = fallbackValue
        break
      }
      return key // Retourner la clé si non trouvée
    }
  }

  // Si la valeur finale est une chaîne, remplacer les paramètres
  if (typeof value === 'string' && params) {
    return value.replace(/\{\{(\w+)\}\}/g, (match, paramKey) => {
      return params[paramKey]?.toString() || match
    })
  }

  return typeof value === 'string' ? value : key
}

/**
 * Hook personnalisé pour utiliser les traductions
 * Note: Ce n'est pas un vrai hook React, mais une fonction utilitaire
 * Pour un vrai hook, voir useTranslation dans hooks/useTranslation.ts
 */
export function t(language: Language, key: TranslationKey, params?: Record<string, string | number>): string {
  return getTranslation(language, key, params)
}

