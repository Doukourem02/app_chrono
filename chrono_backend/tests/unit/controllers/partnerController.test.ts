/**
 * Tests unitaires pour partnerController — portail partenaire B2B (aucune couverture avant ce fichier).
 * Couvre les règles métier les plus sensibles : auto-suppression interdite côté portail,
 * validation de statut, exigence d'un moyen de paiement pour solder une facture.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import type { Request, Response } from 'express';

function makeBuilder(result: unknown) {
  const builder: any = {
    select: jest.fn(() => builder),
    eq: jest.fn(() => builder),
    neq: jest.fn(() => builder),
    order: jest.fn(() => builder),
    limit: jest.fn(() => builder),
    update: jest.fn(() => builder),
    insert: jest.fn(() => builder),
    delete: jest.fn(() => builder),
    upsert: jest.fn(() => builder),
    ilike: jest.fn(() => builder),
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

const partnerController = await import('../../../src/controllers/partnerController.js');

describe('partnerController', () => {
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

  describe('removePartnerUser — portail owner only', () => {
    it("refuse qu'un membre se retire lui-même (400)", async () => {
      mockFrom.mockReturnValueOnce(
        makeBuilder({ data: { id: 'member-1', user_id: 'user-self' }, error: null })
      );

      (mockRequest as any).partnerUser = { partnerId: 'partner-1', userId: 'user-self' };
      mockRequest.params = { memberId: 'member-1' };

      await partnerController.removePartnerUser(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringContaining('retirer vous-même'),
        })
      );
    });

    it('renvoie 404 si le membre ne fait pas partie de ce partenaire (scope IDOR)', async () => {
      mockFrom.mockReturnValueOnce(makeBuilder({ data: null, error: null }));

      (mockRequest as any).partnerUser = { partnerId: 'partner-1', userId: 'user-owner' };
      mockRequest.params = { memberId: 'member-from-another-partner' };

      await partnerController.removePartnerUser(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
    });

    it('supprime le membre quand tout est valide', async () => {
      mockFrom
        .mockReturnValueOnce(makeBuilder({ data: { id: 'member-2', user_id: 'user-2' }, error: null }))
        .mockReturnValueOnce(makeBuilder({ data: null, error: null }));

      (mockRequest as any).partnerUser = { partnerId: 'partner-1', userId: 'user-owner' };
      mockRequest.params = { memberId: 'member-2' };

      await partnerController.removePartnerUser(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });
  });

  describe('updatePartnerStatus — admin only', () => {
    it('rejette un statut invalide (400)', async () => {
      mockRequest.params = { id: 'partner-1' };
      mockRequest.body = { status: 'not-a-real-status' };

      await partnerController.updatePartnerStatus(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockFrom).not.toHaveBeenCalled();
    });

    it('accepte un statut valide et persiste la mise à jour', async () => {
      mockFrom.mockReturnValueOnce(
        makeBuilder({ data: { id: 'partner-1', status: 'suspended' }, error: null })
      );

      mockRequest.params = { id: 'partner-1' };
      mockRequest.body = { status: 'suspended' };

      await partnerController.updatePartnerStatus(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, data: expect.objectContaining({ status: 'suspended' }) })
      );
    });
  });

  describe('markPartnerInvoicePaid — admin only', () => {
    it('renvoie 404 si la facture ne correspond pas à ce partenaire (scope IDOR)', async () => {
      mockFrom.mockReturnValueOnce(makeBuilder({ data: null, error: null }));

      mockRequest.params = { id: 'partner-1', invoiceId: 'invoice-from-another-partner' };
      mockRequest.body = { payment_method_type: 'wave' };

      await partnerController.markPartnerInvoicePaid(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
    });

    it('exige un moyen de paiement (400) même si la facture existe', async () => {
      mockFrom.mockReturnValueOnce(
        makeBuilder({ data: { id: 'invoice-1', partner_id: 'partner-1', amount: 16000 }, error: null })
      );

      mockRequest.params = { id: 'partner-1', invoiceId: 'invoice-1' };
      mockRequest.body = {};

      await partnerController.markPartnerInvoicePaid(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringContaining('Moyen de paiement') })
      );
    });

    it('rejette un moyen de paiement inconnu (400)', async () => {
      mockFrom.mockReturnValueOnce(
        makeBuilder({ data: { id: 'invoice-1', partner_id: 'partner-1', amount: 16000 }, error: null })
      );

      mockRequest.params = { id: 'partner-1', invoiceId: 'invoice-1' };
      mockRequest.body = { payment_method_type: 'bitcoin' };

      await partnerController.markPartnerInvoicePaid(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Moyen de paiement invalide' })
      );
    });

    it('valide le paiement et marque la facture payée', async () => {
      mockFrom
        .mockReturnValueOnce(
          makeBuilder({ data: { id: 'invoice-1', partner_id: 'partner-1', amount: 16000 }, error: null })
        )
        .mockReturnValueOnce(
          makeBuilder({ data: { id: 'invoice-1', status: 'paid' }, error: null })
        );

      mockRequest.params = { id: 'partner-1', invoiceId: 'invoice-1' };
      mockRequest.body = { payment_method_type: 'wave', payment_reference: 'TX123' };

      await partnerController.markPartnerInvoicePaid(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, data: expect.objectContaining({ status: 'paid' }) })
      );
    });
  });
});
