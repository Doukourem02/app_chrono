/**
 * Tests unitaires pour partnerSubscriptionController — remplace les tests écrits sur
 * partnerController.ts (code mort, jamais câblé aux routes ; voir partnerRoutes.ts qui
 * importe createSubscription/activateSubscription/markPartnerInvoicePaid depuis
 * partnerSubscriptionController.js). Couvre les règles métier les plus sensibles côté
 * argent : plan invalide, scope IDOR sur facture/abonnement, moyen de paiement requis.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import type { Request, Response } from 'express';

function makeBuilder(result: unknown) {
  const builder: any = {
    select: jest.fn(() => builder),
    eq: jest.fn(() => builder),
    neq: jest.fn(() => builder),
    order: jest.fn(() => builder),
    update: jest.fn(() => builder),
    insert: jest.fn(() => builder),
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

const partnerSubscriptionController = await import('../../../src/controllers/partnerSubscriptionController.js');

describe('partnerSubscriptionController', () => {
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

  describe('createSubscription — endpoint réellement câblé (POST /:id/subscriptions)', () => {
    it('rejette un plan invalide (400) sans toucher à la base', async () => {
      mockRequest.params = { id: 'partner-1' };
      mockRequest.body = { plan: 'ultra-plan-inexistant' };

      await partnerSubscriptionController.createSubscription(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockFrom).not.toHaveBeenCalled();
    });

    it('crée un abonnement pending_payment pour un plan valide', async () => {
      mockFrom.mockReturnValueOnce(
        makeBuilder({ data: { id: 'sub-1', plan: 'pro', payment_status: 'pending_payment' }, error: null })
      );

      mockRequest.params = { id: 'partner-1' };
      mockRequest.body = { plan: 'pro' };

      await partnerSubscriptionController.createSubscription(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, data: expect.objectContaining({ payment_status: 'pending_payment' }) })
      );
    });
  });

  describe('activateSubscription — scope IDOR', () => {
    it("renvoie 404 si l'abonnement ne correspond pas à ce partenaire", async () => {
      mockFrom.mockReturnValueOnce(makeBuilder({ data: null, error: null }));

      mockRequest.params = { id: 'partner-1', subId: 'sub-from-another-partner' };
      mockRequest.body = {};

      await partnerSubscriptionController.activateSubscription(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
    });

    it('rejette un moyen de paiement inconnu (400)', async () => {
      mockFrom.mockReturnValueOnce(
        makeBuilder({ data: { id: 'sub-1', partner_id: 'partner-1', monthly_price: 16000, plan: 'pro' }, error: null })
      );

      mockRequest.params = { id: 'partner-1', subId: 'sub-1' };
      mockRequest.body = { payment_method_type: 'bitcoin' };

      await partnerSubscriptionController.activateSubscription(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
    });

    it('active un abonnement valide et met à jour le plan du partenaire', async () => {
      mockFrom
        .mockReturnValueOnce(
          makeBuilder({ data: { id: 'sub-1', partner_id: 'partner-1', monthly_price: 16000, plan: 'pro' }, error: null })
        )
        .mockReturnValueOnce(makeBuilder({ data: null, error: null })) // désactivation des autres abonnements
        .mockReturnValueOnce(makeBuilder({ data: { id: 'sub-1', is_active: true, plan: 'pro' }, error: null }))
        .mockReturnValueOnce(makeBuilder({ data: null, error: null })); // update partners.plan

      mockRequest.params = { id: 'partner-1', subId: 'sub-1' };
      mockRequest.body = { payment_method_type: 'wave' };

      await partnerSubscriptionController.activateSubscription(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, data: expect.objectContaining({ is_active: true }) })
      );
    });
  });

  describe('markPartnerInvoicePaid — scope IDOR', () => {
    it("renvoie 404 si la facture ne correspond pas à ce partenaire", async () => {
      mockFrom.mockReturnValueOnce(makeBuilder({ data: null, error: null }));

      mockRequest.params = { id: 'partner-1', invoiceId: 'invoice-from-another-partner' };
      mockRequest.body = { payment_method_type: 'wave' };

      await partnerSubscriptionController.markPartnerInvoicePaid(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
    });

    it('exige un moyen de paiement (400) même si la facture existe', async () => {
      mockFrom.mockReturnValueOnce(
        makeBuilder({ data: { id: 'invoice-1', partner_id: 'partner-1', amount: 16000 }, error: null })
      );

      mockRequest.params = { id: 'partner-1', invoiceId: 'invoice-1' };
      mockRequest.body = {};

      await partnerSubscriptionController.markPartnerInvoicePaid(mockRequest as Request, mockResponse as Response);

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

      await partnerSubscriptionController.markPartnerInvoicePaid(mockRequest as Request, mockResponse as Response);

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
        .mockReturnValueOnce(makeBuilder({ data: { id: 'invoice-1', status: 'paid' }, error: null }));

      mockRequest.params = { id: 'partner-1', invoiceId: 'invoice-1' };
      mockRequest.body = { payment_method_type: 'wave', payment_reference: 'TX123' };

      await partnerSubscriptionController.markPartnerInvoicePaid(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, data: expect.objectContaining({ status: 'paid' }) })
      );
    });
  });
});
