/**
 * Tests d'intégration pour l'endpoint /health
 * @jest-environment node
 * @ts-check
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
// @ts-ignore - supertest types will be available after npm install
import request from 'supertest';
import app from '../src/app.js';

describe('Health Check Endpoints', () => {
  describe('GET /health', () => {
    it('should return health status with all checks', async () => {
      const response = await request(app).get('/health');

      // 200 si healthy/degraded, 503 si unhealthy (DB absente en CI)
      expect([200, 503]).toContain(response.status);
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
      expect(response.body).toHaveProperty('checks');
    });

    it('should return memory usage information', async () => {
      const response = await request(app).get('/health');

      expect([200, 503]).toContain(response.status);
      expect(response.body.checks.memory).toHaveProperty('status');
      expect(response.body.checks.memory).toHaveProperty('used');
      expect(response.body.checks.memory).toHaveProperty('total');
      expect(response.body.checks.memory).toHaveProperty('percentage');
      expect(typeof response.body.checks.memory.used).toBe('number');
      expect(typeof response.body.checks.memory.total).toBe('number');
    });
  });

  describe('GET /health/live', () => {
    it('should return liveness status', async () => {
      const response = await request(app)
        .get('/health/live')
        .expect(200);

      expect(response.body).toHaveProperty('status');
      expect(response.body.status).toBe('alive');
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('GET /health/ready', () => {
    it('should return readiness status', async () => {
      const response = await request(app).get('/health/ready');

      // 503 si DB absente (CI sans postgres sur ce job)
      expect([200, 503]).toContain(response.status);
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('checks');
    });
  });
});

