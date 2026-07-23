/**
 * Tests unitaires pour le service de géocodage (Mapbox)
 * Approche : mock de global.fetch (mapboxService.geocodeForward l'utilise)
 */
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { geocodeAddress } from '../../../src/utils/geocodeService.js';
import logger from '../../../src/utils/logger.js';

jest.mock('../../../src/utils/logger.js', () => ({
  __esModule: true,
  default: {
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

const ORIGINAL_FETCH = global.fetch;

describe('GeocodeService', () => {
  beforeEach(() => {
    process.env.MAPBOX_ACCESS_TOKEN = 'test-mapbox-token';
    // Réassigner logger.warn depuis le contexte test (évite cross-context VM)
    (logger as any).warn = jest.fn();
    (logger as any).error = jest.fn();
    global.fetch = jest.fn() as any;
  });

  afterEach(() => {
    global.fetch = ORIGINAL_FETCH;
    delete process.env.MAPBOX_ACCESS_TOKEN;
  });

  describe('geocodeAddress', () => {
    it('should geocode address successfully via Mapbox', async () => {
      (global.fetch as any).mockResolvedValue({
        json: () => Promise.resolve({
          features: [{
            geometry: { coordinates: [-4.008256, 5.359952] },
            properties: { full_address: 'Abidjan, Côte d\'Ivoire' },
          }],
        }),
      });

      const result = await geocodeAddress('Abidjan, Côte d\'Ivoire');

      expect(result).not.toBeNull();
      expect(result?.latitude).toBe(5.359952);
      expect(result?.longitude).toBe(-4.008256);
      const fetchUrl = (global.fetch as any).mock.calls[0][0] as string;
      expect(fetchUrl).toContain('Abidjan');
    });

    it('should return null when Mapbox returns null', async () => {
      (global.fetch as any).mockResolvedValue({
        json: () => Promise.resolve({ features: [] }),
      });

      const result = await geocodeAddress('Invalid Address 12345');

      expect(result).toBeNull();
      expect(logger.warn).toHaveBeenCalled();
    });

    it('should return null when Mapbox throws', async () => {
      (global.fetch as any).mockRejectedValue(new Error('Network error'));

      const result = await geocodeAddress('Abidjan');

      expect(result).toBeNull();
    });

    it('should pass country and limit to mapboxService', async () => {
      (global.fetch as any).mockResolvedValue({
        json: () => Promise.resolve({
          features: [{
            geometry: { coordinates: [-4.01, 5.36] },
            properties: {},
          }],
        }),
      });

      await geocodeAddress('Cocody, Abidjan');

      const fetchUrl = (global.fetch as any).mock.calls[0][0] as string;
      expect(fetchUrl).toContain('country=ci');
      expect(fetchUrl).toContain('limit=1');
    });
  });
});
