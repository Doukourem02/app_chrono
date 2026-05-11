import pool from '../config/db.js';
import { maskUserId } from '../utils/maskSensitiveData.js';
import logger from '../utils/logger.js';
import { computeOrderPriceCfa } from '../services/priceCalculator.js';
import { formatEtaMinutes, realisticEtaMinutesFromRoute } from '../utils/ivoryCoastEta.js';
import { activeOrders } from './orderSocketState.js';

// ── Delay helper ───────────────────────────────────────────────────────────────
export function delayMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Engin type normalisation ───────────────────────────────────────────────────
/** Type d'engin : commande (`delivery_method`) ↔ profil livreur (`vehicle_type`). */
export function normalizeEnginType(
  m: string | undefined | null
): 'moto' | 'vehicule' | 'cargo' | null {
  const s = String(m ?? '').trim().toLowerCase();
  if (s === 'moto') return 'moto';
  if (s === 'vehicule' || s === 'vehicle' || s === 'voiture' || s === 'car') return 'vehicule';
  if (s === 'cargo') return 'cargo';
  return null;
}

export function orderRequiredEngin(orderMethod: string): 'moto' | 'vehicule' | 'cargo' {
  return normalizeEnginType(orderMethod) ?? 'vehicule';
}

export function driverMatchesOrderEngin(
  driverVehicleType: string | undefined | null,
  orderMethod: string
): boolean {
  const need = orderRequiredEngin(orderMethod);
  // Profils sans vehicle_type : ne plus exclure systématiquement (sinon « en ligne » mais aucun match).
  // On assimile à « moto », le cas le plus courant ; cargo / voiture exigent un type explicite en base.
  const got = normalizeEnginType(driverVehicleType) ?? 'moto';
  return got === need;
}

// ── Active orders counters ─────────────────────────────────────────────────────
// Fonction pour compter les commandes actives d'un client
export function getActiveOrdersCountByUser(userId: string): number {
  let count = 0;
  for (const [, order] of activeOrders.entries()) {
    if (
      order.user.id === userId &&
      order.status !== 'completed' &&
      order.status !== 'cancelled' &&
      order.status !== 'declined'
    ) {
      count++;
    }
  }
  return count;
}

// Fonction pour compter les commandes actives d'un livreur
export function getActiveOrdersCountByDriver(driverId: string): number {
  let count = 0;
  for (const [, order] of activeOrders.entries()) {
    if (
      order.driverId === driverId &&
      order.status !== 'completed' &&
      order.status !== 'cancelled' &&
      order.status !== 'declined'
    ) {
      count++;
    }
  }
  return count;
}

// ── Client profile loader ──────────────────────────────────────────────────────
/** Profil client depuis `users` (source de vérité pour le nom affiché aux livreurs). */
export async function loadClientProfileForOrder(userId: string): Promise<{
  name: string;
  first_name: string | null;
  last_name: string | null;
  avatar?: string;
  phone?: string;
}> {
  try {
    const userResult = await (pool as any).query(
      'SELECT first_name, last_name, avatar_url, phone, email FROM users WHERE id = $1',
      [userId]
    );
    const row = userResult.rows?.[0];
    if (!row) {
      return { name: 'Client', first_name: null, last_name: null };
    }
    const full = [row.first_name, row.last_name].filter(Boolean).join(' ').trim();
    const name =
      full ||
      (row.email ? String(row.email).split('@')[0] : '') ||
      'Client';
    return {
      name,
      first_name: row.first_name ?? null,
      last_name: row.last_name ?? null,
      avatar: row.avatar_url || undefined,
      phone: row.phone || undefined,
    };
  } catch (e: any) {
    logger.warn(`loadClientProfileForOrder échoué pour ${maskUserId(userId)}:`, e?.message || e);
    return { name: 'Client', first_name: null, last_name: null };
  }
}

// ── Distance / geo helpers ─────────────────────────────────────────────────────
// Fonction pour calculer la distance entre deux points
export function getDistanceInKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Rayon de la Terre en km
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

// ── Price / duration helpers ───────────────────────────────────────────────────
/** Prix serveur (source unique — priceCalculator.ts). Export pour tests / outils. */
export function calculatePrice(
  distance: number,
  method: string,
  speedOptionId?: string
): number {
  return computeOrderPriceCfa(distance, method, { speedOptionId });
}

// Fonction pour estimer la durée
export function estimateDuration(
  distance: number,
  method: string,
  routeDurationSeconds?: number
): string {
  return formatEtaMinutes(
    realisticEtaMinutesFromRoute({
      distanceMeters: Math.max(0, Number(distance) || 0) * 1000,
      durationSeconds: routeDurationSeconds,
      vehicleType: method,
    })
  );
}

// ── Vehicle type enrichment ────────────────────────────────────────────────────
export async function enrichCandidateVehicleTypes(
  candidates: Map<string, Record<string, unknown>>
): Promise<void> {
  const missing: string[] = [];
  for (const [id, d] of candidates.entries()) {
    const vt = d.vehicle_type as string | undefined | null;
    if (vt == null || String(vt).trim() === '') missing.push(id);
  }
  if (missing.length === 0 || !process.env.DATABASE_URL) return;
  try {
    const { rows } = await pool.query<{ user_id: string; vehicle_type: string | null }>(
      `SELECT user_id, vehicle_type FROM driver_profiles WHERE user_id = ANY($1::uuid[])`,
      [missing]
    );
    for (const r of rows) {
      const c = candidates.get(r.user_id);
      if (c && r.vehicle_type != null && String(r.vehicle_type).trim() !== '') {
        c.vehicle_type = r.vehicle_type;
      }
    }
  } catch (e: any) {
    logger.warn('[enrichCandidateVehicleTypes]', e?.message || e);
  }
}
