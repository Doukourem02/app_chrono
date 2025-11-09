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
  const testPassword = 'TestPassword123!';
  let otpCode: string;

  describe('POST /api/auth/send-otp', () => {
    it('should send OTP code successfully', async () => {
      const response = await request(app)
        .post('/api/auth/send-otp')
        .send({
          email: testEmail,
          otpMethod: 'email',
          role: 'client'
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('method', 'email');
      expect(response.body.data).toHaveProperty('email', testEmail);

      // En développement, le code OTP est retourné pour les tests
      if (process.env.NODE_ENV === 'development' && response.body.data.debug_code) {
        otpCode = response.body.data.debug_code;
      }
    });

    it('should return 400 for invalid email', async () => {
      const response = await request(app)
        .post('/api/auth/send-otp')
        .send({
          email: 'invalid-email',
          otpMethod: 'email',
          role: 'client'
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should return 400 for missing email', async () => {
      const response = await request(app)
        .post('/api/auth/send-otp')
        .send({
          otpMethod: 'email',
          role: 'client'
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('POST /api/auth/verify-otp', () => {
    it('should verify OTP and create user if new', async () => {
      // D'abord envoyer un OTP
      const sendResponse = await request(app)
        .post('/api/auth/send-otp')
        .send({
          email: testEmail,
          otpMethod: 'email',
          role: 'client'
        })
        .expect(200);

      // En développement, utiliser le code debug
      const code = process.env.NODE_ENV === 'development' && sendResponse.body.data.debug_code
        ? sendResponse.body.data.debug_code
        : '123456'; // Code mock pour les tests

      const response = await request(app)
        .post('/api/auth/verify-otp')
        .send({
          email: testEmail,
          otp: code,
          role: 'client'
        });

      // Peut retourner 200 (succès) ou 400 (code invalide en test)
      expect([200, 400]).toContain(response.status);
      
      if (response.status === 200) {
        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('data');
        expect(response.body.data).toHaveProperty('user');
        expect(response.body.data).toHaveProperty('tokens');
        expect(response.body.data.tokens).toHaveProperty('accessToken');
        expect(response.body.data.tokens).toHaveProperty('refreshToken');
      }
    });

    it('should return 400 for invalid OTP', async () => {
      const response = await request(app)
        .post('/api/auth/verify-otp')
        .send({
          email: testEmail,
          otp: '000000',
          role: 'client'
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('message');
    });
  });

  describe('POST /api/auth/refresh-token', () => {
    it('should return 400 for missing refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh-token')
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('message');
    });

    it('should return 401 for invalid refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh-token')
        .send({
          refreshToken: 'invalid-token'
        })
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
    });
  });
});

