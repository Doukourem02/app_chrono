/**
 * Tarification dynamique (niveau C) — doc krono-reference-unique.md §1
 * (coût base + prime temps trafic) × facteurs contextuels plafonnés.
 */

import {
  computeOrderPriceCfa,
  estimateDurationMinutes,
  normalizeDeliveryMethod,
  type DeliveryMethod,
} from './priceCalculator.js';
import { getWeatherMultiplierForCoords } from './openMeteoPricing.js';
import { getSurgeMultiplierSync } from './surgePricing.js';

export const MAX_CONTEXT_FACTOR = 1.85;

/** F CFA par minute au-delà de la durée théorique (trafic / route réelle). */
const EXTRA_MINUTE_RATES: Record<DeliveryMethod, number> = {
  moto: 12,
  vehicule: 15,
  cargo: 18,
};

/** Heure locale CI (UTC+0, pas d’heure d’été). */
export function getHourMultiplierAbidjan(date = new Date()): number {
  const h = date.getUTCHours();
  if ((h >= 7 && h <= 9) || (h >= 17 && h <= 20)) return 1.06;
  if (h >= 22 || h <= 5) return 1.04;
  return 1;
}

/**
 * Facteur trafic « léger » à partir du rapport durée réelle / durée de référence Mapbox.
 */
export function trafficContextFactor(
  durationSeconds?: number,
  typicalSeconds?: number
): number {
  if (
    durationSeconds == null ||
    typicalSeconds == null ||
    typicalSeconds <= 0 ||
    durationSeconds <= 0
  ) {
    return 1;
  }
  const ratio = durationSeconds / typicalSeconds;
  if (ratio <= 1) return 1;
  const raw = 1 + (ratio - 1) * 0.45;
  return Math.min(1.22, Math.max(1, raw));
}

export interface DynamicPricingInput {
  distanceKm: number;
  method: string;
  speedOptionId?: string;
  pickupLatitude?: number;
  pickupLongitude?: number;
  /** Durée route client (Mapbox), secondes */
  routeDurationSeconds?: number;
  /** Durée « typique » Mapbox (duration_typical), secondes — pour facteur trafic */
  routeDurationTypicalSeconds?: number;
  /** Si false, météo = 1 (aperçu rapide) */
  includeWeather?: boolean;
  /** Si false, surge = 1 */
  includeSurge?: boolean;
}

export interface DynamicPricingBreakdown {
  lineSubtotalCfa: number;
  timePremiumCfa: number;
  subtotalBeforeContextCfa: number;
  weatherFactor: number;
  surgeFactor: number;
  hourFactor: number;
  trafficFactor: number;
  contextFactorRaw: number;
  contextFactorApplied: number;
  totalCfa: number;
  labels: string[];
}

function roundMoney(n: number): number {
  return Math.max(0, Math.round(n));
}

export async function computeDynamicDeliveryPrice(
  input: DynamicPricingInput
): Promise<DynamicPricingBreakdown> {
  const m = normalizeDeliveryMethod(input.method);
  const lineSubtotalCfa = computeOrderPriceCfa(input.distanceKm, input.method, {
    speedOptionId: input.speedOptionId,
  });

  const theoreticalMin = estimateDurationMinutes(input.distanceKm, input.method);
  const actualMin =
    input.routeDurationSeconds != null && input.routeDurationSeconds > 0
      ? input.routeDurationSeconds / 60
      : theoreticalMin;
  const extraMin = Math.max(0, actualMin - theoreticalMin);
  const timePremiumCfa = roundMoney(extraMin * (EXTRA_MINUTE_RATES[m] ?? EXTRA_MINUTE_RATES.vehicule));

  const subtotalBeforeContextCfa = lineSubtotalCfa + timePremiumCfa;

  const weatherFactor =
    input.includeWeather !== false &&
    input.pickupLatitude != null &&
    input.pickupLongitude != null
      ? await getWeatherMultiplierForCoords(input.pickupLatitude, input.pickupLongitude)
      : 1;

  const surgeFactor = input.includeSurge !== false ? getSurgeMultiplierSync() : 1;
  const hourFactor = getHourMultiplierAbidjan();
  const trafficFactor = trafficContextFactor(
    input.routeDurationSeconds,
    input.routeDurationTypicalSeconds
  );

  const contextFactorRaw = weatherFactor * surgeFactor * hourFactor * trafficFactor;
  const contextFactorApplied = Math.min(MAX_CONTEXT_FACTOR, Math.max(1, contextFactorRaw));

  const totalCfa = roundMoney(subtotalBeforeContextCfa * contextFactorApplied);

  const labels: string[] = [];
  if (weatherFactor > 1.02) labels.push('météo');
  if (surgeFactor > 1.03) labels.push('forte demande');
  if (hourFactor > 1.02) labels.push('heures de pointe');
  if (trafficFactor > 1.03) labels.push('trafic');

  return {
    lineSubtotalCfa,
    timePremiumCfa,
    subtotalBeforeContextCfa,
    weatherFactor,
    surgeFactor,
    hourFactor,
    trafficFactor,
    contextFactorRaw,
    contextFactorApplied,
    totalCfa,
    labels,
  };
}
