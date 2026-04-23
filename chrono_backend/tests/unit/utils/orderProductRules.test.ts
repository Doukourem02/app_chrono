import { describe, expect, it } from '@jest/globals';
import {
  clientHeadline,
  clientStatusLabel,
  normalizeProductStatus,
  payerPushCopy,
  progressWithEtaCap,
  publicTrackCopy,
  recipientPushCopy,
  statusBaseProgress,
} from '../../../src/utils/orderProductRules.js';

describe('orderProductRules', () => {
  it('normalise les alias de statuts connus', () => {
    expect(normalizeProductStatus('IN PROGRESS')).toBe('in_progress');
    expect(normalizeProductStatus('picked-up')).toBe('picked_up');
    expect(normalizeProductStatus('canceled')).toBe('cancelled');
  });

  it('produit les libellés client sans termes vagues', () => {
    expect(clientHeadline('pending')).toBe('Recherche livreur');
    expect(clientHeadline('accepted', '4')).toBe('Prise en charge dans 4 min');
    expect(clientHeadline('accepted')).toBe('Prise en charge');
    expect(clientHeadline('picked_up', '9 min')).toBe('Livraison dans 9 min');
    expect(clientHeadline('picked_up')).toBe('Livraison en cours');
    expect(clientStatusLabel('in_progress')).toBe('Livreur arrivé');
    expect(clientStatusLabel('completed')).toBe('Livraison terminée');
  });

  it('aligne push payeur, destinataire et tracking public', () => {
    expect(payerPushCopy('enroute')?.title).toBe('Prise en charge');
    expect(recipientPushCopy('delivering')?.title).toBe('Livraison en cours');
    expect(publicTrackCopy('in_progress')?.title).toBe('Livreur arrivé');
  });

  it('garde la progression cohérente avec les minutes affichées', () => {
    expect(statusBaseProgress('delivering')).toBe(0.88);
    expect(progressWithEtaCap('delivering', 0.95, '5 min')).toBeLessThanOrEqual(0.74);
    expect(progressWithEtaCap('enroute', 0.9, '9 min')).toBeLessThanOrEqual(0.54);
    expect(progressWithEtaCap('completed', 0.2, '')).toBe(1);
  });
});
