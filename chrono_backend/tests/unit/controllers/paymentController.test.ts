/**
 * Tests unitaires pour paymentController
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import type { Request, Response } from 'express';
import * as paymentController from '../../../src/controllers/paymentController.js';
import pool from '../../../src/config/db.js';
import * as priceCalculator from '../../../src/services/priceCalculator.js';
import * as mobileMoneyService from '../../../src/services/mobileMoneyService.js';

// Mock dependencies
jest.mock('../../../src/config/db.js');
jest.mock('../../../src/services/priceCalculator.js');
jest.mock('../../../src/services/mobileMoneyService.js');

describe('paymentController', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockRequest = {
      body: {},
      params: {},
      query: {},
      user: { id: 'test-user-id' },
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  describe('createPaymentMethod', () => {
    it('should create a payment method successfully', async () => {
      const mockQuery = jest.fn()
        .mockResolvedValueOnce({ rows: [] }) // For isDefault update
        .mockResolvedValueOnce({
          rows: [{
            id: 'pm-123',
            user_id: 'test-user-id',
            method_type: 'orange_money',
            provider_account: '+221771234567',
            is_default: true,
          }],
        });

      (pool as any).query = mockQuery;

      mockRequest.body = {
        methodType: 'orange_money',
        providerAccount: '+221771234567',
        providerName: 'Orange Money',
        isDefault: true,
      };

      await paymentController.createPaymentMethod(
        mockRequest as any,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.any(Object),
        })
      );
    });

    it('should return 400 for invalid payment method type', async () => {
      mockRequest.body = {
        methodType: 'invalid_type',
      };

      await paymentController.createPaymentMethod(
        mockRequest as any,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: 'Type de méthode de paiement invalide',
        })
      );
    });

    it('should return 400 if phone number missing for mobile money', async () => {
      mockRequest.body = {
        methodType: 'orange_money',
      };

      await paymentController.createPaymentMethod(
        mockRequest as any,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: 'Numéro de téléphone requis pour Mobile Money',
        })
      );
    });
  });

  describe('calculatePrice', () => {
    it('should calculate price successfully', async () => {
      const mockValidation = { valid: true };
      const mockCalculation = {
        basePrice: 1000,
        urgencyFee: 0,
        totalPrice: 1000,
        distance: 5,
        deliveryMethod: 'moto',
      };

      (priceCalculator.validatePriceParams as jest.Mock) = jest.fn().mockReturnValue(mockValidation);
      (priceCalculator.calculateDeliveryPrice as jest.Mock) = jest.fn().mockReturnValue(mockCalculation);

      mockRequest.body = {
        distance: 5,
        deliveryMethod: 'moto',
        isUrgent: false,
      };

      await paymentController.calculatePrice(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: mockCalculation,
        })
      );
    });

    it('should return 400 for invalid parameters', async () => {
      const mockValidation = {
        valid: false,
        error: 'Distance must be greater than 0',
      };

      (priceCalculator.validatePriceParams as jest.Mock) = jest.fn().mockReturnValue(mockValidation);

      mockRequest.body = {
        distance: -5,
        deliveryMethod: 'moto',
      };

      await paymentController.calculatePrice(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: mockValidation.error,
        })
      );
    });
  });

  describe('initiatePayment', () => {
    beforeEach(() => {
      const mockOrder = {
        id: 'order-123',
        user_id: 'test-user-id',
        price: 1000,
        calculated_price: 1000,
        distance: 5,
      };

      (pool as any).query = jest.fn()
        .mockResolvedValueOnce({ rows: [mockOrder] }) // Order query
        .mockResolvedValueOnce({ rows: [] }) // Payment method query
        .mockResolvedValueOnce({ rows: [{ id: 'txn-123' }] }) // Transaction insert
        .mockResolvedValueOnce({ rows: [] }) // Order update
        .mockResolvedValueOnce({ rows: [{ id: 'inv-123' }] }); // Invoice insert
    });

    it('should initiate cash payment successfully', async () => {
      mockRequest.body = {
        orderId: 'order-123',
        paymentMethodType: 'cash',
      };

      await paymentController.initiatePayment(
        mockRequest as any,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            transaction: expect.any(Object),
            invoice: expect.any(Object),
          }),
        })
      );
    });

    it('should return 404 if order not found', async () => {
      (pool as any).query = jest.fn().mockResolvedValueOnce({ rows: [] });

      mockRequest.body = {
        orderId: 'non-existent-order',
        paymentMethodType: 'cash',
      };

      await paymentController.initiatePayment(
        mockRequest as any,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: 'Commande non trouvée',
        })
      );
    });
  });

  describe('getPaymentMethods', () => {
    it('should return user payment methods', async () => {
      const mockQuery = jest.fn().mockResolvedValue({
        rows: [
          {
            id: 'pm-1',
            method_type: 'orange_money',
            provider_account: '+221771234567',
            is_default: true,
          },
          {
            id: 'pm-2',
            method_type: 'wave',
            provider_account: '+221771234568',
            is_default: false,
          },
        ],
      });

      (pool as any).query = mockQuery;

      await paymentController.getPaymentMethods(
        mockRequest as any,
        mockResponse as Response
      );

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.arrayContaining([
            expect.objectContaining({ id: 'pm-1' }),
            expect.objectContaining({ id: 'pm-2' }),
          ]),
        })
      );
    });
  });
});

