/**
 * Tests unitaires pour ratingController — régression fuite PII (audit routes 2026-07-23)
 * getDriverRatings est une route publique (sans verifyJWT) : elle ne doit jamais
 * renvoyer l'email/téléphone du client qui a laissé l'avis.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import type { Request, Response } from 'express';
import * as ratingController from '../../../src/controllers/ratingController.js';
import pool from '../../../src/config/db.js';

jest.mock('../../../src/config/db.js');

describe('ratingController — getDriverRatings (route publique)', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.DATABASE_URL = 'postgres://fake';

    mockRequest = {
      params: { driverId: 'driver-1' },
      query: {},
    } as unknown as Partial<Request>;

    mockResponse = {
      status: jest.fn().mockReturnThis() as any,
      json: jest.fn().mockReturnThis() as any,
    };

    (pool as any).query = (jest.fn() as any)
      .mockResolvedValueOnce({
        rows: [{
          id: 'rating-1',
          order_id: 'order-1',
          rating: 5,
          comment: 'Super livraison',
          created_at: new Date(),
          updated_at: new Date(),
        }],
      })
      .mockResolvedValueOnce({ rows: [{ count: '1' }] });
  });

  it('should never include user email or phone in the response', async () => {
    await ratingController.getDriverRatings(mockRequest as Request, mockResponse as Response);

    const payload = (mockResponse.json as any).mock.calls[0][0];
    expect(payload.data[0]).not.toHaveProperty('userEmail');
    expect(payload.data[0]).not.toHaveProperty('userPhone');
    expect(payload.data[0]).toEqual(
      expect.objectContaining({ id: 'rating-1', rating: 5, comment: 'Super livraison' })
    );
  });
});
