import { describe, it, expect } from '@jest/globals';
import {
  trafficContextFactor,
  getHourMultiplierAbidjan,
  MAX_CONTEXT_FACTOR,
  B2B_PRIORITY_FACTOR,
  computeDynamicDeliveryPrice,
} from '../../../src/services/dynamicPricing.js';

describe('dynamicPricing', () => {
  describe('trafficContextFactor', () => {
    it('returns 1 when typical missing', () => {
      expect(trafficContextFactor(1200, undefined)).toBe(1);
      expect(trafficContextFactor(undefined, 1000)).toBe(1);
    });
    it('returns 1 when duration <= typical', () => {
      expect(trafficContextFactor(800, 1000)).toBe(1);
    });
    it('increases when duration exceeds typical', () => {
      const f = trafficContextFactor(2000, 1000);
      expect(f).toBeGreaterThan(1);
      expect(f).toBeLessThanOrEqual(1.22);
    });
  });

  describe('getHourMultiplierAbidjan', () => {
    it('returns peak factor during morning rush (UTC)', () => {
      const d = new Date(Date.UTC(2026, 0, 5, 8, 0, 0));
      expect(getHourMultiplierAbidjan(d)).toBeGreaterThan(1);
    });
  });

  it('MAX_CONTEXT_FACTOR is bounded', () => {
    expect(MAX_CONTEXT_FACTOR).toBe(1.85);
  });

  it('applies a B2B priority premium after the base dynamic price', async () => {
    const base = await computeDynamicDeliveryPrice({
      distanceKm: 5,
      method: 'moto',
      includeWeather: false,
      includeSurge: false,
    });
    const b2b = await computeDynamicDeliveryPrice({
      distanceKm: 5,
      method: 'moto',
      includeWeather: false,
      includeSurge: false,
      isB2BPriority: true,
    });

    expect(B2B_PRIORITY_FACTOR).toBe(1.15);
    expect(b2b.priorityFactor).toBe(B2B_PRIORITY_FACTOR);
    expect(b2b.totalCfa).toBeGreaterThan(base.totalCfa);
    expect(b2b.labels).toContain('priorité B2B');
  });
});
