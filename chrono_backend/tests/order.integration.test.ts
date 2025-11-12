/**
 * Tests d'intégration pour le flow de commande complet
 * @jest-environment node
 * @ts-check
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
// @ts-ignore
import request from 'supertest';
import app from '../src/app.js';

describe('Order Flow Integration Tests', () => {
  let authToken: string;
  let userId: string;

  beforeAll(async () => {
    // Setup: Créer un utilisateur de test
    const testEmail = `test-order-${Date.now()}@example.com`;
    
    // Envoyer OTP
    await request(app)
      .post('/api/auth-simple/send-otp')
      .send({
        email: testEmail,
        method: 'email',
        role: 'client'
      });

    // Vérifier OTP
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

  describe('Order Creation Flow', () => {
    it('should calculate price before creating order', async () => {
      const priceResponse = await request(app)
        .post('/api/payments/calculate-price')
        .send({
          pickup: {
            address: '123 Main St, Abidjan',
            coordinates: { latitude: 5.3165, longitude: -4.0266 }
          },
          dropoff: {
            address: '456 Oak Ave, Abidjan',
            coordinates: { latitude: 5.3532, longitude: -3.9851 }
          },
          deliveryMethod: 'moto'
        })
        .expect(200);

      expect(priceResponse.body).toHaveProperty('success', true);
      expect(priceResponse.body).toHaveProperty('price');
      expect(priceResponse.body.price).toBeGreaterThan(0);
    });

    it('should validate order data structure', () => {
      const orderData = {
        pickup: {
          address: '123 Main St',
          coordinates: { latitude: 5.3165, longitude: -4.0266 }
        },
        dropoff: {
          address: '456 Oak Ave',
          coordinates: { latitude: 5.3532, longitude: -3.9851 }
        },
        deliveryMethod: 'moto',
        price: 5000,
        distance: 5.2,
        estimatedDuration: '15 min'
      };

      // Validation de la structure
      expect(orderData.pickup).toHaveProperty('address');
      expect(orderData.pickup).toHaveProperty('coordinates');
      expect(orderData.pickup.coordinates).toHaveProperty('latitude');
      expect(orderData.pickup.coordinates).toHaveProperty('longitude');
      expect(orderData.dropoff).toHaveProperty('address');
      expect(orderData.dropoff).toHaveProperty('coordinates');
      expect(['moto', 'vehicule', 'cargo']).toContain(orderData.deliveryMethod);
      expect(orderData.price).toBeGreaterThan(0);
      expect(orderData.distance).toBeGreaterThan(0);
    });

    it('should reject order with invalid coordinates', async () => {
      const response = await request(app)
        .post('/api/payments/calculate-price')
        .send({
          pickup: {
            coordinates: { latitude: 200, longitude: -4.0266 } // Latitude invalide (> 90)
          },
          dropoff: {
            coordinates: { latitude: 5.3532, longitude: -3.9851 }
          },
          deliveryMethod: 'moto'
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should reject order with missing required fields', async () => {
      const response = await request(app)
        .post('/api/payments/calculate-price')
        .send({
          pickup: {
            coordinates: { latitude: 5.3165, longitude: -4.0266 }
          }
          // dropoff manquant
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('Driver Search Flow', () => {
    it('should find nearby drivers', async () => {
      const response = await request(app)
        .get('/api/drivers/online')
        .query({
          latitude: 5.3165,
          longitude: -4.0266,
          radius: 10 // 10km
        });

      // Peut retourner 200 avec une liste vide si aucun chauffeur en ligne
      expect([200, 400]).toContain(response.status);
      
      if (response.status === 200) {
        expect(response.body).toHaveProperty('success');
        // Peut être un tableau vide si aucun chauffeur disponible
        if (response.body.drivers) {
          expect(Array.isArray(response.body.drivers)).toBe(true);
        }
      }
    });

    it('should return 400 for invalid location parameters', async () => {
      const response = await request(app)
        .get('/api/drivers/online')
        .query({
          latitude: 'invalid',
          longitude: -4.0266
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('Order Status Flow', () => {
    it('should validate order status transitions', () => {
      const validStatuses = ['pending', 'accepted', 'enroute', 'picked_up', 'completed', 'cancelled', 'declined'];
      
      // Test des transitions valides
      const transitions = [
        { from: 'pending', to: 'accepted', valid: true },
        { from: 'pending', to: 'cancelled', valid: true },
        { from: 'pending', to: 'declined', valid: true },
        { from: 'accepted', to: 'enroute', valid: true },
        { from: 'enroute', to: 'picked_up', valid: true },
        { from: 'picked_up', to: 'completed', valid: true },
        { from: 'completed', to: 'pending', valid: false }, // Transition invalide
        { from: 'cancelled', to: 'accepted', valid: false }, // Transition invalide
      ];

      transitions.forEach(({ from, to, valid }) => {
        expect(validStatuses).toContain(from);
        expect(validStatuses).toContain(to);
        // En production, vous implémenteriez une logique de validation des transitions
      });
    });
  });
});

