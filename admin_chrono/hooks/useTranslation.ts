import { useLanguageStore } from '@/stores/languageStore'
import { getTranslation } from '@/lib/i18n'
import type { TranslationKey } from '@/lib/i18n'

/**
 * Hook React pour utiliser les traductions
 * @example
 * const t = useTranslation()
 * const title = t('settings.title')
 */
export function useTranslation() {
  const language = useLanguageStore((state) => state.language)

  return (key: TranslationKey, params?: Record<string, string | number>) => {
    return getTranslation(language, key, params)
  }
}

