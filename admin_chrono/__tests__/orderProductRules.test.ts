import { describe, it, expect } from 'vitest';
import { publicTrackStatusTitle, PUBLIC_TRACK_FLOW_STEPS } from '../lib/orderProductRules';

describe('PUBLIC_TRACK_FLOW_STEPS', () => {
  it('contient au moins les statuts principaux', () => {
    const statuses = PUBLIC_TRACK_FLOW_STEPS.map((s) => s.status);
    expect(statuses).toContain('pending');
    expect(statuses).toContain('picked_up');
    expect(statuses).toContain('completed');
  });

  it('chaque étape a un titre et un body non vides', () => {
    for (const step of PUBLIC_TRACK_FLOW_STEPS) {
      expect(step.title.length).toBeGreaterThan(0);
      expect(step.body.length).toBeGreaterThan(0);
    }
  });
});

describe('publicTrackStatusTitle', () => {
  it('retourne le titre pour un statut connu', () => {
    const title = publicTrackStatusTitle('pending');
    expect(title).toBe('Recherche livreur');
  });

  it('retourne le bon titre pour picked_up', () => {
    expect(publicTrackStatusTitle('picked_up')).toBe('Colis récupéré');
  });

  it('retourne le bon titre pour completed', () => {
    expect(publicTrackStatusTitle('completed')).toBe('Livraison terminée');
  });

  it('retourne le titre pour cancelled', () => {
    expect(publicTrackStatusTitle('cancelled')).toBe('Commande annulée');
  });

  it('retourne le titre pour declined', () => {
    expect(publicTrackStatusTitle('declined')).toBe('Commande refusée');
  });

  it('retourne un fallback pour un statut inconnu', () => {
    const title = publicTrackStatusTitle('unknown_status');
    expect(typeof title).toBe('string');
    expect(title.length).toBeGreaterThan(0);
  });
});
