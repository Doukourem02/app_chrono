/**
 * Tests unitaires pour adminModerationController — ratings/promo/disputes admin.
 * Toutes les routes sont déjà admin-gated (verifyAdminSupabase, voir adminRoutes.ts) ;
 * on couvre ici la logique métier propre (validations, 404 cohérents).
 */

import { describe, it, expect, beforeEach, jest, afterAll } from '@jest/globals';
import type { Request, Response } from 'express';

const mockPool = { query: jest.fn<(...args: any[]) => Promise<any>>() };
await jest.unstable_mockModule('../../../src/config/db.js', () => ({
  __esModule: true,
  default: mockPool,
}));

const adminModerationController = await import('../../../src/controllers/adminModerationController.js');

describe('adminModerationController', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  const originalDbUrl = process.env.DATABASE_URL;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPool.query.mockReset();
    process.env.DATABASE_URL = 'postgres://test';
    mockRequest = { params: {}, body: {}, query: {} } as unknown as Partial<Request>;
    mockResponse = {
      status: jest.fn().mockReturnThis() as any,
      json: jest.fn().mockReturnThis() as any,
    };
  });

  afterAll(() => {
    process.env.DATABASE_URL = originalDbUrl;
  });

  describe('deleteAdminRating', () => {
    it("renvoie 404 si l'évaluation n'existe pas", async () => {
      mockRequest.params = { ratingId: 'rating-x' };
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ exists: true }] } as any) // table check
        .mockResolvedValueOnce({ rows: [] } as any); // delete -> rien supprimé

      await adminModerationController.deleteAdminRating(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
    });

    it('supprime une évaluation existante', async () => {
      mockRequest.params = { ratingId: 'rating-1' };
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ exists: true }] } as any)
        .mockResolvedValueOnce({ rows: [{ id: 'rating-1' }] } as any);

      await adminModerationController.deleteAdminRating(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });
  });

  describe('updateAdminDispute', () => {
    it("rejette une mise à jour sans aucun champ (400)", async () => {
      mockRequest.params = { disputeId: 'dispute-1' };
      mockRequest.body = {};
      mockPool.query.mockResolvedValueOnce({ rows: [{ exists: true }] } as any);

      await adminModerationController.updateAdminDispute(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
    });

    it("renvoie 404 si la dispute n'existe pas après update", async () => {
      mockRequest.params = { disputeId: 'dispute-x' };
      mockRequest.body = { status: 'resolved' };
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ exists: true }] } as any)
        .mockResolvedValueOnce({ rows: [] } as any);

      await adminModerationController.updateAdminDispute(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
    });

    it('met à jour le statut de la dispute', async () => {
      mockRequest.params = { disputeId: 'dispute-1' };
      mockRequest.body = { status: 'resolved', adminNotes: 'ok' };
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ exists: true }] } as any)
        .mockResolvedValueOnce({ rows: [{ id: 'dispute-1', status: 'resolved' }] } as any);

      await adminModerationController.updateAdminDispute(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, data: expect.objectContaining({ status: 'resolved' }) })
      );
    });
  });
});
