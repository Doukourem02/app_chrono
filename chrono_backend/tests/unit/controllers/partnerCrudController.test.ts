/**
 * Tests unitaires pour partnerCrudController — remplace les tests écrits sur
 * partnerController.ts (code mort, jamais câblé aux routes ; voir partnerRoutes.ts
 * qui importe updatePartnerStatus depuis partnerCrudController.js). Couvre la
 * validation de statut, seule règle métier de sécurité de cette fonction.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import type { Request, Response } from 'express';

function makeBuilder(result: unknown) {
  const builder: any = {
    select: jest.fn(() => builder),
    eq: jest.fn(() => builder),
    update: jest.fn(() => builder),
    single: jest.fn(() => Promise.resolve(result)),
    maybeSingle: jest.fn(() => Promise.resolve(result)),
    then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
  };
  return builder;
}

const mockFrom = jest.fn();
const mockSupabaseClient = { from: mockFrom };

await jest.unstable_mockModule('../../../src/config/supabase.js', () => ({
  __esModule: true,
  supabase: mockSupabaseClient,
  supabaseAdmin: mockSupabaseClient,
  default: mockSupabaseClient,
}));

const partnerCrudController = await import('../../../src/controllers/partnerCrudController.js');

describe('partnerCrudController', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    jest.clearAllMocks();

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

  describe('updatePartnerStatus — admin only, endpoint réellement câblé (PATCH /:id/status)', () => {
    it('rejette un statut invalide (400) sans toucher à la base', async () => {
      mockRequest.params = { id: 'partner-1' };
      mockRequest.body = { status: 'not-a-real-status' };

      await partnerCrudController.updatePartnerStatus(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockFrom).not.toHaveBeenCalled();
    });

    it('accepte un statut valide et persiste la mise à jour (pas de req.user -> pas d’audit log)', async () => {
      mockFrom
        .mockReturnValueOnce(makeBuilder({ data: { status: 'active' }, error: null })) // fetch "before"
        .mockReturnValueOnce(makeBuilder({ data: { id: 'partner-1', status: 'suspended' }, error: null })); // update

      mockRequest.params = { id: 'partner-1' };
      mockRequest.body = { status: 'suspended' };

      await partnerCrudController.updatePartnerStatus(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, data: expect.objectContaining({ status: 'suspended' }) })
      );
    });

    it("renvoie 500 si l'update échoue en base", async () => {
      mockFrom
        .mockReturnValueOnce(makeBuilder({ data: { status: 'active' }, error: null }))
        .mockReturnValueOnce(makeBuilder({ data: null, error: { message: 'db down' } }));

      mockRequest.params = { id: 'partner-1' };
      mockRequest.body = { status: 'suspended' };

      await partnerCrudController.updatePartnerStatus(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
    });
  });
});
