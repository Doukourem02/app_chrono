/**
 * Tests unitaires pour le middleware verifyJWT
 */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { Request, Response, NextFunction } from 'express';

// Mock de jwt utils AVANT l'import du middleware
const mockVerifyAccessToken = jest.fn();
jest.mock('../../../src/utils/jwt.js', () => {
  const actual = jest.requireActual('../../../src/utils/jwt.js') as any;
  return {
    __esModule: true,
    generateTokens: actual.generateTokens,
    verifyToken: actual.verifyToken,
    refreshAccessToken: actual.refreshAccessToken,
    verifyAccessToken: mockVerifyAccessToken,
  };
});

// Import du middleware APRÈS le mock
import { verifyJWT } from '../../../src/middleware/verifyToken.js';
import { generateTokens } from '../../../src/utils/jwt.js';

describe('verifyJWT Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let nextFunction: NextFunction;

  beforeEach(() => {
    // Configuration de l'environnement
    process.env.JWT_SECRET = 'test-secret-key-that-is-at-least-32-characters-long';

    mockRequest = {
      headers: {},
    };

    mockResponse = {
      status: jest.fn().mockReturnThis() as any,
      json: jest.fn().mockReturnThis() as any,
    };

    nextFunction = jest.fn();
    jest.clearAllMocks();
    mockVerifyAccessToken.mockClear();
  });

  describe('Success cases', () => {
    it('should allow request with valid Bearer token', () => {
      const user = { id: 'user-123', role: 'client' };
      const { accessToken } = generateTokens(user);

      mockRequest.headers = {
        authorization: `Bearer ${accessToken}`,
      };

      // Mock verifyAccessToken pour retourner le payload décodé
      mockVerifyAccessToken.mockReturnValue({
        id: 'user-123',
        role: 'client',
        type: 'access',
      });

      verifyJWT(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockVerifyAccessToken).toHaveBeenCalledWith(accessToken);
      expect(nextFunction).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
      expect((mockRequest as any).user).toEqual({
        id: 'user-123',
        role: 'client',
        type: 'access',
      });
    });

    it('should handle Authorization header with different case', () => {
      const user = { id: 'user-123', role: 'client' };
      const { accessToken } = generateTokens(user);

      mockRequest.headers = {
        Authorization: `Bearer ${accessToken}`, // Majuscule
      };

      mockVerifyAccessToken.mockReturnValue({
        id: 'user-123',
        role: 'client',
        type: 'access',
      });

      verifyJWT(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });
  });

  describe('Error cases', () => {
    it('should reject request without Authorization header', () => {
      mockRequest.headers = {};

      verifyJWT(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Non autorisé - En-tête Authorization manquant',
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should reject request with invalid format (no Bearer)', () => {
      mockRequest.headers = {
        authorization: 'InvalidToken',
      };

      verifyJWT(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Format d\'autorisation invalide. Attendu: Bearer <token>',
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should reject request with invalid format (multiple spaces)', () => {
      mockRequest.headers = {
        authorization: 'Bearer  token with spaces',
      };

      verifyJWT(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should reject request with expired token', () => {
      const expiredToken = 'expired-token';

      mockRequest.headers = {
        authorization: `Bearer ${expiredToken}`,
      };

      mockVerifyAccessToken.mockImplementation(() => {
        throw new Error('Token expiré');
      });

      verifyJWT(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Token expiré. Utilisez /refresh-token pour obtenir un nouveau token',
        code: 'TOKEN_EXPIRED',
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should reject request with invalid token', () => {
      const invalidToken = 'invalid-token';

      mockRequest.headers = {
        authorization: `Bearer ${invalidToken}`,
      };

      mockVerifyAccessToken.mockImplementation(() => {
        throw new Error('Token invalide');
      });

      verifyJWT(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Token invalide',
        code: 'INVALID_TOKEN',
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should handle other errors with generic message', () => {
      const token = 'some-token';

      mockRequest.headers = {
        authorization: `Bearer ${token}`,
      };

      mockVerifyAccessToken.mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      verifyJWT(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Unexpected error',
        code: 'INVALID_TOKEN',
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });
  });

  describe('Edge cases', () => {
    it('should handle empty token string', () => {
      mockRequest.headers = {
        authorization: 'Bearer ',
      };

      verifyJWT(mockRequest as Request, mockResponse as Response, nextFunction);

      // Le token vide sera passé à verifyAccessToken qui devrait échouer
      expect(mockVerifyAccessToken).toHaveBeenCalledWith('');
    });

    it('should handle token with only whitespace', () => {
      mockRequest.headers = {
        authorization: 'Bearer    ',
      };

      verifyJWT(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockVerifyAccessToken).toHaveBeenCalled();
    });

    it('should set user in request object when token is valid', () => {
      const user = { id: 'user-123', role: 'admin' };
      const { accessToken } = generateTokens(user);

      mockRequest.headers = {
        authorization: `Bearer ${accessToken}`,
      };

      const userPayload = {
        id: 'user-123',
        role: 'admin',
        type: 'access',
      };

      mockVerifyAccessToken.mockReturnValue(userPayload);

      verifyJWT(mockRequest as Request, mockResponse as Response, nextFunction);

      expect((mockRequest as any).user).toEqual(userPayload);
    });
  });
});

