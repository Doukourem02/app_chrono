/**
 * Tests unitaires pour partnerUserController — remplace les tests écrits sur
 * partnerController.ts (code mort, jamais câblé aux routes ; voir partnerRoutes.ts
 * qui importe removePartnerUser depuis partnerUserController.js). Couvre l'IDOR
 * (un membre ne peut retirer un membre que de son propre partenaire) et
 * l'interdiction d'auto-suppression.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import type { Request, Response } from 'express';

function makeBuilder(result: unknown) {
  const builder: any = {
    select: jest.fn(() => builder),
    eq: jest.fn(() => builder),
    delete: jest.fn(() => builder),
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

const partnerUserController = await import('../../../src/controllers/partnerUserController.js');

describe('partnerUserController', () => {
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

  describe('removePartnerUser — endpoint réellement câblé (DELETE /users/:memberId)', () => {
    it("refuse qu'un membre se retire lui-même (400)", async () => {
      mockFrom.mockReturnValueOnce(
        makeBuilder({ data: { id: 'member-1', user_id: 'user-self' }, error: null })
      );

      (mockRequest as any).partnerUser = { partnerId: 'partner-1', userId: 'user-self' };
      mockRequest.params = { memberId: 'member-1' };

      await partnerUserController.removePartnerUser(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, message: expect.stringContaining('retirer vous-même') })
      );
    });

    it('renvoie 404 si le membre ne fait pas partie de ce partenaire (scope IDOR)', async () => {
      mockFrom.mockReturnValueOnce(makeBuilder({ data: null, error: null }));

      (mockRequest as any).partnerUser = { partnerId: 'partner-1', userId: 'user-owner' };
      mockRequest.params = { memberId: 'member-from-another-partner' };

      await partnerUserController.removePartnerUser(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
    });

    it('supprime le membre quand tout est valide', async () => {
      mockFrom
        .mockReturnValueOnce(makeBuilder({ data: { id: 'member-2', user_id: 'user-2' }, error: null }))
        .mockReturnValueOnce(makeBuilder({ data: null, error: null }));

      (mockRequest as any).partnerUser = { partnerId: 'partner-1', userId: 'user-owner' };
      mockRequest.params = { memberId: 'member-2' };

      await partnerUserController.removePartnerUser(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });
  });
});
