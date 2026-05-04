import { Request, Response } from 'express';
import { supabase, supabaseAdmin } from '../config/supabase.js';
import logger from '../utils/logger.js';
import { sendPartnerPortalMagicLinkEmail } from '../services/emailService.js';

const db = () => supabaseAdmin ?? supabase;

function getPlanTier(plan: string | null | undefined): { b2b_tier: 'small' | 'large' | null; portal_eligible: boolean } {
  if (plan === 'pro' || plan === 'business') return { b2b_tier: 'large', portal_eligible: true };
  if (plan === 'starter') return { b2b_tier: 'small', portal_eligible: false };
  return { b2b_tier: null, portal_eligible: false };
}

const PLAN_DEFAULTS: Record<string, { monthly_price: number; included_orders: number | null; excess_commission_rate: number }> = {
  starter:  { monthly_price: 8000,  included_orders: 35,  excess_commission_rate: 0.06 },
  pro:      { monthly_price: 16000, included_orders: 70,  excess_commission_rate: 0.05 },
  business: { monthly_price: 29000, included_orders: 110, excess_commission_rate: 0.03 },
};

/** Sans forfait : commission prélevée sur chaque course (pas d'abonnement). */
const PAY_PER_DELIVERY_COMMISSION_RATE = 0.07;

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
  if (plan) query = query.eq('plan', plan as string);

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
      ...getPlanTier(partnerRes.data.plan),
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

function isInviteEmailAlreadyRegisteredError(err: { message?: string } | null | undefined): boolean {
  const m = (err?.message ?? '').toLowerCase();
  return (
    m.includes('already been registered') ||
    m.includes('already registered') ||
    m.includes('user already exists') ||
    m.includes('email address is already') ||
    m.includes('duplicate') ||
    m.includes('email_exists')
  );
}

/**
 * partner_users.user_id référence public.users.id. Les invitations Supabase créent souvent
 * uniquement auth.users : on aligne une ligne public.users avant la liaison partenaire.
 */
async function ensurePublicUserProfileForAuthUser(
  userId: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!supabaseAdmin) {
    return { ok: false, message: 'Configuration serveur incomplète (Supabase admin).' };
  }

  const { data: existing, error: selErr } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('id', userId)
    .maybeSingle();

  if (selErr) {
    logger.error('[partnerController] ensurePublicUserProfile select users:', selErr);
    return { ok: false, message: 'Erreur lors de la vérification du profil utilisateur.' };
  }
  if (existing?.id) {
    return { ok: true };
  }

  const { data: authBundle, error: authErr } = await supabaseAdmin.auth.admin.getUserById(userId);
  if (authErr || !authBundle?.user) {
    logger.error('[partnerController] ensurePublicUserProfile getUserById:', authErr);
    return { ok: false, message: 'Utilisateur introuvable dans Auth.' };
  }

  const authUser = authBundle.user;
  const email = (authUser.email ?? '').trim().toLowerCase();
  if (!email) {
    return { ok: false, message: "L'utilisateur Auth n'a pas d'e-mail : impossible de créer le profil public." };
  }

  const phone = authUser.phone && String(authUser.phone).trim() ? String(authUser.phone).trim() : null;
  const roleFromMeta = authUser.user_metadata?.role;
  const role =
    typeof roleFromMeta === 'string' && roleFromMeta.trim() ? roleFromMeta.trim() : 'client';

  const { error: insErr } = await supabaseAdmin.from('users').insert({
    id: authUser.id,
    email,
    phone,
    role,
    created_at: authUser.created_at ?? new Date().toISOString(),
  });

  if (insErr) {
    if (insErr.code === '23505') {
      const { data: recheck } = await supabaseAdmin.from('users').select('id').eq('id', userId).maybeSingle();
      if (recheck?.id) return { ok: true };
    }
    logger.error('[partnerController] ensurePublicUserProfile insert users:', insErr);
    return { ok: false, message: 'Impossible de synchroniser le profil utilisateur (table public.users).' };
  }

  return { ok: true };
}

/** Résout l’UUID Auth / public.users à partir de l’e-mail (compte app déjà créé). */
async function resolveUserIdByEmail(normalizedEmail: string): Promise<string | null> {
  const { data: row } = await db()
    .from('users')
    .select('id')
    .ilike('email', normalizedEmail)
    .maybeSingle();
  if (row?.id) return row.id as string;

  if (!supabaseAdmin) return null;
  for (let page = 1; page <= 20; page++) {
    const { data: bundle, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error || !bundle?.users?.length) break;
    const hit = bundle.users.find((u) => (u.email ?? '').toLowerCase() === normalizedEmail);
    if (hit?.id) return hit.id;
    if (bundle.users.length < 1000) break;
  }
  return null;
}

type AttachPortalResult =
  | { ok: true; userId: string; magicLinkEmailed: boolean }
  | { ok: false; message: string };

