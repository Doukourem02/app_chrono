import { describe, it, expect } from 'vitest';
import { rateLimit, getRateLimitIdentifier } from '../lib/rateLimit';

// Pas de REDIS_URL en environnement de test → repli automatique sur le store mémoire.

describe('rateLimit (fallback mémoire)', () => {
  it('autorise les requêtes tant que la limite n\'est pas atteinte', async () => {
    const identifier = `test-${Date.now()}-${Math.random()}`;

    const first = await rateLimit(identifier, 3, 60);
    expect(first.success).toBe(true);
    expect(first.remaining).toBe(2);

    const second = await rateLimit(identifier, 3, 60);
    expect(second.success).toBe(true);
    expect(second.remaining).toBe(1);
  });

  it('bloque après avoir dépassé la limite', async () => {
    const identifier = `test-${Date.now()}-${Math.random()}`;

    await rateLimit(identifier, 2, 60);
    await rateLimit(identifier, 2, 60);
    const third = await rateLimit(identifier, 2, 60);

    expect(third.success).toBe(false);
    expect(third.remaining).toBe(0);
  });

  it('isole les compteurs par identifiant', async () => {
    const idA = `test-a-${Date.now()}`;
    const idB = `test-b-${Date.now()}`;

    await rateLimit(idA, 1, 60);
    const blockedA = await rateLimit(idA, 1, 60);
    const okB = await rateLimit(idB, 1, 60);

    expect(blockedA.success).toBe(false);
    expect(okB.success).toBe(true);
  });
});

describe('getRateLimitIdentifier', () => {
  it("extrait la première IP de x-forwarded-for", () => {
    const request = new Request('http://localhost', {
      headers: { 'x-forwarded-for': '203.0.113.5, 10.0.0.1' },
    });
    expect(getRateLimitIdentifier(request)).toBe('203.0.113.5');
  });

  it("renvoie 'unknown' si aucune IP n'est fournie", () => {
    const request = new Request('http://localhost');
    expect(getRateLimitIdentifier(request)).toBe('unknown');
  });
});
