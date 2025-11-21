/**
 * Gestionnaire d'erreurs centralisé pour l'application
 * Toutes les erreurs sont loggées mais jamais affichées aux utilisateurs en production
 */

import { logger } from './logger'

export interface AppError {
  message: string
  code?: string
  statusCode?: number
  originalError?: unknown
  context?: Record<string, unknown>
}

export class ErrorHandler {
  /**
   * Gère une erreur de manière sécurisée
   * En production : log uniquement, pas d'affichage à l'utilisateur
   * En développement : log + détails dans la console
   */
  static handle(error: unknown, context?: string): AppError {
    const isDevelopment = process.env.NODE_ENV === 'development'
    
    const appError: AppError = {
      message: 'Une erreur inattendue s\'est produite',
      originalError: error,
      context: context ? { component: context } : undefined,
    }

    // Extraire les informations de l'erreur
    if (error instanceof Error) {
      appError.message = error.message
      appError.code = error.name
    } else if (typeof error === 'string') {
      appError.message = error
    } else if (error && typeof error === 'object') {
      const err = error as Record<string, unknown>
      appError.message = (err.message as string) || appError.message
      appError.code = (err.code as string) || appError.code
      appError.statusCode = (err.statusCode as number) || (err.status as number)
    }

    // Logger l'erreur (toujours dans les logs, jamais visible à l'utilisateur)
    logger.error('ErrorHandler:', {
      message: appError.message,
      code: appError.code,
      statusCode: appError.statusCode,
      context: appError.context,
      stack: error instanceof Error ? error.stack : undefined,
    })

    // En production, envoyer à un service de monitoring si nécessaire
    if (!isDevelopment) {
      // TODO: Intégrer Sentry ou autre service de monitoring
      // Sentry.captureException(error, {
      //   tags: { context },
      //   extra: appError.context,
      // })
    }

    return appError
  }

  /**
   * Gère une erreur API de manière sécurisée
   */
  static handleApiError(error: unknown, endpoint?: string): AppError {
    const appError = this.handle(error, endpoint ? `API: ${endpoint}` : 'API')
    
    // En production, ne jamais exposer les détails de l'erreur API
    if (process.env.NODE_ENV === 'production') {
      appError.message = 'Une erreur s\'est produite lors de la communication avec le serveur'
    }

    return appError
  }

  /**
   * Gère une erreur réseau de manière sécurisée
   */
  static handleNetworkError(error: unknown): AppError {
    const appError = this.handle(error, 'Network')
    
    // Message générique pour l'utilisateur
    appError.message = 'Problème de connexion. Vérifiez votre connexion internet et réessayez.'

    return appError
  }

  /**
   * Gère une erreur de validation de manière sécurisée
   */
  static handleValidationError(error: unknown, field?: string): AppError {
    const appError = this.handle(error, field ? `Validation: ${field}` : 'Validation')
    
    // Message générique pour l'utilisateur
    appError.message = field 
      ? `Le champ "${field}" contient une valeur invalide`
      : 'Les données fournies sont invalides'

    return appError
  }
}

/**
 * Hook pour gérer les erreurs dans les composants React
 */
export function useErrorHandler() {
  const handleError = (error: unknown, context?: string) => {
    return ErrorHandler.handle(error, context)
  }

  const handleApiError = (error: unknown, endpoint?: string) => {
    return ErrorHandler.handleApiError(error, endpoint)
  }

  const handleNetworkError = (error: unknown) => {
    return ErrorHandler.handleNetworkError(error)
  }

  return {
    handleError,
    handleApiError,
    handleNetworkError,
  }
}

