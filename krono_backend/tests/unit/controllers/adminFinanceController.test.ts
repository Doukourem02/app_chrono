/**
 * Tests unitaires pour adminFinanceController — statistiques financières et
 * transactions (déjà admin-gated, lecture seule). Couvre le fallback
 * DATABASE_URL absent et la construction de requête paginée/filtrée.
 */

import { describe, it, expect, beforeEach, jest, afterAll } from '@jest/globals';
import type { Request, Response } from 'express';

const mockPool = { query: jest.fn<(...args: any[]) => Promise<any>>() };
await jest.unstable_mockModule('../../../src/config/db.js', () => ({
  __esModule: true,
  default: mockPool,
}));

const adminFinanceController = await import('../../../src/controllers/adminFinanceController.js');

describe('adminFinanceController', () => {
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

  describe('getAdminFinancialStats', () => {
    it('renvoie des stats à zéro sans toucher la base si DATABASE_URL absent', async () => {
      delete process.env.DATABASE_URL;

      await adminFinanceController.getAdminFinancialStats(mockRequest as Request, mockResponse as Response);

      expect(mockPool.query).not.toHaveBeenCalled();
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, data: expect.objectContaining({ conversionRate: 0 }) })
      );
    });

    it("renvoie des données vides si aucune colonne de prix n'existe sur orders", async () => {
      process.env.DATABASE_URL = 'postgres://test';
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ count: '0' }] } as any) // active orders (peu importe l'ordre exact)
        .mockResolvedValueOnce({ rows: [] } as any); // aucune colonne price_cfa/price trouvée

      await adminFinanceController.getAdminFinancialStats(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, data: expect.objectContaining({ conversionRate: 0 }) })
      );
    });
  });

  describe('getAdminTransactions', () => {
    it('renvoie une liste vide sans requête si DATABASE_URL absent', async () => {
      delete process.env.DATABASE_URL;

      await adminFinanceController.getAdminTransactions(mockRequest as Request, mockResponse as Response);

      expect(mockPool.query).not.toHaveBeenCalled();
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, data: [], pagination: expect.objectContaining({ total: 0 }) })
      );
    });

    it('applique les filtres status/method dans la requête paginée', async () => {
      process.env.DATABASE_URL = 'postgres://test';
      mockRequest.query = { status: 'paid', method: 'wave', page: '2', limit: '10' };
      mockPool.query
        .mockResolvedValueOnce({ rows: [] } as any) // data
        .mockResolvedValueOnce({ rows: [{ count: '0' }] } as any); // count

      await adminFinanceController.getAdminTransactions(mockRequest as Request, mockResponse as Response);

      const [query, params] = mockPool.query.mock.calls[0] as [string, any[]];
      expect(query).toContain('t.status = $1');
      expect(query).toContain('t.payment_method_type = $2');
      expect(params).toEqual(['paid', 'wave', 10, 10]); // limit=10, offset=(page 2 -1)*10=10
    });
  });
});
