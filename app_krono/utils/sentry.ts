import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';
import { config } from '../config/index';
import { logger } from './logger';
import {
  initBetterStackErrorTracking,
  addBreadcrumbToBetterStack,
  reportExceptionToBetterStack,
  reportMessageToBetterStack,
} from './betterStackReporting';

function getBetterStackDsn(): string | undefined {
  return (
    Constants.expoConfig?.extra?.betterStackDsn ||
    process.env.EXPO_PUBLIC_BETTERSTACK_DSN
  );
}

function buildSentryRelease(): string | undefined {
  const slug = Constants.expoConfig?.slug ?? 'app_chrono';
  const appVer =
    Constants.nativeAppVersion ?? Constants.expoConfig?.version ?? '0';
  const build = Constants.nativeBuildVersion;
  if (build) {
    return `${slug}@${appVer}+${build}`;
  }
  return `${slug}@${appVer}`;
}

/**
 * Initialise Sentry pour le monitoring d'erreurs
 * Ne capture les erreurs qu'en production
 */
export function initSentry() {
  const sentryDsn = Constants.expoConfig?.extra?.sentryDsn ||
                    process.env.EXPO_PUBLIC_SENTRY_DSN;

  if (!sentryDsn) {
    if (__DEV__) {
      logger.debug('Sentry DSN non configuré - monitoring d\'erreurs désactivé');
    }
  } else {
    Sentry.init({
      dsn: sentryDsn,
      release: buildSentryRelease(),
      environment: config.app.environment,
      tracesSampleRate: config.app.environment === 'production' ? 0.1 : 1.0,
      enableAutoSessionTracking: true,
      beforeSend(event) {
        if (__DEV__) {
          return null;
        }
        return event;
      },
    });

    if (__DEV__) {
      logger.debug('Sentry initialisé pour le monitoring d\'erreurs');
    }
  }

  // Better Stack Error Tracking en parallèle de Sentry, pour les erreurs JS
  // uniquement (les crashs natifs restent gérés par Sentry seul, voir
  // betterStackReporting.ts).
  initBetterStackErrorTracking(getBetterStackDsn(), config.app.environment);
}

function hasSentryDsn(): boolean {
  return Boolean(
    Constants.expoConfig?.extra?.sentryDsn || process.env.EXPO_PUBLIC_SENTRY_DSN
  );
}

/**
 * Capture une erreur manuellement
 */
export function captureError(error: Error, context?: Record<string, any>) {
  if (hasSentryDsn()) {
    Sentry.captureException(error, {
      extra: context,
    });
  }
  reportExceptionToBetterStack(error, context);
}

/**
 * Capture un message
 */
export function captureMessage(message: string, level: Sentry.SeverityLevel = 'info') {
  if (hasSentryDsn()) {
    Sentry.captureMessage(message, level);
  }
  reportMessageToBetterStack(message, level as 'info' | 'warning' | 'error');
}

/** Anti-spam : un événement Sentry au plus toutes les 90 s par clé (prod uniquement). */
const socketReportLastAt: Record<string, number> = {};
const SOCKET_REPORT_COOLDOWN_MS = 90_000;

/**
 * Breadcrumb + message d’avertissement sur sentry.io pour les soucis Socket.IO (prod).
 */
export function reportSocketIssue(
  eventKey: string,
  data: Record<string, unknown>
): void {
  if (__DEV__) {
    return;
  }

  if (hasSentryDsn()) {
    Sentry.addBreadcrumb({
      category: 'socket.io',
      level: 'error',
      message: eventKey,
      data,
    });
  }
  addBreadcrumbToBetterStack('socket.io', 'error', eventKey, data);

  const now = Date.now();
  const last = socketReportLastAt[eventKey] ?? 0;
  if (now - last < SOCKET_REPORT_COOLDOWN_MS) {
    return;
  }
  socketReportLastAt[eventKey] = now;

  if (hasSentryDsn()) {
    Sentry.captureMessage(`Socket: ${eventKey}`, {
      level: 'warning',
      tags: { socket_event: eventKey },
      extra: data,
    });
  }
  reportMessageToBetterStack(`Socket: ${eventKey}`, 'warning', data);
}

/** Breadcrumb info uniquement (pas de captureMessage) — ex. connexion Socket.IO réussie. */
export function addSocketSuccessBreadcrumb(
  eventKey: string,
  data: Record<string, unknown>
): void {
  if (__DEV__) {
    return;
  }
  if (hasSentryDsn()) {
    Sentry.addBreadcrumb({
      category: 'socket.io',
      level: 'info',
      message: eventKey,
      data,
    });
  }
  addBreadcrumbToBetterStack('socket.io', 'info', eventKey, data);
}

const liveActivityReportLastAt: Record<string, number> = {};
const LIVE_ACTIVITY_REPORT_COOLDOWN_MS = 90_000;

/**
 * ActivityKit (îlot / verrouillage) : breadcrumb + message Sentry en prod TestFlight / App Store.
 * Cooldown pour éviter le spam si iOS refuse en boucle (réglages, limite ActivityKit).
 */
export function reportLiveActivityIssue(
  reason: string,
  data: Record<string, unknown>
): void {
  if (__DEV__) {
    return;
  }

  if (hasSentryDsn()) {
    Sentry.addBreadcrumb({
      category: 'live_activity',
      level: 'warning',
      message: reason,
      data,
    });
  }
  addBreadcrumbToBetterStack('live_activity', 'warning', reason, data);

  const now = Date.now();
  const key = reason;
  const last = liveActivityReportLastAt[key] ?? 0;
  if (now - last < LIVE_ACTIVITY_REPORT_COOLDOWN_MS) {
    return;
  }
  liveActivityReportLastAt[key] = now;

  if (hasSentryDsn()) {
    Sentry.captureMessage(`LiveActivity: ${reason}`, {
      level: 'warning',
      tags: { live_activity_reason: reason },
      extra: data,
    });
  }
  reportMessageToBetterStack(`LiveActivity: ${reason}`, 'warning', data);
}
