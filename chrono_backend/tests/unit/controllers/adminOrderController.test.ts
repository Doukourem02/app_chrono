/**
 * Tests unitaires pour adminOrderController — création/annulation de commande par
 * un opérateur admin (commande téléphonique). Couvre les clauses de garde
 * exécutées avant tout calcul de prix/géocodage (rôle admin requis, champs
 * obligatoires, téléphone destinataire requis, client introuvable) et la
 * validation de transition de statut pour l'annulation.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import type { Request, Response } from 'express';

const mockPool = { query: jest.fn<(...args: any[]) => Promise<any>>() };
await jest.unstable_mockModule('../../../src/config/db.js', () => ({
  __esModule: true,
  default: mockPool,
}));

await jest.unstable_mockModule('../../../src/sockets/adminSocket.js', () => ({
  __esModule: true,
  broadcastOrderUpdateToAdmins: jest.fn(),
}));

await jest.unstable_mockModule('../../../src/sockets/orderSocket.js', () => ({
  __esModule: true,
  activeOrders: new Map(),
  connectedUsers: new Map(),
  notifyDriversForOrder: jest.fn(() => Promise.resolve()),
}));

const adminOrderController = await import('../../../src/controllers/adminOrderController.js');

describe('adminOrderController', () => {
  let mockRequest: any;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPool.query.mockReset();
    mockRequest = {
      params: {},
      body: {},
      query: {},
      app: { get: jest.fn(() => null) },
    };
    mockResponse = {
      status: jest.fn().mockReturnThis() as any,
      json: jest.fn().mockReturnThis() as any,
    };
  });

  describe('createAdminOrder — clauses de garde avant tout calcul de prix', () => {
    const validPickup = { address: 'Cocody', coordinates: { latitude: 5.34, longitude: -3.98 } };
    const validDropoff = {
      address: 'Marcory',
      coordinates: { latitude: 5.28, longitude: -3.98 },
      details: { phone: '0700000000' },
    };

    it("refuse un utilisateur non-admin (403), avant même de lire le body", async () => {
      mockRequest.user = { id: 'user-1', role: 'client' };
      mockRequest.body = { userId: 'client-1', pickup: validPickup, dropoff: validDropoff, deliveryMethod: 'moto' };

      await adminOrderController.createAdminOrder(mockRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockPool.query).not.toHaveBeenCalled();
    });

    it('rejette une requête sans champs obligatoires (400)', async () => {
      mockRequest.user = { id: 'admin-1', role: 'admin' };
      mockRequest.body = { userId: 'client-1' };

      await adminOrderController.createAdminOrder(mockRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
    });

    it('rejette une commande non téléphonique sans coordonnées pickup (400)', async () => {
      mockRequest.user = { id: 'admin-1', role: 'admin' };
      mockRequest.body = {
        userId: 'client-1',
        pickup: { address: 'Cocody' },
        dropoff: validDropoff,
        deliveryMethod: 'moto',
      };

      await adminOrderController.createAdminOrder(mockRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockPool.query).not.toHaveBeenCalled();
    });

    it("renvoie 404 si le client n'existe pas (ou n'est pas role=client)", async () => {
      mockRequest.user = { id: 'admin-1', role: 'admin' };
      mockRequest.body = {
        userId: 'not-a-client', pickup: validPickup, dropoff: validDropoff, deliveryMethod: 'moto',
      };
      mockPool.query.mockResolvedValueOnce({ rows: [] } as any);

      await adminOrderController.createAdminOrder(mockRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockPool.query).toHaveBeenCalledWith(expect.any(String), ['not-a-client', 'client']);
    });

    it('exige un numéro de téléphone destinataire (400) même avec un client valide', async () => {
      mockRequest.user = { id: 'admin-1', role: 'admin' };
      mockRequest.body = {
        userId: 'client-1',
        pickup: validPickup,
        dropoff: { address: 'Marcory', coordinates: validDropoff.coordinates, details: {} },
        deliveryMethod: 'moto',
      };
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 'client-1', email: 'a@b.com', first_name: 'A', last_name: 'B' }],
      } as any);

      await adminOrderController.createAdminOrder(mockRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
    });
  });

  describe('cancelAdminOrder', () => {
    it('rejette une requête sans orderId (400)', async () => {
      mockRequest.params = {};

      await adminOrderController.cancelAdminOrder(mockRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockPool.query).not.toHaveBeenCalled();
    });

    it("renvoie 404 si la commande n'existe pas", async () => {
      mockRequest.params = { orderId: 'order-x' };
      mockPool.query.mockResolvedValueOnce({ rows: [] } as any);

      await adminOrderController.cancelAdminOrder(mockRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
    });

    it("refuse d'annuler une commande déjà terminée (400)", async () => {
      mockRequest.params = { orderId: 'order-1' };
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: 'order-1', status: 'completed' }] } as any);

      await adminOrderController.cancelAdminOrder(mockRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
    });

    it('annule une commande dans un statut annulable', async () => {
      mockRequest.params = { orderId: 'order-1' };
      mockRequest.body = { reason: 'client indisponible' };
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ id: 'order-1', status: 'pending', user_id: 'user-1', driver_id: null }] } as any)
        .mockResolvedValueOnce({ rows: [] } as any); // update

      await adminOrderController.cancelAdminOrder(mockRequest, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, order: expect.objectContaining({ status: 'cancelled' }) })
      );
    });
  });
});
