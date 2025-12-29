/**
 * Tests unitaires pour le middleware verifyAdminSupabase
 */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { Request, Response, NextFunction } from 'express';
import { verifyAdminSupabase } from '../../../src/middleware/verifyAdminSupabase.js';

// Mock Supabase avec factory function
const mockCreateClient = jest.fn();
jest.mock('@supabase/supabase-js', () => ({
  createClient: mockCreateClient,
}));

// Mock database
const mockPoolQuery = jest.fn() as any;
jest.mock('../../../src/config/db.js', () => ({
  __esModule: true,
  default: {
    query: mockPoolQuery,
  },
}));

// Mock logger
const mockLogger = {
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};
jest.mock('../../../src/utils/logger.js', () => ({
  __esModule: true,
  default: mockLogger,
}));

// Helper pour créer un token JWT valide pour les tests
function createTestJWT(payload: any): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64');
  const payloadEncoded = Buffer.from(JSON.stringify(payload)).toString('base64');
  const signature = 'test-signature';
  return `${header}.${payloadEncoded}.${signature}`;
}

describe('verifyAdminSupabase Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let nextFunction: NextFunction;
  let mockSupabaseClient: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPoolQuery.mockClear();
    mockLogger.debug.mockClear();
    mockLogger.warn.mockClear();
    mockLogger.error.mockClear();

    // Configuration de l'environnement
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';

    mockRequest = {
      headers: {},
      path: '/api/admin/test',
    };

    mockResponse = {
      status: jest.fn().mockReturnThis() as any,
      json: jest.fn().mockReturnThis() as any,
    };

    nextFunction = jest.fn();

    mockSupabaseClient = {
      auth: {
        getUser: jest.fn(),
      },
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      or: jest.fn().mockReturnThis(),
      single: jest.fn(),
    };

    // Configurer le mock pour retourner le client mocké
    mockCreateClient.mockReturnValue(mockSupabaseClient);
  });

  describe('Error cases - Missing authorization', () => {
    it('should reject request without Authorization header', async () => {
      mockRequest.headers = {};

      await verifyAdminSupabase(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Non autorisé - En-tête Authorization manquant',
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should reject request with invalid format', async () => {
      mockRequest.headers = {
        authorization: 'InvalidFormat token',
      };

      await verifyAdminSupabase(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(nextFunction).not.toHaveBeenCalled();
    });
  });

  describe('Fallback mode - No Supabase config', () => {
    beforeEach(() => {
      delete process.env.SUPABASE_URL;
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    });

    it('should verify admin using PostgreSQL fallback', async () => {
      const token = createTestJWT({ sub: 'user-123' });

      mockRequest.headers = {
        authorization: `Bearer ${token}`,
      };

      mockPoolQuery.mockResolvedValue({
        rows: [{ id: 'user-123', role: 'admin' }],
      });

      await verifyAdminSupabase(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(nextFunction).toHaveBeenCalled();
      expect((mockRequest as any).user).toEqual({
        id: 'user-123',
        role: 'admin',
      });
    });

    it('should reject non-admin user in fallback mode', async () => {
      const token = createTestJWT({ sub: 'user-123' });

      mockRequest.headers = {
        authorization: `Bearer ${token}`,
      };

      mockPoolQuery.mockResolvedValue({
        rows: [{ id: 'user-123', role: 'client' }],
      });

      await verifyAdminSupabase(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should reject when user not found in fallback mode', async () => {
      const token = createTestJWT({ sub: 'user-123' });

      mockRequest.headers = {
        authorization: `Bearer ${token}`,
      };

      mockPoolQuery.mockResolvedValue({
        rows: [],
      });

      await verifyAdminSupabase(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(nextFunction).not.toHaveBeenCalled();
    });
  });

  describe('Supabase mode', () => {
    it('should verify admin with Supabase token', async () => {
      const token = 'supabase-token';

      mockRequest.headers = {
        authorization: `Bearer ${token}`,
      };

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: {
          user: {
            id: 'user-123',
            email: 'admin@example.com',
          },
        },
        error: null,
      });

      mockPoolQuery.mockResolvedValue({
        rows: [{ id: 'user-123', role: 'admin' }],
      });

      await verifyAdminSupabase(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(mockSupabaseClient.auth.getUser).toHaveBeenCalledWith(token);
      expect(nextFunction).toHaveBeenCalled();
      expect((mockRequest as any).user).toEqual({
        id: 'user-123',
        role: 'admin',
      });
    });

    it('should reject invalid Supabase token', async () => {
      const token = 'invalid-token';

      mockRequest.headers = {
        authorization: `Bearer ${token}`,
      };

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Invalid token' },
      });

      await verifyAdminSupabase(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should reject non-admin user', async () => {
      const token = 'supabase-token';

      mockRequest.headers = {
        authorization: `Bearer ${token}`,
      };

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: {
          user: {
            id: 'user-123',
            email: 'client@example.com',
          },
        },
        error: null,
      });

      mockPoolQuery.mockResolvedValue({
        rows: [{ id: 'user-123', role: 'client' }],
      });

      await verifyAdminSupabase(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should accept super_admin role', async () => {
      const token = 'supabase-token';

      mockRequest.headers = {
        authorization: `Bearer ${token}`,
      };

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: {
          user: {
            id: 'user-123',
            email: 'superadmin@example.com',
          },
        },
        error: null,
      });

      mockPoolQuery.mockResolvedValue({
        rows: [{ id: 'user-123', role: 'super_admin' }],
      });

      await verifyAdminSupabase(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(nextFunction).toHaveBeenCalled();
    });

    it('should use Supabase fallback when PostgreSQL fails', async () => {
      const token = 'supabase-token';

      mockRequest.headers = {
        authorization: `Bearer ${token}`,
      };

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: {
          user: {
            id: 'user-123',
            email: 'admin@example.com',
          },
        },
        error: null,
      });

      // PostgreSQL query fails
      mockPoolQuery.mockRejectedValue(new Error('DB Error'));

      // Supabase fallback succeeds
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          or: jest.fn().mockReturnValue({
            single: (jest.fn() as any).mockResolvedValue({
              data: { id: 'user-123', role: 'admin' },
              error: null,
            }),
          }),
        }),
      });

      await verifyAdminSupabase(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(nextFunction).toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('should reject when user not found in database', async () => {
      const token = 'supabase-token';

      mockRequest.headers = {
        authorization: `Bearer ${token}`,
      };

      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: {
          user: {
            id: 'user-123',
            email: 'admin@example.com',
          },
        },
        error: null,
      });

      mockPoolQuery.mockResolvedValue({
        rows: [],
      });

      // Supabase fallback also fails
      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          or: jest.fn().mockReturnValue({
            single: (jest.fn() as any).mockResolvedValue({
              data: null,
              error: { message: 'Not found' },
            }),
          }),
        }),
      });

      await verifyAdminSupabase(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(nextFunction).not.toHaveBeenCalled();
    });
  });

  describe('Edge cases', () => {
    it('should handle errors gracefully', async () => {
      mockRequest.headers = {
        authorization: 'Bearer token',
      };

      mockCreateClient.mockImplementation(() => {
        throw new Error('Supabase error');
      });

      await verifyAdminSupabase(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });
});

