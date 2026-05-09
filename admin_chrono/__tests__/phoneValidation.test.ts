import { describe, it, expect } from 'vitest';
import { isValidCIPhone, getPhoneValidationError } from '../utils/phoneValidation';

describe('isValidCIPhone', () => {
  it('accepte un numero Orange a 10 chiffres', () => {
    expect(isValidCIPhone('0712345678')).toBe(true);
  });

  it('accepte un numero MTN a 10 chiffres', () => {
    expect(isValidCIPhone('0512345678')).toBe(true);
  });

  it('accepte un numero Moov a 10 chiffres', () => {
    expect(isValidCIPhone('0112345678')).toBe(true);
  });

  it('accepte un numero avec indicatif 225', () => {
    expect(isValidCIPhone('225071234567')).toBe(true);
    expect(isValidCIPhone('22507123456789')).toBe(false); // trop long
  });

  it('rejette un numero avec mauvais prefixe', () => {
    expect(isValidCIPhone('0312345678')).toBe(false);
    expect(isValidCIPhone('0212345678')).toBe(false);
  });

  it('rejette un numero trop court', () => {
    expect(isValidCIPhone('071234')).toBe(false);
  });

  it('rejette une chaine vide', () => {
    expect(isValidCIPhone('')).toBe(false);
  });

  it('accepte un numero avec espaces et tirets (normalisation)', () => {
    expect(isValidCIPhone('07 12 34 56 78')).toBe(true);
    expect(isValidCIPhone('07-12-34-56-78')).toBe(true);
  });
});

describe('getPhoneValidationError', () => {
  it('retourne null pour un numero valide', () => {
    expect(getPhoneValidationError('0712345678')).toBeNull();
  });

  it('retourne null pour une entree vide (pas erreur bloquante)', () => {
    expect(getPhoneValidationError('')).toBeNull();
    expect(getPhoneValidationError('   ')).toBeNull();
  });

  it('retourne un message erreur pour un numero invalide', () => {
    const err = getPhoneValidationError('0312345678');
    expect(err).not.toBeNull();
    expect(typeof err).toBe('string');
    expect(err!.length).toBeGreaterThan(0);
  });
});
