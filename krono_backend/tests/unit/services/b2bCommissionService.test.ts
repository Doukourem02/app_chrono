/**
 * Tests unitaires pour b2bCommissionService — calcul du taux de commission B2B appliqué
 * à chaque commande partenaire (grille v2 : Starter 5%/6%, Pro 3%/5%, Business 2%/3%,
 * voir docs/krono-reference-unique.md section 16) et incrément atomique de l'usage mensuel.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';

function makeBuilder(result: unknown) {
  const builder: any = {
    select: jest.fn(() => builder),
    eq: jest.fn(() => builder),
    order: jest.fn(() => builder),
    limit: jest.fn(() => builder),
    single: jest.fn(() => Promise.resolve(result)),
    maybeSingle: jest.fn(() => Promise.resolve(result)),
  };
  return builder;
}

const mockFrom = jest.fn();
const mockSupabaseClient = { from: mockFrom };

await jest.unstable_mockModule('../../../src/config/supabase.js', () => ({
  __esModule: true,
  supabase: mockSupabaseClient,
  supabaseAdmin: mockSupabaseClient,
  default: mockSupabaseClient,
}));

const mockPool = { query: jest.fn<(...args: any[]) => Promise<any>>() };
await jest.unstable_mockModule('../../../src/config/db.js', () => ({
  __esModule: true,
  default: mockPool,
}));

const { computeB2BCommission, incrementPartnerUsage } = await import(
  '../../../src/services/b2bCommissionService.js'
);

describe('b2bCommissionService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPool.query.mockReset();
  });

  describe('computeB2BCommission', () => {
    it('retombe sur partners.commission_rate si aucun abonnement actif', async () => {
      mockFrom
        .mockReturnValueOnce(makeBuilder({ data: null, error: null })) // partner_subscriptions
        .mockReturnValueOnce(makeBuilder({ data: { commission_rate: 0.07 }, error: null })); // partners

      const result = await computeB2BCommission('partner-1');

      expect(result).toEqual({
        rate: 0.07,
        type: 'no_subscription',
        subscriptionId: null,
        plan: null,
      });
    });

    it('applique le taux in-quota Pro (3%) quand le quota mensuel n’est pas dépassé', async () => {
      mockFrom
        .mockReturnValueOnce(
          makeBuilder({
            data: { id: 'sub-1', plan: 'pro', included_orders: 70, excess_commission_rate: 0.05 },
            error: null,
          })
        )
        .mockReturnValueOnce(makeBuilder({ data: { deliveries_count: 10 }, error: null }));

      const result = await computeB2BCommission('partner-1');

      expect(result).toEqual({
        rate: 0.03,
        type: 'in_quota',
        subscriptionId: 'sub-1',
        plan: 'pro',
      });
    });

    it('applique le taux au-delà du quota (excess_commission_rate) une fois le quota Pro atteint', async () => {
      mockFrom
        .mockReturnValueOnce(
          makeBuilder({
            data: { id: 'sub-1', plan: 'pro', included_orders: 70, excess_commission_rate: 0.05 },
            error: null,
          })
        )
        .mockReturnValueOnce(makeBuilder({ data: { deliveries_count: 70 }, error: null }));

      const result = await computeB2BCommission('partner-1');

      expect(result).toEqual({
        rate: 0.05,
        type: 'excess',
        subscriptionId: 'sub-1',
        plan: 'pro',
      });
    });

    it('applique le taux in-quota Business (2%) sans usage enregistré ce mois-ci', async () => {
      mockFrom
        .mockReturnValueOnce(
          makeBuilder({
            data: { id: 'sub-2', plan: 'business', included_orders: 110, excess_commission_rate: 0.03 },
            error: null,
          })
        )
        .mockReturnValueOnce(makeBuilder({ data: null, error: null })); // pas de ligne partner_usage encore

      const result = await computeB2BCommission('partner-2');

      expect(result).toEqual({
        rate: 0.02,
        type: 'in_quota',
        subscriptionId: 'sub-2',
        plan: 'business',
      });
    });
  });

  describe('incrementPartnerUsage', () => {
    it('exécute un upsert atomique ON CONFLICT sur (partner_id, month)', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] } as any);

      await incrementPartnerUsage('partner-1');

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('ON CONFLICT (partner_id, month)'),
        expect.arrayContaining(['partner-1'])
      );
    });

    it('ne lève pas si la requête échoue (ne doit jamais bloquer la commande)', async () => {
      mockPool.query.mockRejectedValueOnce(new Error('db down'));

      await expect(incrementPartnerUsage('partner-1')).resolves.toBeUndefined();
    });
  });
});
