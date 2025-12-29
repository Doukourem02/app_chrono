/**
 * Tests unitaires pour le service de géocodage
 */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { geocodeAddress } from '../../../src/utils/geocodeService.js';

// Mock global fetch
global.fetch = jest.fn() as any;

// Mock console
global.console = {
  ...console,
  warn: jest.fn(),
  error: jest.fn(),
};

describe('GeocodeService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.GOOGLE_MAPS_API_KEY = 'test-api-key';
    process.env.GOOGLE_API_KEY = undefined;
  });

  describe('geocodeAddress', () => {
    it('should geocode address successfully', async () => {
      const mockResponse = {
        status: 'OK',
        results: [
          {
            geometry: {
              location: {
                lat: 5.359952,
                lng: -4.008256,
              },
            },
          },
        ],
      };

      (global.fetch as any).mockResolvedValue({
        json: async () => mockResponse,
      });

      const result = await geocodeAddress('Abidjan, Côte d\'Ivoire');

      expect(result).not.toBeNull();
      expect(result?.latitude).toBe(5.359952);
      expect(result?.longitude).toBe(-4.008256);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('maps.googleapis.com')
      );
    });

    it('should return null when API key is not configured', async () => {
      delete process.env.GOOGLE_MAPS_API_KEY;
      delete process.env.GOOGLE_API_KEY;

      const result = await geocodeAddress('Abidjan');

      expect(result).toBeNull();
      expect(console.warn).toHaveBeenCalled();
    });

    it('should return null when API key starts with <', async () => {
      process.env.GOOGLE_MAPS_API_KEY = '<YOUR_API_KEY>';

      const result = await geocodeAddress('Abidjan');

      expect(result).toBeNull();
    });

    it('should return null when geocoding fails (ZERO_RESULTS)', async () => {
      const mockResponse = {
        status: 'ZERO_RESULTS',
        results: [],
      };

      (global.fetch as any).mockResolvedValue({
        json: async () => mockResponse,
      });

      const result = await geocodeAddress('Invalid Address 12345');

      expect(result).toBeNull();
      expect(console.warn).toHaveBeenCalled();
    });

    it('should return null when geocoding fails (OVER_QUERY_LIMIT)', async () => {
      const mockResponse = {
        status: 'OVER_QUERY_LIMIT',
        results: [],
      };

      (global.fetch as any).mockResolvedValue({
        json: async () => mockResponse,
      });

      const result = await geocodeAddress('Abidjan');

      expect(result).toBeNull();
    });

    it('should return null when geocoding fails (REQUEST_DENIED)', async () => {
      const mockResponse = {
        status: 'REQUEST_DENIED',
        results: [],
      };

      (global.fetch as any).mockResolvedValue({
        json: async () => mockResponse,
      });

      const result = await geocodeAddress('Abidjan');

      expect(result).toBeNull();
    });

    it('should encode address in URL', async () => {
      const mockResponse = {
        status: 'OK',
        results: [
          {
            geometry: {
              location: { lat: 5.359952, lng: -4.008256 },
            },
          },
        ],
      };

      (global.fetch as any).mockResolvedValue({
        json: async () => mockResponse,
      });

      await geocodeAddress('Abidjan, Côte d\'Ivoire');

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0][0];
      expect(fetchCall).toContain('address=');
      expect(fetchCall).toContain(encodeURIComponent('Abidjan, Côte d\'Ivoire'));
    });

    it('should include API key in request', async () => {
      const apiKey = 'test-api-key-123';
      process.env.GOOGLE_MAPS_API_KEY = apiKey;

      const mockResponse = {
        status: 'OK',
        results: [
          {
            geometry: {
              location: { lat: 5.359952, lng: -4.008256 },
            },
          },
        ],
      };

      (global.fetch as any).mockResolvedValue({
        json: async () => mockResponse,
      });

      await geocodeAddress('Abidjan');

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0][0];
      expect(fetchCall).toContain(`key=${apiKey}`);
    });

    it('should include language and region parameters', async () => {
      const mockResponse = {
        status: 'OK',
        results: [
          {
            geometry: {
              location: { lat: 5.359952, lng: -4.008256 },
            },
          },
        ],
      };

      (global.fetch as any).mockResolvedValue({
        json: async () => mockResponse,
      });

      await geocodeAddress('Abidjan');

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0][0];
      expect(fetchCall).toContain('language=fr');
      expect(fetchCall).toContain('region=ci');
    });

    it('should handle network errors', async () => {
      (global.fetch as any).mockRejectedValue(new Error('Network error'));

      const result = await geocodeAddress('Abidjan');

      expect(result).toBeNull();
      expect(console.error).toHaveBeenCalled();
    });

    it('should handle invalid JSON response', async () => {
      (global.fetch as any).mockResolvedValue({
        json: async () => {
          throw new Error('Invalid JSON');
        },
      });

      const result = await geocodeAddress('Abidjan');

      expect(result).toBeNull();
      expect(console.error).toHaveBeenCalled();
    });

    it('should use GOOGLE_API_KEY as fallback', async () => {
      delete process.env.GOOGLE_MAPS_API_KEY;
      process.env.GOOGLE_API_KEY = 'fallback-api-key';

      const mockResponse = {
        status: 'OK',
        results: [
          {
            geometry: {
              location: { lat: 5.359952, lng: -4.008256 },
            },
          },
        ],
      };

      (global.fetch as any).mockResolvedValue({
        json: async () => mockResponse,
      });

      const result = await geocodeAddress('Abidjan');

      expect(result).not.toBeNull();
      const fetchCall = (global.fetch as jest.Mock).mock.calls[0][0];
      expect(fetchCall).toContain('fallback-api-key');
    });

    it('should handle empty results array', async () => {
      const mockResponse = {
        status: 'OK',
        results: [],
      };

      (global.fetch as any).mockResolvedValue({
        json: async () => mockResponse,
      });

      const result = await geocodeAddress('Abidjan');

      expect(result).toBeNull();
    });

    it('should handle addresses with special characters', async () => {
      const mockResponse = {
        status: 'OK',
        results: [
          {
            geometry: {
              location: { lat: 5.359952, lng: -4.008256 },
            },
          },
        ],
      };

      (global.fetch as any).mockResolvedValue({
        json: async () => mockResponse,
      });

      const result = await geocodeAddress('Rue 123, Abidjan & Cocody');

      expect(result).not.toBeNull();
      const fetchCall = (global.fetch as jest.Mock).mock.calls[0][0];
      expect(fetchCall).toContain(encodeURIComponent('Rue 123, Abidjan & Cocody'));
    });
  });

  describe('Edge cases', () => {
    it('should handle very long addresses', async () => {
      const longAddress = 'A'.repeat(1000);
      const mockResponse = {
        status: 'OK',
        results: [
          {
            geometry: {
              location: { lat: 5.359952, lng: -4.008256 },
            },
          },
        ],
      };

      (global.fetch as any).mockResolvedValue({
        json: async () => mockResponse,
      });

      const result = await geocodeAddress(longAddress);

      expect(result).not.toBeNull();
    });

    it('should handle empty address string', async () => {
      const mockResponse = {
        status: 'ZERO_RESULTS',
        results: [],
      };

      (global.fetch as any).mockResolvedValue({
        json: async () => mockResponse,
      });

      const result = await geocodeAddress('');

      expect(result).toBeNull();
    });
  });
});

