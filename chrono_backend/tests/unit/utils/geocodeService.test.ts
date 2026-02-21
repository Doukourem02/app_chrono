/**
 * Tests unitaires pour le service de géocodage (Mapbox)
 */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { geocodeAddress } from '../../../src/utils/geocodeService.js';
import { geocodeForward } from '../../../src/utils/mapboxService.js';

jest.mock('../../../src/utils/mapboxService.js');

global.console = {
  ...console,
  warn: jest.fn(),
  error: jest.fn(),
};

describe('GeocodeService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('geocodeAddress', () => {
    it('should geocode address successfully via Mapbox', async () => {
      (geocodeForward as any).mockResolvedValue({
        latitude: 5.359952,
        longitude: -4.008256,
      });

      const result = await geocodeAddress('Abidjan, Côte d\'Ivoire');

      expect(result).not.toBeNull();
      expect(result?.latitude).toBe(5.359952);
      expect(result?.longitude).toBe(-4.008256);
      expect(geocodeForward).toHaveBeenCalledWith('Abidjan, Côte d\'Ivoire', { country: 'ci', limit: 1 });
    });

    it('should return null when Mapbox returns null', async () => {
      (geocodeForward as any).mockResolvedValue(null);

      const result = await geocodeAddress('Invalid Address 12345');

      expect(result).toBeNull();
      expect(console.warn).toHaveBeenCalled();
    });

    it('should return null when Mapbox throws', async () => {
      (geocodeForward as any).mockRejectedValue(new Error('Network error'));

      const result = await geocodeAddress('Abidjan');

      expect(result).toBeNull();
      expect(console.warn).toHaveBeenCalled();
    });

    it('should pass country and limit to mapboxService', async () => {
      (geocodeForward as any).mockResolvedValue({ latitude: 5.36, longitude: -4.01 });

      await geocodeAddress('Cocody, Abidjan');

      expect(geocodeForward).toHaveBeenCalledWith('Cocody, Abidjan', { country: 'ci', limit: 1 });
    });
  });
});
