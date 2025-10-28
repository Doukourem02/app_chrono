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
    
    // Toujours logger l'erreur
    logger.error(
      `${error.type}: ${error.message}`,
      error.component,
      error.originalError
    );

    // Afficher le message à l'utilisateur seulement si pas de spam
    if (error.userMessage && this.shouldShowError(errorKey)) {
      logger.userError(error.userMessage);
    }

    // Ici on pourrait aussi envoyer l'erreur à un service de monitoring
    // comme Sentry, Crashlytics, etc.
    this.reportError(error);
  }

  private reportError(error: AppError) {
    // En production, envoyer l'erreur à un service de monitoring
    if (!__DEV__) {
      // Example: Sentry.captureException(error);
      console.log('Error reported to monitoring service:', error);
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