import { describe, it, expect } from '@jest/globals';
import { toE164CI } from '../../utils/e164Phone';
import { getPhoneValidationError } from '../../utils/phoneValidation';
import { formatNationalIvorian, parseNationalIvorianInput } from '../../utils/formatNationalPhone';

describe('toE164CI', () => {
  describe('numéros valides', () => {
    it('accepte un numéro 07 national (10 chiffres)', () => {
      expect(toE164CI('0708090001')).toBe('+2250708090001');
    });

    it('accepte un numéro 05 national', () => {
      expect(toE164CI('0512345678')).toBe('+2250512345678');
    });

    it('accepte un numéro 01 national', () => {
      expect(toE164CI('0123456789')).toBe('+2250123456789');
    });

    it('accepte le format +225 suivi de 10 chiffres', () => {
      expect(toE164CI('+2250708090001')).toBe('+2250708090001');
    });

    it('accepte le format 225 suivi de 13 chiffres sans +', () => {
      expect(toE164CI('2250708090001')).toBe('+2250708090001');
    });
  });

  describe('numéros invalides', () => {
    it('rejette un numéro vide', () => {
      expect(toE164CI('')).toBeNull();
    });

    it('rejette un préfixe non mobile CI (03)', () => {
      expect(toE164CI('0312345678')).toBeNull();
    });

    it('rejette un numéro trop court', () => {
      expect(toE164CI('070809')).toBeNull();
    });

    it('rejette du texte aléatoire', () => {
      expect(toE164CI('abcdefghij')).toBeNull();
    });
  });
});

describe('getPhoneValidationError', () => {
  it('retourne null pour un numéro E.164 valide', () => {
    expect(getPhoneValidationError('+2250708090001')).toBeNull();
  });

  it('retourne null pour un numéro national valide', () => {
    expect(getPhoneValidationError('0708090001')).toBeNull();
  });

  it('retourne null pour une chaîne vide', () => {
    expect(getPhoneValidationError('')).toBeNull();
  });

  it('retourne un message d\'erreur pour un préfixe non CI', () => {
    expect(getPhoneValidationError('0312345678')).toBe('Numéro invalide.');
  });

  it('retourne un message d\'erreur pour du texte', () => {
    expect(getPhoneValidationError('numero-invalide')).toBe('Numéro invalide.');
  });
});

describe('formatNationalIvorian', () => {
  it('formate 10 chiffres en "XX XX X XXXXX"', () => {
    expect(formatNationalIvorian('0708090001')).toBe('07 08 0 90001');
  });

  it('formate 2 chiffres sans espace', () => {
    expect(formatNationalIvorian('07')).toBe('07');
  });

  it('formate 4 chiffres avec un espace', () => {
    expect(formatNationalIvorian('0708')).toBe('07 08');
  });

  it('ignore les caractères non numériques', () => {
    expect(formatNationalIvorian('07-08-09')).toBe('07 08 0 9');
  });

  it('retourne une chaîne vide pour une entrée vide', () => {
    expect(formatNationalIvorian('')).toBe('');
  });

  it('limite à 10 chiffres même si plus sont fournis', () => {
    expect(formatNationalIvorian('07080900012345')).toBe('07 08 0 90001');
  });
});

describe('parseNationalIvorianInput', () => {
  it('extrait les chiffres d\'un format avec espaces', () => {
    expect(parseNationalIvorianInput('07 08 09 00 01')).toBe('0708090001');
  });

  it('supprime le préfixe 225 si présent', () => {
    expect(parseNationalIvorianInput('2250708090001')).toBe('0708090001');
  });

  it('limite à 10 chiffres', () => {
    expect(parseNationalIvorianInput('070809000112345')).toBe('0708090001');
  });

  it('retourne une chaîne vide pour une entrée vide', () => {
    expect(parseNationalIvorianInput('')).toBe('');
  });

  it('ignore les tirets et autres séparateurs', () => {
    expect(parseNationalIvorianInput('07-08-09-00-01')).toBe('0708090001');
  });
});
