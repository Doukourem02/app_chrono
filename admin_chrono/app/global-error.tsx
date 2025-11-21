'use client'

import { useEffect } from 'react'
import ErrorPage from '@/components/error/ErrorPage'
import { logger } from '@/utils/logger'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Logger l'erreur critique
    logger.error('Global error caught:', {
      message: error.message,
      stack: error.stack,
      digest: error.digest,
    })

    // En production, envoyer à un service de monitoring
    if (process.env.NODE_ENV === 'production') {
      // TODO: Intégrer Sentry ou autre service de monitoring
      // Sentry.captureException(error, { tags: { type: 'global_error' }, level: 'fatal' })
    }
  }, [error])

  return (
    <html lang="fr">
      <body>
        <ErrorPage
          title="Erreur critique"
          message="Une erreur critique s'est produite. L'application a été rechargée. Si le problème persiste, veuillez contacter le support."
          showRetry={true}
          showHome={true}
          onRetry={reset}
        />
      </body>
    </html>
  )
}

