'use client'

import React, { Component, ErrorInfo, ReactNode } from 'react'
import { logger } from '@/utils/logger'
import ErrorPage from '@/components/error/ErrorPage'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Logger l'erreur (visible uniquement dans les logs, pas à l'utilisateur)
    logger.error('ErrorBoundary caught an error:', {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    })

    this.setState({
      error,
      errorInfo,
    })

    // En production, envoyer à Sentry si disponible
    if (process.env.NODE_ENV === 'production') {
      // Import dynamique pour éviter les erreurs si Sentry n'est pas installé
      import('@sentry/nextjs')
        .then((Sentry) => {
          if (Sentry && typeof Sentry.captureException === 'function') {
            Sentry.captureException(error, {
              contexts: {
                react: {
                  componentStack: errorInfo.componentStack,
                },
              },
              tags: { type: 'error_boundary' },
            })
            logger.debug('Error sent to Sentry')
          }
        })
        .catch(() => {
          // Sentry n'est pas installé ou non configuré - ce n'est pas critique
          logger.debug('Sentry not available, error logged locally only')
        })
    }
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    })
  }

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      // En production, ne jamais afficher les détails techniques à l'utilisateur
      return (
        <ErrorPage
          title="Une erreur est survenue"
          message="Désolé, une erreur inattendue s'est produite. Veuillez réessayer ou contacter le support si le problème persiste."
          showRetry={true}
          showHome={true}
          onRetry={this.handleReset}
        />
      )
    }

    return this.props.children
  }
}

