import { describe, it, expect } from 'vitest';
import formatDeliveryId from '../utils/formatDeliveryId';

describe('formatDeliveryId', () => {
  it('genere un ID avec le prefixe KRLV', () => {
    const id = formatDeliveryId('abc123', '2024-03-15');
    expect(id).toMatch(/^KRLV–/);
  });

  it('inclut la date au format AAMMJJ', () => {
    const id = formatDeliveryId('abc123', '2024-03-15');
    expect(id).toContain('240315');
  });

  it('utilise les 4 derniers caracteres de l_id comme suffixe', () => {
    const id = formatDeliveryId('abcdef', '2024-01-01');
    expect(id).toContain('CDEF');
  });

  it('remplit le suffixe avec des zeros si l_id est court', () => {
    const id = formatDeliveryId('ab', '2024-01-01');
    expect(id).toContain('AB00');
  });

  it('fonctionne sans date (utilise la date courante)', () => {
    const id = formatDeliveryId('test1234');
    expect(id).toMatch(/^KRLV–\d{6}-[A-Z0-9]{4}$/);
  });

  it('fonctionne sans arguments (valeurs par defaut)', () => {
    const id = formatDeliveryId();
    expect(id).toMatch(/^KRLV–\d{6}-\d{4}$/);
  });

  it('accepte un objet Date', () => {
    const date = new Date('2025-12-25');
    const id = formatDeliveryId('XXXX', date);
    expect(id).toContain('251225');
  });

  it('gere une date invalide sans planter', () => {
    const id = formatDeliveryId('XXXX', 'not-a-date');
    expect(id).toMatch(/^KRLV–/);
  });
});
