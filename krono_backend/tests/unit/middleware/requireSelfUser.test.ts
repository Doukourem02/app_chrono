/**
 * Tests unitaires pour le middleware requireSelfUser — clause de garde IDOR
 * (audit 2026-07-23) centralisée ici après avoir été dupliquée à l'identique
 * dans driverController et commissionController.
 */
import { describe, it, expect, jest } from '@jest/globals';
import type { Request, Response, NextFunction } from 'express';
import { requireSelfUser } from '../../../src/middleware/requireSelfUser.js';

function buildResponse(): Partial<Response> {
  return {
    status: jest.fn().mockReturnThis() as any,
    json: jest.fn().mockReturnThis() as any,
  };
}

describe('requireSelfUser', () => {
  it("bloque (403) quand l'utilisateur authentifié n'est pas celui ciblé par l'URL", () => {
    const middleware = requireSelfUser('userId');
    const req = { params: { userId: 'user-b' }, user: { id: 'user-a' } } as unknown as Request;
    const res = buildResponse();
    const next = jest.fn() as unknown as NextFunction;

    middleware(req, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it("laisse passer quand l'utilisateur authentifié correspond au paramètre d'URL", () => {
    const middleware = requireSelfUser('userId');
    const req = { params: { userId: 'user-a' }, user: { id: 'user-a' } } as unknown as Request;
    const res = buildResponse();
    const next = jest.fn() as unknown as NextFunction;

    middleware(req, res as Response, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('respecte le nom de paramètre personnalisé', () => {
    const middleware = requireSelfUser('driverId');
    const req = { params: { driverId: 'user-b' }, user: { id: 'user-a' } } as unknown as Request;
    const res = buildResponse();
    const next = jest.fn() as unknown as NextFunction;

    middleware(req, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("laisse passer si req.user n'est pas défini (délégué à verifyJWT en amont)", () => {
    const middleware = requireSelfUser('userId');
    const req = { params: { userId: 'user-b' } } as unknown as Request;
    const res = buildResponse();
    const next = jest.fn() as unknown as NextFunction;

    middleware(req, res as Response, next);

    expect(next).toHaveBeenCalledTimes(1);
  });
});
