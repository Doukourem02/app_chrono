/**
 * Tests unitaires pour adminDriverController — actions admin sur la commission
 * des livreurs partenaires (argent). Déjà admin-gated au niveau routes ; on couvre
 * les règles métier propres : montant minimum de recharge, réservé aux livreurs
 * `partner`, taux de commission limité à 10 ou 20.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import type { Request, Response } from 'express';

const mockPool = { query: jest.fn<(...args: any[]) => Promise<any>>() };
await jest.unstable_mockModule('../../../src/config/db.js', () => ({
  __esModule: true,
  default: mockPool,
}));

const adminDriverController = await import('../../../src/controllers/adminDriverController.js');

describe('adminDriverController', () => {
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

  describe('rechargeAdminDriverCommission', () => {
    it('rejette un montant sous 10 000 FCFA (400) sans toucher à la base', async () => {
      mockRequest.params = { driverId: 'driver-1' };
      mockRequest.body = { amount: 5000 };

      await adminDriverController.rechargeAdminDriverCommission(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockPool.query).not.toHaveBeenCalled();
    });

    it("renvoie 404 si le profil livreur n'existe pas", async () => {
      mockRequest.params = { driverId: 'driver-1' };
      mockRequest.body = { amount: 20000 };
      mockPool.query.mockResolvedValueOnce({ rows: [] } as any);

      await adminDriverController.rechargeAdminDriverCommission(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
    });

    it('rejette un livreur non-partenaire (400)', async () => {
      mockRequest.params = { driverId: 'driver-1' };
      mockRequest.body = { amount: 20000 };
      mockPool.query.mockResolvedValueOnce({ rows: [{ driver_type: 'internal' }] } as any);

      await adminDriverController.rechargeAdminDriverCommission(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
    });

    it('effectue la recharge pour un livreur partenaire valide', async () => {
      mockRequest.params = { driverId: 'driver-1' };
      mockRequest.body = { amount: 20000, method: 'admin_manual' };
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ driver_type: 'partner' }] } as any)
        .mockResolvedValueOnce({ rows: [{ transaction_id: 'tx-1' }] } as any);

      await adminDriverController.rechargeAdminDriverCommission(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, data: expect.objectContaining({ transactionId: 'tx-1' }) })
      );
    });
  });

  describe('suspendAdminDriverCommission', () => {
    it("renvoie 404 si le profil livreur n'existe pas", async () => {
      mockRequest.params = { driverId: 'driver-1' };
      mockRequest.body = { is_suspended: true };
      mockPool.query.mockResolvedValueOnce({ rows: [] } as any);

      await adminDriverController.suspendAdminDriverCommission(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
    });

    it('rejette un livreur non-partenaire (400)', async () => {
      mockRequest.params = { driverId: 'driver-1' };
      mockRequest.body = { is_suspended: true };
      mockPool.query.mockResolvedValueOnce({ rows: [{ driver_type: 'internal' }] } as any);

      await adminDriverController.suspendAdminDriverCommission(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
    });

    it('suspend le compte commission pour un livreur partenaire', async () => {
      mockRequest.params = { driverId: 'driver-1' };
      mockRequest.body = { is_suspended: true, reason: 'fraude suspectée' };
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ driver_type: 'partner' }] } as any)
        .mockResolvedValueOnce({ rowCount: 1 } as any);

      await adminDriverController.suspendAdminDriverCommission(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });
  });

  describe('updateAdminDriverCommissionRate', () => {
    it('rejette un taux hors {10, 20} (400) sans toucher à la base', async () => {
      mockRequest.params = { driverId: 'driver-1' };
      mockRequest.body = { commission_rate: 15 };

      await adminDriverController.updateAdminDriverCommissionRate(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockPool.query).not.toHaveBeenCalled();
    });

    it('rejette un livreur non-partenaire (400)', async () => {
      mockRequest.params = { driverId: 'driver-1' };
      mockRequest.body = { commission_rate: 20 };
      mockPool.query.mockResolvedValueOnce({ rows: [{ driver_type: 'internal' }] } as any);

      await adminDriverController.updateAdminDriverCommissionRate(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
    });

    it('met à jour le taux pour un livreur partenaire valide', async () => {
      mockRequest.params = { driverId: 'driver-1' };
      mockRequest.body = { commission_rate: 20 };
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ driver_type: 'partner' }] } as any)
        .mockResolvedValueOnce({ rowCount: 1 } as any);

      await adminDriverController.updateAdminDriverCommissionRate(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });
  });
});
