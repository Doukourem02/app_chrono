import { Request, Response } from 'express';
import { supabase, supabaseAdmin } from '../config/supabase.js';
import logger from '../utils/logger.js';

const db = () => supabaseAdmin ?? supabase;

const PLAN_DEFAULTS: Record<string, { monthly_price: number; included_orders: number | null; excess_commission_rate: number }> = {
  starter:  { monthly_price: 15000, included_orders: 50,   excess_commission_rate: 0.20 },
  pro:      { monthly_price: 40000, included_orders: 200,  excess_commission_rate: 0.15 },
  business: { monthly_price: 100000, included_orders: null, excess_commission_rate: 0.10 },
};

// ─── POST /api/partners — admin only ─────────────────────────────────────────
export const createPartner = async (req: Request, res: Response): Promise<void> => {
  const { name, email, phone, commission_rate, notes } = req.body as {
    name: string;
    email?: string;
    phone?: string;
    commission_rate?: number;
    notes?: string;
  };

  if (!name?.trim()) {
    res.status(400).json({ success: false, message: 'Le champ name est requis' });
    return;
  }

  const { data, error } = await db()
    .from('partners')
    .insert({
      name: name.trim(),
      email: email?.trim() ?? null,
      phone: phone?.trim() ?? null,
      commission_rate: commission_rate ?? 0.20,
      notes: notes?.trim() ?? null,
    })
    .select()
    .single();

  if (error) {
    logger.error('[partnerController] createPartner error:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la création du partenaire' });
    return;
  }

  res.status(201).json({ success: true, data });
};

// ─── GET /api/partners — admin only ──────────────────────────────────────────
export const listPartners = async (req: Request, res: Response): Promise<void> => {
  const { status, plan } = req.query;

  let query = db().from('partners').select('*').order('created_at', { ascending: false });

  if (status) query = query.eq('status', status as string);
  if (plan)   query = query.eq('plan', plan as string);

  const { data, error } = await query;

  if (error) {
    logger.error('[partnerController] listPartners error:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la récupération des partenaires' });
    return;
  }

  res.json({ success: true, data });
};

// ─── GET /api/partners/:id — admin or partner ─────────────────────────────────
export const getPartner = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  const [partnerRes, subRes, usageRes] = await Promise.all([
    db().from('partners').select('*').eq('id', id).single(),
    db()
      .from('partner_subscriptions')
      .select('*')
      .eq('partner_id', id)
      .eq('is_active', true)
      .maybeSingle(),
    db()
      .from('partner_usage')
      .select('deliveries_count, month')
      .eq('partner_id', id)
      .order('month', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (partnerRes.error || !partnerRes.data) {
    res.status(404).json({ success: false, message: 'Partenaire introuvable' });
    return;
  }

  res.json({
    success: true,
    data: {
      ...partnerRes.data,
      active_subscription: subRes.data ?? null,
      current_usage: usageRes.data ?? null,
    },
  });
};

// ─── POST /api/partners/:id/subscriptions — admin only ───────────────────────
// Crée un abonnement (payment_status = pending_payment, is_active = false)
export const createSubscription = async (req: Request, res: Response): Promise<void> => {
  const { id: partnerId } = req.params;
  const { plan, starts_at } = req.body as { plan: string; starts_at?: string };

  if (!plan || !PLAN_DEFAULTS[plan]) {
    res.status(400).json({
      success: false,
      message: `Plan invalide. Valeurs acceptées : ${Object.keys(PLAN_DEFAULTS).join(', ')}`,
    });
    return;
  }

  const defaults = PLAN_DEFAULTS[plan]!;

  const { data, error } = await db()
    .from('partner_subscriptions')
    .insert({
      partner_id: partnerId,
      plan,
      monthly_price: defaults.monthly_price,
      included_orders: defaults.included_orders,
      excess_commission_rate: defaults.excess_commission_rate,
      starts_at: starts_at ?? new Date().toISOString(),
      payment_status: 'pending_payment',
      is_active: false,
    })
    .select()
    .single();

  if (error) {
    logger.error('[partnerController] createSubscription error:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la création de l\'abonnement' });
    return;
  }

  res.status(201).json({ success: true, data });
};

// ─── PATCH /api/partners/:id/subscriptions/:subId/activate — admin only ──────
// Valide le paiement manuel → active les droits
export const activateSubscription = async (req: Request, res: Response): Promise<void> => {
  const { id: partnerId, subId } = req.params;

  // Désactiver tout abonnement précédemment actif
  await db()
    .from('partner_subscriptions')
    .update({ is_active: false })
    .eq('partner_id', partnerId)
    .eq('is_active', true)
    .neq('id', subId);

  const { data, error } = await db()
    .from('partner_subscriptions')
    .update({ payment_status: 'active', is_active: true })
    .eq('id', subId)
    .eq('partner_id', partnerId)
    .select()
    .single();

  if (error || !data) {
    res.status(404).json({ success: false, message: 'Abonnement introuvable' });
    return;
  }

  // Mettre à jour le plan sur le partenaire
  await db().from('partners').update({ plan: data.plan }).eq('id', partnerId);

  res.json({ success: true, data });
};

// ─── GET /api/partners/:id/usage — admin or partner ───────────────────────────
export const getPartnerUsage = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  const month = new Date();
  month.setDate(1);
  const monthStr = month.toISOString().slice(0, 10);

  const [usageRes, subRes] = await Promise.all([
    db()
      .from('partner_usage')
      .select('deliveries_count, month')
      .eq('partner_id', id)
      .eq('month', monthStr)
      .maybeSingle(),
    db()
      .from('partner_subscriptions')
      .select('plan, included_orders, payment_status')
      .eq('partner_id', id)
      .eq('is_active', true)
      .maybeSingle(),
  ]);

  const count = usageRes.data?.deliveries_count ?? 0;
  const included: number | null = subRes.data?.included_orders ?? null;

  res.json({
    success: true,
    data: {
      month: monthStr,
      deliveries_count: count,
      quota: included,
      remaining: included !== null ? Math.max(0, included - count) : null,
      over_quota: included !== null ? count > included : false,
      plan: subRes.data?.plan ?? null,
    },
  });
};

// ─── GET /api/partners/:id/invoices — admin or partner ────────────────────────
export const getPartnerInvoices = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  const { data, error } = await db()
    .from('partner_invoices')
    .select('*')
    .eq('partner_id', id)
    .order('period_start', { ascending: false });

  if (error) {
    logger.error('[partnerController] getPartnerInvoices error:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la récupération des factures' });
    return;
  }

  res.json({ success: true, data });
};
