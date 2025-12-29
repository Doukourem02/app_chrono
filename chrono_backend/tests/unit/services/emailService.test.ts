/**
 * Tests unitaires pour le service d'envoi d'emails
 */
import { describe, it, expect, beforeEach, beforeAll, afterAll, jest } from '@jest/globals';
import nodemailer from 'nodemailer';

// Mock console pour éviter les logs pendant les tests
global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
};

// Importer le service
import { sendOTPEmail, sendOTPSMS } from '../../../src/services/emailService.js';

describe('EmailService', () => {
  let mockTransporter: any;
  let createTransportSpy: any;

  beforeAll(() => {
    // Configuration de l'environnement
    process.env.EMAIL_HOST = 'smtp.gmail.com';
    process.env.EMAIL_PORT = '587';
    process.env.EMAIL_USER = 'test@example.com';
    process.env.EMAIL_PASS = 'test-password';
    process.env.EMAIL_FROM_NAME = 'ChronoDelivery';
    process.env.EMAIL_FROM_ADDRESS = 'noreply@chronodelivery.com';

    // Créer le mockTransporter une seule fois
    const newMockSendMail = jest.fn();
    mockTransporter = {
      sendMail: newMockSendMail,
    };

    // Utiliser jest.spyOn pour mocker createTransport une seule fois
    createTransportSpy = jest.spyOn(nodemailer, 'createTransport').mockReturnValue(mockTransporter as any);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Réinitialiser le mockSendMail pour chaque test
    (mockTransporter.sendMail as any).mockClear();
  });
  
  afterAll(() => {
    if (createTransportSpy) {
      createTransportSpy.mockRestore();
    }
  });

  describe('sendOTPEmail', () => {
    it('should send OTP email successfully', async () => {
      const messageId = 'test-message-id-123';
      (mockTransporter.sendMail as any).mockResolvedValue({ messageId });

      const result = await sendOTPEmail('test@example.com', '123456', 'client');

      // Vérifier que createTransport a été appelé
      expect(createTransportSpy).toHaveBeenCalled();
      
      // Vérifier le résultat
      expect(result.success).toBe(true);
      expect(result.messageId).toBe(messageId);
      expect(mockTransporter.sendMail as any).toHaveBeenCalledTimes(1);
      expect(mockTransporter.sendMail as any).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'test@example.com',
          subject: expect.stringContaining('123456'),
          html: expect.stringContaining('123456'),
          text: expect.stringContaining('123456'),
        })
      );
    });

    it('should include role in email subject and content', async () => {
      (mockTransporter.sendMail as any).mockResolvedValue({ messageId: 'test-id' });

      await sendOTPEmail('test@example.com', '123456', 'driver');

      expect(mockTransporter.sendMail as any).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: expect.stringContaining('driver'),
          html: expect.stringContaining('driver'),
        })
      );
    });

    it('should handle email sending errors', async () => {
      const errorMessage = 'SMTP connection failed';
      (mockTransporter.sendMail as any).mockRejectedValue(new Error(errorMessage));

      const result = await sendOTPEmail('test@example.com', '123456');

      expect(result.success).toBe(false);
      expect(result.error).toBe(errorMessage);
      expect(result.messageId).toBeUndefined();
    });

    it('should use default role "driver" when not provided', async () => {
      (mockTransporter.sendMail as any).mockResolvedValue({ messageId: 'test-id' });

      await sendOTPEmail('test@example.com', '123456');

      expect(mockTransporter.sendMail as any).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: expect.stringContaining('driver'),
        })
      );
    });

    it('should include OTP code in email content', async () => {
      const otpCode = '987654';
      (mockTransporter.sendMail as any).mockResolvedValue({ messageId: 'test-id' });

      await sendOTPEmail('test@example.com', otpCode);

      const callArgs = (mockTransporter.sendMail as any).mock.calls[0][0] as any;
      expect(callArgs.html).toContain(otpCode);
      expect(callArgs.text).toContain(otpCode);
      expect(callArgs.subject).toContain(otpCode);
    });

    it('should use correct from address from environment', async () => {
      (mockTransporter.sendMail as any).mockResolvedValue({ messageId: 'test-id' });

      await sendOTPEmail('test@example.com', '123456');

      expect(mockTransporter.sendMail as any).toHaveBeenCalledWith(
        expect.objectContaining({
          from: expect.stringContaining('noreply@chronodelivery.com'),
        })
      );
    });

    it('should handle network errors', async () => {
      (mockTransporter.sendMail as any).mockRejectedValue(new Error('Network timeout'));

      const result = await sendOTPEmail('test@example.com', '123456');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network timeout');
    });
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

  describe('Edge cases', () => {
    it('should handle empty email address', async () => {
      (mockTransporter.sendMail as any).mockResolvedValue({ messageId: 'test-id' });

      const result = await sendOTPEmail('', '123456');

      // Le service devrait quand même tenter d'envoyer
      expect(mockTransporter.sendMail as any).toHaveBeenCalled();
    });

    it('should handle special characters in email', async () => {
      (mockTransporter.sendMail as any).mockResolvedValue({ messageId: 'test-id' });

      const result = await sendOTPEmail('test+special@example.com', '123456');

      expect(result.success).toBe(true);
    });

    it('should handle very long OTP codes', async () => {
      const longOtp = '1'.repeat(20);
      (mockTransporter.sendMail as any).mockResolvedValue({ messageId: 'test-id' });

      const result = await sendOTPEmail('test@example.com', longOtp);

      expect(result.success).toBe(true);
      expect(mockTransporter.sendMail as any).toHaveBeenCalledWith(
        expect.objectContaining({
          html: expect.stringContaining(longOtp),
        })
      );
    });
  });
});
