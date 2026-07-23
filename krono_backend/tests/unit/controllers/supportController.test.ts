/**
 * Tests unitaires pour supportController — FAQ et tickets support.
 * Couvre l'authentification requise pour créer/lister ses propres tickets.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import type { Request, Response } from 'express';

const mockSupportService = {
  searchFAQ: jest.fn<(...args: any[]) => Promise<any>>(),
  createSupportTicket: jest.fn<(...args: any[]) => Promise<any>>(),
  getUserTickets: jest.fn<(...args: any[]) => Promise<any>>(),
};
await jest.unstable_mockModule('../../../src/services/supportService.js', () => ({
  __esModule: true,
  ...mockSupportService,
}));

const supportController = await import('../../../src/controllers/supportController.js');

describe('supportController', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRequest = { params: {}, body: {}, query: {} } as unknown as Partial<Request>;
    mockResponse = {
      status: jest.fn().mockReturnThis() as any,
      json: jest.fn().mockReturnThis() as any,
    };
  });

  describe('createTicket', () => {
    it('refuse une création de ticket non authentifiée (401)', async () => {
      mockRequest.body = { subject: 'Problème', message: 'Ma commande est en retard' };

      await supportController.createTicket(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockSupportService.createSupportTicket).not.toHaveBeenCalled();
    });

    it('rejette un ticket sans sujet ni message (400)', async () => {
      (mockRequest as any).user = { id: 'user-1' };
      mockRequest.body = {};

      await supportController.createTicket(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
    });

    it("crée le ticket pour l'utilisateur authentifié", async () => {
      (mockRequest as any).user = { id: 'user-1' };
      mockRequest.body = { subject: 'Problème', message: 'Ma commande est en retard' };
      mockSupportService.createSupportTicket.mockResolvedValueOnce({ id: 'ticket-1' } as any);

      await supportController.createTicket(mockRequest as Request, mockResponse as Response);

      expect(mockSupportService.createSupportTicket).toHaveBeenCalledWith(
        'user-1', 'Problème', 'Ma commande est en retard', 'general'
      );
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({ ticket: expect.objectContaining({ id: 'ticket-1' }) })
      );
    });
  });

  describe('getTickets — scope IDOR implicite (userId du token, jamais du body/params)', () => {
    it('refuse une consultation non authentifiée (401)', async () => {
      await supportController.getTickets(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockSupportService.getUserTickets).not.toHaveBeenCalled();
    });

    it("récupère uniquement les tickets de l'utilisateur authentifié", async () => {
      (mockRequest as any).user = { id: 'user-1' };
      mockSupportService.getUserTickets.mockResolvedValueOnce([{ id: 'ticket-1' }] as any);

      await supportController.getTickets(mockRequest as Request, mockResponse as Response);

      expect(mockSupportService.getUserTickets).toHaveBeenCalledWith('user-1');
    });
  });
});
