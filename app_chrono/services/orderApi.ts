import { supabase } from '../utils/supabase';

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
  const { data, error } = await supabase.rpc('fn_create_order', {
    p_user_id: params.userId,
    p_pickup: params.pickup,
    p_dropoff: params.dropoff,
    p_method: params.method,
    p_price: params.priceCfa,
    p_distance: params.distanceKm,
  });

  if (error) {
    throw error;
  }

  return data as string; // order_id
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

