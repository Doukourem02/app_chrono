/**
 * Tests unitaires pour phoneE164CI (normalisation numéros CI)
 */
import { describe, it, expect } from '@jest/globals';
import {
  toE164CI,
  phoneDigitsKey,
  buildPhoneLookupDigitKeys,
  buildPhoneLookupDigitSuffixKeys,
} from '../../../src/utils/phoneE164CI.js';

describe('toE164CI', () => {
  describe('numéros nationaux valides (10 chiffres)', () => {
    it('normalise un 07 national', () => {
      expect(toE164CI('0708090001')).toBe('+2250708090001');
    });

    it('normalise un 05 national', () => {
      expect(toE164CI('0512345678')).toBe('+2250512345678');
    });

    it('normalise un 01 national', () => {
      expect(toE164CI('0123456789')).toBe('+2250123456789');
    });
  });

  describe('format E.164 en entrée', () => {
    it('accepte +225 suivi de 10 chiffres', () => {
      expect(toE164CI('+2250708090001')).toBe('+2250708090001');
    });

    it('accepte 225 sans + suivi de 10 chiffres (13 chiffres total)', () => {
      expect(toE164CI('2250708090001')).toBe('+2250708090001');
    });

    it('accepte 225 suivi de 9 chiffres sans le 0 (12 chiffres)', () => {
      expect(toE164CI('225708090001')).toBe('+2250708090001');
    });
  });

  describe('numéros invalides', () => {
    it('retourne null pour une chaîne vide', () => {
      expect(toE164CI('')).toBeNull();
    });

    it('retourne null pour un préfixe non mobile CI (03)', () => {
      expect(toE164CI('0312345678')).toBeNull();
    });

    it('retourne null pour un numéro trop court', () => {
      expect(toE164CI('07123')).toBeNull();
    });

    it('retourne null pour du texte aléatoire', () => {
      expect(toE164CI('abcdefghij')).toBeNull();
    });
  });
});

describe('phoneDigitsKey', () => {
  it('extrait uniquement les chiffres', () => {
    expect(phoneDigitsKey('+225 07 08 09 00 01')).toBe('2250708090001');
  });

  it('retourne une chaîne vide pour une entrée vide', () => {
    expect(phoneDigitsKey('')).toBe('');
  });

  it('ignore les tirets, parenthèses et espaces', () => {
    expect(phoneDigitsKey('(+225) 07-08-09')).toBe('225070809');
  });
});

describe('buildPhoneLookupDigitKeys', () => {
  it('retourne les formes numériques d\'un numéro national valide', () => {
    const keys = buildPhoneLookupDigitKeys('0708090001');
    expect(keys).toContain('0708090001');
    expect(keys).toContain('2250708090001');
  });

  it('retourne un tableau vide pour une chaîne vide', () => {
    expect(buildPhoneLookupDigitKeys('')).toEqual([]);
  });

  it('ne contient pas de doublons', () => {
    const keys = buildPhoneLookupDigitKeys('+2250708090001');
    const unique = new Set(keys);
    expect(keys.length).toBe(unique.size);
  });

  it('retourne uniquement les chiffres bruts pour un numéro non normalisable', () => {
    // La fonction inclut les chiffres bruts même si toE164CI retourne null
    const keys = buildPhoneLookupDigitKeys('0312345678');
    expect(keys).toContain('0312345678');
    expect(keys).not.toContain('2250312345678'); // pas de préfixe 225 car toE164CI retourne null
  });
});

describe('buildPhoneLookupDigitSuffixKeys', () => {
  it('extrait les 10 derniers chiffres d\'une clé E.164', () => {
    const result = buildPhoneLookupDigitSuffixKeys(['2250708090001']);
    expect(result).toContain('0708090001');
  });

  it('retourne un tableau vide pour une entrée vide', () => {
    expect(buildPhoneLookupDigitSuffixKeys([])).toEqual([]);
  });

  it('ignore les clés de moins de 10 chiffres', () => {
    expect(buildPhoneLookupDigitSuffixKeys(['12345'])).toEqual([]);
  });

  it('ne contient pas de doublons', () => {
    const result = buildPhoneLookupDigitSuffixKeys([
      '2250708090001',
      '0708090001',
    ]);
    const unique = new Set(result);
    expect(result.length).toBe(unique.size);
  });
});
