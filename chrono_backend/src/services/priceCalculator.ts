/**
 * Source de vérité du prix livraison (niveau A — doc krono-reference-unique.md).
 * Grille alignée sur l’app client (base + km × perKm, options forfait fixe).
 */

export type DeliveryMethod = 'moto' | 'vehicule' | 'cargo';

/** Grille principale : forfait + tarif au km. */
export const DELIVERY_GRID: Record<DeliveryMethod, { base: number; perKm: number }> = {
  moto: { base: 500, perKm: 200 },
  vehicule: { base: 800, perKm: 300 },
  cargo: { base: 1200, perKm: 450 },
};

/**
 * Forfait fixe remplaçant DELIVERY_GRID[method].base pour une option vitesses / service
 * (même logique que DeliveryMethodBottomSheet côté app).
 */
const SPEED_FLAT_BY_METHOD: Record<string, Partial<Record<DeliveryMethod, number>>> = {
  express: { moto: 400 },
  standard: { moto: 350 },
  scheduled: { moto: 380 },
  pickup_service: { vehicule: 700 },
  full_service: { vehicule: 1000 },
};

const AVG_SPEED_KMH: Record<DeliveryMethod, number> = {
  moto: 25,
  vehicule: 20,
  cargo: 18,
};

/** Si aucune option n’est passée : défauts alignés sur la 1ʳᵉ option UI après reset (moto → express, véhicule → pickup_service). */
const DEFAULT_SPEED_OPTION: Partial<Record<DeliveryMethod, string>> = {
  moto: 'express',
  vehicule: 'pickup_service',
};

export function normalizeDeliveryMethod(method: string): DeliveryMethod {
  if (method === 'moto' || method === 'vehicule' || method === 'cargo') return method;
  return 'vehicule';
}

export function resolveFlatFee(method: DeliveryMethod, speedOptionId?: string): number {
  const grid = DELIVERY_GRID[method] ?? DELIVERY_GRID.vehicule;
  const effectiveId = speedOptionId ?? DEFAULT_SPEED_OPTION[method];
  if (!effectiveId) return grid.base;
  const override = SPEED_FLAT_BY_METHOD[effectiveId]?.[method];
  return override !== undefined ? override : grid.base;
}

/**
 * Prix total FCFA avant urgence (arrondi entier).
 */
export function computeOrderPriceCfa(
  distanceKm: number,
  method: string,
  opts?: { speedOptionId?: string }
): number {
  const m = normalizeDeliveryMethod(method);
  const grid = DELIVERY_GRID[m] ?? DELIVERY_GRID.vehicule;
  const flat = resolveFlatFee(m, opts?.speedOptionId);
  return Math.max(0, Math.round(flat + distanceKm * grid.perKm));
}

export function estimateDurationMinutes(distanceKm: number, method: string): number {
  const m = normalizeDeliveryMethod(method);
  const speed = AVG_SPEED_KMH[m] ?? AVG_SPEED_KMH.vehicule;
  if (!speed) return 0;
  return Math.max(0, Math.round((distanceKm / speed) * 60));
}

export function haversineDistanceKm(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number }
): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return Math.round(R * c * 100) / 100;
}

export interface PriceCalculationParams {
  distance: number;
  deliveryMethod: DeliveryMethod;
  isUrgent?: boolean;
  customPricePerKm?: number;
  speedOptionId?: string;
}

export interface PriceCalculationResult {
  basePrice: number;
  urgencyFee: number;
  totalPrice: number;
  pricePerKm: number;
  breakdown: {
    distance: number;
    pricePerKm: number;
    flatFee: number;
    distanceCharge: number;
    urgencyFee: number;
    total: number;
  };
}

export const URGENCY_FEE_PERCENTAGE = 0.3;

export function calculateDeliveryPrice(params: PriceCalculationParams): PriceCalculationResult {
  const { distance, deliveryMethod, isUrgent = false, customPricePerKm, speedOptionId } = params;
  const m = normalizeDeliveryMethod(deliveryMethod);
  const grid = DELIVERY_GRID[m] ?? DELIVERY_GRID.vehicule;
  const perKm = customPricePerKm ?? grid.perKm;

  let flatFee: number;
  let distanceCharge: number;
  let lineTotal: number;

  if (customPricePerKm !== undefined) {
    flatFee = 0;
    distanceCharge = Math.round(distance * customPricePerKm);
    lineTotal = distanceCharge;
  } else {
    flatFee = resolveFlatFee(m, speedOptionId);
    distanceCharge = Math.round(distance * perKm);
    lineTotal = flatFee + distanceCharge;
  }

  const urgencyFee = isUrgent ? Math.round(lineTotal * URGENCY_FEE_PERCENTAGE) : 0;
  const totalPrice = lineTotal + urgencyFee;

  return {
    basePrice: lineTotal,
    urgencyFee,
    totalPrice,
    pricePerKm: perKm,
    breakdown: {
      distance: Math.round(distance * 100) / 100,
      pricePerKm: perKm,
      flatFee,
      distanceCharge,
      urgencyFee,
      total: totalPrice,
    },
  };
}

export function getPricePerKm(deliveryMethod: DeliveryMethod): number {
  return DELIVERY_GRID[deliveryMethod]?.perKm ?? DELIVERY_GRID.vehicule.perKm;
}

export function validatePriceParams(params: PriceCalculationParams): { valid: boolean; error?: string } {
  if (params.distance == null || Number.isNaN(params.distance) || params.distance <= 0) {
    return { valid: false, error: 'La distance doit être supérieure à 0' };
  }
  if (!params.deliveryMethod || !['moto', 'vehicule', 'cargo'].includes(params.deliveryMethod)) {
    return { valid: false, error: 'Méthode de livraison invalide' };
  }
  if (params.customPricePerKm !== undefined && params.customPricePerKm <= 0) {
    return { valid: false, error: 'Le tarif personnalisé par km doit être supérieur à 0' };
  }
  return { valid: true };
}
