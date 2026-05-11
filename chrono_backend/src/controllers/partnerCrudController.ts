import { Request, Response } from 'express';
import logger from '../utils/logger.js';
import {
  db,
  getPlanTier,
  PLAN_DEFAULTS,
  PAY_PER_DELIVERY_COMMISSION_RATE,
  PARTNER_PORTAL_LOGIN_URL,
  statusFromPartnerJoin,
  isInviteEmailAlreadyRegisteredError,
  ensurePublicUserProfileForAuthUser,
  attachExistingUserAndSendPortalLink,
} from './partnerControllerUtils.js';
import { supabaseAdmin } from '../config/supabase.js';

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

export const listPartners = async (req: Request, res: Response): Promise<void> => {
  const { status, plan } = req.query;

  let query = db().from('partners').select('*').order('created_at', { ascending: false });

  if (status) query = query.eq('status', status as string);
  if (plan) query = query.eq('plan', plan as string);

  const { data, error } = await query;

  if (error) {
    logger.error('[partnerController] listPartners error:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la récupération des partenaires' });
    return;
  }

  res.json({ success: true, data });
};

export const getPartner = async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id ?? req.params.partnerId;

  const [partnerRes, subRes, usageRes] = await Promise.all([
    db().from('partners').select('*').eq('id', id).single(),
    db()
      .from('partner_subscriptions')
      .select('*')
      .eq('partner_id', id)
      .order('is_active', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(1)
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
      ...getPlanTier(partnerRes.data.plan),
      active_subscription: subRes.data ?? null,
      current_usage: usageRes.data ?? null,
    },
  });
};

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
          payment_status: 'active',
          is_active: true,
        });
      if (subError) logger.warn('[partnerController] Création abonnement auto échouée:', subError.message);
    }
  }

  if (data.email && supabaseAdmin) {
    const redirectTo = process.env.PARTNER_PORTAL_URL ?? PARTNER_PORTAL_LOGIN_URL;
    const em = data.email.toLowerCase();
    try {
      const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(em, {
        redirectTo,
        data: { partner_id: id, partner_name: data.name, role: 'owner' },
      });
      if (!inviteError && inviteData?.user?.id) {
        const ensured = await ensurePublicUserProfileForAuthUser(inviteData.user.id);
        if (!ensured.ok) {
          logger.warn('[partnerController] Auto-invite profil public échoué:', ensured.message);
        } else {
          const { error: puError } = await db()
            .from('partner_users')
            .upsert({ partner_id: id, user_id: inviteData.user.id, role: 'owner' }, { onConflict: 'partner_id,user_id' });
          if (puError) {
            logger.warn('[partnerController] Auto-invite liaison partner_users échouée:', puError.message);
          } else {
            logger.info(`[partnerController] Invitation portail envoyée et owner lié à ${data.email}`);
          }
        }
      } else if (inviteError && isInviteEmailAlreadyRegisteredError(inviteError)) {
        const attached = await attachExistingUserAndSendPortalLink({
          normalizedEmail: em,
          partnerId: id,
          partnerName: data.name,
          role: 'owner',
          redirectTo,
        });
        if (!attached.ok) {
          logger.warn('[partnerController] Auto-invite compte existant non lié:', attached.message);
        }
      } else if (inviteError) {
        logger.warn('[partnerController] Auto-invite portail échouée:', inviteError.message);
      }
    } catch (inviteErr) {
      logger.warn('[partnerController] Auto-invite portail échouée:', inviteErr);
    }
  }

  res.json({ success: true, data });
};

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

  if (plan && plan !== 'none' && !PLAN_DEFAULTS[plan]) {
    res.status(400).json({
      success: false,
      message: `Plan invalide. Valeurs acceptées : none, ${Object.keys(PLAN_DEFAULTS).join(', ')}`,
    });
    return;
  }

  const explicitNoPlan = plan === 'none';
  const subscribedPlan = plan && plan !== 'none' && PLAN_DEFAULTS[plan] ? plan : null;

  const { data: existing } = await db()
    .from('partner_users')
    .select('partner_id, partners(id, status)')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();

  if (existing?.partner_id) {
    const currentStatus = statusFromPartnerJoin(existing.partners);

    if (currentStatus === 'active') {
      if (subscribedPlan) {
        await db().from('partners').update({ plan: subscribedPlan }).eq('id', existing.partner_id);
      } else if (explicitNoPlan) {
        await db().from('partners').update({ plan: 'none', commission_rate: PAY_PER_DELIVERY_COMMISSION_RATE }).eq('id', existing.partner_id);
      }
      await db().from('users').update({ is_business: true }).eq('id', userId);
      res.status(200).json({
        success: true,
        data: { partner_id: existing.partner_id, status: 'active' },
        message: 'Mode business réactivé',
      });
      return;
    }

    if (currentStatus === 'pending') {
      if (subscribedPlan) {
        await db().from('partners').update({ plan: subscribedPlan }).eq('id', existing.partner_id);
      } else if (explicitNoPlan) {
        await db().from('partners').update({ plan: 'none', commission_rate: PAY_PER_DELIVERY_COMMISSION_RATE }).eq('id', existing.partner_id);
      }
      await db().from('users').update({ is_business: true }).eq('id', userId);
      res.status(200).json({
        success: true,
        data: { partner_id: existing.partner_id, status: 'pending' },
        message: 'Demande partenaire déjà en cours de traitement',
      });
      return;
    }

    if (currentStatus === 'inactive') {
      await db().from('users').update({ is_business: true }).eq('id', userId);
      res.status(200).json({
        success: true,
        data: { partner_id: existing.partner_id, status: 'inactive' },
        message: 'Mode business active - agrement en attente de reactivation admin',
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: { partner_id: existing.partner_id, status: currentStatus },
      message: 'Compte partenaire existant',
    });
    return;
  }

  const { data: user } = await db()
    .from('users')
    .select('email, phone')
    .eq('id', userId)
    .maybeSingle();

  const emailForPortal = portal_email?.trim() || user?.email || null;

  const { data: partner, error } = await db()
    .from('partners')
    .insert({
      name: company_name.trim(),
      email: emailForPortal,
      phone: user?.phone ?? null,
      status: 'pending',
      ...(explicitNoPlan
        ? { plan: 'none', commission_rate: PAY_PER_DELIVERY_COMMISSION_RATE }
        : subscribedPlan
          ? { plan: subscribedPlan }
          : {}),
    })
    .select()
    .single();

  if (error || !partner) {
    logger.error('[partnerController] registerAsPartner error:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la création du partenaire' });
    return;
  }

  const { error: puError } = await db()
    .from('partner_users')
    .insert({ partner_id: partner.id, user_id: userId, role: 'owner' });

  if (puError) {
    logger.error('[partnerController] registerAsPartner partner_users error:', puError);
    await db().from('partners').delete().eq('id', partner.id);
    res.status(500).json({ success: false, message: 'Erreur lors du lien utilisateur-partenaire' });
    return;
  }

  await db().from('users').update({ is_business: true }).eq('id', userId);

  res.status(201).json({ success: true, data: { partner_id: partner.id, status: partner.status } });
};

