import { config } from '../config/index';
import { apiFetch } from '../utils/apiFetch';
import { apiService } from './apiService';
import type { ActiveBatch, BatchStop } from '../store/useBatchStore';

type Coordinates = { latitude: number; longitude: number };

async function authHeader(): Promise<{ Authorization: string } | Record<string, never>> {
  const result = await apiService.ensureAccessToken();
  return result.token ? { Authorization: `Bearer ${result.token}` } : {};
}

function parseLocation(value: unknown): Record<string, any> | null {
  if (!value) return null;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' ? parsed as Record<string, any> : { address: value };
    } catch {
      return { address: value };
    }
  }
  if (typeof value === 'object') {
    return value as Record<string, any>;
  }
  return null;
}

function addressText(value: unknown): string {
  const parsed = parseLocation(value);
  if (!parsed) return '';
  const address = parsed.address ?? parsed.label ?? parsed.name;
  return typeof address === 'string' ? address : '';
}

function coordinatesFromLocation(value: unknown): Coordinates | undefined {
  const parsed = parseLocation(value);
  if (!parsed) return undefined;

  const candidate = parsed.coordinates ?? parsed.coords ?? parsed.location ?? parsed;
  if (Array.isArray(candidate) && candidate.length >= 2) {
    const lng = Number(candidate[0]);
    const lat = Number(candidate[1]);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return { latitude: lat, longitude: lng };
    }
    return undefined;
  }

  const lat = Number(candidate.latitude ?? candidate.lat ?? candidate.Lat ?? candidate.y);
  const lng = Number(candidate.longitude ?? candidate.lng ?? candidate.Lng ?? candidate.lon ?? candidate.x);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return undefined;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return undefined;
  return { latitude: lat, longitude: lng };
}

function detailsFromLocation(value: unknown): Record<string, any> {
  const parsed = parseLocation(value);
  const details = parsed?.details;
  return details && typeof details === 'object' ? details as Record<string, any> : {};
}

function notesText(value: unknown): string | undefined {
  const details = detailsFromLocation(value);
  const raw = details.driver_notes ?? details.notes ?? details.instructions;
  return typeof raw === 'string' && raw.trim() ? raw.trim() : undefined;
}

function recipientName(item: { recipient?: { name?: string }; dropoff_address?: unknown }): string {
  const fromRecipient = item.recipient?.name;
  if (typeof fromRecipient === 'string' && fromRecipient.trim()) return fromRecipient.trim();
  const details = detailsFromLocation(item.dropoff_address);
  const fromDetails = details.recipient_name ?? details.recipientName ?? details.name;
  return typeof fromDetails === 'string' && fromDetails.trim() ? fromDetails.trim() : 'Destinataire';
}

function recipientPhone(item: { recipient?: { phone?: string }; dropoff_address?: unknown }): string {
  const fromRecipient = item.recipient?.phone;
  if (typeof fromRecipient === 'string' && fromRecipient.trim()) return fromRecipient.trim();
  const details = detailsFromLocation(item.dropoff_address);
  const fromDetails = details.phone ?? details.recipientPhone;
  return typeof fromDetails === 'string' && fromDetails.trim() ? fromDetails.trim() : '';
}

export async function getBatch(batchId: string): Promise<ActiveBatch> {
  const headers = await authHeader();
  const response = await apiFetch(`${config.apiUrl}/api/batches/${encodeURIComponent(batchId)}`, {
    headers: { ...headers },
  });
  const body = await response.json() as {
    success?: boolean;
    data?: {
      id: string;
      orders_count?: number;
      orders?: {
        position: number;
        order_id: string;
        orders?: {
          id: string;
          status: string;
          dropoff_address?: unknown;
          recipient?: { name?: string; phone?: string };
          price_cfa?: number;
          delivery_qr_scanned_at?: string | null;
          proof?: {
            method?: BatchStop['proofMethod'];
            validated_at?: string | null;
          } | null;
        };
      }[];
    };
  };
  if (!response.ok || !body.success || !body.data) {
    throw new Error((body as any).message ?? 'Impossible de charger la tournée');
  }

  const raw = body.data;
  const stops: BatchStop[] = (raw.orders ?? [])
    .sort((a, b) => a.position - b.position)
    .map((item) => ({
      orderId: item.order_id,
      position: item.position,
      recipientName: recipientName(item.orders ?? {}),
      phone: recipientPhone(item.orders ?? {}),
      address: addressText(item.orders?.dropoff_address),
      coordinates: coordinatesFromLocation(item.orders?.dropoff_address),
      notes: notesText(item.orders?.dropoff_address),
      status: (item.orders?.status === 'completed'
        ? 'completed'
        : item.orders?.status === 'cancelled'
        ? 'cancelled'
        : 'pending') as BatchStop['status'],
      proofMethod: item.orders?.proof?.method ?? (item.orders?.delivery_qr_scanned_at ? 'batch_driver_confirmation' : null),
      proofValidatedAt: item.orders?.proof?.validated_at ?? item.orders?.delivery_qr_scanned_at ?? null,
    }));

  return {
    id: raw.id,
    ordersCount: stops.length,
    stops,
  };
}

export async function validateBatchOrder(
  batchId: string,
  orderId: string,
  status: 'completed' | 'cancelled',
  proof?: {
    proofMethod?: BatchStop['proofMethod'];
    location?: { latitude: number; longitude: number };
    alternativeProof?: {
      photoBase64?: string | null;
      signatureName?: string | null;
      timestamp?: string;
    };
  }
): Promise<void> {
  const headers = await authHeader();
  const response = await apiFetch(
    `${config.apiUrl}/api/batches/${encodeURIComponent(batchId)}/orders/${encodeURIComponent(orderId)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({ status, ...(proof ?? {}) }),
    }
  );
  const body = await response.json() as { success?: boolean };
  if (!response.ok || !body.success) {
    throw new Error((body as any).message ?? 'Erreur validation livraison');
  }
}
