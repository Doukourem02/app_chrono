/**
 * Tests unitaires pour gamificationController — badges/score livreur (IDOR :
 * un livreur ne doit voir que ses propres badges/score, sauf admin).
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import type { Request, Response } from 'express';

const mockPool = { query: jest.fn<(...args: any[]) => Promise<any>>() };
await jest.unstable_mockModule('../../../src/config/db.js', () => ({
  __esModule: true,
  default: mockPool,
}));

const mockGamificationService = {
  checkAndUnlockBadges: jest.fn(),
  getLeaderboard: jest.fn(),
  calculateDriverScore: jest.fn(),
  getPerformanceKPIs: jest.fn(),
};
await jest.unstable_mockModule('../../../src/services/gamificationService.js', () => ({
  __esModule: true,
  ...mockGamificationService,
}));

const gamificationController = await import('../../../src/controllers/gamificationController.js');

describe('gamificationController', () => {
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

  describe('getDriverBadges — IDOR', () => {
    it("refuse de consulter les badges d'un autre livreur (403)", async () => {
      (mockRequest as any).user = { id: 'driver-a', role: 'driver' };
      mockRequest.params = { driverId: 'driver-b' };

      await gamificationController.getDriverBadges(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockPool.query).not.toHaveBeenCalled();
    });

    it('autorise le livreur à consulter ses propres badges', async () => {
      (mockRequest as any).user = { id: 'driver-a', role: 'driver' };
      mockRequest.params = { driverId: 'driver-a' };
      mockPool.query.mockResolvedValueOnce({ rows: [{ badge_id: 'b1', unlocked_at: '2026-01-01' }] } as any);

      await gamificationController.getDriverBadges(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({ badges: expect.arrayContaining([expect.objectContaining({ badge_id: 'b1' })]) })
      );
    });

    it("autorise un admin à consulter les badges d'un autre livreur", async () => {
      (mockRequest as any).user = { id: 'admin-1', role: 'admin' };
      mockRequest.params = { driverId: 'driver-b' };
      mockPool.query.mockResolvedValueOnce({ rows: [] } as any);

      await gamificationController.getDriverBadges(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).not.toHaveBeenCalledWith(403);
      expect(mockPool.query).toHaveBeenCalled();
    });
  });

  describe('getDriverScore — IDOR', () => {
    it("refuse de consulter le score d'un autre livreur (403)", async () => {
      (mockRequest as any).user = { id: 'driver-a', role: 'driver' };
      mockRequest.params = { driverId: 'driver-b' };

      await gamificationController.getDriverScore(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
    });
  });

  describe('checkBadges — IDOR', () => {
    it("refuse de déclencher le check de badges d'un autre livreur (403)", async () => {
      (mockRequest as any).user = { id: 'driver-a', role: 'driver' };
      mockRequest.params = { driverId: 'driver-b' };

      await gamificationController.checkBadges(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockGamificationService.checkAndUnlockBadges).not.toHaveBeenCalled();
    });
  });
});