export const setBusinessMode = async (req: Request, res: Response): Promise<void> => {
  const userId = (req as any).user?.id;
  if (!userId) { res.status(401).json({ success: false, message: 'Non autorise' }); return; }

  const { active } = req.body as { active?: boolean };
  if (typeof active !== 'boolean') {
    res.status(400).json({ success: false, message: 'Parametre active (boolean) requis' });
    return;
  }

  await db().from('users').update({ is_business: active }).eq('id', userId);
  res.json({ success: true });
};

export const deregisterAsPartner = async (req: Request, res: Response): Promise<void> => {
  const userId = (req as any).user?.id;
  if (!userId) {
    res.status(401).json({ success: false, message: 'Non autorisé' });
    return;
  }

  await db().from('users').update({ is_business: false }).eq('id', userId);

  res.json({ success: true });
};

export const updatePartnerPreferences = async (req: Request, res: Response): Promise<void> => {
  const partnerId = (req as any).partnerUser?.partnerId ?? req.params.id ?? req.params.partnerId;
  const { use_preferred_drivers } = req.body as { use_preferred_drivers?: boolean };

  if (typeof use_preferred_drivers !== 'boolean') {
    res.status(400).json({ success: false, message: 'use_preferred_drivers doit être un booléen' });
    return;
  }

  const { data, error } = await db()
    .from('partners')
    .update({ use_preferred_drivers })
    .eq('id', partnerId)
    .select('*')
    .single();

  if (error) {
    logger.error('[partnerController] updatePartnerPreferences error:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la mise à jour des préférences partenaire' });
    return;
  }

  res.json({ success: true, data });
};
