/**
 * Tests unitaires pour driverController — régression IDOR (audit routes 2026-07-23)
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import type { Request, Response } from 'express';
import * as driverController from '../../../src/controllers/driverController.js';
import pool from '../../../src/config/db.js';

jest.mock('../../../src/config/db.js');
jest.mock('../../../src/utils/calculateDriverRating.js', () => ({
  calculateDriverRating: jest.fn(() => Promise.resolve(4.5)),
}));

describe('driverController — ownership checks', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.DATABASE_URL = 'postgres://fake';

    mockRequest = {
      params: {},
      query: {},
      user: { id: 'test-user-id' },
    } as unknown as Partial<Request>;

    mockResponse = {
      status: jest.fn().mockReturnThis() as any,
      json: jest.fn().mockReturnThis() as any,
    };
  });

  describe('getDriverRevenues', () => {
    it('should return 403 when requesting another driver\'s revenues', async () => {
      mockRequest.params = { userId: 'another-driver-id' };

      await driverController.getDriverRevenues(mockRequest as any, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
    });

    it('should allow a driver to view their own revenues', async () => {
      mockRequest.params = { userId: 'test-user-id' };
      (pool as any).query = (jest.fn() as any).mockResolvedValue({ rows: [{ count: '0' }] });

      await driverController.getDriverRevenues(mockRequest as any, mockResponse as Response);

      expect(mockResponse.status).not.toHaveBeenCalledWith(403);
    });

    it('should allow an admin to view any driver\'s revenues', async () => {
      mockRequest.user = { id: 'admin-id', role: 'admin' } as any;
      mockRequest.params = { userId: 'another-driver-id' };
      (pool as any).query = (jest.fn() as any).mockResolvedValue({ rows: [{ count: '0' }] });

      await driverController.getDriverRevenues(mockRequest as any, mockResponse as Response);

      expect(mockResponse.status).not.toHaveBeenCalledWith(403);
    });
  });

  describe('getDriverStatistics', () => {
    it('should return 403 when requesting another driver\'s statistics', async () => {
      mockRequest.params = { userId: 'another-driver-id' };

      await driverController.getDriverStatistics(mockRequest as any, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
    });
  });

  describe('getDriverDetails', () => {
    beforeEach(() => {
      (pool as any).query = (jest.fn() as any).mockResolvedValue({
        rows: [{
          id: 'profile-1',
          user_id: 'another-driver-id',
          email: 'driver@example.com',
          phone: '+2250700000000',
          first_name: 'Jean',
          last_name: 'Kouassi',
          completed_deliveries: 10,
        }],
      });
    });

    it('should strip email/phone/total_earnings for a non-owner, non-admin caller', async () => {
      mockRequest.params = { driverId: 'another-driver-id' };

      await driverController.getDriverDetails(mockRequest as any, mockResponse as Response);

      const payload = (mockResponse.json as any).mock.calls[0][0];
      expect(payload.data.email).toBeUndefined();
      expect(payload.data.phone).toBeUndefined();
      expect(payload.data.total_earnings).toBeUndefined();
      expect(payload.data.first_name).toBe('Jean');
    });

    it('should include email/phone/total_earnings when the driver views their own profile', async () => {
      mockRequest.user = { id: 'another-driver-id' } as any;
      mockRequest.params = { driverId: 'another-driver-id' };

      await driverController.getDriverDetails(mockRequest as any, mockResponse as Response);

      const payload = (mockResponse.json as any).mock.calls[0][0];
      expect(payload.data.email).toBe('driver@example.com');
      expect(payload.data.total_earnings).toBeDefined();
    });
  });
});
