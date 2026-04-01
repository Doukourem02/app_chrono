import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  isTwilioSmsConfigured,
  sendOTPSMSTwilio,
} from '../../../src/services/twilioSmsService.js';

describe('twilioSmsService', () => {
  const original = { ...process.env };

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...original };
  });

  afterEach(() => {
    process.env = original;
    jest.restoreAllMocks();
  });

  describe('isTwilioSmsConfigured', () => {
    it('returns false without credentials', () => {
      delete process.env.TWILIO_ACCOUNT_SID;
      delete process.env.TWILIO_AUTH_TOKEN;
      delete process.env.TWILIO_SMS_FROM;
      delete process.env.TWILIO_SMS_MESSAGING_SERVICE_SID;
      expect(isTwilioSmsConfigured()).toBe(false);
    });

    it('returns true with sid, token, and SMS From', () => {
      process.env.TWILIO_ACCOUNT_SID = 'ACtest';
      process.env.TWILIO_AUTH_TOKEN = 'token';
      process.env.TWILIO_SMS_FROM = '+33601020304';
      expect(isTwilioSmsConfigured()).toBe(true);
    });

    it('returns true with Messaging Service SID instead of From', () => {
      process.env.TWILIO_ACCOUNT_SID = 'ACtest';
      process.env.TWILIO_AUTH_TOKEN = 'token';
      process.env.TWILIO_SMS_MESSAGING_SERVICE_SID = 'MGxxxxxxxx';
      expect(isTwilioSmsConfigured()).toBe(true);
    });
  });

  describe('sendOTPSMSTwilio', () => {
    it('returns error when Twilio SMS From missing', async () => {
      process.env.TWILIO_ACCOUNT_SID = 'ACtest';
      process.env.TWILIO_AUTH_TOKEN = 'token';
      delete process.env.TWILIO_SMS_FROM;
      delete process.env.TWILIO_SMS_MESSAGING_SERVICE_SID;

      const r = await sendOTPSMSTwilio('+33601020304', '123456', 'client');
      expect(r.success).toBe(false);
      expect(r.error).toContain('TWILIO_SMS_FROM');
    });

    it('calls Twilio API and returns sid on success', async () => {
      process.env.TWILIO_ACCOUNT_SID = 'ACtest';
      process.env.TWILIO_AUTH_TOKEN = 'token';
      process.env.TWILIO_SMS_FROM = '+15551234567';

      const fetchMock = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ sid: 'SMabc123' }),
      });
      global.fetch = fetchMock as unknown as typeof fetch;

      const r = await sendOTPSMSTwilio('33601020304', '654321', 'driver');
      expect(r.success).toBe(true);
      expect(r.messageId).toBe('SMabc123');
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(init.method).toBe('POST');
      expect(init.body).toContain('To=%2B33601020304');
      expect(init.body).toContain('654321');
    });
  });
});
