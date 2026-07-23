/**
 * Tests unitaires pour multiDeliveryController — optimisation de tournée livreur.
 * Couvre l'authentification requise et le scope IDOR (la requête SQL ne doit
 * porter que sur les commandes assignées au livreur appelant).
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import type { Request, Response } from 'express';

const mockPool = { query: jest.fn<(...args: any[]) => Promise<any>>() };
await jest.unstable_mockModule('../../../src/config/db.js', () => ({
  __esModule: true,
  default: mockPool,
}));

await jest.unstable_mockModule('../../../src/services/multiDeliveryService.js', () => ({
  __esModule: true,
  optimizeRoute: jest.fn(),
  groupOrdersByZone: jest.fn(() => []),
  calculateOptimalRouteForGroup: jest.fn(() => ({ orderedStops: [] })),
}));

const multiDeliveryController = await import('../../../src/controllers/multiDeliveryController.js');

describe('multiDeliveryController', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPool.query.mockReset();

    mockRequest = { params: {}, body: {}, query: {} } as unknown as Partial<Request>;
    mockResponse = {
      status: jest.fn().mockReturnThis() as any,
      json: jest.fn().mockReturnThis() as any,
    };
  });

  describe('optimizeDeliveryRoute', () => {
    it('refuse une requête non authentifiée (401)', async () => {
      mockRequest.body = { orderIds: ['o1'], driverPosition: { latitude: 5, longitude: -4 } };

      await multiDeliveryController.optimizeDeliveryRoute(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockPool.query).not.toHaveBeenCalled();
    });

    it('rejette une liste de commandes vide (400)', async () => {
      (mockRequest as any).user = { id: 'driver-1' };
      mockRequest.body = { orderIds: [], driverPosition: { latitude: 5, longitude: -4 } };

      await multiDeliveryController.optimizeDeliveryRoute(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
    });

    it("scope la requête SQL sur le driver_id de l'utilisateur connecté (IDOR)", async () => {
      (mockRequest as any).user = { id: 'driver-1' };
      mockRequest.body = {
        orderIds: ['o1', 'o2'],
        driverPosition: { latitude: 5.34, longitude: -4.02 },
      };
      mockPool.query.mockResolvedValueOnce({ rows: [] } as any);

      await multiDeliveryController.optimizeDeliveryRoute(mockRequest as Request, mockResponse as Response);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('driver_id = $2'),
        [['o1', 'o2'], 'driver-1']
      );
    });
  });

  describe('getZonesWithOrders', () => {
    it('refuse une requête non authentifiée (401)', async () => {
      await multiDeliveryController.getZonesWithOrders(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockPool.query).not.toHaveBeenCalled();
    });
  });
});
