import * as Sentry from '@sentry/node';

let betterStackScope: Sentry.Scope | null = null;

if (process.env.BETTERSTACK_DSN) {
  const betterStackClient = new Sentry.NodeClient({
    dsn: process.env.BETTERSTACK_DSN,
    environment: process.env.NODE_ENV || 'development',
    transport: Sentry.makeNodeTransport,
    stackParser: Sentry.defaultStackParser,
    integrations: Sentry.getDefaultIntegrations({}),
  });
  betterStackClient.init();

  betterStackScope = new Sentry.Scope();
  betterStackScope.setClient(betterStackClient);
}

/**
 * Envoie l'erreur à Sentry et à Better Stack en parallèle (chacun seulement
 * si son DSN est configuré). Point d'entrée unique pour ne pas dupliquer
 * cette logique à chaque appel de captureException dans le code.
 */
export function captureException(
  error: unknown,
  captureContext?: Parameters<typeof Sentry.captureException>[1]
): void {
  if (process.env.SENTRY_DSN) {
    Sentry.captureException(error, captureContext);
  }
  betterStackScope?.captureException(error, captureContext);
}
