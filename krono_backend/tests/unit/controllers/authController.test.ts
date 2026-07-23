/**
 * Tests unitaires pour authController — la partie testable sans mocker toute la
 * maze de provisioning Supabase Auth (création/synchronisation utilisateur, très
 * imbriquée). Couvre les contrôles de sécurité isolables :
 *  - verifyOTPCode : rejet d'un code invalide + intégration brute-force
 *    (recordFailedAttempt/resetAttempts)
 *  - refreshToken : erreur serveur (DB/réseau) => 500 jamais 401 (pour ne pas
 *    déconnecter le client sur un problème transitoire), token invalide => 401
 *  - logoutUser : révocation du refresh token
 *  - updateUserProfile / getUserProfile : IDOR explicite (un user ne peut
 *    lire/modifier que son propre profil, sauf admin)
 *
 * Le flux complet de création/synchronisation de compte (nouvel utilisateur,
 * comptes orphelins, etc.) n'est pas couvert ici — trop imbriqué avec Supabase
 * Auth pour un mock unitaire raisonnable ; à couvrir via un test d'intégration
 * si besoin dans une session dédiée.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import type { Request, Response } from 'express';

const mockPool = { query: jest.fn<(...args: any[]) => Promise<any>>() };
await jest.unstable_mockModule('../../../src/config/db.js', () => ({
  __esModule: true,
  default: mockPool,
}));

const mockSupabaseClient = {
  from: jest.fn(),
  auth: { admin: { listUsers: jest.fn(), createUser: jest.fn() }, signUp: jest.fn() },
};
await jest.unstable_mockModule('../../../src/config/supabase.js', () => ({
  __esModule: true,
  supabase: mockSupabaseClient,
  supabaseAdmin: mockSupabaseClient,
  default: mockSupabaseClient,
}));

const mockVerifyOTP = jest.fn<(...args: any[]) => Promise<any>>();
await jest.unstable_mockModule('../../../src/config/otpStorage.js', () => ({
  __esModule: true,
  storeOTP: jest.fn(),
  verifyOTP: mockVerifyOTP,
  getOTP: jest.fn(),
  resolveOtpEmailForStorage: jest.fn((email: string, phone: string) => email || `${phone}@otp.chrono.local`),
  syntheticEmailFromPhone: jest.fn((phone: string) => `${phone}@otp.chrono.local`),
}));

await jest.unstable_mockModule('../../../src/config/otpTtl.js', () => ({
  __esModule: true,
  OTP_TTL_MINUTES: 5,
}));

const mockRefreshAccessToken = jest.fn<(...args: any[]) => Promise<any>>();
const mockRevokeRefreshToken = jest.fn<(...args: any[]) => Promise<any>>();
await jest.unstable_mockModule('../../../src/utils/jwt.js', () => ({
  __esModule: true,
  generateTokens: jest.fn(),
  refreshAccessToken: mockRefreshAccessToken,
  revokeRefreshToken: mockRevokeRefreshToken,
}));

await jest.unstable_mockModule('../../../src/services/emailService.js', () => ({
  __esModule: true,
  sendOTPSMS: jest.fn(() => Promise.resolve({ success: true })),
}));
await jest.unstable_mockModule('../../../src/services/twilioWhatsAppService.js', () => ({
  __esModule: true,
  sendOTPWhatsApp: jest.fn(() => Promise.resolve({ success: true })),
}));
await jest.unstable_mockModule('../../../src/utils/createDefaultPaymentMethods.js', () => ({
  __esModule: true,
  createDefaultPaymentMethods: jest.fn(),
}));
await jest.unstable_mockModule('../../../src/utils/ensureUsersProfileColumns.js', () => ({
  __esModule: true,
  ensureUsersProfileColumns: jest.fn(() => Promise.resolve(true)),
}));

const authController = await import('../../../src/controllers/authController.js');

describe('authController', () => {
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

  describe('verifyOTPCode — rejet + intégration brute-force', () => {
    it('rejette un code invalide (400) et enregistre la tentative échouée', async () => {
      mockVerifyOTP.mockResolvedValueOnce(false);
      const recordFailedAttempt = jest.fn();
      mockRequest.body = { phone: '+2250700000000', otp: '000000', role: 'client' };
      mockRequest.recordFailedAttempt = recordFailedAttempt;

      await authController.verifyOTPCode(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, message: expect.stringContaining('incorrect') })
      );
      expect(recordFailedAttempt).toHaveBeenCalled();
    });

    it('réinitialise le compteur brute-force dès que le code est reconnu valide', async () => {
      mockVerifyOTP.mockResolvedValueOnce(true);
      const resetAttempts = jest.fn();
      mockRequest.body = { phone: '+2250700000000', otp: '123456', role: 'client' };
      mockRequest.resetAttempts = resetAttempts;
      mockSupabaseClient.from.mockReturnValue({
        select: () => ({ eq: () => ({ limit: () => Promise.resolve({ data: [], error: null }) }) }),
      });

      await authController.verifyOTPCode(mockRequest as Request, mockResponse as Response).catch(() => {});

      expect(resetAttempts).toHaveBeenCalled();
    });
  });

  describe('refreshToken', () => {
    it('rejette une requête sans refreshToken (400)', async () => {
      mockRequest.body = {};

      await authController.refreshToken(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockRefreshAccessToken).not.toHaveBeenCalled();
    });

    it('renvoie 500 (jamais 401) sur une erreur réseau/DB transitoire', async () => {
      mockRequest.body = { refreshToken: 'sometoken' };
      mockRefreshAccessToken.mockRejectedValueOnce(new Error('ECONNRESET'));

      await authController.refreshToken(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
    });

    it('renvoie 401 pour un refresh token réellement invalide/expiré', async () => {
      mockRequest.body = { refreshToken: 'bad-token' };
      mockRefreshAccessToken.mockRejectedValueOnce(new Error('jwt expired'));

      await authController.refreshToken(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
    });

    it('renvoie le nouveau accessToken en cas de succès', async () => {
      mockRequest.body = { refreshToken: 'good-token' };
      mockRefreshAccessToken.mockResolvedValueOnce({ accessToken: 'new-access-token' } as any);

      await authController.refreshToken(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, data: { accessToken: 'new-access-token' } })
      );
    });
  });

  describe('logoutUser', () => {
    it('rejette une requête sans refreshToken (400)', async () => {
      mockRequest.body = {};

      await authController.logoutUser(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockRevokeRefreshToken).not.toHaveBeenCalled();
    });

    it('révoque le refresh token fourni', async () => {
      mockRequest.body = { refreshToken: 'sometoken' };
      mockRevokeRefreshToken.mockResolvedValueOnce(undefined as any);

      await authController.logoutUser(mockRequest as Request, mockResponse as Response);

      expect(mockRevokeRefreshToken).toHaveBeenCalledWith('sometoken');
      expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });
  });

  describe('getUserProfile — IDOR', () => {
    it('refuse une requête non authentifiée (401)', async () => {
      mockRequest.params = { userId: 'user-1' };

      await authController.getUserProfile(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
    });

    it("refuse qu'un utilisateur consulte le profil d'un autre (403)", async () => {
      (mockRequest as any).user = { id: 'user-a', role: 'client' };
      mockRequest.params = { userId: 'user-b' };

      await authController.getUserProfile(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockPool.query).not.toHaveBeenCalled();
    });

    it('autorise un admin à consulter le profil de n’importe quel utilisateur', async () => {
      (mockRequest as any).user = { id: 'admin-1', role: 'admin' };
      mockRequest.params = { userId: 'user-b' };
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: 'user-b', email: 'b@x.com' }] } as any);

      await authController.getUserProfile(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).not.toHaveBeenCalledWith(403);
    });
  });

  describe('updateUserProfile — IDOR', () => {
    it("refuse qu'un utilisateur modifie le profil d'un autre (403)", async () => {
      (mockRequest as any).user = { id: 'user-a', role: 'client' };
      mockRequest.params = { userId: 'user-b' };
      mockRequest.body = { first_name: 'Hacker' };

      await authController.updateUserProfile(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockPool.query).not.toHaveBeenCalled();
    });

    it('rejette une mise à jour sans aucun champ (400)', async () => {
      (mockRequest as any).user = { id: 'user-a', role: 'client' };
      mockRequest.params = { userId: 'user-a' };
      mockRequest.body = {};
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: 'user-a' }] } as any);

      await authController.updateUserProfile(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
    });

    it('autorise la mise à jour de son propre profil', async () => {
      (mockRequest as any).user = { id: 'user-a', role: 'client' };
      mockRequest.params = { userId: 'user-a' };
      mockRequest.body = { first_name: 'Alice' };
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ id: 'user-a' }] } as any)
        .mockResolvedValueOnce({ rows: [{ id: 'user-a', first_name: 'Alice', role: 'client' }] } as any);

      await authController.updateUserProfile(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });
  });
});
