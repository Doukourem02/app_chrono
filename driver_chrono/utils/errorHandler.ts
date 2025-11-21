import { logger } from './logger';

export enum ErrorType {
  NETWORK = 'NETWORK',
  VALIDATION = 'VALIDATION',
  PERMISSION = 'PERMISSION',
  LOCATION = 'LOCATION',
  API = 'API',
  UNKNOWN = 'UNKNOWN',
}

export interface AppError {
  type: ErrorType;
  message: string;
  originalError?: any;
  component?: string;
  userMessage?: string;
}

class ErrorHandler {
  private static instance: ErrorHandler;
  private lastErrors: Map<string, number> = new Map(); // Cache des dernières erreurs
  private errorThrottleTime = 5000; // 5 secondes entre les mêmes erreurs

  private constructor() {}

  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  private shouldShowError(errorKey: string): boolean {
    const now = Date.now();
    const lastTime = this.lastErrors.get(errorKey) || 0;
    
    if (now - lastTime > this.errorThrottleTime) {
      this.lastErrors.set(errorKey, now);
      return true;
    }
    return false;
  }

  handle(error: AppError) {
    // Créer une clé unique pour l'erreur
    const errorKey = `${error.type}-${error.component}-${error.message}`;
    
    // Toujours logger l'erreur (dans les logs, pas visible à l'utilisateur)
    logger.error(
      `${error.type}: ${error.message}`,
      error.component,
      error.originalError
    );

    // En production, ne jamais afficher les détails techniques à l'utilisateur
    // Afficher uniquement un message générique si nécessaire
    if (!__DEV__ && error.userMessage && this.shouldShowError(errorKey)) {
      // En production, utiliser un message générique
      logger.userError(
        'Une erreur s\'est produite. Veuillez réessayer ou contacter le support si le problème persiste.',
        'Erreur'
      );
    } else if (__DEV__ && error.userMessage && this.shouldShowError(errorKey)) {
      // En développement, afficher le message détaillé
      logger.userError(error.userMessage);
    }

    // Envoyer l'erreur à un service de monitoring
    this.reportError(error);
  }

  private reportError(error: AppError) {
    // En production, envoyer l'erreur à un service de monitoring
    if (!__DEV__) {
      // L'erreur est déjà capturée par Sentry via l'ErrorBoundary
      // Ici on peut ajouter d'autres services de monitoring si nécessaire
      try {
        const { captureError } = require('./sentry');
        if (error.originalError instanceof Error) {
          captureError(error.originalError, {
            type: error.type,
            component: error.component,
            userMessage: error.userMessage,
          });
        }
      } catch (e) {
        // Ignorer si Sentry n'est pas disponible
      }
    }
  }

  // Méthodes utilitaires pour créer des erreurs typées
  createNetworkError(message: string, originalError?: any, component?: string): AppError {
    return {
      type: ErrorType.NETWORK,
      message,
      originalError,
      component,
      userMessage: 'Problème de connexion. Vérifiez votre connexion internet.',
    };
  }

  createValidationError(message: string, component?: string): AppError {
    return {
      type: ErrorType.VALIDATION,
      message,
      component,
      userMessage: 'Veuillez vérifier les informations saisies.',
    };
  }

  createLocationError(message: string, originalError?: any, component?: string): AppError {
    return {
      type: ErrorType.LOCATION,
      message,
      originalError,
      component,
      userMessage: 'Impossible d\'accéder à votre position. Vérifiez les autorisations.',
    };
  }

  createAPIError(message: string, originalError?: any, component?: string): AppError {
    return {
      type: ErrorType.API,
      message,
      originalError,
      component,
      userMessage: 'Service temporairement indisponible. Réessayez plus tard.',
    };
  }
}

export const errorHandler = ErrorHandler.getInstance();

// Hook utilitaire pour gérer les erreurs dans les composants
export const useErrorHandler = () => {
  const handleError = (error: any, component?: string, userMessage?: string) => {
    let appError: AppError;

    if (error.name === 'Network Error' || error.code === 'NETWORK_ERROR') {
      appError = errorHandler.createNetworkError(error.message, error, component);
    } else if (error.code === 'LOCATION_ERROR') {
      appError = errorHandler.createLocationError(error.message, error, component);
    } else if (error.response) {
      // Erreur API
      appError = errorHandler.createAPIError(
        `API Error: ${error.response.status}`,
        error,
        component
      );
    } else {
      appError = {
        type: ErrorType.UNKNOWN,
        message: error.message || 'Une erreur inattendue s\'est produite',
        originalError: error,
        component,
        userMessage: userMessage || 'Une erreur inattendue s\'est produite',
      };
    }

    errorHandler.handle(appError);
  };

  return { handleError };
};

