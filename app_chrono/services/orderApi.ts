import { config } from '../config';
import { apiFetch, parseApiErrorBody } from '../utils/apiFetch';
import { userApiService } from './userApiService';

type DeliveryMethod = 'moto' | 'vehicule' | 'cargo';

export const BASE_PRICES: Record<DeliveryMethod, { base: number; perKm: number }> = {
  moto: { base: 500, perKm: 200 },
  vehicule: { base: 800, perKm: 300 },
  cargo: { base: 1200, perKm: 450 },
};

const AVG_SPEED_KMH: Record<DeliveryMethod, number> = {
  moto: 25,
  vehicule: 20,
  cargo: 18,
};

function toRadians(deg: number) {
  return deg * (Math.PI / 180);
}

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

export function calculatePrice(distanceKm: number, method: DeliveryMethod): number {
  const pricing = BASE_PRICES[method] ?? BASE_PRICES.vehicule;
  return Math.max(0, Math.round(pricing.base + distanceKm * pricing.perKm));
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
  priceCfa: number;
  distanceKm: number;
}) {
  const token = await userApiService.ensureAccessToken();
  if (!token) {
    const err = new Error('Session expirée. Veuillez vous reconnecter.');
    (err as any).code = 'AUTH_REQUIRED';
    throw err;
  }

  const response = await apiFetch(`${config.apiUrl}/api/orders/record`, {
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
    }),
  });

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (!response.ok) {
    const msg = parseApiErrorBody(body, response.status, 'Impossible d’enregistrer la commande');
    const err = new Error(msg);
    const code = body && typeof body === 'object' && 'code' in body ? (body as { code?: string }).code : undefined;
    if (code) (err as any).code = code;
    throw err;
  }

  const orderId =
    body &&
    typeof body === 'object' &&
    'data' in body &&
    (body as { data?: { orderId?: string } }).data?.orderId;
  if (typeof orderId !== 'string' || !orderId) {
    throw new Error('Réponse serveur invalide (orderId manquant)');
  }

  return orderId;
}

export async function createOrderRecord(options: {
  userId: string;
  pickup: { address: string; coordinates: { latitude: number; longitude: number } };
  dropoff: { address: string; coordinates: { latitude: number; longitude: number } };
  method: DeliveryMethod;
}) {
  // NOTE: we intentionally do NOT pre-check for profile existence here.
  // The database RPC `fn_create_order` already contains logic to create a
  // minimal `profiles` row when appropriate (server-side). Relying on the
  // RPC avoids permission/RLS issues with the anon key and prevents false
  // negatives where the client cannot read `profiles` but the server can
  // create the missing profile from `auth.users`.
  const distanceKm = getDistanceInKm(options.pickup.coordinates, options.dropoff.coordinates);
  const priceCfa = calculatePrice(distanceKm, options.method);
  const etaMinutes = estimateDurationMinutes(distanceKm, options.method);
  const etaLabel = formatDurationLabel(etaMinutes);

  const orderId = await createOrderInDatabase({
    userId: options.userId,
    pickup: options.pickup,
    dropoff: options.dropoff,
    method: options.method,
    priceCfa,
    distanceKm,
  });

  return {
    orderId,
    priceCfa,
    distanceKm,
    etaMinutes,
    etaLabel,
  };
}

export default {
  createOrderRecord,
  createOrderInDatabase,
  calculatePrice,
  estimateDurationMinutes,
  formatDurationLabel,
  getDistanceInKm,
};

