/**
 * Tests unitaires pour commissionController — solde et recharge commission des livreurs
 * partenaires (aucune couverture avant ce fichier). Couvre l'IDOR (un livreur ne doit
 * consulter/recharger que son propre solde) et les règles métier de la recharge
 * (montant minimum, méthode de paiement autorisée, réservé aux livreurs partenaires).
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import type { Request, Response } from 'express';

const mockPool = { query: jest.fn<(...args: any[]) => Promise<any>>() };
await jest.unstable_mockModule('../../../src/config/db.js', () => ({
  __esModule: true,
  default: mockPool,
}));

const commissionController = await import('../../../src/controllers/commissionController.js');

describe('commissionController', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPool.query.mockReset();

    mockRequest = {
      params: {},
      body: {},
      query: {},
    } as unknown as Partial<Request>;

    mockResponse = {
      status: jest.fn().mockReturnThis() as any,
      json: jest.fn().mockReturnThis() as any,
    };
  });

  describe('getCommissionBalance — scope IDOR', () => {
    it("refuse de consulter le solde d'un autre utilisateur (403)", async () => {
      (mockRequest as any).user = { id: 'user-a' };
      mockRequest.params = { userId: 'user-b' };

      await commissionController.getCommissionBalance(mockRequest as any, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockPool.query).not.toHaveBeenCalled();
    });

    it("renvoie 404 si le profil livreur n'existe pas", async () => {
      (mockRequest as any).user = { id: 'user-a' };
      mockRequest.params = { userId: 'user-a' };
      mockPool.query.mockResolvedValueOnce({ rows: [] } as any);

      await commissionController.getCommissionBalance(mockRequest as any, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
    });

    it("rejette un livreur non-partenaire (400)", async () => {
      (mockRequest as any).user = { id: 'user-a' };
      mockRequest.params = { userId: 'user-a' };
      mockPool.query.mockResolvedValueOnce({ rows: [{ driver_type: 'independent' }] } as any);

      await commissionController.getCommissionBalance(mockRequest as any, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
    });

    it('retourne le solde existant pour un livreur partenaire', async () => {
      (mockRequest as any).user = { id: 'user-a' };
      mockRequest.params = { userId: 'user-a' };
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ driver_type: 'partner' }] } as any)
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'bal-1',
              balance: '15000.00',
              is_suspended: false,
              commission_rate: '10.00',
              updated_at: '2026-07-01',
            },
          ],
        } as any);

      await commissionController.getCommissionBalance(mockRequest as any, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({ balance: 15000, is_suspended: false }),
        })
      );
    });
  });

  describe('getCommissionTransactions — scope IDOR', () => {
    it("refuse de consulter l'historique d'un autre utilisateur (403)", async () => {
      (mockRequest as any).user = { id: 'user-a' };
      mockRequest.params = { userId: 'user-b' };

      await commissionController.getCommissionTransactions(mockRequest as any, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockPool.query).not.toHaveBeenCalled();
    });

    it('retourne les transactions du propre compte', async () => {
      (mockRequest as any).user = { id: 'user-a' };
      mockRequest.params = { userId: 'user-a' };
      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            id: 'tx-1',
            transaction_type: 'recharge',
            amount: '10000.00',
            balance_before: '0.00',
            balance_after: '10000.00',
            order_id: null,
            payment_method: 'mobile_money',
            payment_provider: 'wave',
            created_at: '2026-07-01',
          },
        ],
      } as any);

      await commissionController.getCommissionTransactions(mockRequest as any, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.arrayContaining([expect.objectContaining({ id: 'tx-1', amount: 10000 })]),
        })
      );
    });
  });

  describe('rechargeCommission — IDOR + règles métier', () => {
    it("refuse de recharger le compte d'un autre utilisateur (403)", async () => {
      (mockRequest as any).user = { id: 'user-a' };
      mockRequest.params = { userId: 'user-b' };
      mockRequest.body = { amount: 20000, method: 'wave' };

      await commissionController.rechargeCommission(mockRequest as any, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockPool.query).not.toHaveBeenCalled();
    });

    it('rejette un montant sous le minimum de 10 000 FCFA (400)', async () => {
      (mockRequest as any).user = { id: 'user-a' };
      mockRequest.params = { userId: 'user-a' };
      mockRequest.body = { amount: 5000, method: 'wave' };

      await commissionController.rechargeCommission(mockRequest as any, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockPool.query).not.toHaveBeenCalled();
    });

    it('rejette une méthode de paiement inconnue (400)', async () => {
      (mockRequest as any).user = { id: 'user-a' };
      mockRequest.params = { userId: 'user-a' };
      mockRequest.body = { amount: 20000, method: 'bitcoin' };

      await commissionController.rechargeCommission(mockRequest as any, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockPool.query).not.toHaveBeenCalled();
    });

    it("renvoie 404 si le profil livreur n'existe pas", async () => {
      (mockRequest as any).user = { id: 'user-a' };
      mockRequest.params = { userId: 'user-a' };
      mockRequest.body = { amount: 20000, method: 'wave' };
      mockPool.query.mockResolvedValueOnce({ rows: [] } as any);

      await commissionController.rechargeCommission(mockRequest as any, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
    });

    it('rejette un livreur non-partenaire (400)', async () => {
      (mockRequest as any).user = { id: 'user-a' };
      mockRequest.params = { userId: 'user-a' };
      mockRequest.body = { amount: 20000, method: 'wave' };
      mockPool.query.mockResolvedValueOnce({ rows: [{ driver_type: 'independent' }] } as any);

      await commissionController.rechargeCommission(mockRequest as any, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
    });

    it('accepte une recharge valide pour un livreur partenaire', async () => {
      (mockRequest as any).user = { id: 'user-a' };
      mockRequest.params = { userId: 'user-a' };
      mockRequest.body = { amount: 20000, method: 'orange_money' };
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ driver_type: 'partner' }] } as any)
        .mockResolvedValueOnce({ rows: [{ transaction_id: 'tx-99' }] } as any);

      await commissionController.rechargeCommission(mockRequest as any, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({ transactionId: 'tx-99' }),
        })
      );
    });
  });
});
