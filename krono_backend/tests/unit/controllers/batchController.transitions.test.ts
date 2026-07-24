/**
 * Tests unitaires pour batchController — logique métier des tournées B2B
 * (transitions de statut, preuve de livraison, agrégation du statut de la
 * tournée, notifications multi-arrêts), complémentaires aux tests de
 * régression IDOR déjà présents dans batchController.test.ts (contrôle
 * d'accès uniquement, pas testé ici).
 *
 * Couvre notamment la régression du bug corrigé le 2026-07-23 :
 * validateBatchOrder ne notifiait jamais personne (payeur, admin) pour un
 * arrêt de tournée passant à completed/cancelled ; confirmBatchPickup devait
 * notifier chaque commande individuellement (N livraisons = N notifications).
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

const notifyAllForOrderStatus = jest.fn<(...args: any[]) => Promise<any>>(() => Promise.resolve());
await jest.unstable_mockModule('../../../src/services/recipientOrderNotifyService.js', () => ({
  __esModule: true,
  notifyAllForOrderStatus,
  copyForPublicTrackStatus: jest.fn(() => null),
  extractRecipientPhoneFromOrder: jest.fn(() => null),
  publicTrackPageBaseUrl: jest.fn(() => null),
}));

const emitOrderStatusToPayer = jest.fn<(...args: any[]) => Promise<any>>(() => Promise.resolve());
await jest.unstable_mockModule('../../../src/sockets/orderSocket.js', () => ({
  __esModule: true,
  emitBatchAssigned: jest.fn(() => true),
  emitBatchOfferToAllConnectedDrivers: jest.fn(() => 0),
  emitBatchOfferToDrivers: jest.fn(() => 0),
  findAllAvailableDrivers: jest.fn(() => Promise.resolve([])),
  emitOrderStatusToPayer,
}));

const broadcastOrderUpdateToAdmins = jest.fn();
await jest.unstable_mockModule('../../../src/sockets/adminSocket.js', () => ({
  __esModule: true,
  broadcastOrderUpdateToAdmins,
}));

const completeTransactionsForOrder = jest.fn<(...args: any[]) => Promise<any>>(() => Promise.resolve());
await jest.unstable_mockModule('../../../src/utils/createTransactionForOrder.js', () => ({
  __esModule: true,
  completeTransactionsForOrder,
  cancelDeferredTransactionForOrder: jest.fn(() => Promise.resolve()),
}));

const saveDeliveryProofRecord = jest.fn<(...args: any[]) => Promise<any>>(() => Promise.resolve());
await jest.unstable_mockModule('../../../src/config/orderStorage.js', () => ({
  __esModule: true,
  saveDeliveryProofRecord,
}));

const batchController = await import('../../../src/controllers/batchController.js');

describe('batchController — logique métier tournée (hors contrôle d’accès)', () => {
  let mockRequest: any;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockRequest = {
      params: {},
      body: {},
      query: {},
      app: { get: jest.fn(() => ({})) },
    };

    mockResponse = {
      status: jest.fn().mockReturnThis() as any,
      json: jest.fn().mockReturnThis() as any,
    };
  });

  describe('validateBatchOrder — garde-fous de validation', () => {
    it('rejette un status autre que completed/cancelled sans toucher la base', async () => {
      mockRequest.params = { id: 'batch-1', orderId: 'order-1' };
      mockRequest.body = { status: 'delivering' };

      await batchController.validateBatchOrder(mockRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockFrom).not.toHaveBeenCalled();
    });

    it('exige un proofMethod valide pour clôturer en completed', async () => {
      mockFrom.mockReturnValueOnce(
        makeBuilder({ data: { id: 'bo-1', delivery_batches: { driver_id: 'driver-1' } }, error: null })
      );
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 'order-1', status: 'accepted', driver_id: 'driver-1', user_id: 'client-1' }],
      } as any);
      mockRequest.params = { id: 'batch-1', orderId: 'order-1' };
      mockRequest.body = { status: 'completed' };
      mockRequest.user = { id: 'driver-1', role: 'driver' };

      await batchController.validateBatchOrder(mockRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, message: expect.stringContaining('preuve') })
      );
      expect(mockPool.query).toHaveBeenCalledTimes(1); // pas de proofCheck déclenché
    });

    it('refuse un scan QR/code absent ou invalide (proofMethod qr_scan)', async () => {
      mockFrom.mockReturnValueOnce(
        makeBuilder({ data: { id: 'bo-1', delivery_batches: { driver_id: 'driver-1' } }, error: null })
      );
      mockPool.query
        .mockResolvedValueOnce({
          rows: [{ id: 'order-1', status: 'accepted', driver_id: 'driver-1', user_id: 'client-1' }],
        } as any)
        .mockResolvedValueOnce({ rows: [] } as any); // aucune ligne qr_code_scans valide

      mockRequest.params = { id: 'batch-1', orderId: 'order-1' };
      mockRequest.body = { status: 'completed', proofMethod: 'qr_scan' };
      mockRequest.user = { id: 'driver-1', role: 'driver' };

      await batchController.validateBatchOrder(mockRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, message: expect.stringContaining('preuve QR') })
      );
    });

    it("refuse de clôturer depuis un statut de commande qui ne le permet pas (ex. pending)", async () => {
      mockFrom.mockReturnValueOnce(
        makeBuilder({ data: { id: 'bo-1', delivery_batches: { driver_id: 'driver-1' } }, error: null })
      );
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 'order-1', status: 'pending', driver_id: 'driver-1', user_id: 'client-1' }],
      } as any);

      mockRequest.params = { id: 'batch-1', orderId: 'order-1' };
      mockRequest.body = { status: 'completed', proofMethod: 'batch_driver_confirmation' };
      mockRequest.user = { id: 'driver-1', role: 'driver' };

      await batchController.validateBatchOrder(mockRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, message: expect.stringContaining('pending') })
      );
    });
  });

  describe('validateBatchOrder — notifications par transition (régression bug 2026-07-23)', () => {
    it('notifie le payeur (socket live + push/SMS) et l’admin quand un arrêt est annulé', async () => {
      mockFrom
        .mockReturnValueOnce(
          makeBuilder({ data: { id: 'bo-1', delivery_batches: { driver_id: 'driver-1' } }, error: null })
        ) // check appartenance
        .mockReturnValueOnce(makeBuilder({ error: null })) // update orders -> cancelled
        .mockReturnValueOnce(makeBuilder({ data: [{ orders: { status: 'accepted' } }], error: null })); // reste des arrêts actifs
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 'order-1', status: 'accepted', driver_id: 'driver-1', user_id: 'client-1' }],
      } as any);

      mockRequest.params = { id: 'batch-1', orderId: 'order-1' };
      mockRequest.body = { status: 'cancelled' };
      mockRequest.user = { id: 'driver-1', role: 'driver' };

      await batchController.validateBatchOrder(mockRequest, mockResponse as Response);

      expect(notifyAllForOrderStatus).toHaveBeenCalledWith(
        expect.objectContaining({ orderId: 'order-1', status: 'cancelled', payerUserId: 'client-1' })
      );
      expect(emitOrderStatusToPayer).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ orderId: 'order-1', status: 'cancelled', payerUserId: 'client-1' })
      );
      expect(broadcastOrderUpdateToAdmins).toHaveBeenCalledWith(
        expect.anything(),
        'order:status:update',
        expect.objectContaining({ order: { id: 'order-1', status: 'cancelled' } })
      );
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, data: { orderId: 'order-1', status: 'cancelled' } })
      );
    });

    it('enregistre la preuve alternative et finalise le paiement quand un arrêt est complété via batch_driver_confirmation', async () => {
      mockFrom
        .mockReturnValueOnce(
          makeBuilder({ data: { id: 'bo-1', delivery_batches: { driver_id: 'driver-1' } }, error: null })
        )
        .mockReturnValueOnce(makeBuilder({ error: null })) // update orders -> completed
        .mockReturnValueOnce(makeBuilder({ data: [{ orders: { status: 'accepted' } }], error: null })); // autres arrêts encore actifs
      mockPool.query
        .mockResolvedValueOnce({
          rows: [{ id: 'order-1', status: 'picked_up', driver_id: 'driver-1', user_id: 'client-1' }],
        } as any)
        .mockResolvedValueOnce({ rows: [] } as any); // INSERT qr_code_scans (preuve alternative)

      mockRequest.params = { id: 'batch-1', orderId: 'order-1' };
      mockRequest.body = { status: 'completed', proofMethod: 'batch_driver_confirmation' };
      mockRequest.user = { id: 'driver-1', role: 'driver' };

      await batchController.validateBatchOrder(mockRequest, mockResponse as Response);

      expect(saveDeliveryProofRecord).toHaveBeenCalledWith(
        expect.objectContaining({ orderId: 'order-1', driverId: 'driver-1', proofType: 'batch_driver_confirmation' })
      );
      expect(completeTransactionsForOrder).toHaveBeenCalledWith('order-1');
      expect(notifyAllForOrderStatus).toHaveBeenCalledWith(
        expect.objectContaining({ orderId: 'order-1', status: 'completed' })
      );
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, data: { orderId: 'order-1', status: 'completed' } })
      );
    });
  });

  describe('validateBatchOrder — agrégation du statut final de la tournée', () => {
    it("passe la tournée à 'completed' quand le dernier arrêt restant est complété", async () => {
      const deliveryBatchesUpdateBuilder = makeBuilder({ error: null });
      mockFrom
        .mockReturnValueOnce(
          makeBuilder({ data: { id: 'bo-1', delivery_batches: { driver_id: 'driver-1' } }, error: null })
        )
        .mockReturnValueOnce(makeBuilder({ error: null })) // update orders -> completed
        .mockReturnValueOnce(makeBuilder({ data: [], error: null })) // plus aucun arrêt actif
        .mockReturnValueOnce(makeBuilder({ data: [{ orders: { status: 'completed' } }], error: null })) // tous les arrêts
        .mockReturnValueOnce(deliveryBatchesUpdateBuilder); // update delivery_batches
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 'order-1', status: 'picked_up', driver_id: 'driver-1', user_id: 'client-1' }],
      } as any);

      mockRequest.params = { id: 'batch-1', orderId: 'order-1' };
      mockRequest.body = { status: 'completed', proofMethod: 'batch_driver_confirmation' };
      mockRequest.user = { id: 'driver-1', role: 'driver' };

      await batchController.validateBatchOrder(mockRequest, mockResponse as Response);

      expect(deliveryBatchesUpdateBuilder.update).toHaveBeenCalledWith({ status: 'completed' });
    });

    it("passe la tournée à 'partial' quand le dernier arrêt restant mélange completed et cancelled", async () => {
      const deliveryBatchesUpdateBuilder = makeBuilder({ error: null });
      mockFrom
        .mockReturnValueOnce(
          makeBuilder({ data: { id: 'bo-1', delivery_batches: { driver_id: 'driver-1' } }, error: null })
        )
        .mockReturnValueOnce(makeBuilder({ error: null })) // update orders -> cancelled
        .mockReturnValueOnce(makeBuilder({ data: [], error: null })) // plus aucun arrêt actif
        .mockReturnValueOnce(
          makeBuilder({ data: [{ orders: { status: 'completed' } }, { orders: { status: 'cancelled' } }], error: null })
        )
        .mockReturnValueOnce(deliveryBatchesUpdateBuilder);
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 'order-2', status: 'accepted', driver_id: 'driver-1', user_id: 'client-2' }],
      } as any);

      mockRequest.params = { id: 'batch-1', orderId: 'order-2' };
      mockRequest.body = { status: 'cancelled' };
      mockRequest.user = { id: 'driver-1', role: 'driver' };

      await batchController.validateBatchOrder(mockRequest, mockResponse as Response);

      expect(deliveryBatchesUpdateBuilder.update).toHaveBeenCalledWith({ status: 'partial' });
    });
  });

  describe('confirmBatchPickup — notification par arrêt (N livraisons = N notifications)', () => {
    it('notifie individuellement chaque commande récupérée de la tournée', async () => {
      mockFrom
        .mockReturnValueOnce(
          makeBuilder({ data: { id: 'batch-1', driver_id: 'driver-1', status: 'pending' }, error: null })
        )
        .mockReturnValueOnce(makeBuilder({ error: null })); // update delivery_batches -> in_progress
      mockPool.query.mockResolvedValueOnce({
        rows: [
          { id: 'order-1', user_id: 'client-1' },
          { id: 'order-2', user_id: 'client-2' },
        ],
      } as any);

      mockRequest.params = { id: 'batch-1' };
      mockRequest.user = { id: 'driver-1', role: 'driver' };

      await batchController.confirmBatchPickup(mockRequest, mockResponse as Response);

      expect(notifyAllForOrderStatus).toHaveBeenCalledTimes(2);
      expect(notifyAllForOrderStatus).toHaveBeenCalledWith(
        expect.objectContaining({ orderId: 'order-1', status: 'picked_up', payerUserId: 'client-1' })
      );
      expect(notifyAllForOrderStatus).toHaveBeenCalledWith(
        expect.objectContaining({ orderId: 'order-2', status: 'picked_up', payerUserId: 'client-2' })
      );
      expect(emitOrderStatusToPayer).toHaveBeenCalledTimes(2);
      expect(broadcastOrderUpdateToAdmins).toHaveBeenCalledTimes(2);
      expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });
  });
});
