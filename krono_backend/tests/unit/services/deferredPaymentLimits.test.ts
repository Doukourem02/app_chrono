/**
 * Tests unitaires pour deferredPaymentLimits — règles métier du paiement différé
 * (montant minimum, limite mensuelle/annuelle, blocage après 3 retards).
 * Couvre canUseDeferredPayment et calculateMonthlyCreditAvailable, les deux points
 * d'entrée qui protègent Krono contre un crédit différé mal utilisé.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';

const mockPool = { query: jest.fn<(...args: any[]) => Promise<any>>() };
await jest.unstable_mockModule('../../../src/config/db.js', () => ({
  __esModule: true,
  default: mockPool,
}));

const { canUseDeferredPayment, calculateMonthlyCreditAvailable } = await import(
  '../../../src/utils/deferredPaymentLimits.js'
);

function lateRow(total: number, d30 = total, d90 = total) {
  return { rows: [{ count_30_days: String(d30), count_90_days: String(d90), total_count: String(total) }] };
}

describe('deferredPaymentLimits', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPool.query.mockReset();
  });

  describe('canUseDeferredPayment', () => {
    it('rejette un montant sous le minimum (2 000 FCFA) sans toucher la base', async () => {
      const result = await canUseDeferredPayment('user-1', 1000);

      expect(result).toEqual(
        expect.objectContaining({ canUse: false, errorCode: 'MIN_AMOUNT_NOT_REACHED' })
      );
      expect(mockPool.query).not.toHaveBeenCalled();
    });

    it('bloque un utilisateur ayant 3 retards ou plus dans les 90 derniers jours', async () => {
      const tenDaysAgo = new Date();
      tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);

      mockPool.query
        .mockResolvedValueOnce(lateRow(3)) // checkLatePayments — compteurs
        .mockResolvedValueOnce({ rows: [{ last_late_date: tenDaysAgo.toISOString() }] }); // date du dernier retard

      const result = await canUseDeferredPayment('user-1', 3000);

      expect(result.canUse).toBe(false);
      expect(result.errorCode).toBe('DEFERRED_PAYMENT_BLOCKED');
      expect(mockPool.query).toHaveBeenCalledTimes(2);
    });

    it('rejette si le montant dépasse le crédit mensuel restant', async () => {
      mockPool.query
        .mockResolvedValueOnce(lateRow(0)) // checkLatePayments (1er appel, direct)
        .mockResolvedValueOnce(lateRow(0)) // checkLatePayments (2e appel, via calculateMonthlyCreditAvailable)
        .mockResolvedValueOnce({ rows: [{ total: '3500' }] }); // calculateMonthlyCreditUsed → 3500/5000 déjà utilisés

      const result = await canUseDeferredPayment('user-1', 2000);

      expect(result.canUse).toBe(false);
      expect(result.errorCode).toBe('MONTHLY_CREDIT_INSUFFICIENT');
      expect(result.details?.monthlyRemaining).toBe(1500);
    });

    it('autorise un montant qui respecte toutes les limites (chemin nominal)', async () => {
      mockPool.query
        .mockResolvedValueOnce(lateRow(0)) // checkLatePayments direct
        .mockResolvedValueOnce(lateRow(0)) // checkLatePayments via calculateMonthlyCreditAvailable
        .mockResolvedValueOnce({ rows: [{ total: '0' }] }) // calculateMonthlyCreditUsed
        .mockResolvedValueOnce({ rows: [{ count: '0' }] }) // getDeferredPaymentUsageCount
        .mockResolvedValueOnce({ rows: [{ last_date: null }] }) // getLastDeferredPaymentDate
        .mockResolvedValueOnce({ rows: [{ total: '0' }] }); // calculateAnnualCreditUsed

      const result = await canUseDeferredPayment('user-1', 3000);

      expect(result).toEqual({ canUse: true });
    });
  });

  describe('calculateMonthlyCreditAvailable', () => {
    it('renvoie le crédit plein (5 000 FCFA) sans retard de paiement', async () => {
      mockPool.query.mockResolvedValueOnce(lateRow(0));

      const result = await calculateMonthlyCreditAvailable('user-1');

      expect(result.finalCredit).toBe(5000);
      expect(result.reason).toBeUndefined();
    });

    it('réduit le crédit de 2 000 FCFA après 1 retard dans les 30 derniers jours', async () => {
      mockPool.query.mockResolvedValueOnce(lateRow(1));

      const result = await calculateMonthlyCreditAvailable('user-1');

      expect(result.finalCredit).toBe(3000);
      expect(result.reason).toContain('30 derniers jours');
    });

    it('réduit le crédit de 3 000 FCFA après 2 retards dans les 90 derniers jours', async () => {
      // 2 retards sur 90j mais aucun sur les 30 derniers jours -> branche "TWO_LATE_90_DAYS"
      mockPool.query.mockResolvedValueOnce(lateRow(2, 0, 2));

      const result = await calculateMonthlyCreditAvailable('user-1');

      expect(result.finalCredit).toBe(2000);
      expect(result.reason).toContain('90 derniers jours');
    });
  });
});
