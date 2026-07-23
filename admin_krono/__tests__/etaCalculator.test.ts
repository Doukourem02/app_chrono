import { describe, it, expect } from 'vitest';
import { calculateDistance, calculateETA } from '../utils/etaCalculator';

describe('calculateDistance', () => {
  it('retourne 0 pour deux points identiques', () => {
    const d = calculateDistance({ lat: 5.3165, lng: -4.0266 }, { lat: 5.3165, lng: -4.0266 });
    expect(d).toBe(0);
  });

  it('calcule la distance Plateau → Cocody (≈ 4 km)', () => {
    const d = calculateDistance(
      { lat: 5.3165, lng: -4.0266 }, // Plateau
      { lat: 5.3532, lng: -3.9851 }  // Cocody
    );
    expect(d).toBeGreaterThan(3000);
    expect(d).toBeLessThan(8000);
  });

  it('est symétrique (A→B == B→A)', () => {
    const a = { lat: 5.3165, lng: -4.0266 };
    const b = { lat: 5.3532, lng: -3.9851 };
    expect(calculateDistance(a, b)).toBeCloseTo(calculateDistance(b, a), 0);
  });
});

describe('calculateETA', () => {
  it('retourne 0 pour une distance nulle', () => {
    expect(calculateETA(0)).toBe(0);
  });

  it('retourne 0 pour une distance négative', () => {
    expect(calculateETA(-100)).toBe(0);
  });

  it('calcule correctement à vitesse par défaut (30 km/h)', () => {
    // 1 km à 30 km/h = 2 min
    expect(calculateETA(1000)).toBe(2);
  });

  it('calcule correctement avec vitesse personnalisée', () => {
    // 6 km à 60 km/h = 6 min
    expect(calculateETA(6000, 60)).toBe(6);
  });

  it('arrondit à la minute supérieure', () => {
    // 1500 m à 30 km/h = 3 min exactement
    expect(calculateETA(1500, 30)).toBe(3);
    // 1600 m à 30 km/h ≈ 3.2 min → 4
    expect(calculateETA(1600, 30)).toBe(4);
  });
});
