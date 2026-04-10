/**
 * Envoie des événements de navigation vers Better Stack (Logtail HTTP ingest).
 * Créer une source dédiée « driver / navigation » dans Better Stack et définir
 * EXPO_PUBLIC_BETTER_STACK_SOURCE_TOKEN (le token est embarqué dans l’app — prévoir une source avec droits limités).
 */
import { config } from '../config';

const DEFAULT_INGEST = 'https://in.logs.betterstack.com';

type TelemetryLevel = 'debug' | 'info' | 'warn' | 'error';

function getToken(): string | undefined {
  const t = config.betterStackSourceToken?.trim();
  return t && t.length > 8 ? t : undefined;
}

function sendBatch(
  entries: { level: TelemetryLevel; message: string; fields?: Record<string, unknown> }[]
): void {
  const token = getToken();
  if (!token) return;

  const body = entries.map(({ level, message, fields }) => ({
    dt: new Date().toISOString(),
    level,
    message,
    service: 'driver-chrono-navigation',
    ...fields,
  }));

  const ingest =
    typeof config.betterStackIngestUrl === 'string' && config.betterStackIngestUrl.trim().length > 0
      ? config.betterStackIngestUrl.trim()
      : DEFAULT_INGEST;

  fetch(ingest, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  }).catch(() => {});
}

export function logNavigationEvent(
  event: string,
  fields?: Record<string, unknown>,
  level: TelemetryLevel = 'info'
): void {
  if (__DEV__) {
    console.info('[nav-telemetry]', event, fields ?? '');
  }
  sendBatch([{ level, message: event, fields: { event, ...fields } }]);
}

let lastProgressLogAt = 0;
const PROGRESS_MIN_INTERVAL_MS = 45_000;

/** Limite le volume : ~1 log / 45 s pendant le guidage actif */
export function logNavigationProgressThrottled(fields: Record<string, unknown>): void {
  const token = getToken();
  if (!token) return;
  const now = Date.now();
  if (now - lastProgressLogAt < PROGRESS_MIN_INTERVAL_MS) return;
  lastProgressLogAt = now;
  logNavigationEvent('nav_route_progress', fields);
}
