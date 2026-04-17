import { config } from '../config';
import { apiFetch, parseApiErrorBody } from '../utils/apiFetch';
import { logger } from '../utils/logger';
import { userApiService } from './userApiService';

type DeliveryMethod = 'moto' | 'vehicule' | 'cargo';

/**
 * Grille tarifaire — à garder alignée avec `chrono_backend/src/services/priceCalculator.ts` (DELIVERY_GRID).
 */
export const BASE_PRICES: Record<DeliveryMethod, { base: number; perKm: number }> = {
  moto: { base: 500, perKm: 200 },
  vehicule: { base: 800, perKm: 300 },
  cargo: { base: 1200, perKm: 450 },
};

const SPEED_FLAT_BY_METHOD: Record<string, Partial<Record<DeliveryMethod, number>>> = {
  express: { moto: 300 },
  standard: { moto: 250 },
  scheduled: { moto: 280 },
  pickup_service: { vehicule: 700 },
  full_service: { vehicule: 1000 },
};

const DEFAULT_SPEED_OPTION: Partial<Record<DeliveryMethod, string>> = {
  moto: 'express',
  vehicule: 'pickup_service',
};

function resolveFlatFee(method: DeliveryMethod, speedOptionId?: string): number {
  const grid = BASE_PRICES[method] ?? BASE_PRICES.vehicule;
  const effectiveId = speedOptionId ?? DEFAULT_SPEED_OPTION[method];
  if (!effectiveId) return grid.base;
  const override = SPEED_FLAT_BY_METHOD[effectiveId]?.[method];
  return override !== undefined ? override : grid.base;
}

/** Prix FCFA (forfait option + km × tarif) — même logique que le serveur. */
export function computeOrderPriceCfa(
  distanceKm: number,
  method: DeliveryMethod,
  speedOptionId?: string
): number {
  const grid = BASE_PRICES[method] ?? BASE_PRICES.vehicule;
  const flat = resolveFlatFee(method, speedOptionId);
  return Math.max(0, Math.round(flat + distanceKm * grid.perKm));
}

const AVG_SPEED_KMH: Record<DeliveryMethod, number> = {
  moto: 25,
  vehicule: 20,
  cargo: 18,
};

function toRadians(deg: number) {
  return deg * (Math.PI / 180);
}

/** Distance minimale envoyée à `/api/orders/record` (évite 400 si points identiques ou arrondi à 0). */
export const MIN_ORDER_DISTANCE_KM = 0.01;

export function getDistanceInKm(
  start: { latitude: number; longitude: number },
  end: { latitude: number; longitude: number },
): number {
  const R = 6371; // Rayon de la Terre en km
  const dLat = toRadians(end.latitude - start.latitude);
  const dLon = toRadians(end.longitude - start.longitude);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(start.latitude)) *
      Math.cos(toRadians(end.latitude)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round((R * c) * 100) / 100; // Arrondi à 2 décimales
}

export function calculatePrice(
  distanceKm: number,
  method: DeliveryMethod,
  speedOptionId?: string
): number {
  return computeOrderPriceCfa(distanceKm, method, speedOptionId);
}

export function estimateDurationMinutes(distanceKm: number, method: DeliveryMethod): number {
  const speed = AVG_SPEED_KMH[method] ?? AVG_SPEED_KMH.vehicule;
  if (!speed) return 0;
  return Math.max(0, Math.round((distanceKm / speed) * 60));
}

export function formatDurationLabel(minutes: number | null | undefined): string | null {
  if (minutes == null || Number.isNaN(minutes)) return null;
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  if (remaining === 0) {
    return `${hours}h`;
  }
  return `${hours}h ${remaining}min`;
}

