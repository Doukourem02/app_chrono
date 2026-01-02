/**
 * Tests unitaires pour deliveryController
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import type { Request, Response } from 'express';
import type { Server as SocketIOServer } from 'socket.io';
import * as deliveryController from '../../../src/controllers/deliveryController.js';
import pool from '../../../src/config/db.js';
import { activeOrders, connectedUsers } from '../../../src/sockets/orderSocket.js';

// Mock dependencies
jest.mock('../../../src/config/db.js');
jest.mock('../../../src/sockets/orderSocket.js', () => ({
  activeOrders: new Map(),
  connectedUsers: new Map(),
}));

describe('deliveryController', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockSocketIO: Partial<SocketIOServer>;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    activeOrders.clear();
    connectedUsers.clear();

    // Mock Socket.IO
    mockSocketIO = {
      emit: jest.fn(),
      to: jest.fn().mockReturnThis(),
    };

    // Mock Request
    mockRequest = {
      body: {},
      params: {},
      query: {},
      user: { id: 'test-user-id' },
      app: {
        get: jest.fn().mockReturnValue(mockSocketIO),
      },
    };

    // Mock Response
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  describe('createDelivery', () => {
    it('should create a delivery successfully', async () => {
      const mockQuery = jest.fn().mockResolvedValue({
        rows: [{
          id: 'delivery-123',
          user_id: 'test-user-id',
          pickup: { address: 'Pickup Address' },
          delivery: { address: 'Delivery Address' },
          method: 'moto',
          status: 'pending',
        }],
      });

      (pool as any).query = mockQuery;

      mockRequest.body = {
        userId: 'test-user-id',
        pickup: { address: 'Pickup Address' },
        delivery: { address: 'Delivery Address' },
        method: 'moto',
      };

      await deliveryController.createDelivery(
        mockRequest as any,
        mockResponse as Response
      );

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO deliveries'),
        expect.arrayContaining(['test-user-id', expect.anything(), expect.anything(), 'moto', 'pending'])
      );
      expect(mockSocketIO.emit).toHaveBeenCalledWith('new_delivery', expect.any(Object));
      expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ id: 'delivery-123' }));
    });

    it('should handle database errors', async () => {
      const mockQuery = jest.fn().mockRejectedValue(new Error('Database error'));
      (pool as any).query = mockQuery;

      mockRequest.body = {
        userId: 'test-user-id',
        pickup: { address: 'Pickup Address' },
        delivery: { address: 'Delivery Address' },
        method: 'moto',
      };

      await deliveryController.createDelivery(
        mockRequest as any,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({ message: 'Erreur serveur' });
    });
  });

  describe('getUserDeliveries', () => {
    it('should return user deliveries from database', async () => {
      const mockQuery = jest.fn()
        .mockResolvedValueOnce({
          rows: [{
            id: 'order-1',
            user_id: 'test-user-id',
            pickup_address: '{"address": "Pickup"}',
            dropoff_address: '{"address": "Dropoff"}',
            status: 'completed',
            created_at: new Date(),
          }],
        })
        .mockResolvedValueOnce({
          rows: [{ count: '1' }],
        });

      (pool as any).query = mockQuery;

      mockRequest.params = { userId: 'test-user-id' };
      mockRequest.query = { page: '1', limit: '20' };

      await deliveryController.getUserDeliveries(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.any(Array),
          pagination: expect.any(Object),
        })
      );
    });

    it('should fallback to memory orders when database is unavailable', async () => {
      // Add order to memory
      activeOrders.set('order-memory-1', {
        id: 'order-memory-1',
        user: { id: 'test-user-id' },
        pickup: { address: 'Memory Pickup' },
        dropoff: { address: 'Memory Dropoff' },
        status: 'pending',
        price: 1000,
        deliveryMethod: 'moto',
        distance: 5,
        estimatedDuration: '10 min',
        createdAt: new Date(),
      } as any);

      // Mock database unavailable
      process.env.DATABASE_URL = '';
      const mockQuery = jest.fn().mockRejectedValue(new Error('Database unavailable'));
      (pool as any).query = mockQuery;

      mockRequest.params = { userId: 'test-user-id' };
      mockRequest.query = { page: '1', limit: '20' };

      await deliveryController.getUserDeliveries(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.arrayContaining([
            expect.objectContaining({ id: 'order-memory-1' }),
          ]),
          meta: { source: 'memory' },
        })
      );
    });
  });

  describe('updateDeliveryStatus', () => {
    beforeEach(() => {
      // Add order to memory
      activeOrders.set('order-123', {
        id: 'order-123',
        user: { id: 'test-user-id' },
        driverId: 'driver-123',
        status: 'accepted',
        pickup: { address: 'Pickup' },
        dropoff: { address: 'Dropoff' },
        price: 1000,
        deliveryMethod: 'moto',
        distance: 5,
        estimatedDuration: '10 min',
        createdAt: new Date(),
      } as any);

      connectedUsers.set('test-user-id', 'socket-user-123');
    });

    it('should update delivery status successfully', async () => {
      const mockQuery = jest.fn().mockResolvedValue({ rows: [] });
      (pool as any).query = mockQuery;

      mockRequest.params = { orderId: 'order-123' };
      mockRequest.body = { status: 'enroute' };

      await deliveryController.updateDeliveryStatus(
        mockRequest as any,
        mockResponse as Response
      );

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          order: expect.objectContaining({ status: 'enroute' }),
        })
      );
    });

    it('should reject invalid status transitions', async () => {
      mockRequest.params = { orderId: 'order-123' };
      mockRequest.body = { status: 'completed' }; // Cannot go from 'accepted' to 'completed'

      await deliveryController.updateDeliveryStatus(
        mockRequest as any,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Invalid status transition'),
        })
      );
    });

    it('should return 404 if order not found', async () => {
      mockRequest.params = { orderId: 'non-existent-order' };
      mockRequest.body = { status: 'enroute' };

      await deliveryController.updateDeliveryStatus(
        mockRequest as any,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Order not found or already completed',
        })
      );
    });
  });

  describe('cancelOrder', () => {
    beforeEach(() => {
      activeOrders.set('order-123', {
        id: 'order-123',
        user: { id: 'test-user-id' },
        status: 'pending',
        pickup: { address: 'Pickup' },
        dropoff: { address: 'Dropoff' },
        price: 1000,
        deliveryMethod: 'moto',
        distance: 5,
        estimatedDuration: '10 min',
        createdAt: new Date(),
      } as any);
    });

    it('should cancel order successfully', async () => {
      const mockQuery = jest.fn().mockResolvedValue({ rows: [] });
      (pool as any).query = mockQuery;

      mockRequest.params = { orderId: 'order-123' };

      await deliveryController.cancelOrder(
        mockRequest as any,
        mockResponse as Response
      );

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Order cancelled successfully',
        })
      );
    });

    it('should return 400 if order cannot be cancelled', async () => {
      const order = activeOrders.get('order-123');
      if (order) {
        (order as any).status = 'completed';
      }

      mockRequest.params = { orderId: 'order-123' };

      await deliveryController.cancelOrder(
        mockRequest as any,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
    });
  });
});

