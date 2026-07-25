/**
 * Tests unitaires pour les utilitaires JWT
 */
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import jwt from 'jsonwebtoken';

// Mock de la base de données
const mockQuery = jest.fn<(...args: any[]) => Promise<any>>();
await jest.unstable_mockModule('../../../src/config/db.js', () => ({
  __esModule: true,
  default: { query: mockQuery },
}));

// Mock de supabaseAdmin (utilisé par generateTokens pour stocker le hash du refresh
// token, et par refreshAccessToken pour vérifier qu'il n'a pas été révoqué).
const eqResult: any = Promise.resolve({ error: null });
eqResult.single = () => Promise.resolve({
  data: { id: 'refresh-token-row-id', expires_at: new Date(Date.now() + 1000 * 60 * 60).toISOString() },
  error: null,
});
const supabaseChain: any = {
  insert: () => Promise.resolve({ error: null }),
  select: () => supabaseChain,
  delete: () => supabaseChain,
  eq: () => eqResult,
};
await jest.unstable_mockModule('../../../src/config/supabase.js', () => ({
  __esModule: true,
  supabaseAdmin: { from: () => supabaseChain },
}));

// Mock du logger
await jest.unstable_mockModule('../../../src/utils/logger.js', () => ({
  __esModule: true,
  default: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
  },
}));

const { generateTokens, verifyAccessToken, refreshAccessToken } = await import('../../../src/utils/jwt.js');
const { default: pool } = await import('../../../src/config/db.js');

// Configuration de l'environnement pour les tests
const ORIGINAL_ENV = process.env;

beforeEach(() => {
  jest.resetModules();
  process.env = { ...ORIGINAL_ENV };
  process.env.JWT_SECRET = 'test-secret-key-that-is-at-least-32-characters-long';
  jest.clearAllMocks();
  mockQuery.mockReset();
});

afterEach(() => {
  process.env = ORIGINAL_ENV;
});

