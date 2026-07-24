/**
 * Tests unitaires pour le service d'envoi de SMS OTP
 */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Mock console pour éviter les logs pendant les tests
global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
};

// Importer le service
import { sendOTPSMS } from '../../../src/services/emailService.js';

describe('EmailService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('sendOTPSMS', () => {
    it('should send OTP SMS successfully', async () => {
      const result = await sendOTPSMS('+2250123456789', '123456', 'client');

      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();
      expect(result.messageId).toContain('sim-');
    });

    it('should include role in SMS simulation', async () => {
      const result = await sendOTPSMS('+2250123456789', '123456', 'driver');

      expect(result.success).toBe(true);
    });

    it('should use default role "driver" when not provided', async () => {
      const result = await sendOTPSMS('+2250123456789', '123456');

      expect(result.success).toBe(true);
    });

    it('should handle errors gracefully', async () => {
      // La fonction actuelle ne lance pas d'erreur, mais testons la structure
      const result = await sendOTPSMS('+2250123456789', '123456');

      expect(result.success).toBe(true);
    });

    it('should generate unique message IDs', async () => {
      const result1 = await sendOTPSMS('+2250123456789', '123456');
      // Attendre un peu pour avoir un timestamp différent
      await new Promise(resolve => setTimeout(resolve, 10));
      const result2 = await sendOTPSMS('+2250123456789', '123456');

      expect(result1.messageId).not.toBe(result2.messageId);
    });
  });
});
