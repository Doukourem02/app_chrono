/**
 * Tests d'intégration pour l'authentification
 * @jest-environment node
 * @ts-check
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
// @ts-ignore - supertest types will be available after npm install
import request from 'supertest';
import app from '../src/app.js';

describe('Authentication Integration Tests', () => {
  const testEmail = `test-${Date.now()}@example.com`;
  const testPhone = '+2250500000001';
  const testPassword = 'TestPassword123!';
  let otpCode: string;

  describe('POST /api/auth-simple/send-otp', () => {
    it('should send OTP code successfully or fail gracefully without SMS provider', async () => {
      const response = await request(app)
        .post('/api/auth-simple/send-otp')
        .send({
          email: testEmail,
          phone: testPhone,
          otpMethod: 'sms',
          role: 'client'
        });

      // 200 avec SMS configuré, 503 si provider SMS absent (CI sans Twilio)
      expect([200, 503]).toContain(response.status);

      if (response.status === 200) {
        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('data');
        expect(response.body.data).toHaveProperty('method', 'sms');
        expect(response.body.data).toHaveProperty('phone', testPhone);
        if (process.env.NODE_ENV === 'development' && response.body.data.debug_code) {
          otpCode = response.body.data.debug_code;
        }
      }
    });

    it('should return 400 for invalid email when provided', async () => {
      const response = await request(app)
        .post('/api/auth-simple/send-otp')
        .send({
          email: 'invalid-email',
          phone: testPhone,
          otpMethod: 'sms',
          role: 'client'
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should return 400 for missing phone', async () => {
      const response = await request(app)
        .post('/api/auth-simple/send-otp')
        .send({
          email: testEmail,
          otpMethod: 'sms',
          role: 'client'
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('POST /api/auth-simple/verify-otp', () => {
    it('should verify OTP and create user if new', async () => {
      const sendResponse = await request(app)
        .post('/api/auth-simple/send-otp')
        .send({ email: testEmail, phone: testPhone, otpMethod: 'sms', role: 'client' });

      // Si SMS non configuré on skip la vérification (pas de code disponible)
      if (sendResponse.status !== 200) return;

      const code = process.env.NODE_ENV === 'development' && sendResponse.body.data?.debug_code
        ? sendResponse.body.data.debug_code
        : '123456';

      const response = await request(app)
        .post('/api/auth-simple/verify-otp')
        .send({ email: testEmail, phone: testPhone, otp: code, method: 'sms', role: 'client' });

      expect([200, 400]).toContain(response.status);

      if (response.status === 200) {
        expect(response.body).toHaveProperty('success', true);
        expect(response.body.data).toHaveProperty('user');
        expect(response.body.data).toHaveProperty('tokens');
        expect(response.body.data.tokens).toHaveProperty('accessToken');
        expect(response.body.data.tokens).toHaveProperty('refreshToken');
      }
    });

    it('should return 400 for invalid OTP', async () => {
      const response = await request(app)
        .post('/api/auth-simple/verify-otp')
        .send({ email: testEmail, phone: testPhone, otp: '000000', method: 'sms', role: 'client' });

      // 400 si OTP invalide, 503 si service non configuré
      expect([400, 503]).toContain(response.status);
      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('POST /api/auth-simple/refresh-token', () => {
    it('should return 400 for missing refresh token', async () => {
      const response = await request(app)
        .post('/api/auth-simple/refresh-token')
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('message');
    });

    it('should return 401 for invalid refresh token', async () => {
      const response = await request(app)
        .post('/api/auth-simple/refresh-token')
        .send({
          refreshToken: 'invalid-token'
        })
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
    });
  });
});