export async function createOrderInDatabase(params: {
  userId: string;
  pickup: any;
  dropoff: any;
  method: DeliveryMethod;
  /** Indicatif client — le serveur recalcule (tarif dynamique) */
  priceCfa: number;
  distanceKm: number;
  speedOptionId?: string;
  routeDurationSeconds?: number;
  routeDurationTypicalSeconds?: number;
}): Promise<{ orderId: string; priceCfa: number; distanceKm: number }> {
  const token = await userApiService.ensureAccessToken();
  if (!token) {
    const err = new Error('Session expirée. Veuillez vous reconnecter.');
    (err as any).code = 'AUTH_REQUIRED';
    throw err;
  }

  const url = `${config.apiUrl}/api/orders/record`;
  let response: Response;
  try {
    response = await apiFetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        userId: params.userId,
        pickup: params.pickup,
        dropoff: params.dropoff,
        method: params.method,
        priceCfa: params.priceCfa,
        distanceKm: params.distanceKm,
        ...(params.speedOptionId ? { speedOptionId: params.speedOptionId } : {}),
        ...(params.routeDurationSeconds != null
          ? { routeDurationSeconds: params.routeDurationSeconds }
          : {}),
        ...(params.routeDurationTypicalSeconds != null
          ? { routeDurationTypicalSeconds: params.routeDurationTypicalSeconds }
          : {}),
      }),
    });
  } catch (e: unknown) {
    logger.warn(
      '[orders/record] échec réseau / timeout (client)',
      'orderApi',
      e instanceof Error ? { name: e.name, message: e.message } : { detail: String(e) }
    );
    throw e;
  }

  const requestId =
    typeof response.headers?.get === 'function' ? response.headers.get('x-request-id') : null;

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (!response.ok) {
    const msg = parseApiErrorBody(body, response.status, 'Impossible d’enregistrer la commande');
    const code =
      body && typeof body === 'object' && 'code' in body
        ? (body as { code?: string }).code
        : undefined;
    logger.warn('[orders/record] réponse HTTP erreur (client)', 'orderApi', {
      status: response.status,
      requestId: requestId ?? undefined,
      code: code ?? undefined,
      message: msg,
    });
    const err = new Error(msg);
    if (code) (err as any).code = code;
    (err as any).httpStatus = response.status;
    if (requestId) (err as any).requestId = requestId;
    throw err;
  }

  const data =
    body && typeof body === 'object' && 'data' in body
      ? (body as { data?: { orderId?: string; priceCfa?: number; distanceKm?: number } }).data
      : undefined;
  const orderId = data?.orderId;
  if (typeof orderId !== 'string' || !orderId) {
    logger.warn('[orders/record] réponse 200 sans orderId (client)', 'orderApi', {
      requestId: requestId ?? undefined,
    });
    const err = new Error('Réponse serveur invalide (orderId manquant)');
    if (requestId) (err as any).requestId = requestId;
    (err as any).httpStatus = response.status;
    throw err;
  }

  return {
    orderId,
    priceCfa:
      typeof data.priceCfa === 'number' && Number.isFinite(data.priceCfa)
        ? data.priceCfa
        : params.priceCfa,
    distanceKm:
      typeof data.distanceKm === 'number' && Number.isFinite(data.distanceKm)
        ? data.distanceKm
        : params.distanceKm,
  };
}

export async function createOrderRecord(options: {
  userId: string;
  pickup: { address: string; coordinates: { latitude: number; longitude: number } };
  dropoff: { address: string; coordinates: { latitude: number; longitude: number } };
  method: DeliveryMethod;
  speedOptionId?: string;
  /** Distance route Mapbox (km) — sinon vol d’oiseau */
  routeDistanceKm?: number;
  /** Durée route (secondes) — sinon estimée par vitesse moyenne */
  routeDurationSeconds?: number;
  /** Durée typique Mapbox (secondes) — facteur trafic côté serveur */
  routeDurationTypicalSeconds?: number;
}) {
  // NOTE: we intentionally do NOT pre-check for profile existence here.
  // The database RPC `fn_create_order` already contains logic to create a
  // minimal `profiles` row when appropriate (server-side). Relying on the
  // RPC avoids permission/RLS issues with the anon key and prevents false
  // negatives where the client cannot read `profiles` but the server can
  // create the missing profile from `auth.users`.
  const fallbackKm = getDistanceInKm(options.pickup.coordinates, options.dropoff.coordinates);
  const rawKm =
    options.routeDistanceKm != null &&
    Number.isFinite(options.routeDistanceKm) &&
    options.routeDistanceKm > 0
      ? options.routeDistanceKm
      : fallbackKm;
  const roundedKm =
    Number.isFinite(rawKm) && rawKm > 0 ? Math.round(rawKm * 100) / 100 : 0;
  const distanceKm =
    roundedKm > 0 ? Math.max(MIN_ORDER_DISTANCE_KM, roundedKm) : MIN_ORDER_DISTANCE_KM;

  const priceCfa = computeOrderPriceCfa(distanceKm, options.method, options.speedOptionId);

  const etaMinutes =
    options.routeDurationSeconds != null &&
    Number.isFinite(options.routeDurationSeconds) &&
    options.routeDurationSeconds > 0
      ? Math.max(0, Math.round(options.routeDurationSeconds / 60))
      : estimateDurationMinutes(distanceKm, options.method);
  const etaLabel = formatDurationLabel(etaMinutes);

  const saved = await createOrderInDatabase({
    userId: options.userId,
    pickup: options.pickup,
    dropoff: options.dropoff,
    method: options.method,
    priceCfa,
    distanceKm,
    speedOptionId: options.speedOptionId,
    routeDurationSeconds: options.routeDurationSeconds,
    routeDurationTypicalSeconds: options.routeDurationTypicalSeconds,
  });

  return {
    orderId: saved.orderId,
    priceCfa: saved.priceCfa,
    distanceKm: saved.distanceKm,
    etaMinutes,
    etaLabel,
  };
}

export default {
  createOrderRecord,
  createOrderInDatabase,
  calculatePrice,
  computeOrderPriceCfa,
  estimateDurationMinutes,
  formatDurationLabel,
  getDistanceInKm,
};

