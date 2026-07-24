/**
 * Tests unitaires pour QRCodeService.scanQRCode — le QR est la preuve de remise d'une
 * livraison (voir docs/krono-reference-unique.md section 8). Couvre les 2 propriétés de
 * sécurité les plus sensibles : un QR ne peut valider que SA commande (pas celle d'un
 * autre arrêt de tournée) et une signature falsifiée est rejetée, plus le chemin nominal
 * et la protection anti-rescan.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import crypto from 'crypto';

const mockPool = { query: jest.fn<(...args: any[]) => Promise<any>>() };
await jest.unstable_mockModule('../../../src/config/db.js', () => ({
  __esModule: true,
  default: mockPool,
}));

const mockCompleteTransactionsForOrder = jest.fn<(...args: any[]) => Promise<any>>();
await jest.unstable_mockModule('../../../src/utils/createTransactionForOrder.js', () => ({
  __esModule: true,
  completeTransactionsForOrder: mockCompleteTransactionsForOrder,
}));

const { default: qrCodeService } = await import('../../../src/services/qrCodeService.js');

// Réplique exacte de QRCodeService.generateSignature (même secret par défaut, même ordre de champs).
const QR_CODE_SECRET =
  process.env.QR_CODE_SECRET || 'change-me-in-production-minimum-32-characters-long-secret-key';

function signQrPayload(data: {
  orderId: string;
  orderNumber: string;
  recipientName: string;
  recipientPhone: string;
  creatorName: string;
  timestamp: string;
  expiresAt: string;
}): string {
  const payload = JSON.stringify(data);
  return crypto.createHmac('sha256', QR_CODE_SECRET).update(payload).digest('hex');
}

function buildSignedQr(overrides: Partial<{ orderId: string; expiresAt: string }> = {}) {
  const base = {
    orderId: overrides.orderId ?? 'order-a',
    orderNumber: 'KR-001',
    recipientName: 'Fatou',
    recipientPhone: '+2250700000000',
    creatorName: 'Krono',
    timestamp: new Date().toISOString(),
    expiresAt: overrides.expiresAt ?? new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  };
  const signature = signQrPayload(base);
  return JSON.stringify({ ...base, signature });
}

describe('QRCodeService.scanQRCode', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPool.query.mockReset();
    mockCompleteTransactionsForOrder.mockReset();
  });

  it("refuse un QR valide mais qui correspond à un AUTRE arrêt de la tournée (QR_ORDER_MISMATCH)", async () => {
    const qr = buildSignedQr({ orderId: 'order-b' });
    mockPool.query.mockResolvedValueOnce({ rows: [] } as any); // recordInvalidScan

    const result = await qrCodeService.scanQRCode(qr, 'driver-1', undefined, undefined, 'order-a');

    expect(result.success).toBe(false);
    expect(result.code).toBe('QR_ORDER_MISMATCH');
  });

  it('rejette une signature falsifiée (QR_SIGNATURE_INVALID)', async () => {
    const qr = buildSignedQr();
    const tampered = JSON.parse(qr);
    tampered.recipientName = 'Nom modifié après signature';
    mockPool.query.mockResolvedValueOnce({ rows: [] } as any); // recordInvalidScan

    const result = await qrCodeService.scanQRCode(JSON.stringify(tampered), 'driver-1');

    expect(result.success).toBe(false);
    expect(result.code).toBe('QR_SIGNATURE_INVALID');
  });

  it('refuse un second scan du même QR déjà validé (QR_ALREADY_SCANNED)', async () => {
    const qr = buildSignedQr({ orderId: 'order-a' });
    mockPool.query
      .mockResolvedValueOnce({
        rows: [{ id: 'order-a', status: 'picked_up', driver_id: 'driver-1', user_id: 'client-1' }],
      } as any) // fetch commande
      .mockResolvedValueOnce({ rows: [{ id: 'scan-1' }] } as any); // déjà scanné avec succès

    const result = await qrCodeService.scanQRCode(qr, 'driver-1');

    expect(result.success).toBe(false);
    expect(result.code).toBe('QR_ALREADY_SCANNED');
  });

  it('valide un scan légitime (bonne commande, bon livreur, statut picked_up)', async () => {
    const qr = buildSignedQr({ orderId: 'order-a' });
    mockPool.query
      .mockResolvedValueOnce({
        rows: [{ id: 'order-a', status: 'picked_up', driver_id: 'driver-1', user_id: 'client-1' }],
      } as any) // fetch commande
      .mockResolvedValueOnce({ rows: [] } as any) // pas déjà scanné
      .mockResolvedValueOnce({ rows: [] } as any) // recordValidScan (insert)
      .mockResolvedValueOnce({ rows: [] } as any); // update orders -> completed
    mockCompleteTransactionsForOrder.mockResolvedValueOnce(undefined);

    const result = await qrCodeService.scanQRCode(qr, 'driver-1', undefined, undefined, 'order-a');

    expect(result.success).toBe(true);
    expect(result.isValid).toBe(true);
    expect(result.data?.orderId).toBe('order-a');
    expect(mockCompleteTransactionsForOrder).toHaveBeenCalledWith('order-a');
  });
});
