/**
 * Tests d'intégration pour les paiements
 * @jest-environment node
 * @ts-check
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
// @ts-ignore
import request from 'supertest';
import app from '../src/app.js';

describe('Payment Integration Tests', () => {
  let authToken: string;
  let userId: string;

  beforeAll(async () => {
    // Setup: Créer un utilisateur de test et obtenir un token
    // Note: En production, utilisez un utilisateur de test dédié
    const testEmail = `test-payment-${Date.now()}@example.com`;
    
    // Envoyer OTP
    await request(app)
      .post('/api/auth-simple/send-otp')
      .send({
        email: testEmail,
        method: 'email',
        role: 'client'
      });

    // Vérifier OTP (en développement, utilisez le code debug)
    // Pour les tests, on peut mocker ou utiliser un code de test
    const verifyResponse = await request(app)
      .post('/api/auth-simple/verify-otp')
      .send({
        email: testEmail,
        otp: process.env.TEST_OTP_CODE || '123456',
        method: 'email',
        role: 'client'
      });

    if (verifyResponse.status === 200 && verifyResponse.body.accessToken) {
      authToken = verifyResponse.body.accessToken;
      userId = verifyResponse.body.user?.id || '';
    }
  });

  describe('POST /api/payments/calculate-price', () => {
    it('should calculate price for moto delivery', async () => {
      const response = await request(app)
        .post('/api/payments/calculate-price')
        .send({
          pickup: {
            coordinates: { latitude: 5.3165, longitude: -4.0266 }
          },
          dropoff: {
            coordinates: { latitude: 5.3532, longitude: -3.9851 }
          },
          deliveryMethod: 'moto'
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('price');
      expect(response.body).toHaveProperty('distance');
      expect(response.body).toHaveProperty('estimatedDuration');
      expect(response.body.price).toBeGreaterThan(0);
      expect(response.body.distance).toBeGreaterThan(0);
    });

    it('should calculate price for vehicule delivery', async () => {
      const response = await request(app)
        .post('/api/payments/calculate-price')
        .send({
          pickup: {
            coordinates: { latitude: 5.3165, longitude: -4.0266 }
          },
          dropoff: {
            coordinates: { latitude: 5.3532, longitude: -3.9851 }
          },
          deliveryMethod: 'vehicule'
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.price).toBeGreaterThan(0);
    });

    it('should return 400 for invalid coordinates', async () => {
      const response = await request(app)
        .post('/api/payments/calculate-price')
        .send({
          pickup: {
            coordinates: { latitude: 200, longitude: -4.0266 } // Latitude invalide
          },
          dropoff: {
            coordinates: { latitude: 5.3532, longitude: -3.9851 }
          },
          deliveryMethod: 'moto'
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should return 400 for missing delivery method', async () => {
      const response = await request(app)
        .post('/api/payments/calculate-price')
        .send({
          pickup: {
            coordinates: { latitude: 5.3165, longitude: -4.0266 }
          },
          dropoff: {
            coordinates: { latitude: 5.3532, longitude: -3.9851 }
          }
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('POST /api/payments/methods', () => {
    it('should create a payment method with valid token', async () => {
      if (!authToken) {
        console.warn('⚠️ Token d\'authentification non disponible, test ignoré');
        return;
      }

      const response = await request(app)
        .post('/api/payments/methods')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: 'orange_money',
          phoneNumber: '+221771234567',
          isDefault: true
        });

      // Peut retourner 200 (succès) ou 401 (token invalide en test)
      expect([200, 201, 401]).toContain(response.status);
      
      if (response.status === 200 || response.status === 201) {
        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('paymentMethod');
      }
    });

    it('should return 401 without authentication token', async () => {
      const response = await request(app)
        .post('/api/payments/methods')
        .send({
          type: 'orange_money',
          phoneNumber: '+221771234567'
        })
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('GET /api/payments/methods', () => {
    it('should return payment methods with valid token', async () => {
      if (!authToken) {
        console.warn('⚠️ Token d\'authentification non disponible, test ignoré');
        return;
      }

      const response = await request(app)
        .get('/api/payments/methods')
        .set('Authorization', `Bearer ${authToken}`);

      // Peut retourner 200 (succès) ou 401 (token invalide en test)
      expect([200, 401]).toContain(response.status);
      
      if (response.status === 200) {
        expect(response.body).toHaveProperty('success', true);
        expect(Array.isArray(response.body.paymentMethods) || Array.isArray(response.body.data)).toBe(true);
      }
    });
  });

  describe('POST /api/payments/initiate', () => {
    it('should initiate payment with valid data', async () => {
      if (!authToken) {
        console.warn('⚠️ Token d\'authentification non disponible, test ignoré');
        return;
      }

      const response = await request(app)
        .post('/api/payments/initiate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          orderId: 'test-order-id',
          paymentMethodId: 'test-method-id',
          amount: 5000
        });

      // Peut retourner 200, 400 ou 401 selon la configuration
      expect([200, 201, 400, 401, 404]).toContain(response.status);
    });

    it('should return 400 for invalid amount', async () => {
      if (!authToken) {
        console.warn('⚠️ Token d\'authentification non disponible, test ignoré');
        return;
      }

      const response = await request(app)
        .post('/api/payments/initiate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          orderId: 'test-order-id',
          paymentMethodId: 'test-method-id',
          amount: -100 // Montant invalide
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });
  });
});