/** Compte Auth déjà existant : lien partner_users + e-mail avec lien de connexion (SMTP Krono). */
async function attachExistingUserAndSendPortalLink(params: {
  normalizedEmail: string;
  partnerId: string;
  partnerName: string;
  role: string;
  redirectTo: string;
}): Promise<AttachPortalResult> {
  const { normalizedEmail, partnerId, partnerName, role, redirectTo } = params;
  const userId = await resolveUserIdByEmail(normalizedEmail);
  if (!userId) {
    return {
      ok: false,
      message:
        "Cet e-mail a déjà un compte, mais aucun profil correspondant n'a été trouvé. Vérifiez que le mail est le même que sur l'app client.",
    };
  }

  const ensured = await ensurePublicUserProfileForAuthUser(userId);
  if (!ensured.ok) {
    return { ok: false, message: ensured.message };
  }

  const { error: puError } = await db()
    .from('partner_users')
    .upsert({ partner_id: partnerId, user_id: userId, role }, { onConflict: 'partner_id,user_id' });

  if (puError) {
    logger.error('[partnerController] attachExisting partner_users:', puError);
    return { ok: false, message: 'Erreur lors de la liaison au partenaire' };
  }

  if (!supabaseAdmin) {
    return { ok: true, userId, magicLinkEmailed: false };
  }

  let actionLink: string | undefined;
  const { data: magicGen, error: magicErr } = await supabaseAdmin.auth.admin.generateLink({
    type: 'magiclink',
    email: normalizedEmail,
    options: { redirectTo },
  });
  if (!magicErr && magicGen?.properties?.action_link) {
    actionLink = magicGen.properties.action_link;
  } else {
    logger.warn('[partnerController] generateLink magiclink:', magicErr?.message);
    const { data: recGen, error: recErr } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email: normalizedEmail,
      options: { redirectTo },
    });
    if (!recErr && recGen?.properties?.action_link) {
      actionLink = recGen.properties.action_link;
    } else {
      logger.warn('[partnerController] generateLink recovery:', recErr?.message);
    }
  }

  let magicLinkEmailed = false;
  if (actionLink) {
    const sendResult = await sendPartnerPortalMagicLinkEmail(normalizedEmail, actionLink, partnerName);
    magicLinkEmailed = sendResult.success;
    if (!sendResult.success) {
      logger.info(`[partnerController] Lien portail (SMTP non utilisé), à transmettre manuellement si besoin : ${actionLink}`);
    }
  }

  return { ok: true, userId, magicLinkEmailed };
}

// ─── POST /api/partners/:id/invite — admin only ───────────────────────────────
// Nouveau compte : invite Supabase. Compte déjà existant (app) : liaison + lien de connexion par mail.
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

  const normalized = email.trim().toLowerCase();
  const redirectTo = process.env.PARTNER_PORTAL_URL ?? 'https://admin.kro-no-delivery.com/partner/login';

  const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(normalized, {
    redirectTo,
    data: { partner_id: partnerId, partner_name: partner.name, role },
  });

  if (inviteError) {
    if (isInviteEmailAlreadyRegisteredError(inviteError)) {
      const attached = await attachExistingUserAndSendPortalLink({
        normalizedEmail: normalized,
        partnerId,
        partnerName: partner.name,
        role,
        redirectTo,
      });
      if (!attached.ok) {
        res.status(400).json({ success: false, message: attached.message });
        return;
      }
      res.status(201).json({
        success: true,
        message: attached.magicLinkEmailed
          ? "Compte déjà existant : accès portail ajouté. Un e-mail avec un lien de connexion vient d'être envoyé."
          : "Compte déjà existant : accès portail ajouté. Configurez SMTP (EMAIL_USER / EMAIL_PASS) pour envoyer le lien automatiquement, ou utilisez « Mot de passe oublié » sur la page de connexion du portail.",
        data: {
          userId: attached.userId,
          email: normalized,
          role,
          existingUser: true,
          magicLinkEmailed: attached.magicLinkEmailed,
        },
      });
      return;
    }
    logger.error('[partnerController] invitePartnerUser invite error:', inviteError);
    res.status(500).json({ success: false, message: inviteError.message ?? "Erreur lors de l'envoi de l'invitation" });
    return;
  }

  const userId = inviteData.user.id;

  const ensuredNew = await ensurePublicUserProfileForAuthUser(userId);
  if (!ensuredNew.ok) {
    logger.error('[partnerController] invitePartnerUser ensure public users failed:', ensuredNew.message);
    res.status(500).json({ success: false, message: ensuredNew.message });
    return;
  }

  const { error: puError } = await supabaseAdmin
    .from('partner_users')
    .upsert({ partner_id: partnerId, user_id: userId, role }, { onConflict: 'partner_id,user_id' });

  if (puError) {
    logger.error('[partnerController] invitePartnerUser partner_users error:', puError);
    res.status(500).json({ success: false, message: 'Invitation envoyée mais erreur lors du lien partenaire' });
    return;
  }

  res.status(201).json({ success: true, message: 'Invitation envoyée', data: { userId, email: normalized, role } });
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

  if (plan && plan !== 'none' && !PLAN_DEFAULTS[plan]) {
    res.status(400).json({
      success: false,
      message: `Plan invalide. Valeurs acceptées : none, ${Object.keys(PLAN_DEFAULTS).join(', ')}`,
    });
    return;
  }

  const explicitNoPlan = plan === 'none';
  const subscribedPlan = plan && plan !== 'none' && PLAN_DEFAULTS[plan] ? plan : null;

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
      // Toggle mode business uniquement : ne pas remettre partners.status sans validation admin
      await db().from('users').update({ is_business: true }).eq('id', userId);
      res.status(200).json({
        success: true,
        data: { partner_id: existing.partner_id, status: 'inactive' },
        message: 'Mode business active - agrement en attente de reactivation admin',
      });
      return;
    }

    // suspended : inchangé (réservé à l'admin)
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

  // Créer le partenaire avec status pending (forfait optionnel ; « none » = commission à la course uniquement)
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

