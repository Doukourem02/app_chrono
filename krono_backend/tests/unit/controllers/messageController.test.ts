/**
 * Tests unitaires pour messageController — messagerie interne (conversations
 * commande/support/admin). Couvre l'accès délégué à `canAccessConversation`
 * (IDOR) et les règles de création de conversation par type.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import type { Response } from 'express';

const mockMessageService = {
  getAllConversations: jest.fn<(...args: any[]) => Promise<any>>(),
  getUserConversations: jest.fn<(...args: any[]) => Promise<any>>(),
  canAccessConversation: jest.fn<(...args: any[]) => Promise<any>>(),
  getConversationById: jest.fn<(...args: any[]) => Promise<any>>(),
  getOrCreateOrderConversation: jest.fn<(...args: any[]) => Promise<any>>(),
  createSupportConversation: jest.fn<(...args: any[]) => Promise<any>>(),
  findAvailableAdmin: jest.fn<(...args: any[]) => Promise<any>>(),
  getMessages: jest.fn<(...args: any[]) => Promise<any>>(),
  sendMessage: jest.fn<(...args: any[]) => Promise<any>>(),
  markAsRead: jest.fn<(...args: any[]) => Promise<any>>(),
  getUnreadCount: jest.fn<(...args: any[]) => Promise<any>>(),
  getAllUnreadCount: jest.fn<(...args: any[]) => Promise<any>>(),
};
await jest.unstable_mockModule('../../../src/services/messageService.js', () => ({
  __esModule: true,
  default: mockMessageService,
}));
await jest.unstable_mockModule('../../../src/services/expoPushService.js', () => ({
  __esModule: true,
  notifyOrderChatMessagePush: jest.fn(() => Promise.resolve()),
}));

const messageController = await import('../../../src/controllers/messageController.js');

describe('messageController', () => {
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

  describe('getConversationById — scope IDOR délégué à canAccessConversation', () => {
    it('refuse une requête non authentifiée (401)', async () => {
      mockRequest.params = { conversationId: 'conv-1' };
      await messageController.getConversationById(mockRequest, mockResponse as Response);
      expect(mockResponse.status).toHaveBeenCalledWith(401);
    });

    it("refuse l'accès si canAccessConversation renvoie false (403)", async () => {
      mockRequest.user = { id: 'user-1', role: 'client' };
      mockRequest.params = { conversationId: 'conv-1' };
      mockMessageService.canAccessConversation.mockResolvedValueOnce(false);

      await messageController.getConversationById(mockRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockMessageService.getConversationById).not.toHaveBeenCalled();
    });

    it('autorise et renvoie la conversation quand accès accordé', async () => {
      mockRequest.user = { id: 'user-1', role: 'client' };
      mockRequest.params = { conversationId: 'conv-1' };
      mockMessageService.canAccessConversation.mockResolvedValueOnce(true);
      mockMessageService.getConversationById.mockResolvedValueOnce({ id: 'conv-1' } as any);

      await messageController.getConversationById(mockRequest, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, data: expect.objectContaining({ id: 'conv-1' }) })
      );
    });
  });

  describe('sendMessage', () => {
    it('rejette un message vide (400) sans vérifier l’accès', async () => {
      mockRequest.user = { id: 'user-1', role: 'client' };
      mockRequest.params = { conversationId: 'conv-1' };
      mockRequest.body = { content: '   ' };

      await messageController.sendMessage(mockRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockMessageService.canAccessConversation).not.toHaveBeenCalled();
    });

    it("refuse l'envoi si l'utilisateur n'a pas accès à la conversation (403)", async () => {
      mockRequest.user = { id: 'user-1', role: 'client' };
      mockRequest.params = { conversationId: 'conv-1' };
      mockRequest.body = { content: 'Bonjour' };
      mockMessageService.canAccessConversation.mockResolvedValueOnce(false);

      await messageController.sendMessage(mockRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockMessageService.sendMessage).not.toHaveBeenCalled();
    });
  });

  describe('createConversation — règles par type', () => {
    it('rejette un type invalide (400)', async () => {
      mockRequest.user = { id: 'user-1', role: 'client' };
      mockRequest.body = { type: 'bogus' };

      await messageController.createConversation(mockRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
    });

    it("refuse qu'un client crée une conversation admin-livreur (403)", async () => {
      mockRequest.user = { id: 'user-1', role: 'client' };
      mockRequest.body = { type: 'admin', participantId: 'driver-1' };

      await messageController.createConversation(mockRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockMessageService.createSupportConversation).not.toHaveBeenCalled();
    });

    it("exige participantId pour une conversation admin (400)", async () => {
      mockRequest.user = { id: 'admin-1', role: 'admin' };
      mockRequest.body = { type: 'admin' };

      await messageController.createConversation(mockRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
    });

    it('un client crée une conversation support avec un admin disponible trouvé automatiquement', async () => {
      mockRequest.user = { id: 'user-1', role: 'client' };
      mockRequest.body = { type: 'support' };
      mockMessageService.findAvailableAdmin.mockResolvedValueOnce('admin-1');
      mockMessageService.createSupportConversation.mockResolvedValueOnce({ id: 'conv-1' } as any);

      await messageController.createConversation(mockRequest, mockResponse as Response);

      expect(mockMessageService.createSupportConversation).toHaveBeenCalledWith('admin-1', 'user-1', 'support');
      expect(mockResponse.status).toHaveBeenCalledWith(201);
    });
  });
});
