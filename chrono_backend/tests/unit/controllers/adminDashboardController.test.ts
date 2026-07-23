/**
 * Tests unitaires pour adminDashboardController — statistiques et recherche
 * globale du back-office (déjà admin-gated au niveau routes, lecture seule).
 * Couvre le fallback DATABASE_URL absent et le calcul de variation en
 * pourcentage (cas limite : période précédente à zéro).
 */

import { describe, it, expect, beforeEach, jest, afterAll } from '@jest/globals';
import type { Request, Response } from 'express';

const mockPool = { query: jest.fn<(...args: any[]) => Promise<any>>() };
await jest.unstable_mockModule('../../../src/config/db.js', () => ({
  __esModule: true,
  default: mockPool,
}));

const adminDashboardController = await import('../../../src/controllers/adminDashboardController.js');

describe('adminDashboardController', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  const originalDbUrl = process.env.DATABASE_URL;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPool.query.mockReset();
    mockRequest = { params: {}, body: {}, query: {} } as unknown as Partial<Request>;
    mockResponse = {
      status: jest.fn().mockReturnThis() as any,
      json: jest.fn().mockReturnThis() as any,
    };
  });

  afterAll(() => {
    process.env.DATABASE_URL = originalDbUrl;
  });

  describe('getAdminDashboardStats', () => {
    it('renvoie des stats à zéro sans toucher la base si DATABASE_URL absent', async () => {
      delete process.env.DATABASE_URL;

      await adminDashboardController.getAdminDashboardStats(mockRequest as Request, mockResponse as Response);

      expect(mockPool.query).not.toHaveBeenCalled();
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, data: expect.objectContaining({ onDelivery: 0, revenue: 0 }) })
      );
    });

    it('calcule une variation de 100% quand la période précédente est à zéro (pas de division par zéro)', async () => {
      process.env.DATABASE_URL = 'postgres://test';
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ count: '3' }] } as any) // active orders (courant)
        .mockResolvedValueOnce({ rows: [{ column_name: 'price_cfa' }] } as any) // price column
        .mockResolvedValueOnce({ rows: [{ count: '5', total_revenue: '10000' }] } as any) // completed courant
        .mockResolvedValueOnce({ rows: [{ count: '0', total_revenue: '0' }] } as any) // completed précédent (zéro)
        .mockResolvedValueOnce({ rows: [{ count: '0' }] } as any) // active orders précédent
        .mockResolvedValueOnce({ rows: [{ exists: false }] } as any) // ratings table check
        .mockResolvedValueOnce({ rows: [{ avg_time: null }] } as any) // avg delivery time
        .mockResolvedValueOnce({ rows: [{ count: '0' }] } as any) // cancelled
        .mockResolvedValueOnce({ rows: [{ count: '2' }] } as any) // active clients
        .mockResolvedValueOnce({ rows: [{ count: '1' }] } as any); // active drivers

      await adminDashboardController.getAdminDashboardStats(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({ successDeliveries: 5, revenue: 10000, revenueChange: 100 }),
        })
      );
    });
  });

  describe('getAdminGlobalSearch', () => {
    it('court-circuite sans toucher la base si la recherche est vide', async () => {
      process.env.DATABASE_URL = 'postgres://test';
      mockRequest.query = { q: '   ' };

      await adminDashboardController.getAdminGlobalSearch(mockRequest as Request, mockResponse as Response);

      expect(mockPool.query).not.toHaveBeenCalled();
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, data: { orders: [], drivers: [], clients: [] } })
      );
    });
  });
});