// ─── PATCH /api/partners/business-mode — utilisateur authentifié ─────────────
// Toggle simple is_business sans toucher partners.status.
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

// ─── POST /api/partners/deregister — utilisateur authentifié ─────────────────
// Mode perso simple : is_business = false. Ne touche pas partners.status.
export const deregisterAsPartner = async (req: Request, res: Response): Promise<void> => {
  const userId = (req as any).user?.id;
  if (!userId) {
    res.status(401).json({ success: false, message: 'Non autorisé' });
    return;
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
          payment_status: 'active',
          is_active: true,
        });
      if (subError) logger.warn('[partnerController] Création abonnement auto échouée:', subError.message);
    }
  }

  // Invitation portail à l'email fourni lors de l'inscription (best-effort)
  if (data.email && supabaseAdmin) {
    const redirectTo = process.env.PARTNER_PORTAL_URL ?? 'https://admin.kro-no-delivery.com/partner/login';
    const em = data.email.toLowerCase();
    try {
      const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(em, {
        redirectTo,
        data: { partner_id: id, partner_name: data.name, role: 'owner' },
      });
      if (!inviteError && inviteData) {
        await supabaseAdmin
          .from('partner_users')
          .upsert({ partner_id: id, user_id: inviteData.user.id, role: 'owner' }, { onConflict: 'partner_id,user_id' });
        logger.info(`[partnerController] Invitation portail envoyée à ${data.email}`);
      } else if (inviteError && isInviteEmailAlreadyRegisteredError(inviteError)) {
        const attached = await attachExistingUserAndSendPortalLink({
          normalizedEmail: em,
          partnerId: id,
          partnerName: data.name,
          role: 'owner',
          redirectTo,
        });
        if (attached.ok) {
          logger.info(
            `[partnerController] Activation : compte existant lié au portail (${data.email}), mail lien=${attached.magicLinkEmailed}`
          );
        } else {
          logger.warn('[partnerController] Activation : compte existant non lié:', attached.message);
        }
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

  const normalized = email.trim().toLowerCase();
  const redirectTo = process.env.PARTNER_PORTAL_URL ?? 'https://admin.kro-no-delivery.com/partner/login';

  const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(normalized, {
    redirectTo,
    data: { partner_id: partnerId, partner_name: partner.name, role: 'owner' },
  });

  if (inviteError) {
    if (isInviteEmailAlreadyRegisteredError(inviteError)) {
      const attached = await attachExistingUserAndSendPortalLink({
        normalizedEmail: normalized,
        partnerId,
        partnerName: partner.name,
        role: 'owner',
        redirectTo,
      });
      if (!attached.ok) {
        res.status(400).json({ success: false, message: attached.message });
        return;
      }
      res.status(201).json({
        success: true,
        message: attached.magicLinkEmailed
          ? "Compte déjà existant : accès portail ajouté. Un e-mail avec un lien de connexion vient d'être envoyé."
          : "Compte déjà existant : accès portail ajouté. Configurez SMTP ou utilisez « Mot de passe oublié » sur la page de connexion du portail.",
        data: {
          userId: attached.userId,
          email: normalized,
          role: 'owner',
          existingUser: true,
          magicLinkEmailed: attached.magicLinkEmailed,
        },
      });
      return;
    }
    logger.error('[partnerController] invitePortalUser invite error:', inviteError);
    res.status(500).json({ success: false, message: inviteError.message ?? "Erreur lors de l'envoi de l'invitation" });
    return;
  }

  const userId = inviteData.user.id;

  const ensuredPortal = await ensurePublicUserProfileForAuthUser(userId);
  if (!ensuredPortal.ok) {
    logger.error('[partnerController] invitePortalUser ensure public users failed:', ensuredPortal.message);
    res.status(500).json({ success: false, message: ensuredPortal.message });
    return;
  }

  const { error: puError } = await supabaseAdmin
    .from('partner_users')
    .upsert({ partner_id: partnerId, user_id: userId, role: 'owner' }, { onConflict: 'partner_id,user_id' });

  if (puError) {
    logger.error('[partnerController] invitePortalUser partner_users error:', puError);
    res.status(500).json({ success: false, message: 'Invitation envoyée mais erreur lors du lien partenaire' });
    return;
  }

  res.status(201).json({ success: true, message: 'Invitation envoyée', data: { userId, email: normalized, role: 'owner' } });
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
