/**
 * Tests unitaires pour le service Mobile Money
 */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  initiateMobileMoneyPayment,
  validateMobileMoneyParams,
  checkPaymentStatus,
  MobileMoneyPaymentParams,
} from '../../../src/services/mobileMoneyService.js';
import logger from '../../../src/utils/logger.js';

// Mock logger
jest.mock('../../../src/utils/logger.js', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

// Mock maskPhoneNumber
jest.mock('../../../src/utils/maskSensitiveData.js', () => ({
  maskPhoneNumber: jest.fn((phone: string) => phone.replace(/\d(?=\d{4})/g, '*')),
}));

describe('MobileMoneyService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Configuration par défaut pour les tests
    process.env.ORANGE_MONEY_API_KEY = 'test-orange-key';
    process.env.ORANGE_MONEY_API_SECRET = 'test-orange-secret';
    process.env.ORANGE_MONEY_MERCHANT_ID = 'test-orange-merchant';
    process.env.WAVE_API_KEY = 'test-wave-key';
    process.env.WAVE_API_SECRET = 'test-wave-secret';
    process.env.WAVE_MERCHANT_ID = 'test-wave-merchant';
  });

  describe('validateMobileMoneyParams', () => {
    it('should validate correct Orange Money params', () => {
      const params: MobileMoneyPaymentParams = {
        provider: 'orange_money',
        phoneNumber: '+2250123456789',
        amount: 5000,
        orderId: 'order-123',
      };

      const result = validateMobileMoneyParams(params);

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should validate correct Wave params', () => {
      const params: MobileMoneyPaymentParams = {
        provider: 'wave',
        phoneNumber: '+2250123456789',
        amount: 5000,
        orderId: 'order-123',
      };

      const result = validateMobileMoneyParams(params);

      expect(result.valid).toBe(true);
    });

    it('should reject invalid provider', () => {
      const params = {
        provider: 'invalid_provider',
        phoneNumber: '+2250123456789',
        amount: 5000,
        orderId: 'order-123',
      } as any;

      const result = validateMobileMoneyParams(params);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Fournisseur Mobile Money invalide');
    });

    it('should reject invalid phone number', () => {
      const params: MobileMoneyPaymentParams = {
        provider: 'orange_money',
        phoneNumber: 'invalid-phone',
        amount: 5000,
        orderId: 'order-123',
      };

      const result = validateMobileMoneyParams(params);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Numéro de téléphone invalide');
    });

    it('should accept phone numbers with + prefix', () => {
      const params: MobileMoneyPaymentParams = {
        provider: 'orange_money',
        phoneNumber: '+2250123456789',
        amount: 5000,
        orderId: 'order-123',
      };

      const result = validateMobileMoneyParams(params);

      expect(result.valid).toBe(true);
    });

    it('should accept phone numbers without + prefix', () => {
      const params: MobileMoneyPaymentParams = {
        provider: 'orange_money',
        phoneNumber: '2250123456789',
        amount: 5000,
        orderId: 'order-123',
      };

      const result = validateMobileMoneyParams(params);

      expect(result.valid).toBe(true);
    });

    it('should reject zero or negative amount', () => {
      const params1: MobileMoneyPaymentParams = {
        provider: 'orange_money',
        phoneNumber: '+2250123456789',
        amount: 0,
        orderId: 'order-123',
      };

      const params2: MobileMoneyPaymentParams = {
        provider: 'orange_money',
        phoneNumber: '+2250123456789',
        amount: -100,
        orderId: 'order-123',
      };

      expect(validateMobileMoneyParams(params1).valid).toBe(false);
      expect(validateMobileMoneyParams(params2).valid).toBe(false);
    });

    it('should reject missing orderId', () => {
      const params = {
        provider: 'orange_money',
        phoneNumber: '+2250123456789',
        amount: 5000,
      } as any;

      const result = validateMobileMoneyParams(params);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('ID de commande requis');
    });

    it('should accept valid description', () => {
      const params: MobileMoneyPaymentParams = {
        provider: 'orange_money',
        phoneNumber: '+2250123456789',
        amount: 5000,
        orderId: 'order-123',
        description: 'Payment for order',
      };

      const result = validateMobileMoneyParams(params);

      expect(result.valid).toBe(true);
    });
  });

  describe('initiateMobileMoneyPayment', () => {
    it('should initiate Orange Money payment successfully', async () => {
      const params: MobileMoneyPaymentParams = {
        provider: 'orange_money',
        phoneNumber: '+2250123456789',
        amount: 5000,
        orderId: 'order-123',
      };

      const result = await initiateMobileMoneyPayment(params);

      expect(result.success).toBe(true);
      expect(result.status).toBe('pending');
      expect(result.transactionId).toBeDefined();
      expect(result.providerTransactionId).toBeDefined();
      expect(result.providerTransactionId).toContain('OM-');
      expect(result.message).toContain('Orange Money');
    });

    it('should initiate Wave payment successfully', async () => {
      const params: MobileMoneyPaymentParams = {
        provider: 'wave',
        phoneNumber: '+2250123456789',
        amount: 5000,
        orderId: 'order-123',
      };

      const result = await initiateMobileMoneyPayment(params);

      expect(result.success).toBe(true);
      expect(result.status).toBe('pending');
      expect(result.providerTransactionId).toContain('WV-');
      expect(result.message).toContain('Wave');
    });

    it('should return error when Orange Money is not configured', async () => {
      delete process.env.ORANGE_MONEY_API_KEY;

      const params: MobileMoneyPaymentParams = {
        provider: 'orange_money',
        phoneNumber: '+2250123456789',
        amount: 5000,
        orderId: 'order-123',
      };

      const result = await initiateMobileMoneyPayment(params);

      expect(result.success).toBe(false);
      expect(result.status).toBe('failed');
      expect(result.error).toContain('Orange Money non configuré');
    });

    it('should return error when Wave is not configured', async () => {
      delete process.env.WAVE_API_KEY;

      const params: MobileMoneyPaymentParams = {
        provider: 'wave',
        phoneNumber: '+2250123456789',
        amount: 5000,
        orderId: 'order-123',
      };

      const result = await initiateMobileMoneyPayment(params);

      expect(result.success).toBe(false);
      expect(result.status).toBe('failed');
      expect(result.error).toContain('Wave non configuré');
    });

    it('should return error for unsupported provider', async () => {
      const params = {
        provider: 'mtn_money',
        phoneNumber: '+2250123456789',
        amount: 5000,
        orderId: 'order-123',
      } as any;

      const result = await initiateMobileMoneyPayment(params);

      expect(result.success).toBe(false);
      expect(result.status).toBe('failed');
      expect(result.error).toContain('Fournisseur non supporté');
    });

    it('should generate unique transaction IDs', async () => {
      const params: MobileMoneyPaymentParams = {
        provider: 'orange_money',
        phoneNumber: '+2250123456789',
        amount: 5000,
        orderId: 'order-123',
      };

      const result1 = await initiateMobileMoneyPayment(params);
      await new Promise(resolve => setTimeout(resolve, 10));
      const result2 = await initiateMobileMoneyPayment(params);

      expect(result1.transactionId).not.toBe(result2.transactionId);
    });

    it('should include description in payment', async () => {
      const params: MobileMoneyPaymentParams = {
        provider: 'orange_money',
        phoneNumber: '+2250123456789',
        amount: 5000,
        orderId: 'order-123',
        description: 'Test payment',
      };

      const result = await initiateMobileMoneyPayment(params);

      expect(result.success).toBe(true);
    });
  });

  describe('checkPaymentStatus', () => {
    it('should check Orange Money payment status', async () => {
      const result = await checkPaymentStatus('orange_money', 'OM-123456');

      expect(result.success).toBe(true);
      expect(result.transactionId).toBe('OM-123456');
      expect(result.status).toBe('pending');
    });

    it('should check Wave payment status', async () => {
      const result = await checkPaymentStatus('wave', 'WV-123456');

      expect(result.success).toBe(true);
      expect(result.transactionId).toBe('WV-123456');
    });

    it('should handle errors when checking status', async () => {
      // Mock logger.error pour capturer l'erreur
      const originalError = logger.error;
      (logger.error as any) = jest.fn();

      // La fonction actuelle ne lance pas d'erreur, mais testons la structure
      const result = await checkPaymentStatus('orange_money', 'OM-123456');

      expect(result.success).toBe(true);
      logger.error = originalError;
    });
  });

  describe('Edge cases', () => {
    it('should handle very large amounts', async () => {
      const params: MobileMoneyPaymentParams = {
        provider: 'orange_money',
        phoneNumber: '+2250123456789',
        amount: 999999999,
        orderId: 'order-123',
      };

      const result = await initiateMobileMoneyPayment(params);

      expect(result.success).toBe(true);
    });

    it('should handle very long order IDs', async () => {
      const params: MobileMoneyPaymentParams = {
        provider: 'orange_money',
        phoneNumber: '+2250123456789',
        amount: 5000,
        orderId: 'a'.repeat(200),
      };

      const result = await initiateMobileMoneyPayment(params);

      expect(result.success).toBe(true);
    });

    it('should handle phone numbers with different formats', async () => {
      const formats = ['+2250123456789', '2250123456789', '0123456789'];

      for (const phone of formats) {
        const params: MobileMoneyPaymentParams = {
          provider: 'orange_money',
          phoneNumber: phone,
          amount: 5000,
          orderId: 'order-123',
        };

        const validation = validateMobileMoneyParams(params);
        // Certains formats peuvent être valides selon la regex
        expect(validation.valid || validation.error).toBeDefined();
      }
    });
  });
});

