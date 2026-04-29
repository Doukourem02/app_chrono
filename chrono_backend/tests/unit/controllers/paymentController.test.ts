/**
 * Tests unitaires pour paymentController
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import type { Request, Response } from 'express';

// Mock dependencies
const mockPool = { query: jest.fn() };
await jest.unstable_mockModule('../../../src/config/db.js', () => ({
  __esModule: true,
  default: mockPool,
}));

const mockValidatePriceParams = jest.fn();
const mockCalculateDeliveryPrice = jest.fn();
await jest.unstable_mockModule('../../../src/services/priceCalculator.js', () => ({
  __esModule: true,
  validatePriceParams: mockValidatePriceParams,
  calculateDeliveryPrice: mockCalculateDeliveryPrice,
  haversineDistanceKm: jest.fn(() => 5),
  estimateDurationMinutes: jest.fn(() => 15),
  normalizeDeliveryMethod: jest.fn((method: string) => method),
  URGENCY_FEE_PERCENTAGE: 0.3,
}));

await jest.unstable_mockModule('../../../src/services/mobileMoneyService.js', () => ({
  __esModule: true,
  initiateMobileMoneyPayment: jest.fn(),
  validateMobileMoneyParams: jest.fn(() => ({ valid: true })),
  checkPaymentStatus: jest.fn(),
}));

await jest.unstable_mockModule('../../../src/services/dynamicPricing.js', () => ({
  computeDynamicDeliveryPrice: jest.fn((): Promise<any> =>
    Promise.resolve({
      lineSubtotalCfa: 1000,
      timePremiumCfa: 0,
      subtotalBeforeContextCfa: 1000,
      weatherFactor: 1,
      surgeFactor: 1,
      hourFactor: 1,
      trafficFactor: 1,
      contextFactorRaw: 1,
      contextFactorApplied: 1,
      totalCfa: 1000,
      labels: [],
    })
  ),
}));

const paymentController = await import('../../../src/controllers/paymentController.js');

describe('paymentController', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPool.query.mockReset();

    mockRequest = {
      body: {},
      params: {},
      query: {},
      user: { id: 'test-user-id' },
    } as unknown as Partial<Request>;

    mockResponse = {
      status: jest.fn().mockReturnThis() as any,
      json: jest.fn().mockReturnThis() as any,
    };
  });

  describe('createPaymentMethod', () => {
    it('should create a payment method successfully', async () => {
      const mockQuery = (jest.fn() as any)
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

      mockPool.query = mockQuery;

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

      mockValidatePriceParams.mockReturnValue(mockValidation);
      mockCalculateDeliveryPrice.mockReturnValue({
        ...mockCalculation,
        breakdown: {
          distance: 5,
          pricePerKm: 200,
          flatFee: 0,
          distanceCharge: 1000,
          urgencyFee: 0,
          total: 1000,
        },
      });

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
          data: expect.objectContaining({
            basePrice: mockCalculation.basePrice,
            totalPrice: 1000,
          }),
        })
      );
    });

    it('should return 400 for invalid parameters', async () => {
      const mockValidation = {
        valid: false,
        error: 'Distance must be greater than 0',
      };

      mockValidatePriceParams.mockReturnValue(mockValidation);

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

      mockPool.query = (jest.fn() as any)
        .mockResolvedValueOnce({ rows: [mockOrder] }) // Order query
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
      mockPool.query = (jest.fn() as any).mockResolvedValueOnce({ rows: [] });

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
      const mockQuery = (jest.fn() as any).mockResolvedValue({
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

      mockPool.query = mockQuery;

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
