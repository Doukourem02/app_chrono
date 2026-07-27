/**
 * Tests unitaires pour partnerMergeController — fusion de deux fiches partenaire
 * (docs/taches.md, règles validées 2026-07-27). Couvre les garde-fous (mêmes ids,
 * fiche introuvable, déjà fusionnée) et le chemin de fusion simple (aucune ligne
 * en double dans les tables enfants). Les cas de dédoublonnage (quota, livreurs,
 * accès équipe) et la comparaison d'abonnement ont été vérifiés manuellement
 * contre le schéma réel dans une transaction annulée (BEGIN...ROLLBACK).
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import type { Request, Response } from 'express';

function makeTxClient() {
  return {
    query: jest.fn<(...args: any[]) => Promise<any>>(),
    release: jest.fn(),
  };
}

const mockPool = {
  query: jest.fn<(...args: any[]) => Promise<any>>(),
  connect: jest.fn<(...args: any[]) => Promise<any>>(),
};
await jest.unstable_mockModule('../../../src/config/db.js', () => ({
  __esModule: true,
  default: mockPool,
}));

const partnerMergeController = await import('../../../src/controllers/partnerMergeController.js');

describe('partnerMergeController.mergePartners', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPool.query.mockReset();
    mockPool.connect.mockReset();
    mockRequest = { params: {}, body: {} } as unknown as Partial<Request>;
    mockResponse = {
      status: jest.fn().mockReturnThis() as any,
      json: jest.fn().mockReturnThis() as any,
    };
    (mockRequest as any).user = { id: 'admin-1' };
  });

  it('rejette une requête sans mergeFromPartnerId (400) sans ouvrir de transaction', async () => {
    mockRequest.params = { id: 'partner-a' };
    mockRequest.body = {};

    await partnerMergeController.mergePartners(mockRequest as Request, mockResponse as Response);

    expect(mockResponse.status).toHaveBeenCalledWith(400);
    expect(mockPool.connect).not.toHaveBeenCalled();
  });

  it('rejette la fusion d\'une fiche avec elle-même (400) sans ouvrir de transaction', async () => {
    mockRequest.params = { id: 'partner-a' };
    mockRequest.body = { mergeFromPartnerId: 'partner-a' };

    await partnerMergeController.mergePartners(mockRequest as Request, mockResponse as Response);

    expect(mockResponse.status).toHaveBeenCalledWith(400);
    expect(mockPool.connect).not.toHaveBeenCalled();
  });

  it("renvoie 404 si l'une des deux fiches est introuvable", async () => {
    const client = makeTxClient();
    client.query
      .mockResolvedValueOnce({} as any) // BEGIN
      .mockResolvedValueOnce({ rows: [{ id: 'partner-a', name: 'A', email: null, status: 'active' }] } as any); // SELECT ... FOR UPDATE (une seule ligne trouvée)
    mockPool.connect.mockResolvedValueOnce(client as any);

    mockRequest.params = { id: 'partner-a' };
    mockRequest.body = { mergeFromPartnerId: 'partner-b' };

    await partnerMergeController.mergePartners(mockRequest as Request, mockResponse as Response);

    expect(mockResponse.status).toHaveBeenCalledWith(404);
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
  });

  it('renvoie 400 si une des deux fiches est déjà fusionnée', async () => {
    const client = makeTxClient();
    client.query
      .mockResolvedValueOnce({} as any) // BEGIN
      .mockResolvedValueOnce({
        rows: [
          { id: 'partner-a', name: 'A', email: null, status: 'active' },
          { id: 'partner-b', name: 'B', email: null, status: 'merged' },
        ],
      } as any);
    mockPool.connect.mockResolvedValueOnce(client as any);

    mockRequest.params = { id: 'partner-a' };
    mockRequest.body = { mergeFromPartnerId: 'partner-b' };

    await partnerMergeController.mergePartners(mockRequest as Request, mockResponse as Response);

    expect(mockResponse.status).toHaveBeenCalledWith(400);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('déjà fusionnée') })
    );
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
  });

  it('fusionne deux fiches sans données enfant en double (chemin simple) et commit', async () => {
    const client = makeTxClient();
    client.query
      .mockResolvedValueOnce({} as any) // BEGIN
      .mockResolvedValueOnce({
        rows: [
          { id: 'partner-a', name: 'Fiche A', email: 'a@test.com', status: 'active' },
          { id: 'partner-b', name: 'Fiche B', email: 'b@test.com', status: 'active' },
        ],
      } as any) // partners FOR UPDATE
      .mockResolvedValueOnce({ rows: [] } as any) // active subscriptions (aucune des deux)
      .mockResolvedValueOnce({} as any) // UPDATE partner_subscriptions reattach
      .mockResolvedValueOnce({ rows: [] } as any) // SELECT partner_usage du perdant (aucune ligne)
      .mockResolvedValueOnce({} as any) // UPDATE partner_invoices
      .mockResolvedValueOnce({} as any) // UPDATE orders
      .mockResolvedValueOnce({} as any) // UPDATE delivery_batches
      .mockResolvedValueOnce({} as any) // UPDATE partner_driver_requests
      .mockResolvedValueOnce({ rows: [] } as any) // SELECT partner_drivers du perdant (aucune ligne)
      .mockResolvedValueOnce({ rowCount: 0 } as any) // SELECT survivor a un défaut ?
      .mockResolvedValueOnce({ rows: [] } as any) // SELECT partner_users du perdant (aucune ligne)
      .mockResolvedValueOnce({} as any) // UPDATE partners (archive)
      .mockResolvedValueOnce({} as any) // SAVEPOINT
      .mockResolvedValueOnce({} as any) // INSERT partner_audit_logs
      .mockResolvedValueOnce({} as any) // RELEASE SAVEPOINT
      .mockResolvedValueOnce({} as any); // COMMIT
    mockPool.connect.mockResolvedValueOnce(client as any);

    mockRequest.params = { id: 'partner-a' };
    mockRequest.body = { mergeFromPartnerId: 'partner-b' };

    await partnerMergeController.mergePartners(mockRequest as Request, mockResponse as Response);

    expect(client.query).toHaveBeenCalledWith('COMMIT');
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: { survivor_id: 'partner-a', merged_partner_id: 'partner-b' },
      })
    );
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE partners SET status = 'merged'"),
      ['partner-a', 'partner-b']
    );
  });

  it('annule toute la fusion (ROLLBACK) si une étape échoue de manière inattendue', async () => {
    const client = makeTxClient();
    client.query
      .mockResolvedValueOnce({} as any) // BEGIN
      .mockRejectedValueOnce(new Error('DB down')) // partners FOR UPDATE échoue
      .mockResolvedValueOnce({} as any); // ROLLBACK (catch)
    mockPool.connect.mockResolvedValueOnce(client as any);

    mockRequest.params = { id: 'partner-a' };
    mockRequest.body = { mergeFromPartnerId: 'partner-b' };

    await partnerMergeController.mergePartners(mockRequest as Request, mockResponse as Response);

    expect(mockResponse.status).toHaveBeenCalledWith(500);
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
  });
});
