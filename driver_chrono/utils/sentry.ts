import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';
import { config } from '../config/index';

/**
 * Initialise Sentry pour le monitoring d'erreurs
 * Ne capture les erreurs qu'en production
 */
export function initSentry() {
  const sentryDsn = Constants.expoConfig?.extra?.sentryDsn || 
                    process.env.EXPO_PUBLIC_SENTRY_DSN;

  if (!sentryDsn) {
    if (__DEV__) {
      console.log('⚠️ Sentry DSN non configuré - monitoring d\'erreurs désactivé');
    }
    return;
  }

  Sentry.init({
    dsn: sentryDsn,
    environment: config.app.environment,
    tracesSampleRate: config.app.environment === 'production' ? 0.1 : 1.0, // 10% en prod, 100% en dev
    beforeSend(event, hint) {
      // Filtrer les erreurs de développement
      if (__DEV__) {
        return null;
      }
      return event;
    },
  });

  if (__DEV__) {
    console.log('✅ Sentry initialisé pour le monitoring d\'erreurs');
  }
}

/**
 * Capture une erreur manuellement
 */
export function captureError(error: Error, context?: Record<string, any>) {
  if (process.env.EXPO_PUBLIC_SENTRY_DSN) {
    Sentry.captureException(error, {
      extra: context,
    });
  }
}

/**
 * Capture un message
 */
export function captureMessage(message: string, level: Sentry.SeverityLevel = 'info') {
  if (process.env.EXPO_PUBLIC_SENTRY_DSN) {
    Sentry.captureMessage(message, level);
  }
}

