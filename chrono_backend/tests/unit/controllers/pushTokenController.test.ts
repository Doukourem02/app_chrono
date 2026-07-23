/**
 * Tests unitaires pour pushTokenController — enregistrement des tokens Expo Push.
 * Couvre l'authentification requise, la validation du format de token, et le
 * contrôle rôle/app (un compte client ne peut enregistrer que app: "client").
 */

import { describe, it, expect, beforeEach, jest, afterAll } from '@jest/globals';
import type { Response } from 'express';

const mockPool = { query: jest.fn<(...args: any[]) => Promise<any>>() };
await jest.unstable_mockModule('../../../src/config/db.js', () => ({
  __esModule: true,
  default: mockPool,
}));

const pushTokenController = await import('../../../src/controllers/pushTokenController.js');

const VALID_EXPO_TOKEN = 'ExponentPushToken[abcdefghijklmnopqrstuv]';

describe('pushTokenController', () => {
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

  describe('registerPushToken', () => {
    it('refuse une requête non authentifiée (401)', async () => {
      mockRequest.body = { expoPushToken: VALID_EXPO_TOKEN, platform: 'ios', app: 'client' };

      await pushTokenController.registerPushToken(mockRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockPool.query).not.toHaveBeenCalled();
    });

    it('rejette un token Expo mal formé (400)', async () => {
      mockRequest.user = { id: 'user-1', role: 'client' };
      mockRequest.body = { expoPushToken: 'not-an-expo-token', platform: 'ios', app: 'client' };

      await pushTokenController.registerPushToken(mockRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
    });

    it("refuse qu'un compte client enregistre app: driver (403)", async () => {
      mockRequest.user = { id: 'user-1', role: 'client' };
      mockRequest.body = { expoPushToken: VALID_EXPO_TOKEN, platform: 'ios', app: 'driver' };

      await pushTokenController.registerPushToken(mockRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockPool.query).not.toHaveBeenCalled();
    });

    it("refuse qu'un compte driver enregistre app: client (403)", async () => {
      mockRequest.user = { id: 'driver-1', role: 'driver' };
      mockRequest.body = { expoPushToken: VALID_EXPO_TOKEN, platform: 'android', app: 'client' };

      await pushTokenController.registerPushToken(mockRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
    });

    it('enregistre le token pour un rôle cohérent', async () => {
      mockRequest.user = { id: 'user-1', role: 'client' };
      mockRequest.body = { expoPushToken: VALID_EXPO_TOKEN, platform: 'ios', app: 'client' };
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: 'pt-1', created_at: 'x', updated_at: 'x' }] } as any);

      await pushTokenController.registerPushToken(mockRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockPool.query).toHaveBeenCalledWith(expect.any(String), ['user-1', VALID_EXPO_TOKEN, 'ios', 'client', null]);
    });
  });

  describe('unregisterPushToken', () => {
    it('refuse une requête non authentifiée (401)', async () => {
      mockRequest.body = { app: 'client' };

      await pushTokenController.unregisterPushToken(mockRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockPool.query).not.toHaveBeenCalled();
    });

    it('scope toujours la requête sur user_id = utilisateur connecté', async () => {
      mockRequest.user = { id: 'user-1', role: 'client' };
      mockRequest.body = { app: 'client' };
      mockPool.query.mockResolvedValueOnce({ rowCount: 2 } as any);

      await pushTokenController.unregisterPushToken(mockRequest, mockResponse as Response);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE user_id = $1'),
        ['user-1', 'client']
      );
    });
  });
});
