import { config } from '../config';
import { apiFetch } from '../utils/apiFetch';
import { userApiService } from './userApiService';
import { logger } from '../utils/logger';

async function authHeader(): Promise<{ Authorization: string } | Record<string, never>> {
  const token = await userApiService.ensureAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ─── Inscription comme partenaire depuis l'app ────────────────────────────────
export async function registerAsPartner(
  companyName: string,
  plan?: string,
  portalEmail?: string,
): Promise<{ partner_id: string; status: string }> {
  const headers = await authHeader();
  const response = await apiFetch(`${config.apiUrl}/api/partners/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({
      company_name: companyName,
      ...(plan != null && plan !== '' ? { plan } : {}),
      ...(portalEmail ? { portal_email: portalEmail } : {}),
    }),
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

// ─── Toggle simple mode business/perso (partner déjà enregistré) ─────────────
export async function setBusinessMode(active: boolean): Promise<void> {
  const headers = await authHeader();
  const response = await apiFetch(`${config.apiUrl}/api/partners/business-mode`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({ active }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { message?: string };
    throw new Error(body.message ?? 'Erreur toggle mode business');
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
  notifyDrivers?: boolean;
}

export async function createB2BOrder(params: B2BOrderParams): Promise<{ orderId: string }> {
  const headers = await authHeader();
  const pickup = {
    address: params.pickup.address,
    ...(params.pickup.lat !== undefined && params.pickup.lng !== undefined
      ? { coordinates: { latitude: params.pickup.lat, longitude: params.pickup.lng } }
      : {}),
  };
  const dropoff = {
    address: params.dropoff.address,
    ...(params.dropoff.lat !== undefined && params.dropoff.lng !== undefined
      ? { coordinates: { latitude: params.dropoff.lat, longitude: params.dropoff.lng } }
      : {}),
  };

  const response = await apiFetch(`${config.apiUrl}/api/orders/record`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({
      userId: params.userId,
      partner_id: params.partnerId,
      pickup,
      dropoff,
      recipient: params.recipient,
      method: params.vehicleType ?? 'moto',
      notes: params.notes,
      notifyDrivers: params.notifyDrivers ?? true,
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
  pickupCoords?: { lat: number; lng: number } | null;
  orders: BatchOrderItem[];
}

export async function createBatch(params: CreateBatchParams): Promise<{ batchId: string; orders: { orderId: string; position: number; clientOrderIndex: number }[] }> {
  const headers = await authHeader();
  const response = await apiFetch(`${config.apiUrl}/api/batches`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({
      partner_id: params.partnerId,
      user_id: params.userId,
      driver_id: params.driverId ?? null,
      pickup_address: params.pickupAddress,
      pickup_coords: params.pickupCoords
        ? { latitude: params.pickupCoords.lat, longitude: params.pickupCoords.lng }
        : null,
      orders: params.orders.map((item, index) => ({
        recipient: item.recipient,
        lat: item.lat,
        lng: item.lng,
        notes: item.notes,
        client_order_index: index,
      })),
    }),
  });

  const body = await response.json() as {
    success?: boolean;
    data?: {
      id?: string;
      orders?: { order_id?: string; position?: number; client_order_index?: number }[];
    };
  };
  if (!response.ok || !body.success) {
    throw new Error((body as any).message ?? 'Erreur création tournée');
  }

  return {
    batchId: body.data?.id ?? '',
    orders: (body.data?.orders ?? []).map((item, index) => ({
      orderId: item.order_id ?? '',
      position: item.position ?? index + 1,
      clientOrderIndex: item.client_order_index ?? index,
    })),
  };
}

// ─── Livreurs attitrés du partenaire ─────────────────────────────────────────

export interface PartnerDriver {
  id: string;
  partner_id: string;
  driver_user_id: string;
  is_default: boolean;
  created_at: string;
  driver: {
    id: string;
    first_name?: string | null;
    last_name?: string | null;
    phone?: string | null;
    avatar_url?: string | null;
  };
  profile: {
    is_online: boolean;
    is_available: boolean;
    accepts_b2b_orders: boolean;
    vehicle_type?: string | null;
    completed_deliveries: number;
    rating?: number | null;
  };
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
