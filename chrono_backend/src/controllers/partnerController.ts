import { Request, Response } from 'express';
import { supabase, supabaseAdmin } from '../config/supabase.js';
import logger from '../utils/logger.js';

const db = () => supabaseAdmin ?? supabase;

const PLAN_DEFAULTS: Record<string, { monthly_price: number; included_orders: number | null; excess_commission_rate: number }> = {
  starter:  { monthly_price: 15000, included_orders: 50,   excess_commission_rate: 0.20 },
  pro:      { monthly_price: 40000, included_orders: 200,  excess_commission_rate: 0.15 },
  business: { monthly_price: 100000, included_orders: null, excess_commission_rate: 0.10 },
};

/** Statut partenaire depuis une jointure Supabase (objet ou tableau). */
function statusFromPartnerJoin(partners: unknown): string | undefined {
  if (partners == null) return undefined;
  if (Array.isArray(partners)) return (partners[0] as { status?: string } | undefined)?.status;
  if (typeof partners === 'object' && 'status' in (partners as object)) {
    return (partners as { status: string }).status;
  }
  return undefined;
}

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
      commission_rate: commission_rate ?? null,
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
  const { email } = req.body as { email: string };
  const role = 'owner';

  if (!email?.trim()) {
    res.status(400).json({ success: false, message: 'Email requis' });
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

  const { company_name, plan, portal_email } = req.body as {
    company_name?: string;
    plan?: string;
    portal_email?: string;
  };

  if (!company_name?.trim()) {
    res.status(400).json({ success: false, message: "Le nom de l'entreprise est requis" });
    return;
  }

  if (plan && !PLAN_DEFAULTS[plan]) {
    res.status(400).json({
      success: false,
      message: `Plan invalide. Valeurs acceptées : ${Object.keys(PLAN_DEFAULTS).join(', ')}`,
    });
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
    const currentStatus = statusFromPartnerJoin(existing.partners);

    if (currentStatus === 'active') {
      // Partenaire agréé : réactiver le mode business sans changer le statut
      await db().from('users').update({ is_business: true }).eq('id', userId);
      res.status(200).json({
        success: true,
        data: { partner_id: existing.partner_id, status: 'active' },
        message: 'Mode business réactivé',
      });
      return;
    }

    if (currentStatus === 'pending') {
      await db().from('users').update({ is_business: true }).eq('id', userId);
      res.status(200).json({
        success: true,
        data: { partner_id: existing.partner_id, status: 'pending' },
        message: 'Demande partenaire déjà en cours de traitement',
      });
      return;
    }

    if (currentStatus === 'inactive') {
      // Même partenaire : passage mode perso → business remet l’agrément actif (sync avec le switch app)
      await db()
        .from('partners')
        .update({ status: 'active', updated_at: new Date().toISOString() })
        .eq('id', existing.partner_id)
        .eq('status', 'inactive');
      await db().from('users').update({ is_business: true }).eq('id', userId);
      res.status(200).json({
        success: true,
        data: { partner_id: existing.partner_id, status: 'active' },
        message: 'Mode business réactivé',
      });
      return;
    }

    // suspended : inchangé (réservé à l’admin)
    res.status(200).json({
      success: true,
      data: { partner_id: existing.partner_id, status: currentStatus },
      message: 'Compte partenaire existant',
    });
    return;
  }

  // Récupérer email et téléphone de l'utilisateur
  const { data: user } = await db()
    .from('users')
    .select('email, phone')
    .eq('id', userId)
    .maybeSingle();

  const emailForPortal = portal_email?.trim() || user?.email || null;

  // Créer le partenaire avec status pending
  const { data: partner, error } = await db()
    .from('partners')
    .insert({
      name: company_name.trim(),
      email: emailForPortal,
      phone: user?.phone ?? null,
      status: 'pending',
      ...(plan ? { plan } : {}),
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

  // Marquer l'utilisateur comme business dans la table users
  await db().from('users').update({ is_business: true }).eq('id', userId);

  res.status(201).json({ success: true, data: { partner_id: partner.id, status: partner.status } });
};

// ─── POST /api/partners/deregister — utilisateur authentifié ─────────────────
// Mode perso : is_business = false + partenaire déjà agréé (active) → partners.status = inactive (sync admin / Realtime).
// Ne modifie pas pending ni suspended.
export const deregisterAsPartner = async (req: Request, res: Response): Promise<void> => {
  const userId = (req as any).user?.id;
  if (!userId) {
    res.status(401).json({ success: false, message: 'Non autorisé' });
    return;
  }

  const { data: link } = await db()
    .from('partner_users')
    .select('partner_id, partners(status)')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();

  const pStatus = statusFromPartnerJoin(link?.partners);

  if (link?.partner_id && pStatus === 'active') {
    await db()
      .from('partners')
      .update({ status: 'inactive', updated_at: new Date().toISOString() })
      .eq('id', link.partner_id)
      .eq('status', 'active');
  }

  await db().from('users').update({ is_business: false }).eq('id', userId);

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
// Active le partenaire (pending → active) + crée l'abonnement si plan déjà choisi
// + envoie l'invitation portail à partner.email (best-effort).
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

  // Créer l'abonnement depuis le plan choisi côté app (si aucun abonnement actif)
  if (data.plan && PLAN_DEFAULTS[data.plan]) {
    const { data: existingSub } = await db()
      .from('partner_subscriptions')
      .select('id')
      .eq('partner_id', id)
      .eq('is_active', true)
      .maybeSingle();

    if (!existingSub) {
      const defaults = PLAN_DEFAULTS[data.plan]!;
      const { error: subError } = await db()
        .from('partner_subscriptions')
        .insert({
          partner_id: id,
          plan: data.plan,
          monthly_price: defaults.monthly_price,
          included_orders: defaults.included_orders,
          excess_commission_rate: defaults.excess_commission_rate,
          starts_at: new Date().toISOString(),
          payment_status: 'pending_payment',
          is_active: false,
        });
      if (subError) logger.warn('[partnerController] Création abonnement auto échouée:', subError.message);
    }
  }

  // Envoyer l'invitation portail à l'email fourni lors de l'inscription (best-effort)
  if (data.email && supabaseAdmin) {
    const redirectTo = process.env.PARTNER_PORTAL_URL ?? 'https://admin.kro-no-delivery.com/partner/login';
    try {
      const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
        data.email.toLowerCase(),
        { redirectTo, data: { partner_id: id, partner_name: data.name, role: 'owner' } }
      );
      if (!inviteError && inviteData) {
        await supabaseAdmin
          .from('partner_users')
          .upsert(
            { partner_id: id, user_id: inviteData.user.id, role: 'owner' },
            { onConflict: 'partner_id,user_id' }
          );
        logger.info(`[partnerController] Invitation portail envoyée à ${data.email}`);
      }
    } catch (inviteErr) {
      logger.warn('[partnerController] Auto-invite portail échouée:', inviteErr);
    }
  }

  res.json({ success: true, data });
};

// ─── GET /api/partner/:partnerId/users — portail owner only ──────────────────
export const getPartnerUsers = async (req: Request, res: Response): Promise<void> => {
  const partnerId = (req as any).partnerUser?.partnerId;

  const { data, error } = await db()
    .from('partner_users')
    .select('id, partner_id, user_id, role, created_at, user:users(email, first_name, last_name)')
    .eq('partner_id', partnerId)
    .order('created_at', { ascending: true });

  if (error) {
    logger.error('[partnerController] getPartnerUsers error:', error);
    res.status(500).json({ success: false, message: "Erreur lors de la récupération de l'équipe" });
    return;
  }

  res.json({ success: true, data });
};

// ─── POST /api/partner/:partnerId/users/invite — portail owner only ──────────
export const invitePortalUser = async (req: Request, res: Response): Promise<void> => {
  const partnerId = (req as any).partnerUser?.partnerId;
  const { email } = req.body as { email: string };

  if (!email?.trim()) {
    res.status(400).json({ success: false, message: 'Email requis' });
    return;
  }

  if (!supabaseAdmin) {
    res.status(500).json({ success: false, message: 'Admin client Supabase non disponible' });
    return;
  }

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

  const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
    email.trim().toLowerCase(),
    {
      redirectTo,
      data: { partner_id: partnerId, partner_name: partner.name, role: 'owner' },
    }
  );

  if (inviteError) {
    logger.error('[partnerController] invitePortalUser invite error:', inviteError);
    res.status(500).json({ success: false, message: inviteError.message ?? "Erreur lors de l'envoi de l'invitation" });
    return;
  }

  const userId = inviteData.user.id;

  const { error: puError } = await supabaseAdmin
    .from('partner_users')
    .upsert(
      { partner_id: partnerId, user_id: userId, role: 'owner' },
      { onConflict: 'partner_id,user_id' }
    );

  if (puError) {
    logger.error('[partnerController] invitePortalUser partner_users error:', puError);
    res.status(500).json({ success: false, message: 'Invitation envoyée mais erreur lors du lien partenaire' });
    return;
  }

  res.status(201).json({ success: true, message: 'Invitation envoyée', data: { userId, email: email.trim().toLowerCase(), role: 'owner' } });
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

// ─── DELETE /api/partners/:id — admin only ───────────────────────────────────
// Supprime la fiche partenaire et les lignes liées (factures, abonnements, usage, équipe).
// Détache les commandes / tournées (partner_id → null) et remet is_business à false pour les utilisateurs liés.
export const deletePartner = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  const { data: existing, error: exErr } = await db().from('partners').select('id').eq('id', id).maybeSingle();
  if (exErr || !existing) {
    res.status(404).json({ success: false, message: 'Partenaire introuvable' });
    return;
  }

  const { data: puRows } = await db().from('partner_users').select('user_id').eq('partner_id', id);
  const userIds = [...new Set((puRows ?? []).map((r: { user_id: string }) => r.user_id).filter(Boolean))];

  const detachBatches = await db().from('delivery_batches').update({ partner_id: null }).eq('partner_id', id);
  if (detachBatches.error) {
    logger.warn('[partnerController] deletePartner delivery_batches:', detachBatches.error.message);
  }

  const detachOrders = await db().from('orders').update({ partner_id: null }).eq('partner_id', id);
  if (detachOrders.error) {
    logger.warn('[partnerController] deletePartner orders:', detachOrders.error.message);
  }

  const childTables = ['partner_invoices', 'partner_subscriptions', 'partner_usage', 'partner_users'] as const;
  for (const table of childTables) {
    const { error } = await db().from(table).delete().eq('partner_id', id);
    if (error) {
      logger.error(`[partnerController] deletePartner ${table}:`, error);
      res.status(500).json({ success: false, message: 'Erreur lors de la suppression des données liées' });
      return;
    }
  }

  if (userIds.length) {
    const { error: uErr } = await db().from('users').update({ is_business: false }).in('id', userIds);
    if (uErr) logger.warn('[partnerController] deletePartner users is_business:', uErr.message);
  }

  const { error: delErr } = await db().from('partners').delete().eq('id', id);
  if (delErr) {
    logger.error('[partnerController] deletePartner partners:', delErr);
    res.status(500).json({ success: false, message: 'Erreur lors de la suppression du partenaire' });
    return;
  }

  res.json({ success: true });
};
