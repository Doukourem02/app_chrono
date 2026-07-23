/**
 * Tests unitaires pour fleetController — gestion des véhicules de flotte
 * (admin-only, voir fleetRoutes.ts). Couvre la validation de création (plaque
 * dupliquée) et la mise à jour par allowlist de champs (pas d'injection via un
 * champ arbitraire du body).
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import type { Request, Response } from 'express';

const mockPool = { query: jest.fn<(...args: any[]) => Promise<any>>() };
await jest.unstable_mockModule('../../../src/config/db.js', () => ({
  __esModule: true,
  default: mockPool,
}));

const fleetController = await import('../../../src/controllers/fleetController.js');

describe('fleetController', () => {
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

  describe('createFleetVehicle', () => {
    it('rejette une création sans plaque ni type (400)', async () => {
      mockRequest.body = {};

      await fleetController.createFleetVehicle(mockRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockPool.query).not.toHaveBeenCalled();
    });

    it('rejette une plaque déjà existante (409)', async () => {
      mockRequest.body = { vehicle_plate: 'CI-1234-AB', vehicle_type: 'moto' };
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: 'veh-1' }] } as any);

      await fleetController.createFleetVehicle(mockRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(409);
    });

    it('crée le véhicule pour une plaque inédite', async () => {
      mockRequest.body = { vehicle_plate: 'CI-5678-CD', vehicle_type: 'moto' };
      mockPool.query
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [{ id: 'veh-2', vehicle_plate: 'CI-5678-CD' }] } as any);

      await fleetController.createFleetVehicle(mockRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(201);
    });
  });

  describe('updateFleetVehicle', () => {
    it("rejette une mise à jour sans aucun champ reconnu (400)", async () => {
      mockRequest.params = { vehiclePlate: 'CI-1234-AB' };
      mockRequest.body = { not_a_real_column: 'x' };

      await fleetController.updateFleetVehicle(mockRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockPool.query).not.toHaveBeenCalled();
    });

    it("n'inclut dans la requête que les champs de l'allowlist", async () => {
      mockRequest.params = { vehiclePlate: 'CI-1234-AB' };
      mockRequest.body = { vehicle_color: 'rouge', not_a_real_column: 'x' };
      mockPool.query.mockResolvedValueOnce({ rows: [{ id: 'veh-1', vehicle_color: 'rouge' }] } as any);

      await fleetController.updateFleetVehicle(mockRequest, mockResponse as Response);

      const [query, values] = mockPool.query.mock.calls[0] as [string, any[]];
      expect(query).toContain('vehicle_color = $1');
      expect(query).not.toContain('not_a_real_column');
      expect(values).toEqual(['rouge', 'CI-1234-AB']);
    });

    it("renvoie 404 si le véhicule n'existe pas", async () => {
      mockRequest.params = { vehiclePlate: 'CI-9999-ZZ' };
      mockRequest.body = { vehicle_color: 'bleu' };
      mockPool.query.mockResolvedValueOnce({ rows: [] } as any);

      await fleetController.updateFleetVehicle(mockRequest, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
    });
  });
});
