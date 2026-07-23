/**
 * Tests unitaires pour batchController — getBatch et confirmBatchPickup.
 *
 * Ces deux fonctions avaient une faille d'autorisation : le contrôle ne bloquait
 * que si `driver_id` était déjà renseigné ET différent de l'utilisateur courant.
 * Tant que la tournée n'était pas encore assignée (driver_id = null, ex. pendant
 * la diffusion de l'offre à plusieurs livreurs), n'importe quel utilisateur
 * authentifié pouvait :
 *  - consulter le détail complet d'une tournée d'un tiers (getBatch) — adresses,
 *    destinataire, code de vérification QR ;
 *  - confirmer la collecte d'une tournée qui ne lui était pas assignée
 *    (confirmBatchPickup), faisant basculer les commandes en "picked_up" sans
 *    affectation réelle.
 * Corrigé en exigeant une correspondance stricte (driver assigné, propriétaire,
 * membre du partenaire, ou admin) au lieu de sauter le contrôle quand driver_id
 * est absent. Ce fichier fige le comportement corrigé.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import type { Response } from 'express';

function makeBuilder(result: unknown) {
  const builder: any = {
    select: jest.fn(() => builder),
    eq: jest.fn(() => builder),
    not: jest.fn(() => builder),
    order: jest.fn(() => builder),
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

const mockPool = { query: jest.fn<(...args: any[]) => Promise<any>>(), connect: jest.fn() };
await jest.unstable_mockModule('../../../src/config/db.js', () => ({
  __esModule: true,
  default: mockPool,
}));

await jest.unstable_mockModule('../../../src/services/recipientOrderNotifyService.js', () => ({
  __esModule: true,
  notifyAllForOrderStatus: jest.fn(() => Promise.resolve()),
  copyForPublicTrackStatus: jest.fn(() => null),
  extractRecipientPhoneFromOrder: jest.fn(() => null),
  publicTrackPageBaseUrl: jest.fn(() => null),
}));

const batchController = await import('../../../src/controllers/batchController.js');

describe('batchController', () => {
  let mockRequest: any;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    jest.clearAllMocks();

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

  describe('getBatch — scope IDOR (regression : driver_id null ne doit plus ouvrir l’accès à tous)', () => {
    it('renvoie 404 si la tournée n’existe pas', async () => {
      mockFrom.mockReturnValueOnce(makeBuilder({ data: null, error: { message: 'not found' } }));
      mockRequest.params = { id: 'batch-1' };
      mockRequest.user = { id: 'user-x' };

      await batchController.getBatch(mockRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
    });

    it("refuse un utilisateur authentifié quelconque quand la tournée n'est pas encore assignée (driver_id null)", async () => {
      mockFrom.mockReturnValueOnce(
        makeBuilder({ data: { id: 'batch-1', driver_id: null, user_id: 'owner-1', partner_id: null }, error: null })
      );
      mockRequest.params = { id: 'batch-1' };
      mockRequest.user = { id: 'random-user', role: 'client' };

      await batchController.getBatch(mockRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockFrom).toHaveBeenCalledTimes(1); // ne va pas chercher batch_orders si accès refusé
    });

    it('autorise le livreur assigné', async () => {
      mockFrom
        .mockReturnValueOnce(
          makeBuilder({ data: { id: 'batch-1', driver_id: 'driver-1', user_id: 'owner-1', partner_id: null }, error: null })
        )
        .mockReturnValueOnce(makeBuilder({ data: [], error: null }));

      mockRequest.params = { id: 'batch-1' };
      mockRequest.user = { id: 'driver-1', role: 'driver' };

      await batchController.getBatch(mockRequest, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it("autorise le propriétaire (user_id) même quand un AUTRE livreur est assigné — ce qui échouait avant le correctif", async () => {
      mockFrom
        .mockReturnValueOnce(
          makeBuilder({ data: { id: 'batch-1', driver_id: 'driver-1', user_id: 'owner-1', partner_id: null }, error: null })
        )
        .mockReturnValueOnce(makeBuilder({ data: [], error: null }));

      mockRequest.params = { id: 'batch-1' };
      mockRequest.user = { id: 'owner-1', role: 'client' };

      await batchController.getBatch(mockRequest, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('autorise un membre du partenaire propriétaire de la tournée', async () => {
      mockFrom
        .mockReturnValueOnce(
          makeBuilder({ data: { id: 'batch-1', driver_id: null, user_id: null, partner_id: 'partner-1' }, error: null })
        )
        .mockReturnValueOnce(makeBuilder({ data: [], error: null }));
      mockPool.query.mockResolvedValueOnce({ rowCount: 1, rows: [{ '?column?': 1 }] } as any);

      mockRequest.params = { id: 'batch-1' };
      mockRequest.user = { id: 'partner-user-1', role: 'client' };

      await batchController.getBatch(mockRequest, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });
  });

  describe('confirmBatchPickup — scope IDOR (regression : driver_id null ne doit plus laisser passer n’importe qui)', () => {
    it('renvoie 404 si la tournée n’existe pas', async () => {
      mockFrom.mockReturnValueOnce(makeBuilder({ data: null, error: { message: 'not found' } }));
      mockRequest.params = { id: 'batch-1' };
      mockRequest.user = { id: 'user-x' };

      await batchController.confirmBatchPickup(mockRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
    });

    it("refuse la confirmation quand la tournée n'est pas encore assignée (driver_id null) — faille corrigée", async () => {
      mockFrom.mockReturnValueOnce(
        makeBuilder({ data: { id: 'batch-1', driver_id: null, status: 'pending' }, error: null })
      );
      mockRequest.params = { id: 'batch-1' };
      mockRequest.user = { id: 'opportunistic-driver', role: 'driver' };

      await batchController.confirmBatchPickup(mockRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockFrom).toHaveBeenCalledTimes(1); // ne déclenche pas l'update de statut
    });

    it('refuse un livreur différent de celui assigné (403)', async () => {
      mockFrom.mockReturnValueOnce(
        makeBuilder({ data: { id: 'batch-1', driver_id: 'driver-1', status: 'pending' }, error: null })
      );
      mockRequest.params = { id: 'batch-1' };
      mockRequest.user = { id: 'driver-2', role: 'driver' };

      await batchController.confirmBatchPickup(mockRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
    });

    it('confirme la collecte pour le livreur assigné', async () => {
      mockFrom
        .mockReturnValueOnce(
          makeBuilder({ data: { id: 'batch-1', driver_id: 'driver-1', status: 'pending' }, error: null })
        )
        .mockReturnValueOnce(makeBuilder({ data: null, error: null })); // update status -> in_progress
      mockPool.query.mockResolvedValueOnce({ rows: [] } as any); // aucune commande à faire basculer

      mockRequest.params = { id: 'batch-1' };
      mockRequest.user = { id: 'driver-1', role: 'driver' };

      await batchController.confirmBatchPickup(mockRequest, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });
  });

  describe('validateBatchOrder — scope IDOR durci (même faille que getBatch/confirmBatchPickup)', () => {
    it("refuse quand la tournée n'est pas encore assignée (driver_id null) — durci cette session", async () => {
      mockFrom.mockReturnValueOnce(
        makeBuilder({ data: { id: 'bo-1', delivery_batches: { driver_id: null } }, error: null })
      );
      mockRequest.params = { id: 'batch-1', orderId: 'order-1' };
      mockRequest.body = { status: 'cancelled' };
      mockRequest.user = { id: 'random-driver', role: 'driver' };

      await batchController.validateBatchOrder(mockRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockPool.query).not.toHaveBeenCalled();
    });

    it('refuse un livreur différent de celui assigné à la tournée (403)', async () => {
      mockFrom.mockReturnValueOnce(
        makeBuilder({ data: { id: 'bo-1', delivery_batches: { driver_id: 'driver-1' } }, error: null })
      );
      mockRequest.params = { id: 'batch-1', orderId: 'order-1' };
      mockRequest.body = { status: 'cancelled' };
      mockRequest.user = { id: 'driver-2', role: 'driver' };

      await batchController.validateBatchOrder(mockRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
    });

    it("refuse si la commande n'est pas assignée au même livreur que la tournée (défense en profondeur)", async () => {
      mockFrom.mockReturnValueOnce(
        makeBuilder({ data: { id: 'bo-1', delivery_batches: { driver_id: 'driver-1' } }, error: null })
      );
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 'order-1', status: 'accepted', driver_id: 'driver-9-incoherent', user_id: 'client-1' }],
      } as any);
      mockRequest.params = { id: 'batch-1', orderId: 'order-1' };
      mockRequest.body = { status: 'cancelled' };
      mockRequest.user = { id: 'driver-1', role: 'driver' };

      await batchController.validateBatchOrder(mockRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
    });

    it('annule une commande de la tournée pour le livreur assigné', async () => {
      mockFrom
        .mockReturnValueOnce(
          makeBuilder({ data: { id: 'bo-1', delivery_batches: { driver_id: 'driver-1' } }, error: null })
        )
        .mockReturnValueOnce(makeBuilder({ data: null, error: null })) // update orders
        .mockReturnValueOnce(makeBuilder({ data: [{ orders: { status: 'accepted' } }], error: null })); // remaining
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 'order-1', status: 'accepted', driver_id: 'driver-1', user_id: 'client-1' }],
      } as any);

      mockRequest.params = { id: 'batch-1', orderId: 'order-1' };
      mockRequest.body = { status: 'cancelled' };
      mockRequest.user = { id: 'driver-1', role: 'driver' };

      await batchController.validateBatchOrder(mockRequest, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, data: expect.objectContaining({ status: 'cancelled' }) })
      );
    });
  });
});
