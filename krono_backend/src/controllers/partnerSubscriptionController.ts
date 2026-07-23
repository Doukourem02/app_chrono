import { Request, Response } from 'express';
import logger from '../utils/logger.js';
import { db, PLAN_DEFAULTS, readPartnerPaymentInput } from './partnerControllerUtils.js';

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
    res.status(500).json({ success: false, message: "Erreur lors de la création de l'abonnement" });
    return;
  }

  res.status(201).json({ success: true, data });
};

export const activateSubscription = async (req: Request, res: Response): Promise<void> => {
  const { id: partnerId, subId } = req.params;

  const current = await db()
    .from('partner_subscriptions')
    .select('*')
    .eq('id', subId)
    .eq('partner_id', partnerId)
    .maybeSingle();

  if (current.error || !current.data) {
    res.status(404).json({ success: false, message: 'Abonnement introuvable' });
    return;
  }

  const payment = readPartnerPaymentInput(req.body ?? {}, {
    defaultAmount: Number(current.data.monthly_price ?? 0),
    requireMethod: false,
  });
  if (payment.error) {
    res.status(400).json({ success: false, message: payment.error });
    return;
  }

  await db()
    .from('partner_subscriptions')
    .update({ is_active: false })
    .eq('partner_id', partnerId)
    .eq('is_active', true)
    .neq('id', subId);

  const { data, error } = await db()
    .from('partner_subscriptions')
    .update({
      payment_status: 'active',
      is_active: true,
      payment_method_type: payment.data?.payment_method_type ?? null,
      payment_provider_account: payment.data?.payment_provider_account ?? null,
      payment_reference: payment.data?.payment_reference ?? null,
      payment_amount: payment.data?.payment_amount ?? Number(current.data.monthly_price ?? 0),
      paid_at: payment.data?.paid_at ?? new Date().toISOString(),
      payment_notes: payment.data?.payment_notes ?? null,
    })
    .eq('id', subId)
    .eq('partner_id', partnerId)
    .select()
    .single();

  if (error || !data) {
    res.status(404).json({ success: false, message: 'Abonnement introuvable' });
    return;
  }

  await db().from('partners').update({ plan: data.plan }).eq('id', partnerId);

  res.json({ success: true, data });
};

export const markPartnerInvoicePaid = async (req: Request, res: Response): Promise<void> => {
  const { id: partnerId, invoiceId } = req.params;

  const invoice = await db()
    .from('partner_invoices')
    .select('*')
    .eq('id', invoiceId)
    .eq('partner_id', partnerId)
    .maybeSingle();

  if (invoice.error || !invoice.data) {
    res.status(404).json({ success: false, message: 'Facture introuvable' });
    return;
  }

  const payment = readPartnerPaymentInput(req.body ?? {}, {
    defaultAmount: Number(invoice.data.amount ?? 0),
    requireMethod: true,
  });
  if (payment.error || !payment.data) {
    res.status(400).json({ success: false, message: payment.error ?? 'Paiement invalide' });
    return;
  }

  const { data, error } = await db()
    .from('partner_invoices')
    .update({
      status: 'paid',
      paid_at: payment.data.paid_at,
      payment_method_type: payment.data.payment_method_type,
      payment_provider_account: payment.data.payment_provider_account,
      payment_reference: payment.data.payment_reference,
      payment_amount: payment.data.payment_amount ?? Number(invoice.data.amount ?? 0),
      payment_notes: payment.data.payment_notes,
    })
    .eq('id', invoiceId)
    .eq('partner_id', partnerId)
    .select()
    .single();

  if (error || !data) {
    logger.error('[partnerController] markPartnerInvoicePaid error:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la validation du paiement' });
    return;
  }

  res.json({ success: true, data });
};

export const getPartnerUsage = async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id ?? req.params.partnerId;

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

export const getPartnerInvoices = async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id ?? req.params.partnerId;

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
