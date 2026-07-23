/**
 * Tests unitaires pour partnerDriverController — rattachement de livreurs
 * dédiés à un partenaire B2B (transaction pool.connect()). Couvre la validation
 * des champs, le rejet d'un utilisateur non-livreur, et les règles de revue de
 * demande (action invalide, driver_user_id requis pour approuver).
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import type { Request, Response } from 'express';

function makeTxClient() {
  return {
    query: jest.fn<(...args: any[]) => Promise<any>>(),
    release: jest.fn(),
  };
}

const mockPool = {
  query: jest.fn<(...args: any[]) => Promise<any>>(),
  connect: jest.fn<(...args: any[]) => Promise<any>>(),
};
await jest.unstable_mockModule('../../../src/config/db.js', () => ({
  __esModule: true,
  default: mockPool,
}));

function makeBuilder(result: unknown) {
  const builder: any = {
    select: jest.fn(() => builder),
    eq: jest.fn(() => builder),
    order: jest.fn(() => builder),
    insert: jest.fn(() => builder),
    update: jest.fn(() => builder),
    single: jest.fn(() => Promise.resolve(result)),
    maybeSingle: jest.fn(() => Promise.resolve(result)),
    then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
  };
  return builder;
}
const mockFrom = jest.fn();
await jest.unstable_mockModule('../../../src/config/supabase.js', () => ({
  __esModule: true,
  supabase: { from: mockFrom },
  supabaseAdmin: { from: mockFrom },
  default: { from: mockFrom },
}));

const partnerDriverController = await import('../../../src/controllers/partnerDriverController.js');

describe('partnerDriverController', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPool.query.mockReset();
    mockPool.connect.mockReset();
    mockFrom.mockReset();
    mockRequest = { params: {}, body: {}, query: {} } as unknown as Partial<Request>;
    mockResponse = {
      status: jest.fn().mockReturnThis() as any,
      json: jest.fn().mockReturnThis() as any,
    };
  });

  describe('addPartnerDriver', () => {
    it('rejette une requête sans driver_user_id (400) sans ouvrir de transaction', async () => {
      mockRequest.params = { id: 'partner-1' };
      mockRequest.body = {};

      await partnerDriverController.addPartnerDriver(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockPool.connect).not.toHaveBeenCalled();
    });

    it("renvoie 404 si le partenaire n'existe pas", async () => {
      const client = makeTxClient();
      client.query
        .mockResolvedValueOnce({} as any) // BEGIN
        .mockResolvedValueOnce({ rowCount: 0, rows: [] } as any); // partner lookup
      mockPool.connect.mockResolvedValueOnce(client as any);

      mockRequest.params = { id: 'partner-x' };
      mockRequest.body = { driver_user_id: '11111111-1111-1111-1111-111111111111' };

      await partnerDriverController.addPartnerDriver(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    });

    it("rejette un utilisateur qui n'est pas un livreur (400)", async () => {
      const client = makeTxClient();
      client.query
        .mockResolvedValueOnce({} as any) // BEGIN
        .mockResolvedValueOnce({ rowCount: 1 } as any) // partner exists
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ role: 'client' }] } as any); // user is a client, not driver
      mockPool.connect.mockResolvedValueOnce(client as any);

      mockRequest.params = { id: 'partner-1' };
      mockRequest.body = { driver_user_id: '11111111-1111-1111-1111-111111111111' };

      await partnerDriverController.addPartnerDriver(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringContaining('livreur') })
      );
    });

    it('rattache un livreur valide au partenaire', async () => {
      const client = makeTxClient();
      client.query
        .mockResolvedValueOnce({} as any) // BEGIN
        .mockResolvedValueOnce({ rowCount: 1 } as any) // partner exists
        .mockResolvedValueOnce({
          rowCount: 1,
          rows: [{ role: 'driver', first_name: 'A', last_name: 'B', accepts_b2b_orders: true }],
        } as any) // driver lookup
        .mockResolvedValueOnce({
          rows: [{ id: 'pd-1', partner_id: 'partner-1', driver_user_id: 'driver-1', is_default: false }],
        } as any) // insert
        .mockResolvedValueOnce({} as any); // COMMIT
      mockPool.connect.mockResolvedValueOnce(client as any);

      mockRequest.params = { id: 'partner-1' };
      mockRequest.body = { driver_user_id: '11111111-1111-1111-1111-111111111111' };

      await partnerDriverController.addPartnerDriver(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(client.query).toHaveBeenCalledWith('COMMIT');
    });
  });

  describe('removePartnerDriver', () => {
    it("renvoie 404 si le livreur dédié n'existe pas", async () => {
      mockRequest.params = { id: 'partner-1', driverUserId: 'driver-x' };
      mockPool.query.mockResolvedValueOnce({ rowCount: 0 } as any);

      await partnerDriverController.removePartnerDriver(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
    });

    it('supprime le rattachement livreur existant', async () => {
      mockRequest.params = { id: 'partner-1', driverUserId: 'driver-1' };
      mockPool.query.mockResolvedValueOnce({ rowCount: 1 } as any);

      await partnerDriverController.removePartnerDriver(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });
  });

  describe('reviewPartnerDriverRequest', () => {
    it('rejette une action invalide (400)', async () => {
      mockRequest.params = { id: 'partner-1', requestId: 'req-1' };
      mockRequest.body = { action: 'bogus' };

      await partnerDriverController.reviewPartnerDriverRequest(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
    });

    it('exige driver_user_id pour approuver une demande (400)', async () => {
      mockRequest.params = { id: 'partner-1', requestId: 'req-1' };
      mockRequest.body = { action: 'approve' };

      await partnerDriverController.reviewPartnerDriverRequest(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
    });

    it('rejette une demande sans avoir besoin de driver_user_id', async () => {
      mockRequest.params = { id: 'partner-1', requestId: 'req-1' };
      mockRequest.body = { action: 'reject', review_note: 'non pertinent' };
      mockFrom.mockReturnValueOnce(
        makeBuilder({ data: { id: 'req-1', status: 'rejected' }, error: null })
      );

      await partnerDriverController.reviewPartnerDriverRequest(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, data: expect.objectContaining({ status: 'rejected' }) })
      );
    });
  });
});
