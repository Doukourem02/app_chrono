import pool from '../config/db.js';
import { supabase, supabaseAdmin } from '../config/supabase.js';
import logger from '../utils/logger.js';

// Taux in-quota = excess_commission_rate - 3% (écart constant récompensant le quota)
// Starter 6%→3%, Pro 5%→2%, Business 3%→0%
const QUOTA_COMMISSION: Record<string, number> = {
  starter:  0.03,
  pro:      0.02,
  business: 0.00,
};

const db = () => supabaseAdmin ?? supabase;

export interface CommissionResult {
  rate: number;
  type: 'in_quota' | 'excess' | 'no_subscription';
  subscriptionId: string | null;
  plan: string | null;
}

export async function computeB2BCommission(partnerId: string): Promise<CommissionResult> {
  // Active subscription for this partner
  const { data: sub, error: subErr } = await db()
    .from('partner_subscriptions')
    .select('id, plan, included_orders, excess_commission_rate')
    .eq('partner_id', partnerId)
    .eq('is_active', true)
    .eq('payment_status', 'active')
    .order('starts_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (subErr) logger.warn('[b2bCommission] Error fetching subscription:', subErr.message);

  if (!sub) {
    const { data: partner } = await db()
      .from('partners')
      .select('commission_rate')
      .eq('id', partnerId)
      .single();

    return {
      rate: Number(partner?.commission_rate ?? 0),
      type: 'no_subscription',
      subscriptionId: null,
      plan: null,
    };
  }

  // Current month usage (1st of month, DATE type)
  const month = new Date();
  month.setDate(1);
  const monthStr = month.toISOString().slice(0, 10);

  const { data: usage } = await db()
    .from('partner_usage')
    .select('deliveries_count')
    .eq('partner_id', partnerId)
    .eq('month', monthStr)
    .maybeSingle();

  const count = usage?.deliveries_count ?? 0;
  const included: number | null = sub.included_orders ?? null;
  const overQuota = included !== null && count >= included;

  if (overQuota) {
    return {
      rate: Number(sub.excess_commission_rate),
      type: 'excess',
      subscriptionId: sub.id as string,
      plan: sub.plan as string,
    };
  }

  return {
    rate: QUOTA_COMMISSION[sub.plan as string] ?? 0.05,
    type: 'in_quota',
    subscriptionId: sub.id as string,
    plan: sub.plan as string,
  };
}

// Atomic upsert via raw SQL to avoid race conditions
export async function incrementPartnerUsage(partnerId: string): Promise<void> {
  const month = new Date();
  month.setDate(1);
  const monthStr = month.toISOString().slice(0, 10);

  try {
    await (pool as any).query(
      `INSERT INTO partner_usage (partner_id, month, deliveries_count)
       VALUES ($1, $2, 1)
       ON CONFLICT (partner_id, month)
       DO UPDATE SET deliveries_count = partner_usage.deliveries_count + 1`,
      [partnerId, monthStr]
    );
  } catch (err) {
    logger.error('[b2bCommission] Failed to increment partner_usage:', err);
  }
}
