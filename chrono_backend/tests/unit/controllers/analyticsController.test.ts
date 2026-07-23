/**
 * Tests unitaires pour analyticsController — KPIs temps réel, performance et
 * export (déjà admin-gated, lecture seule). `getRealTimeKPIs`/`getPerformanceData`
 * enchaînent une dizaine de requêtes SQL séquentielles ; on couvre ici le
 * comportement d'erreur (500 propre) plutôt que de mocker toute la chaîne, et on
 * teste en détail `exportAnalytics` qui a une vraie logique métier (échappement
 * CSV, format json/csv).
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import type { Request, Response } from 'express';

const mockPool = { query: jest.fn<(...args: any[]) => Promise<any>>() };
await jest.unstable_mockModule('../../../src/config/db.js', () => ({
  __esModule: true,
  default: mockPool,
}));

const analyticsController = await import('../../../src/controllers/analyticsController.js');

describe('analyticsController', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPool.query.mockReset();
    mockRequest = { params: {}, body: {}, query: {} } as unknown as Partial<Request>;
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      setHeader: jest.fn(),
      write: jest.fn(),
      end: jest.fn(),
    };
  });

  describe('getRealTimeKPIs', () => {
    it('renvoie 500 sur une erreur SQL non liée à la connexion', async () => {
      mockPool.query.mockRejectedValueOnce(new Error('syntax error'));

      await analyticsController.getRealTimeKPIs(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getPerformanceData', () => {
    it('renvoie 500 sur une erreur SQL non liée à la connexion', async () => {
      mockPool.query.mockRejectedValueOnce(new Error('syntax error'));

      await analyticsController.getPerformanceData(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
    });
  });

  describe('exportAnalytics', () => {
    it('exporte en JSON par défaut', async () => {
      mockRequest.query = {};
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ column_name: 'price_cfa' }] } as any)
        .mockResolvedValueOnce({
          rows: [{ id: '11111111-abcd', status: 'completed', price: 1500, created_at: '2026-01-01', completed_at: '2026-01-02', client_email: 'a@b.com', driver_id: 'driver-1' }],
        } as any);

      await analyticsController.exportAnalytics(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.arrayContaining([expect.objectContaining({ status: 'completed' }) ]) })
      );
      expect(mockResponse.write).not.toHaveBeenCalled();
    });

    it('exporte en CSV avec échappement correct des valeurs contenant une virgule', async () => {
      mockRequest.query = { format: 'csv' };
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ column_name: 'price_cfa' }] } as any)
        .mockResolvedValueOnce({
          rows: [{
            id: '11111111-abcd', status: 'completed', price: 1500,
            created_at: '2026-01-01', completed_at: '2026-01-02',
            client_email: 'Doe, John', driver_id: 'driver-1',
          }],
        } as any);

      await analyticsController.exportAnalytics(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv');
      const writtenLines = mockResponse.write.mock.calls.map((c: any[]) => c[0]).join('');
      expect(writtenLines).toContain('"Doe, John"');
      expect(mockResponse.end).toHaveBeenCalled();
    });
  });
});
