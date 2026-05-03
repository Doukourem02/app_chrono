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

// ─── POST /api/partners/:id/invite — admin only ───────────────────────────────
// Crée un compte Supabase pour le partenaire + envoie le mail d'invitation
export const invitePartnerUser = async (req: Request, res: Response): Promise<void> => {
  const { id: partnerId } = req.params;
  const { email, role = 'owner' } = req.body as { email: string; role?: 'owner' | 'manager' };

  if (!email?.trim()) {
    res.status(400).json({ success: false, message: 'Email requis' });
    return;
  }
  if (!['owner', 'manager'].includes(role)) {
    res.status(400).json({ success: false, message: 'Rôle invalide (owner | manager)' });
    return;
  }

  if (!supabaseAdmin) {
    res.status(500).json({ success: false, message: 'Admin client Supabase non disponible (SUPABASE_SERVICE_ROLE_KEY manquant)' });
    return;
  }

  // Vérifier que le partenaire existe
  const { data: partner, error: partnerErr } = await supabaseAdmin
    .from('partners')
    .select('id, name')
    .eq('id', partnerId)
    .single();

  if (partnerErr || !partner) {
    res.status(404).json({ success: false, message: 'Partenaire introuvable' });
    return;
  }

  const redirectTo = process.env.PARTNER_PORTAL_URL ?? 'https://admin.kro-no-delivery.com/partner/login';

  // Invite via Supabase (crée le compte + envoie le mail automatiquement)
  const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
    email.trim().toLowerCase(),
    {
      redirectTo,
      data: { partner_id: partnerId, partner_name: partner.name, role },
    }
  );

  if (inviteError) {
    logger.error('[partnerController] invitePartnerUser invite error:', inviteError);
    res.status(500).json({ success: false, message: inviteError.message ?? "Erreur lors de l'envoi de l'invitation" });
    return;
  }

  const userId = inviteData.user.id;

  // Lier l'utilisateur au partenaire dans partner_users
  const { error: puError } = await supabaseAdmin
    .from('partner_users')
    .upsert(
      { partner_id: partnerId, user_id: userId, role },
      { onConflict: 'partner_id,user_id' }
    );

  if (puError) {
    logger.error('[partnerController] invitePartnerUser partner_users error:', puError);
    res.status(500).json({ success: false, message: 'Invitation envoyée mais erreur lors du lien partenaire' });
    return;
  }

  res.status(201).json({ success: true, message: 'Invitation envoyée', data: { userId, email: email.trim().toLowerCase(), role } });
};

// ─── POST /api/partners/register — utilisateur authentifié ───────────────────
export const registerAsPartner = async (req: Request, res: Response): Promise<void> => {
  const userId = (req as any).user?.id;
  if (!userId) {
    res.status(401).json({ success: false, message: 'Non autorisé' });
    return;
  }

  const { company_name } = req.body as { company_name?: string };
  if (!company_name?.trim()) {
    res.status(400).json({ success: false, message: "Le nom de l'entreprise est requis" });
    return;
  }

  // Vérifier si l'utilisateur est déjà lié à un partenaire
  const { data: existing } = await db()
    .from('partner_users')
    .select('partner_id, partners(id, status)')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();

  if (existing?.partner_id) {
    const currentStatus = (existing.partners as any)?.status;
    // Si le partenaire existe mais est inactif, on le repasse en pending pour réapprobation
    if (currentStatus === 'inactive') {
      await db().from('partners').update({ status: 'pending', name: company_name.trim(), updated_at: new Date().toISOString() }).eq('id', existing.partner_id);
    }
    res.status(200).json({ success: true, data: { partner_id: existing.partner_id }, message: 'Déjà enregistré comme partenaire' });
    return;
  }

  // Récupérer email et téléphone de l'utilisateur
  const { data: user } = await db()
    .from('users')
    .select('email, phone')
    .eq('id', userId)
    .maybeSingle();

  // Créer le partenaire avec status pending
  const { data: partner, error } = await db()
    .from('partners')
    .insert({
      name: company_name.trim(),
      email: user?.email ?? null,
      phone: user?.phone ?? null,
      commission_rate: 0.20,
      status: 'pending',
    })
    .select()
    .single();

  if (error || !partner) {
    logger.error('[partnerController] registerAsPartner error:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la création du partenaire' });
    return;
  }

  // Lier l'utilisateur comme owner
  const { error: puError } = await db()
    .from('partner_users')
    .insert({ partner_id: partner.id, user_id: userId, role: 'owner' });

  if (puError) {
    logger.error('[partnerController] registerAsPartner partner_users error:', puError);
    await db().from('partners').delete().eq('id', partner.id);
    res.status(500).json({ success: false, message: 'Erreur lors du lien utilisateur-partenaire' });
    return;
  }

  res.status(201).json({ success: true, data: { partner_id: partner.id, status: partner.status } });
};

// ─── POST /api/partners/deregister — utilisateur authentifié ─────────────────
export const deregisterAsPartner = async (req: Request, res: Response): Promise<void> => {
  const userId = (req as any).user?.id;
  if (!userId) {
    res.status(401).json({ success: false, message: 'Non autorisé' });
    return;
  }

  const { data: existing } = await db()
    .from('partner_users')
    .select('partner_id')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();

  if (!existing?.partner_id) {
    res.status(200).json({ success: true, message: 'Aucun partenaire lié' });
    return;
  }

  await db()
    .from('partners')
    .update({ status: 'inactive', updated_at: new Date().toISOString() })
    .eq('id', existing.partner_id);

  res.json({ success: true });
};

// ─── PATCH /api/partners/:id/status — admin only ──────────────────────────────
export const updatePartnerStatus = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { status } = req.body as { status?: string };
  const allowed = ['active', 'inactive', 'suspended', 'pending'];

  if (!status || !allowed.includes(status)) {
    res.status(400).json({ success: false, message: `Statut invalide. Valeurs possibles : ${allowed.join(', ')}` });
    return;
  }

  const { data, error } = await db()
    .from('partners')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error || !data) {
    logger.error('[partnerController] updatePartnerStatus error:', error);
    res.status(500).json({ success: false, message: 'Erreur lors du changement de statut' });
    return;
  }

  res.json({ success: true, data });
};

// ─── PATCH /api/partners/:id/activate — admin only ───────────────────────────
export const activatePartner = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  const { data, error } = await db()
    .from('partners')
    .update({ status: 'active', updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'pending')
    .select()
    .single();

  if (error || !data) {
    logger.error('[partnerController] activatePartner error:', error);
    res.status(500).json({ success: false, message: "Erreur lors de l'activation" });
    return;
  }

  res.json({ success: true, data });
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
