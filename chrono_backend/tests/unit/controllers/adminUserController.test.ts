/**
 * Tests unitaires pour adminUserController — fiches client/admin côté back-office
 * (déjà admin-gated au niveau routes). Couvre le filtre de rôle dans la requête
 * SQL (un clientId ne doit pouvoir remonter que via role='client', jamais un compte
 * admin par erreur d'ID, et inversement).
 */

import { describe, it, expect, beforeEach, jest, afterAll } from '@jest/globals';
import type { Request, Response } from 'express';

const mockPool = { query: jest.fn<(...args: any[]) => Promise<any>>() };
await jest.unstable_mockModule('../../../src/config/db.js', () => ({
  __esModule: true,
  default: mockPool,
}));

const adminUserController = await import('../../../src/controllers/adminUserController.js');

describe('adminUserController', () => {
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

  describe('getAdminClientDetails', () => {
    it('scope la requête sur role = client (un id admin ne doit pas remonter)', async () => {
      mockRequest.params = { clientId: 'some-admin-id' };
      mockPool.query.mockResolvedValueOnce({ rows: [] } as any);

      await adminUserController.getAdminClientDetails(mockRequest as Request, mockResponse as Response);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("role = 'client'"),
        ['some-admin-id']
      );
      expect(mockResponse.status).toHaveBeenCalledWith(404);
    });

    it('renvoie les statistiques du client trouvé', async () => {
      mockRequest.params = { clientId: 'client-1' };
      mockPool.query
        .mockResolvedValueOnce({
          rows: [{ id: 'client-1', email: 'a@b.com', first_name: 'A', last_name: 'B', created_at: '2026-01-01', avatar_url: null }],
        } as any)
        .mockResolvedValueOnce({ rows: [{ column_name: 'price_cfa' }] } as any)
        .mockResolvedValueOnce({ rows: [{ total_orders: '5', week_orders: '1', month_orders: '2', completed_orders: '4', total_spent: '20000' }] } as any)
        .mockResolvedValueOnce({ rows: [{ exists: false }] } as any)
        .mockResolvedValueOnce({ rows: [{ loyalty_points: '10' }] } as any)
        .mockResolvedValueOnce({ rows: [] } as any);

      await adminUserController.getAdminClientDetails(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({ id: 'client-1', statistics: expect.objectContaining({ totalOrders: 5 }) }),
        })
      );
    });
  });

  describe('getAdminAdminDetails', () => {
    it('scope la requête sur role admin/super_admin (un id client ne doit pas remonter)', async () => {
      mockRequest.params = { adminId: 'some-client-id' };
      mockPool.query.mockResolvedValueOnce({ rows: [] } as any);

      await adminUserController.getAdminAdminDetails(mockRequest as Request, mockResponse as Response);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("role = 'admin' OR role = 'super_admin'"),
        ['some-client-id']
      );
      expect(mockResponse.status).toHaveBeenCalledWith(404);
    });
  });
});
