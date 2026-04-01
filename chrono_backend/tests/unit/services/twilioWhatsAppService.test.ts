/**
 * Tests unitaires — envoi OTP WhatsApp (Twilio REST)
 */
import { describe, it, expect, beforeEach, afterAll, jest } from '@jest/globals';
import { toWhatsAppAddress, sendOTPWhatsApp } from '../../../src/services/twilioWhatsAppService.js';

describe('twilioWhatsAppService', () => {
  const originalFetch = global.fetch;
  const originalEnv = { ...process.env };

  afterAll(() => {
    global.fetch = originalFetch;
    process.env = { ...originalEnv };
  });

  describe('toWhatsAppAddress', () => {
    it('normalise +225 vers whatsapp:+225…', () => {
      expect(toWhatsAppAddress('+225 07 78 73 39 71')).toBe('whatsapp:+2250778733971');
    });
    it('rejette numéro trop court', () => {
      expect(() => toWhatsAppAddress('+123')).toThrow();
    });
  });

  describe('sendOTPWhatsApp', () => {
    beforeEach(() => {
      jest.resetAllMocks();
      process.env.TWILIO_ACCOUNT_SID = 'ACtest';
      process.env.TWILIO_AUTH_TOKEN = 'token';
      process.env.TWILIO_WHATSAPP_FROM = 'whatsapp:+10000000000';
      delete process.env.TWILIO_WHATSAPP_MESSAGING_SERVICE_SID;
      delete process.env.TWILIO_WHATSAPP_CONTENT_SID;
      delete process.env.TWILIO_WHATSAPP_CONTENT_VARIABLES_JSON;
    });

    it('retourne erreur si credentials manquants', async () => {
      delete process.env.TWILIO_ACCOUNT_SID;
      const r = await sendOTPWhatsApp('+2250778733971', '123456', 'client');
      expect(r.success).toBe(false);
      expect(r.error).toMatch(/TWILIO_ACCOUNT_SID/);
    });

    it('envoie Body sans ContentSid et parse succès Twilio', async () => {
      global.fetch = jest.fn(async () => ({
        ok: true,
        json: async () => ({ sid: 'SMxxx' }),
      })) as unknown as typeof fetch;

      const r = await sendOTPWhatsApp('+2250778733971', '654321', 'driver');
      expect(r.success).toBe(true);
      expect(r.messageId).toBe('SMxxx');
      expect(global.fetch).toHaveBeenCalledTimes(1);
      const init = (global.fetch as jest.Mock).mock.calls[0][1] as RequestInit;
      expect(init.method).toBe('POST');
      const body = init.body as string;
      expect(body).toContain('To=whatsapp%3A%2B2250778733971');
      expect(body).toContain('654321');
    });

    it('utilise ContentSid et ContentVariables', async () => {
      process.env.TWILIO_WHATSAPP_CONTENT_SID = 'HXaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
      global.fetch = jest.fn(async () => ({
        ok: true,
        json: async () => ({ sid: 'SMyyy' }),
      })) as unknown as typeof fetch;

      const r = await sendOTPWhatsApp('+2250504343424', '111222', 'client');
      expect(r.success).toBe(true);
      const body = ((global.fetch as jest.Mock).mock.calls[0][1] as RequestInit).body as string;
      expect(body).toContain('ContentSid');
      expect(decodeURIComponent(body)).toContain('"1":"111222"');
    });

    it('retourne erreur si Twilio répond ko', async () => {
      global.fetch = jest.fn(async () => ({
        ok: false,
        status: 400,
        json: async () => ({ message: 'Invalid' }),
      })) as unknown as typeof fetch;

      const r = await sendOTPWhatsApp('+2250778733971', '123456', 'client');
      expect(r.success).toBe(false);
      expect(r.error).toBe('Invalid');
    });
  });
});
