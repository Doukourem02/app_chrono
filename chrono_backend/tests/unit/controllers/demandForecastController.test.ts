/**
 * Tests unitaires pour demandForecastController — prévision de demande/pics
 * (lecture seule, aucun état). Couvre la validation `zone requise`.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import type { Request, Response } from 'express';

const mockService = {
  predictDemand: jest.fn<(...args: any[]) => Promise<any>>(),
  predictPeakHours: jest.fn<(...args: any[]) => Promise<any>>(),
  recommendZonesForDrivers: jest.fn<(...args: any[]) => Promise<any>>(),
};
await jest.unstable_mockModule('../../../src/services/demandForecastService.js', () => ({
  __esModule: true,
  ...mockService,
}));

const demandForecastController = await import('../../../src/controllers/demandForecastController.js');

describe('demandForecastController', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRequest = { params: {}, body: {}, query: {} } as unknown as Partial<Request>;
    mockResponse = {
      status: jest.fn().mockReturnThis() as any,
      json: jest.fn().mockReturnThis() as any,
    };
  });

  describe('getDemandForecast', () => {
    it('rejette une requête sans zone (400)', async () => {
      await demandForecastController.getDemandForecast(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockService.predictDemand).not.toHaveBeenCalled();
    });

    it('renvoie la prévision pour une zone donnée', async () => {
      mockRequest.query = { zone: 'cocody' };
      mockService.predictDemand.mockResolvedValueOnce({ demand: 42 } as any);

      await demandForecastController.getDemandForecast(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith({ demand: 42 });
    });
  });

  describe('getPeakHours', () => {
    it('rejette une requête sans zone (400)', async () => {
      await demandForecastController.getPeakHours(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockService.predictPeakHours).not.toHaveBeenCalled();
    });

    it('renvoie les pics pour une zone donnée', async () => {
      mockRequest.query = { zone: 'plateau' };
      mockService.predictPeakHours.mockResolvedValueOnce([12, 18] as any);

      await demandForecastController.getPeakHours(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith({ peaks: [12, 18] });
    });
  });

  describe('getZoneRecommendations', () => {
    it('renvoie les recommandations de zones', async () => {
      mockService.recommendZonesForDrivers.mockResolvedValueOnce([{ zone: 'yopougon' }] as any);

      await demandForecastController.getZoneRecommendations(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith({ recommendations: [{ zone: 'yopougon' }] });
    });
  });
});
