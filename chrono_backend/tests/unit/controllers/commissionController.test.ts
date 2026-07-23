/**
 * Tests unitaires pour commissionController — solde et recharge commission des livreurs
 * partenaires. Couvre les règles métier (montant minimum, méthode de paiement autorisée,
 * réservé aux livreurs partenaires, paiement Mobile Money confirmé avant tout crédit).
 * L'IDOR (un livreur ne doit consulter/recharger que son propre compte) est géré par le
 * middleware `requireSelfUser`, monté sur les routes et testé dans
 * tests/unit/middleware/requireSelfUser.test.ts — plus dupliqué dans chaque contrôleur.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import type { Request, Response } from 'express';

const mockPool = { query: jest.fn<(...args: any[]) => Promise<any>>() };
await jest.unstable_mockModule('../../../src/config/db.js', () => ({
  __esModule: true,
  default: mockPool,
}));

const mockInitiateMobileMoneyPayment = jest.fn<(...args: any[]) => Promise<any>>();
await jest.unstable_mockModule('../../../src/services/mobileMoneyService.js', () => ({
  __esModule: true,
  initiateMobileMoneyPayment: mockInitiateMobileMoneyPayment,
  validateMobileMoneyParams: () => ({ valid: true }),
}));

const commissionController = await import('../../../src/controllers/commissionController.js');

describe('commissionController', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPool.query.mockReset();
    mockInitiateMobileMoneyPayment.mockReset();

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

  describe('getCommissionBalance', () => {
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

  describe('getCommissionTransactions', () => {
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

  describe('rechargeCommission — règles métier', () => {
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

    it("refuse si le profil livreur n'a pas de numéro de téléphone (400, aucun crédit)", async () => {
      (mockRequest as any).user = { id: 'user-a' };
      mockRequest.params = { userId: 'user-a' };
      mockRequest.body = { amount: 20000, method: 'orange_money' };
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ driver_type: 'partner' }] } as any)
        .mockResolvedValueOnce({ rows: [{ phone: null }] } as any);

      await commissionController.rechargeCommission(mockRequest as any, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockInitiateMobileMoneyPayment).not.toHaveBeenCalled();
    });

    it("ne crédite jamais le solde si le paiement Mobile Money n'est pas confirmé (régression bug recharge gratuite)", async () => {
      (mockRequest as any).user = { id: 'user-a' };
      mockRequest.params = { userId: 'user-a' };
      mockRequest.body = { amount: 20000, method: 'orange_money' };
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ driver_type: 'partner' }] } as any)
        .mockResolvedValueOnce({ rows: [{ phone: '+2250700000000' }] } as any);
      mockInitiateMobileMoneyPayment.mockResolvedValueOnce({
        success: false,
        status: 'failed',
        error: 'Mobile Money indisponible : intégration provider non finalisée. Contactez le support.',
      });

      await commissionController.rechargeCommission(mockRequest as any, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      // Seules les 2 requêtes de vérification (driver_type + phone) ont eu lieu,
      // recharge_commission_balance n'est jamais appelée.
      expect(mockPool.query).toHaveBeenCalledTimes(2);
    });

    it('accepte une recharge dont le paiement Mobile Money est confirmé', async () => {
      (mockRequest as any).user = { id: 'user-a' };
      mockRequest.params = { userId: 'user-a' };
      mockRequest.body = { amount: 20000, method: 'orange_money' };
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ driver_type: 'partner' }] } as any)
        .mockResolvedValueOnce({ rows: [{ phone: '+2250700000000' }] } as any)
        .mockResolvedValueOnce({ rows: [{ transaction_id: 'tx-99' }] } as any);
      mockInitiateMobileMoneyPayment.mockResolvedValueOnce({
        success: true,
        status: 'pending',
        providerTransactionId: 'OM-123',
      });

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
