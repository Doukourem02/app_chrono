/**
 * Tests unitaires pour le service de messagerie
 */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { MessageService } from '../../../src/services/messageService.js';

// Mock de la base de données
const mockPoolQuery = jest.fn() as any;
jest.mock('../../../src/config/db.js', () => ({
  __esModule: true,
  default: {
    query: mockPoolQuery,
  },
}));

// Mock logger
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
};
jest.mock('../../../src/utils/logger.js', () => ({
  __esModule: true,
  default: mockLogger,
}));

describe('MessageService', () => {
  let messageService: MessageService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPoolQuery.mockClear();
    mockLogger.info.mockClear();
    mockLogger.error.mockClear();
    mockLogger.warn.mockClear();
    messageService = new MessageService();
  });

  describe('getConversationById', () => {
    it('should return conversation when found', async () => {
      const mockConversation = {
        id: 'conv-123',
        type: 'order',
        order_id: 'order-123',
        participant_1_id: 'user-1',
        participant_2_id: 'user-2',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_message_at: null,
        is_archived: false,
        p1_id: 'user-1',
        p1_email: 'user1@example.com',
        p1_role: 'client',
        p1_first_name: null,
        p1_last_name: null,
        p1_avatar_url: null,
        p2_id: 'user-2',
        p2_email: 'user2@example.com',
        p2_role: 'driver',
        p2_first_name: null,
        p2_last_name: null,
        p2_avatar_url: null,
      };

      mockPoolQuery.mockResolvedValue({
        rows: [mockConversation],
      });

      const result = await messageService.getConversationById('conv-123');

      expect(result).not.toBeNull();
      expect(result?.id).toBe('conv-123');
      expect(mockPoolQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE c.id = $1'),
        ['conv-123']
      );
    });

    it('should return null when conversation not found', async () => {
      mockPoolQuery.mockResolvedValue({
        rows: [],
      });

      const result = await messageService.getConversationById('non-existent');

      expect(result).toBeNull();
    });

    it('should handle database errors', async () => {
      mockPoolQuery.mockRejectedValue(new Error('DB Error'));

      await expect(
        messageService.getConversationById('conv-123')
      ).rejects.toThrow('Impossible de récupérer la conversation');
    });
  });

  describe('getUserConversations', () => {
    it('should return user conversations', async () => {
      const mockConversations = [
        {
          id: 'conv-1',
          type: 'order',
          participant_1_id: 'user-1',
          participant_2_id: 'user-2',
          unread_count: 2,
        },
      ];

      mockPoolQuery.mockResolvedValue({
        rows: mockConversations,
      });

      const result = await messageService.getUserConversations('user-1');

      expect(result).toBeInstanceOf(Array);
      expect(mockPoolQuery).toHaveBeenCalled();
    });

    it('should filter by conversation type', async () => {
      mockPoolQuery.mockResolvedValue({
        rows: [],
      });

      await messageService.getUserConversations('user-1', 'order');

      const queryCall = mockPoolQuery.mock.calls[0][0];
      expect(queryCall).toContain("AND c.type = $2");
    });

    it('should return empty array on connection error', async () => {
      const connectionError = new Error('ENOTFOUND db.example.com');
      mockPoolQuery.mockRejectedValue(connectionError);

      const result = await messageService.getUserConversations('user-1');

      expect(result).toEqual([]);
      expect(mockLogger.warn).toHaveBeenCalled();
    });
  });

  describe('getAllConversations', () => {
    it('should return all conversations', async () => {
      mockPoolQuery.mockResolvedValue({
        rows: [],
      });

      const result = await messageService.getAllConversations();

      expect(result).toBeInstanceOf(Array);
      expect(mockPoolQuery).toHaveBeenCalled();
    });

    it('should filter by type when provided', async () => {
      mockPoolQuery.mockResolvedValue({
        rows: [],
      });

      await messageService.getAllConversations('support');

      const queryCall = mockPoolQuery.mock.calls[0][0];
      expect(queryCall).toContain("AND c.type = $1");
    });

    it('should return empty array on connection error', async () => {
      const connectionError = new Error('ECONNREFUSED');
      mockPoolQuery.mockRejectedValue(connectionError);

      const result = await messageService.getAllConversations();

      expect(result).toEqual([]);
    });
  });

  describe('createOrderConversation', () => {
    it('should create new order conversation', async () => {
      // Mock: no existing conversation
      mockPoolQuery
        .mockResolvedValueOnce({ rows: [] } as any) // Check existing
        .mockResolvedValueOnce({
          rows: [{
            id: 'conv-new',
            type: 'order',
            order_id: 'order-123',
            participant_1_id: 'user-1',
            participant_2_id: 'driver-1',
          }],
        } as any); // Insert

      const result = await messageService.createOrderConversation(
        'order-123',
        'user-1',
        'driver-1'
      );

      expect(result).not.toBeNull();
      expect(result.id).toBe('conv-new');
      expect(mockPoolQuery).toHaveBeenCalledTimes(2);
    });

    it('should return existing conversation if already exists', async () => {
      // Mock: existing conversation found
      mockPoolQuery
        .mockResolvedValueOnce({
          rows: [{ id: 'conv-existing' }],
        } as any) // Check existing
        .mockResolvedValueOnce({
          rows: [{
            id: 'conv-existing',
            type: 'order',
            order_id: 'order-123',
          }],
        } as any); // Get by ID

      const result = await messageService.createOrderConversation(
        'order-123',
        'user-1',
        'driver-1'
      );

      expect(result).not.toBeNull();
      expect(result.id).toBe('conv-existing');
      // Should not insert new conversation
      expect(mockPoolQuery.mock.calls.filter(
        (call: any[]) => call[0].includes('INSERT')
      ).length).toBe(0);
    });

    it('should handle database errors', async () => {
      mockPoolQuery.mockRejectedValue(new Error('DB Error'));

      await expect(
        messageService.createOrderConversation('order-123', 'user-1', 'driver-1')
      ).rejects.toThrow('Impossible de créer la conversation');
    });
  });

  describe('findAvailableAdmin', () => {
    it('should return admin ID when available', async () => {
      mockPoolQuery.mockResolvedValue({
        rows: [{ id: 'admin-123' }],
      });

      const result = await messageService.findAvailableAdmin();

      expect(result).toBe('admin-123');
    });

    it('should return null when no admin available', async () => {
      mockPoolQuery.mockResolvedValue({
        rows: [],
      });

      const result = await messageService.findAvailableAdmin();

      expect(result).toBeNull();
    });

    it('should handle database errors gracefully', async () => {
      mockPoolQuery.mockRejectedValue(new Error('DB Error'));

      const result = await messageService.findAvailableAdmin();

      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('createSupportConversation', () => {
    it('should create new support conversation', async () => {
      mockPoolQuery
        .mockResolvedValueOnce({ rows: [] } as any) // Check existing
        .mockResolvedValueOnce({
          rows: [{
            id: 'conv-support',
            type: 'support',
            participant_1_id: 'admin-1',
            participant_2_id: 'user-1',
          }],
        } as any); // Insert

      const result = await messageService.createSupportConversation(
        'admin-1',
        'user-1',
        'support'
      );

      expect(result).not.toBeNull();
      expect(result.id).toBe('conv-support');
    });

    it('should return existing conversation if already exists', async () => {
      mockPoolQuery
        .mockResolvedValueOnce({
          rows: [{ id: 'conv-existing' }],
        } as any)
        .mockResolvedValueOnce({
          rows: [{
            id: 'conv-existing',
            type: 'support',
          }],
        } as any);

      const result = await messageService.createSupportConversation(
        'admin-1',
        'user-1',
        'support'
      );

      expect(result).not.toBeNull();
    });

    it('should handle database errors', async () => {
      mockPoolQuery.mockRejectedValue(new Error('DB Error'));

      await expect(
        messageService.createSupportConversation('admin-1', 'user-1', 'support')
      ).rejects.toThrow('Impossible de créer la conversation');
    });
  });
});

