import {
  BrowserClient,
  Scope,
  defaultStackParser,
  makeFetchTransport,
} from '@sentry/browser';

// Client Sentry-compatible séparé, pointé vers Better Stack, en plus de
// Sentry (déjà initialisé dans sentry.ts). On reste volontairement sur
// @sentry/browser (JS pur, transport fetch) plutôt que de recréer un
// ReactNativeClient : ça évite de toucher au SDK natif (crashs natifs
// iOS/Android), qui reste géré uniquement par Sentry.
let betterStackScope: Scope | null = null;

export function initBetterStackErrorTracking(dsn: string | undefined, environment: string): void {
  if (!dsn) {
    return;
  }

  const client = new BrowserClient({
    dsn,
    environment,
    transport: makeFetchTransport,
    stackParser: defaultStackParser,
    integrations: [],
    beforeSend(event) {
      if (__DEV__) {
        return null;
      }
      return event;
    },
  });
  client.init();

  betterStackScope = new Scope();
  betterStackScope.setClient(client);
}

export function reportExceptionToBetterStack(
  error: unknown,
  extra?: Record<string, unknown>
): void {
  if (!betterStackScope) {
    return;
  }
  const scope = betterStackScope.clone();
  if (extra) {
    scope.setExtras(extra);
  }
  scope.captureException(error);
}

export function reportMessageToBetterStack(
  message: string,
  level: 'info' | 'warning' | 'error' = 'info',
  extra?: Record<string, unknown>
): void {
  if (!betterStackScope) {
    return;
  }
  const scope = betterStackScope.clone();
  if (extra) {
    scope.setExtras(extra);
  }
  scope.captureMessage(message, level);
}
