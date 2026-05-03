import { config } from '../config';
import { apiFetch } from '../utils/apiFetch';
import { userApiService } from './userApiService';
import { logger } from '../utils/logger';

async function authHeader(): Promise<{ Authorization: string } | Record<string, never>> {
  const token = await userApiService.ensureAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ─── Inscription comme partenaire depuis l'app ────────────────────────────────
export async function registerAsPartner(companyName: string): Promise<{ partner_id: string; status: string }> {
  const headers = await authHeader();
  const response = await apiFetch(`${config.apiUrl}/api/partners/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({ company_name: companyName }),
  });
  const body = await response.json() as { success?: boolean; data?: { partner_id: string; status: string }; message?: string };
  if (!response.ok || !body.success) {
    throw new Error(body.message ?? 'Erreur inscription partenaire');
  }
  return body.data!;
}

// ─── Se désenregistrer comme partenaire (retour utilisateur simple) ───────────
export async function deregisterAsPartner(): Promise<void> {
  const headers = await authHeader();
  const response = await apiFetch(`${config.apiUrl}/api/partners/deregister`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { message?: string };
    throw new Error(body.message ?? 'Erreur lors du passage en mode personnel');
  }
}

// ─── Commande B2B unique (Profil 1) ──────────────────────────────────────────

export interface B2BOrderParams {
  partnerId: string | null;
  userId: string;
  pickup: { address: string; lat?: number; lng?: number };
  dropoff: { address: string; lat?: number; lng?: number };
  recipient: { name: string; phone: string };
  vehicleType?: 'moto' | 'vehicule' | 'cargo';
  notes?: string;
}

export async function createB2BOrder(params: B2BOrderParams): Promise<{ orderId: string }> {
  const headers = await authHeader();
  const response = await apiFetch(`${config.apiUrl}/api/orders/record`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({
      userId: params.userId,
      partner_id: params.partnerId,
      pickup: { address: params.pickup.address, coordinates: { latitude: params.pickup.lat ?? 0, longitude: params.pickup.lng ?? 0 } },
      dropoff: { address: params.dropoff.address, coordinates: { latitude: params.dropoff.lat ?? 0, longitude: params.dropoff.lng ?? 0 } },
      recipient: params.recipient,
      method: params.vehicleType ?? 'moto',
      notes: params.notes,
    }),
  });

  const body = await response.json() as { success?: boolean; orderId?: string; data?: { orderId?: string } };
  if (!response.ok || !body.success) {
    throw new Error((body as any).message ?? 'Erreur création commande B2B');
  }
  return { orderId: body.orderId ?? (body.data?.orderId ?? '') };
}

// ─── Tournée (Profil 2) ───────────────────────────────────────────────────────

export interface BatchOrderItem {
  order_id?: string;
  lat?: number;
  lng?: number;
  recipient: { name: string; phone: string; address: string };
  notes?: string;
}

export interface CreateBatchParams {
  partnerId: string;
  userId: string;
  driverId?: string;
  pickupAddress: string;
  orders: BatchOrderItem[];
}

export async function createBatch(params: CreateBatchParams): Promise<{ batchId: string; orders: { orderId: string }[] }> {
  const headers = await authHeader();

  // 1. Créer chaque commande individuellement et récupérer les orderIds
  const createdOrders: { orderId: string; lat?: number; lng?: number }[] = [];
  for (const item of params.orders) {
    try {
      const result = await createB2BOrder({
        partnerId: params.partnerId,
        userId: params.userId,
        pickup: { address: params.pickupAddress },
        dropoff: { address: item.recipient.address, lat: item.lat, lng: item.lng },
        recipient: { name: item.recipient.name, phone: item.recipient.phone },
        vehicleType: 'moto',
        notes: item.notes,
      });
      createdOrders.push({ orderId: result.orderId, lat: item.lat, lng: item.lng });
    } catch (err) {
      logger.warn('[partnerApi] Erreur création commande dans la tournée', 'partnerApi', err);
    }
  }

  // 2. Créer la tournée avec les orderIds
  const response = await apiFetch(`${config.apiUrl}/api/batches`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({
      partner_id: params.partnerId,
      user_id: params.userId,
      driver_id: params.driverId ?? null,
      orders: createdOrders.map((o) => ({
        order_id: o.orderId,
        lat: o.lat,
        lng: o.lng,
      })),
    }),
  });

  const body = await response.json() as { success?: boolean; data?: { id?: string } };
  if (!response.ok || !body.success) {
    throw new Error((body as any).message ?? 'Erreur création tournée');
  }

  return { batchId: body.data?.id ?? '', orders: createdOrders };
}

// ─── Livreurs attitrés du partenaire ─────────────────────────────────────────

export interface PartnerDriver {
  id: string;
  user_id: string;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  vehicle_type?: string | null;
}

export async function getPartnerDrivers(partnerId: string): Promise<PartnerDriver[]> {
  try {
    const headers = await authHeader();
    const response = await apiFetch(`${config.apiUrl}/api/partners/${partnerId}/drivers`, {
      headers: { ...headers },
    });
    if (!response.ok) return [];
    const body = await response.json() as { data?: PartnerDriver[] };
    return body.data ?? [];
  } catch (err) {
    logger.warn('[partnerApi] getPartnerDrivers error', 'partnerApi', err);
    return [];
  }
}

// ─── Usage du quota ───────────────────────────────────────────────────────────

export interface PartnerUsageResult {
  deliveries_count: number;
  quota: number | null;
  remaining: number | null;
  over_quota: boolean;
  plan: string | null;
}

export async function getPartnerUsage(partnerId: string): Promise<PartnerUsageResult | null> {
  try {
    const headers = await authHeader();
    const response = await apiFetch(`${config.apiUrl}/api/partner/${partnerId}/usage`, {
      headers: { ...headers },
    });
    if (!response.ok) return null;
    const body = await response.json() as { data?: PartnerUsageResult };
    return body.data ?? null;
  } catch (err) {
    logger.warn('[partnerApi] getPartnerUsage error', 'partnerApi', err);
    return null;
  }
}
