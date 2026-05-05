import { config } from '../config/index';
import { apiFetch } from '../utils/apiFetch';
import { apiService } from './apiService';
import type { ActiveBatch, BatchStop } from '../store/useBatchStore';

async function authHeader(): Promise<{ Authorization: string } | Record<string, never>> {
  const result = await apiService.ensureAccessToken();
  return result.token ? { Authorization: `Bearer ${result.token}` } : {};
}

function addressText(value: unknown): string {
  if (!value) return '';
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as { address?: unknown };
      return typeof parsed?.address === 'string' ? parsed.address : value;
    } catch {
      return value;
    }
  }
  if (typeof value === 'object' && 'address' in value) {
    const address = (value as { address?: unknown }).address;
    return typeof address === 'string' ? address : '';
  }
  return '';
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
      recipientName: item.orders?.recipient?.name ?? 'Destinataire',
      phone: item.orders?.recipient?.phone ?? '',
      address: addressText(item.orders?.dropoff_address),
      status: (item.orders?.status === 'completed'
        ? 'completed'
        : item.orders?.status === 'cancelled'
        ? 'cancelled'
        : 'pending') as BatchStop['status'],
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
  status: 'completed' | 'cancelled'
): Promise<void> {
  const headers = await authHeader();
  const response = await apiFetch(
    `${config.apiUrl}/api/batches/${encodeURIComponent(batchId)}/orders/${encodeURIComponent(orderId)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({ status }),
    }
  );
  const body = await response.json() as { success?: boolean };
  if (!response.ok || !body.success) {
    throw new Error((body as any).message ?? 'Erreur validation livraison');
  }
}
