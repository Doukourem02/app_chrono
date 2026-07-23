/**
 * Tests unitaires pour partnerController — après nettoyage du code mort cette
 * session (1995 → ~250 lignes), il ne reste que les 2 fonctions réellement
 * câblées aux routes (voir partnerRoutes.ts) : suivi de commande et QR code de
 * livraison pour le portail partenaire.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import type { Request, Response } from 'express';

const mockPool = { query: jest.fn<(...args: any[]) => Promise<any>>() };
await jest.unstable_mockModule('../../../src/config/db.js', () => ({
  __esModule: true,
  default: mockPool,
}));

const mockQrCodeService = {
  getOrderQRCode: jest.fn<(...args: any[]) => Promise<any>>(),
  generateDeliveryQRCode: jest.fn<(...args: any[]) => Promise<any>>(),
};
await jest.unstable_mockModule('../../../src/services/qrCodeService.js', () => ({
  __esModule: true,
  default: mockQrCodeService,
}));

const partnerController = await import('../../../src/controllers/partnerController.js');

describe('partnerController (post-nettoyage du code mort)', () => {
  let mockRequest: any;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPool.query.mockReset();
    mockRequest = { params: {}, body: {}, query: {} };
    mockResponse = {
      status: jest.fn().mockReturnThis() as any,
      json: jest.fn().mockReturnThis() as any,
    };
  });

  describe('getPartnerOrderTracking', () => {
    it('rejette une requête sans partnerId ni orderId (400)', async () => {
      mockRequest.params = {};

      await partnerController.getPartnerOrderTracking(mockRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockPool.query).not.toHaveBeenCalled();
    });

    it("renvoie 404 si la commande n'appartient pas à ce partenaire (scope IDOR)", async () => {
      mockRequest.partnerUser = { partnerId: 'partner-1' };
      mockRequest.params = { orderId: 'order-1' };
      mockPool.query.mockResolvedValueOnce({ rows: [] } as any);

      await partnerController.getPartnerOrderTracking(mockRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('o.partner_id = $2'),
        ['order-1', 'partner-1']
      );
    });

    it('retourne le suivi pour une commande du partenaire', async () => {
      mockRequest.partnerUser = { partnerId: 'partner-1' };
      mockRequest.params = { orderId: 'order-1' };
      mockPool.query.mockResolvedValueOnce({
        rows: [{
          id: 'order-1', status: 'accepted', driver_id: null,
          pickup_address: JSON.stringify({ address: 'Cocody' }),
          dropoff_address: JSON.stringify({ address: 'Marcory' }),
          recipient: JSON.stringify({}),
          price_cfa: 1500, delivery_method: 'moto', distance_km: 5,
          created_at: '2026-01-01', updated_at: '2026-01-01',
          delivery_qr_scanned_at: null,
        }],
      } as any);

      await partnerController.getPartnerOrderTracking(mockRequest, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, data: expect.objectContaining({ id: 'order-1' }) })
      );
    });
  });

  describe('getPartnerOrderQRCode', () => {
    it('rejette une requête sans partnerId ni orderId (400)', async () => {
      mockRequest.params = {};

      await partnerController.getPartnerOrderQRCode(mockRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
    });

    it("renvoie 404 si la commande n'appartient pas à ce partenaire (scope IDOR)", async () => {
      mockRequest.partnerUser = { partnerId: 'partner-1' };
      mockRequest.params = { orderId: 'order-1' };
      mockPool.query.mockResolvedValueOnce({ rows: [] } as any);

      await partnerController.getPartnerOrderQRCode(mockRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
    });

    it("ne montre pas le QR code si le colis n'a pas encore été récupéré", async () => {
      mockRequest.partnerUser = { partnerId: 'partner-1' };
      mockRequest.params = { orderId: 'order-1' };
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 'order-1', status: 'accepted', recipient: '{}', dropoff_address: '{}', delivery_qr_scanned_at: null }],
      } as any);

      await partnerController.getPartnerOrderQRCode(mockRequest, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ showQRCode: false }) })
      );
    });

    it('montre le QR code une fois le colis récupéré', async () => {
      mockRequest.partnerUser = { partnerId: 'partner-1' };
      mockRequest.params = { orderId: 'order-1' };
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 'order-1', status: 'picked_up', recipient: '{}', dropoff_address: '{}', delivery_qr_scanned_at: null }],
      } as any);
      mockQrCodeService.getOrderQRCode.mockResolvedValueOnce({
        verificationCode: 'ABC123',
        qrCodeImage: 'data:image/png;base64,xxx',
        qrCodeData: { orderNumber: 'CMD-ORDER-1', expiresAt: '2026-01-02' },
      } as any);

      await partnerController.getPartnerOrderQRCode(mockRequest, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ showQRCode: true, verificationCode: 'ABC123' }) })
      );
    });
  });
});
