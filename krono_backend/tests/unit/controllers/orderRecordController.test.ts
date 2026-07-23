/**
 * Tests unitaires pour orderRecordController — création/liste des commandes.
 * Fonction la plus sensible côté argent du backend : le prix final facturé vient
 * TOUJOURS du recalcul serveur (`computeDynamicDeliveryPrice`), jamais du prix
 * envoyé par le client (qui ne sert qu'à logguer un écart suspect). Couvre aussi
 * l'IDOR (`userId !== authUser.id`) et le scope partenaire (`canUsePartner`).
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import type { Response } from 'express';

const mockPool = { query: jest.fn<(...args: any[]) => Promise<any>>() };
await jest.unstable_mockModule('../../../src/config/db.js', () => ({
  __esModule: true,
  default: mockPool,
}));

const mockRpc = jest.fn<(...args: any[]) => Promise<any>>();
const mockSupabaseClient = { rpc: mockRpc };
await jest.unstable_mockModule('../../../src/config/supabase.js', () => ({
  __esModule: true,
  supabase: mockSupabaseClient,
  supabaseAdmin: mockSupabaseClient,
  default: mockSupabaseClient,
}));

const mockComputeDynamicDeliveryPrice = jest.fn<(...args: any[]) => Promise<any>>();
await jest.unstable_mockModule('../../../src/services/dynamicPricing.js', () => ({
  __esModule: true,
  computeDynamicDeliveryPrice: mockComputeDynamicDeliveryPrice,
}));

const mockComputeB2BCommission = jest.fn<(...args: any[]) => Promise<any>>();
const mockIncrementPartnerUsage = jest.fn();
await jest.unstable_mockModule('../../../src/services/b2bCommissionService.js', () => ({
  __esModule: true,
  computeB2BCommission: mockComputeB2BCommission,
  incrementPartnerUsage: mockIncrementPartnerUsage,
}));

await jest.unstable_mockModule('../../../src/sockets/orderSocket.js', () => ({
  __esModule: true,
  notifyDriversForOrder: jest.fn(() => Promise.resolve()),
}));

await jest.unstable_mockModule('../../../src/services/qrCodeService.js', () => ({
  __esModule: true,
  default: { generateDeliveryQRCode: jest.fn(() => Promise.resolve({})) },
}));

const orderRecordController = await import('../../../src/controllers/orderRecordController.js');

describe('orderRecordController', () => {
  let mockRequest: any;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPool.query.mockReset();
    mockRequest = {
      params: {},
      body: {},
      query: {},
      app: { get: jest.fn(() => null) },
    };
    mockResponse = {
      status: jest.fn().mockReturnThis() as any,
      json: jest.fn().mockReturnThis() as any,
    };
  });

  describe('createOrderRecord — le prix vient toujours du serveur, jamais du client', () => {
    const validBody = {
      userId: 'user-1',
      pickup: { coordinates: { latitude: 5.3, longitude: -4.0 } },
      dropoff: { coordinates: { latitude: 5.35, longitude: -4.05 } },
      method: 'moto',
      distanceKm: 5,
      priceCfa: 1, // prix client falsifié à la baisse
    };

    it('refuse une requête non authentifiée (401)', async () => {
      mockRequest.body = validBody;
      await orderRecordController.createOrderRecord(mockRequest, mockResponse as Response);
      expect(mockResponse.status).toHaveBeenCalledWith(401);
    });

    it("refuse de créer une commande pour un autre utilisateur (403 IDOR)", async () => {
      mockRequest.user = { id: 'user-attacker', role: 'client' };
      mockRequest.body = validBody; // userId: 'user-1' !== 'user-attacker'

      await orderRecordController.createOrderRecord(mockRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockRpc).not.toHaveBeenCalled();
    });

    it('rejette une requête B2B sans accès au partenaire (403)', async () => {
      mockRequest.user = { id: 'user-1', role: 'client' };
      mockRequest.body = { ...validBody, partner_id: 'partner-1' };
      mockPool.query.mockResolvedValueOnce({ rowCount: 0 } as any); // canUsePartner -> false

      await orderRecordController.createOrderRecord(mockRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockRpc).not.toHaveBeenCalled();
    });

    it("ignore le prix client falsifié et facture le prix recalculé serveur", async () => {
      mockRequest.user = { id: 'user-1', role: 'client' };
      mockRequest.body = validBody; // priceCfa: 1, mais le serveur va calculer 2500
      mockComputeDynamicDeliveryPrice.mockResolvedValueOnce({
        totalCfa: 2500,
        labels: [],
        contextFactorApplied: 1,
      } as any);
      mockRpc.mockResolvedValueOnce({ data: 'order-123', error: null } as any);

      await orderRecordController.createOrderRecord(mockRequest, mockResponse as Response);

      expect(mockRpc).toHaveBeenCalledWith(
        'fn_create_order',
        expect.objectContaining({ p_price: 2500 })
      );
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, data: expect.objectContaining({ priceCfa: 2500 }) })
      );
    });

    it('ajoute la commission B2B au-dessus du prix serveur pour une commande partenaire', async () => {
      mockRequest.user = { id: 'user-1', role: 'client' };
      mockRequest.body = { ...validBody, partner_id: 'partner-1' };
      mockPool.query.mockResolvedValueOnce({ rowCount: 1 } as any); // canUsePartner -> true (membre)
      mockComputeDynamicDeliveryPrice.mockResolvedValueOnce({
        totalCfa: 2000,
        labels: [],
        contextFactorApplied: 1,
      } as any);
      mockComputeB2BCommission.mockResolvedValueOnce({ rate: 0.05, type: 'pay_per_delivery', plan: null } as any);
      mockRpc.mockResolvedValueOnce({ data: 'order-456', error: null } as any);
      mockPool.query.mockResolvedValue({ rows: [] } as any); // getOrderColumns etc. post-création

      await orderRecordController.createOrderRecord(mockRequest, mockResponse as Response);

      // 2000 + 5% = 2100
      expect(mockRpc).toHaveBeenCalledWith('fn_create_order', expect.objectContaining({ p_price: 2100 }));
    });

    it('renvoie 400 si la RPC de création échoue', async () => {
      mockRequest.user = { id: 'user-1', role: 'client' };
      mockRequest.body = validBody;
      mockComputeDynamicDeliveryPrice.mockResolvedValueOnce({ totalCfa: 2500, labels: [], contextFactorApplied: 1 } as any);
      mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'contrainte violée', code: '23505' } } as any);

      await orderRecordController.createOrderRecord(mockRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
    });
  });

  describe('listOrderRecords', () => {
    it('refuse une requête non authentifiée (401)', async () => {
      await orderRecordController.listOrderRecords(mockRequest, mockResponse as Response);
      expect(mockResponse.status).toHaveBeenCalledWith(401);
    });

    it("refuse l'accès à un partenaire dont l'utilisateur n'est pas membre (403)", async () => {
      mockRequest.user = { id: 'user-1', role: 'client' };
      mockRequest.query = { partner_id: 'partner-1' };
      mockPool.query.mockResolvedValueOnce({ rowCount: 0 } as any);

      await orderRecordController.listOrderRecords(mockRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
    });

    it("scope la requête sur user_id quand aucun partner_id n'est fourni", async () => {
      mockRequest.user = { id: 'user-1', role: 'client' };
      mockPool.query.mockResolvedValueOnce({ rows: [] } as any);

      await orderRecordController.listOrderRecords(mockRequest, mockResponse as Response);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('user_id = $1'),
        expect.arrayContaining(['user-1'])
      );
    });
  });
});
