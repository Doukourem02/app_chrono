/**
 * Tests unitaires pour qrCodeController — génération/scan des QR codes de preuve
 * de livraison. Couvre le scope IDOR (propriétaire/livreur/destinataire/admin) et
 * la validation des entrées de scan.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import type { Response } from 'express';

const mockPool = { query: jest.fn<(...args: any[]) => Promise<any>>() };
await jest.unstable_mockModule('../../../src/config/db.js', () => ({
  __esModule: true,
  default: mockPool,
}));

const mockQrCodeService = {
  generateDeliveryQRCode: jest.fn<(...args: any[]) => Promise<any>>(),
  getOrderQRCode: jest.fn<(...args: any[]) => Promise<any>>(),
  scanQRCode: jest.fn<(...args: any[]) => Promise<any>>(),
  manualVerifyCode: jest.fn<(...args: any[]) => Promise<any>>(),
  getScanHistory: jest.fn<(...args: any[]) => Promise<any>>(),
};
await jest.unstable_mockModule('../../../src/services/qrCodeService.js', () => ({
  __esModule: true,
  default: mockQrCodeService,
}));

await jest.unstable_mockModule('../../../src/services/recipientOrderNotifyService.js', () => ({
  __esModule: true,
  notifyAllForOrderStatus: jest.fn(() => Promise.resolve()),
}));
await jest.unstable_mockModule('../../../src/sockets/adminSocket.js', () => ({
  __esModule: true,
  broadcastOrderUpdateToAdmins: jest.fn(),
}));

const qrCodeController = await import('../../../src/controllers/qrCodeController.js');

describe('qrCodeController', () => {
  let mockRequest: any;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPool.query.mockReset();
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

  describe('generateQRCode — IDOR', () => {
    it('refuse une requête non authentifiée (401)', async () => {
      mockRequest.params = { orderId: 'order-1' };
      await qrCodeController.generateQRCode(mockRequest, mockResponse as Response);
      expect(mockResponse.status).toHaveBeenCalledWith(401);
    });

    it("refuse un utilisateur qui n'est pas propriétaire de la commande (403)", async () => {
      mockRequest.user = { id: 'user-a', role: 'client' };
      mockRequest.params = { orderId: 'order-1' };
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 'order-1', user_id: 'user-b', dropoff: {} }],
      } as any);

      await qrCodeController.generateQRCode(mockRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockQrCodeService.generateDeliveryQRCode).not.toHaveBeenCalled();
    });

    it('rejette si le destinataire n’a pas de numéro de téléphone (400)', async () => {
      mockRequest.user = { id: 'user-a', role: 'client' };
      mockRequest.params = { orderId: 'order-1' };
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 'order-1', user_id: 'user-a', dropoff: { details: { name: 'Jean' } } }],
      } as any);

      await qrCodeController.generateQRCode(mockRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
    });

    it('génère le QR code pour le propriétaire de la commande', async () => {
      mockRequest.user = { id: 'user-a', role: 'client' };
      mockRequest.params = { orderId: 'order-1' };
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 'order-1', user_id: 'user-a', dropoff: { details: { name: 'Jean', phone: '070000000' } } }],
      } as any);
      mockQrCodeService.generateDeliveryQRCode.mockResolvedValueOnce({
        qrCodeData: { orderNumber: 'ORDER-1' },
        qrCodeImage: 'data:image/png;base64,xxx',
      } as any);

      await qrCodeController.generateQRCode(mockRequest, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });
  });

  describe('getQRCode — IDOR (owner/driver/recipient/admin)', () => {
    it('refuse un tiers sans lien avec la commande (403)', async () => {
      mockRequest.user = { id: 'random-user', role: 'client' };
      mockRequest.params = { orderId: 'order-1' };
      mockPool.query.mockResolvedValueOnce({
        rows: [{ user_id: 'owner-1', driver_id: 'driver-1', recipient_user_id: null }],
      } as any);

      await qrCodeController.getQRCode(mockRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockQrCodeService.getOrderQRCode).not.toHaveBeenCalled();
    });

    it('autorise le livreur assigné', async () => {
      mockRequest.user = { id: 'driver-1', role: 'driver' };
      mockRequest.params = { orderId: 'order-1' };
      mockPool.query.mockResolvedValueOnce({
        rows: [{ user_id: 'owner-1', driver_id: 'driver-1', recipient_user_id: null }],
      } as any);
      mockQrCodeService.getOrderQRCode.mockResolvedValueOnce({ verificationCode: 'ABC123' } as any);

      await qrCodeController.getQRCode(mockRequest, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, data: expect.objectContaining({ verificationCode: 'ABC123' }) })
      );
    });
  });

  describe('scanQRCode', () => {
    it('rejette un scan sans payload QR (400)', async () => {
      mockRequest.user = { id: 'driver-1', role: 'driver' };
      mockRequest.body = {};

      await qrCodeController.scanQRCode(mockRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockQrCodeService.scanQRCode).not.toHaveBeenCalled();
    });

    it('renvoie 400 si le service juge le scan invalide', async () => {
      mockRequest.user = { id: 'driver-1', role: 'driver' };
      mockRequest.body = { qrCode: 'raw-qr-payload' };
      mockQrCodeService.scanQRCode.mockResolvedValueOnce({ success: false, isValid: false, error: 'expiré', code: 'EXPIRED' } as any);

      await qrCodeController.scanQRCode(mockRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
    });

    it('accepte un scan valide', async () => {
      mockRequest.user = { id: 'driver-1', role: 'driver' };
      mockRequest.body = { qrCode: 'raw-qr-payload' };
      mockQrCodeService.scanQRCode.mockResolvedValueOnce({
        success: true,
        isValid: true,
        data: { orderId: 'order-1' },
      } as any);

      await qrCodeController.scanQRCode(mockRequest, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });
  });

  describe('getScanHistory — admin uniquement', () => {
    it('refuse un utilisateur non-admin (403)', async () => {
      mockRequest.user = { id: 'driver-1', role: 'driver' };
      mockRequest.params = { orderId: 'order-1' };

      await qrCodeController.getScanHistory(mockRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockQrCodeService.getScanHistory).not.toHaveBeenCalled();
    });

    it('autorise un admin', async () => {
      mockRequest.user = { id: 'admin-1', role: 'admin' };
      mockRequest.params = { orderId: 'order-1' };
      mockQrCodeService.getScanHistory.mockResolvedValueOnce([{ id: 'scan-1' }] as any);

      await qrCodeController.getScanHistory(mockRequest, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, data: expect.arrayContaining([expect.objectContaining({ id: 'scan-1' })]) })
      );
    });
  });
});
