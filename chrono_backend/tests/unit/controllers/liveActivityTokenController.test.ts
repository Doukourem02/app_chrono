/**
 * Tests unitaires pour liveActivityTokenController — Live Activities iOS (suivi de
 * commande sur écran verrouillé). Couvre le scope IDOR (`userOwnsOrder`) et la
 * validation du token APNs.
 */

import { describe, it, expect, beforeEach, jest, afterAll } from '@jest/globals';
import type { Response } from 'express';

const mockPool = { query: jest.fn<(...args: any[]) => Promise<any>>() };
await jest.unstable_mockModule('../../../src/config/db.js', () => ({
  __esModule: true,
  default: mockPool,
}));

const liveActivityTokenController = await import('../../../src/controllers/liveActivityTokenController.js');

const VALID_TOKEN = 'a'.repeat(64);

describe('liveActivityTokenController', () => {
  let mockRequest: any;
  let mockResponse: Partial<Response>;
  const originalDbUrl = process.env.DATABASE_URL;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPool.query.mockReset();
    process.env.DATABASE_URL = 'postgres://test';

    mockRequest = { params: {}, body: {}, query: {} };
    mockResponse = {
      status: jest.fn().mockReturnThis() as any,
      json: jest.fn().mockReturnThis() as any,
    };
  });

  afterAll(() => {
    process.env.DATABASE_URL = originalDbUrl;
  });

  describe('registerLiveActivityToken', () => {
    it('refuse une requête non authentifiée (401)', async () => {
      mockRequest.body = { orderId: 'order-1', pushToken: VALID_TOKEN };

      await liveActivityTokenController.registerLiveActivityToken(mockRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockPool.query).not.toHaveBeenCalled();
    });

    it('refuse un rôle non-client (403)', async () => {
      mockRequest.user = { id: 'driver-1', role: 'driver' };
      mockRequest.body = { orderId: 'order-1', pushToken: VALID_TOKEN };

      await liveActivityTokenController.registerLiveActivityToken(mockRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
    });

    it('rejette un pushToken APNs mal formé (400)', async () => {
      mockRequest.user = { id: 'client-1', role: 'client' };
      mockRequest.body = { orderId: 'order-1', pushToken: 'not-a-valid-token' };

      await liveActivityTokenController.registerLiveActivityToken(mockRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockPool.query).not.toHaveBeenCalled();
    });

    it("refuse d'enregistrer une Live Activity sur une commande d'un autre utilisateur (IDOR)", async () => {
      mockRequest.user = { id: 'client-1', role: 'client' };
      mockRequest.body = { orderId: 'order-of-another-user', pushToken: VALID_TOKEN };
      mockPool.query.mockResolvedValueOnce({ rows: [] } as any); // userOwnsOrder -> false

      await liveActivityTokenController.registerLiveActivityToken(mockRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
    });

    it('enregistre le token pour le propriétaire de la commande', async () => {
      mockRequest.user = { id: 'client-1', role: 'client' };
      mockRequest.body = { orderId: 'order-1', pushToken: VALID_TOKEN };
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ id: 'order-1' }] } as any) // userOwnsOrder -> true
        .mockResolvedValueOnce({ rows: [{ id: 'token-1', created_at: 'x', updated_at: 'x' }] } as any);

      await liveActivityTokenController.registerLiveActivityToken(mockRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, data: expect.objectContaining({ id: 'token-1' }) })
      );
    });
  });

  describe('endLiveActivityToken', () => {
    it('refuse une requête non authentifiée (401)', async () => {
      mockRequest.body = { orderId: 'order-1' };

      await liveActivityTokenController.endLiveActivityToken(mockRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockPool.query).not.toHaveBeenCalled();
    });

    it('scope toujours la requête SQL sur user_id = utilisateur connecté', async () => {
      mockRequest.user = { id: 'client-1', role: 'client' };
      mockRequest.body = { orderId: 'order-1' };
      mockPool.query.mockResolvedValueOnce({ rowCount: 1 } as any);

      await liveActivityTokenController.endLiveActivityToken(mockRequest, mockResponse as Response);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('user_id = $1'),
        expect.arrayContaining(['client-1'])
      );
    });
  });
});
