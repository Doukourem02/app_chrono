/**
 * Tests unitaires pour trackController — suivi public d'une commande par token
 * (sans authentification, par design : lien envoyé au destinataire). Le scope de
 * sécurité ici est le token lui-même (imprévisible, généré côté commande) ; on
 * vérifie que l'accès est bien refusé sans token valide.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import type { Request, Response } from 'express';

const mockPool = { query: jest.fn<(...args: any[]) => Promise<any>>() };
await jest.unstable_mockModule('../../../src/config/db.js', () => ({
  __esModule: true,
  default: mockPool,
}));

await jest.unstable_mockModule('../../../src/services/qrCodeService.js', () => ({
  __esModule: true,
  default: { getOrderQRCode: jest.fn() },
}));

await jest.unstable_mockModule('../../../src/services/trackWebPushService.js', () => ({
  __esModule: true,
  getWebPushPublicKey: jest.fn(() => 'pubkey'),
  isTrackWebPushConfigured: jest.fn(() => true),
  saveTrackPushSubscription: jest.fn(),
}));

const trackController = await import('../../../src/controllers/trackController.js');

describe('trackController', () => {
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

  describe('getTrackByToken', () => {
    it('renvoie 404 pour un token de suivi inconnu', async () => {
      mockRequest.params = { token: 'invalid-token' };
      mockPool.query.mockResolvedValueOnce({ rows: [] } as any);

      await trackController.getTrackByToken(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
    });

    it('scope la requête sur tracking_token (jamais sur order id direct)', async () => {
      mockRequest.params = { token: 'tok-123' };
      mockPool.query.mockResolvedValueOnce({ rows: [] } as any);

      await trackController.getTrackByToken(mockRequest as Request, mockResponse as Response);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE o.tracking_token = $1'),
        ['tok-123']
      );
    });
  });

  describe('postTrackPushSubscribe', () => {
    it('renvoie 404 pour un token inconnu avant même de valider la subscription', async () => {
      mockRequest.params = { token: 'invalid-token' };
      mockRequest.body = { endpoint: 'https://push.example', keys: { p256dh: 'a', auth: 'b' } };
      mockPool.query.mockResolvedValueOnce({ rows: [] } as any);

      await trackController.postTrackPushSubscribe(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
    });

    it('rejette une subscription push mal formée (400)', async () => {
      mockRequest.params = { token: 'tok-123' };
      mockRequest.body = { endpoint: 'https://push.example' };
      mockPool.query.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] } as any);

      await trackController.postTrackPushSubscribe(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
    });
  });
});