describe('JWT Utils', () => {
  describe('generateTokens', () => {
    it('should generate access and refresh tokens successfully', async () => {
      const user = { id: 'user-123', role: 'client' };
      const tokens = await generateTokens(user);

      expect(tokens).toHaveProperty('accessToken');
      expect(tokens).toHaveProperty('refreshToken');
      expect(typeof tokens.accessToken).toBe('string');
      expect(typeof tokens.refreshToken).toBe('string');
    });

    it('should include user id and role in access token', async () => {
      const user = { id: 'user-123', role: 'admin' };
      const { accessToken } = await generateTokens(user);

      const decoded = jwt.decode(accessToken) as any;
      expect(decoded.id).toBe('user-123');
      expect(decoded.role).toBe('admin');
      expect(decoded.type).toBe('access');
    });

    it('should include user id in refresh token', async () => {
      const user = { id: 'user-123', role: 'client' };
      const { refreshToken } = await generateTokens(user);

      const decoded = jwt.decode(refreshToken) as any;
      expect(decoded.id).toBe('user-123');
      expect(decoded.type).toBe('refresh');
    });

    it('should use default role "client" when role is not provided', async () => {
      const user = { id: 'user-123' };
      const { accessToken } = await generateTokens(user);

      const decoded = jwt.decode(accessToken) as any;
      expect(decoded.role).toBe('client');
    });

    it('should throw error when user data is missing', async () => {
      await expect(generateTokens(null as any)).rejects.toThrow('User data is required');
      await expect(generateTokens({} as any)).rejects.toThrow('User data is required');
    });

    it('should throw error when user id is missing', async () => {
      await expect(generateTokens({ role: 'client' } as any)).rejects.toThrow('User data is required');
    });
  });

  describe('verifyAccessToken', () => {
    it('should verify valid access token', async () => {
      const user = { id: 'user-123', role: 'client' };
      const { accessToken } = await generateTokens(user);

      const decoded = verifyAccessToken(accessToken);

      expect(decoded.id).toBe('user-123');
      expect(decoded.role).toBe('client');
      expect(decoded.type).toBe('access');
    });

    it('should throw error for expired token', () => {
      // Signer avec le même secret que le module (chargé depuis setup.ts avant beforeEach)
      const expiredToken = jwt.sign(
        { id: 'user-123', role: 'client', type: 'access' },
        ORIGINAL_ENV.JWT_SECRET!,
        { expiresIn: '-1s' }
      );

      expect(() => verifyAccessToken(expiredToken)).toThrow('Token expiré');
    });

    it('should throw error for invalid token', () => {
      const invalidToken = 'invalid-token-string';

      expect(() => verifyAccessToken(invalidToken)).toThrow('Token invalide');
    });

    it('should throw error for refresh token used as access token', async () => {
      const user = { id: 'user-123', role: 'client' };
      const { refreshToken } = await generateTokens(user);

      expect(() => verifyAccessToken(refreshToken)).toThrow("Ce n'est pas un token d'accès valide");
    });

    it('should throw error for token signed with wrong secret', () => {
      const wrongSecretToken = jwt.sign(
        { id: 'user-123', role: 'client', type: 'access' },
        'wrong-secret-key'
      );

      expect(() => verifyAccessToken(wrongSecretToken)).toThrow('Token invalide');
    });
  });

  describe('refreshAccessToken', () => {
    it('should generate new access token from valid refresh token', async () => {
      const user = { id: 'user-123', role: 'admin' };
      const { refreshToken } = await generateTokens(user);

      // Mock de la base de données
      (pool.query as any).mockResolvedValue({
        rows: [{ id: 'user-123', role: 'admin' }],
      });

      const result = await refreshAccessToken(refreshToken);

      expect(result).toHaveProperty('accessToken');
      expect(typeof result.accessToken).toBe('string');

      // Vérifier que le nouveau token est valide
      const decoded = verifyAccessToken(result.accessToken);
      expect(decoded.id).toBe('user-123');
      expect(decoded.role).toBe('admin');
    });

    it('should throw error for invalid refresh token', async () => {
      const invalidToken = 'invalid-refresh-token';

      await expect(refreshAccessToken(invalidToken)).rejects.toThrow();
    });

    it('should throw error when refresh token is actually an access token', async () => {
      const user = { id: 'user-123', role: 'client' };
      const { accessToken } = await generateTokens(user);

      await expect(refreshAccessToken(accessToken)).rejects.toThrow("Token invalide: ce n'est pas un refresh token");
    });

    it('should throw error when user is not found in database', async () => {
      const user = { id: 'non-existent-user', role: 'client' };
      const { refreshToken } = await generateTokens(user);

      // Mock de la base de données - utilisateur non trouvé
      (pool.query as any).mockResolvedValue({
        rows: [],
      });

      await expect(refreshAccessToken(refreshToken)).rejects.toThrow('Utilisateur non trouvé');
    });

    it('should throw error for expired refresh token', async () => {
      // Créer un refresh token expiré
      const expiredRefreshToken = jwt.sign(
        { id: 'user-123', type: 'refresh' },
        process.env.JWT_SECRET!,
        { expiresIn: '-1s' }
      );

      await expect(refreshAccessToken(expiredRefreshToken)).rejects.toThrow();
    });
  });

  describe('Edge cases', () => {
    it('should handle tokens with special characters in user id', async () => {
      const user = { id: 'user-123-special@test', role: 'client' };
      const { accessToken } = await generateTokens(user);

      const decoded = verifyAccessToken(accessToken);
      expect(decoded.id).toBe('user-123-special@test');
    });

    it('should handle different user roles', async () => {
      const roles = ['client', 'driver', 'admin', 'super_admin'];

      for (const role of roles) {
        const user = { id: 'user-123', role };
        const { accessToken } = await generateTokens(user);
        const decoded = verifyAccessToken(accessToken);
        expect(decoded.role).toBe(role);
      }
    });
  });
});

