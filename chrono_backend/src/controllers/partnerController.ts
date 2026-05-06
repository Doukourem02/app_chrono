import { Request, Response } from 'express';
import { supabase, supabaseAdmin } from '../config/supabase.js';
import pool from '../config/db.js';
import logger from '../utils/logger.js';
import { sendPartnerPortalMagicLinkEmail } from '../services/emailService.js';
import {
  clientHeadline,
  normalizeProductStatus,
  orderStatusDefinition,
  progressWithEtaCap,
  statusBaseProgress,
} from '../utils/orderProductRules.js';
import { realisticEtaMinutesFromAirDistance } from '../utils/ivoryCoastEta.js';

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

type PartnerTrackingCoordinates = { latitude: number; longitude: number };

function parseLocationField(value: unknown): Record<string, any> {
  if (!value) return {};
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' ? parsed : { address: value };
    } catch {
      return { address: value };
    }
  }
  return typeof value === 'object' ? (value as Record<string, any>) : {};
}

function toPartnerTrackingCoordinates(value: unknown): PartnerTrackingCoordinates | null {
  const record = value as Record<string, unknown> | null | undefined;
  const coords = (record?.coordinates || record) as Record<string, unknown> | null | undefined;
  if (!coords) return null;
  const latitude = typeof coords.latitude === 'number' ? coords.latitude : Number(coords.latitude ?? coords.lat);
  const longitude = typeof coords.longitude === 'number' ? coords.longitude : Number(coords.longitude ?? coords.lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude };
}

function calculateDistanceMeters(a: PartnerTrackingCoordinates, b: PartnerTrackingCoordinates): number {
  const toRad = (degrees: number) => (degrees * Math.PI) / 180;
  const earthRadiusMeters = 6371000;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const rLat1 = toRad(a.latitude);
  const rLat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(rLat1) * Math.cos(rLat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function etaLabelForPartnerTracking(
  status: string,
  driver: PartnerTrackingCoordinates | null,
  pickup: unknown,
  dropoff: unknown,
  deliveryMethod: string | null
): string {
  const normalized = normalizeProductStatus(status) ?? status;
  if (normalized === 'pending') return '';
  if (normalized === 'in_progress') return '1 min';
  if (normalized === 'completed' || normalized === 'cancelled' || normalized === 'declined') return '';

  const etaMode = orderStatusDefinition(normalized).etaMode;
  const target =
    etaMode === 'pickup'
      ? toPartnerTrackingCoordinates(pickup)
      : etaMode === 'dropoff'
        ? toPartnerTrackingCoordinates(dropoff)
        : null;
  if (!driver || !target) return '';

  const distanceMeters = calculateDistanceMeters(driver, target);
  const minutes = realisticEtaMinutesFromAirDistance({
    airDistanceMeters: distanceMeters,
    vehicleType: deliveryMethod,
  });
  return `${minutes} min`;
}

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
  const id = req.params.id ?? req.params.partnerId;

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

/** Envoie uniquement le lien portail par e-mail sans toucher partner_users. */
async function sendPortalLinkOnly(params: {
  normalizedEmail: string;
  partnerName: string;
  redirectTo: string;
}): Promise<void> {
  if (!supabaseAdmin) return;
  const { normalizedEmail, partnerName, redirectTo } = params;
  try {
    let actionLink: string | undefined;
    const { data: magicGen, error: magicErr } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: normalizedEmail,
      options: { redirectTo },
    });
    if (!magicErr && magicGen?.properties?.action_link) {
      actionLink = magicGen.properties.action_link;
    } else {
      logger.warn('[partnerController] sendPortalLinkOnly generateLink:', magicErr?.message);
      const { data: recGen, error: recErr } = await supabaseAdmin.auth.admin.generateLink({
        type: 'recovery',
        email: normalizedEmail,
        options: { redirectTo },
      });
      if (!recErr && recGen?.properties?.action_link) actionLink = recGen.properties.action_link;
    }
    if (actionLink) {
      await sendPartnerPortalMagicLinkEmail(normalizedEmail, actionLink, partnerName);
    }
    logger.info(`[partnerController] Lien portail envoyé à ${normalizedEmail} (sans ajout membre)`);
  } catch (err) {
    logger.warn('[partnerController] sendPortalLinkOnly échec:', err);
  }
}

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
        // Email de bienvenue envoyé — partner_users est géré uniquement via registerAsPartner ou invitePartnerUser
        logger.info(`[partnerController] Invitation portail envoyée à ${data.email}`);
      } else if (inviteError && isInviteEmailAlreadyRegisteredError(inviteError)) {
        // Compte existant : envoyer uniquement le lien de connexion, sans toucher partner_users
        await sendPortalLinkOnly({ normalizedEmail: em, partnerName: data.name, redirectTo });
      }
    } catch (inviteErr) {
      logger.warn('[partnerController] Auto-invite portail échouée:', inviteErr);
    }
  }

  res.json({ success: true, data });
};

// ─── DELETE /api/partner/:partnerId/users/:memberId — portail owner only ─────
export const removePartnerUser = async (req: Request, res: Response): Promise<void> => {
  const partnerId = (req as any).partnerUser?.partnerId;
  const currentUserId = (req as any).partnerUser?.userId;
  const { memberId } = req.params;

  const { data: row, error: fetchErr } = await db()
    .from('partner_users')
    .select('id, user_id')
    .eq('id', memberId)
    .eq('partner_id', partnerId)
    .maybeSingle();

  if (fetchErr || !row) {
    res.status(404).json({ success: false, message: 'Membre introuvable' });
    return;
  }

  if (row.user_id === currentUserId) {
    res.status(400).json({ success: false, message: 'Vous ne pouvez pas vous retirer vous-même.' });
    return;
  }

  const { error } = await db().from('partner_users').delete().eq('id', memberId).eq('partner_id', partnerId);
  if (error) {
    logger.error('[partnerController] removePartnerUser:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la suppression du membre' });
    return;
  }

  res.json({ success: true });
};

// ─── GET /api/partner/:partnerId/users — portail owner only ──────────────────
export const getPartnerUsers = async (req: Request, res: Response): Promise<void> => {
  const partnerId = (req as any).partnerUser?.partnerId;

  const { data, error } = await db()
    .from('partner_users')
    .select('id, partner_id, user_id, role, created_at, user:users(email, first_name, last_name), partner:partners(email)')
    .eq('partner_id', partnerId)
    .order('created_at', { ascending: true });

  if (error) {
    logger.error('[partnerController] getPartnerUsers error:', error);
    res.status(500).json({ success: false, message: "Erreur lors de la récupération de l'équipe" });
    return;
  }

  const sanitized = (data ?? []).map((row: any) => {
    const userEmail: string | null = row.user?.email ?? null;
    const isOtp = userEmail?.includes('@otp.') || userEmail?.endsWith('.local');
    const partnerEmail: string | null = (row.partner as any)?.email ?? null;
    return {
      ...row,
      user: row.user
        ? { ...row.user, email: isOtp ? (partnerEmail ?? null) : userEmail }
        : row.user,
      partner: undefined,
    };
  });

  // Certains comptes peuvent exister en double (compte réel + compte technique OTP).
  // On déduplique pour n'afficher qu'un seul membre par e-mail, en privilégiant la
  // fiche la plus complète (nom/prénom présent).
  const dedupedByEmail = new Map<string, any>();
  for (const row of sanitized) {
    const emailKey = (row.user?.email ?? '').trim().toLowerCase();
    const fallbackKey = row.user_id ? `id:${row.user_id}` : `row:${row.id}`;
    const key = emailKey || fallbackKey;

    const existing = dedupedByEmail.get(key);
    if (!existing) {
      dedupedByEmail.set(key, row);
      continue;
    }

    const existingHasName = !!(existing.user?.first_name && existing.user?.last_name);
    const currentHasName = !!(row.user?.first_name && row.user?.last_name);

    if (!existingHasName && currentHasName) {
      dedupedByEmail.set(key, row);
    }
  }

  const deduped = [...dedupedByEmail.values()].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  res.json({ success: true, data: deduped });
};

export const getPartnerDrivers = async (req: Request, res: Response): Promise<void> => {
  const partnerId = (req as any).partnerUser?.partnerId ?? req.params.id ?? req.params.partnerId;

  const { data, error } = await db()
    .from('partner_drivers')
    .select(`
      id,
      partner_id,
      driver_user_id,
      is_default,
      created_at,
      driver:users(id, first_name, last_name, phone, avatar_url),
      profile:driver_profiles(user_id, is_online, is_available, accepts_b2b_orders, vehicle_type, completed_deliveries, rating)
    `)
    .eq('partner_id', partnerId)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: true });

  if (error) {
    logger.error('[partnerController] getPartnerDrivers error:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la récupération des livreurs attitrés' });
    return;
  }

  const rows = (data ?? []).map((row: any) => {
    const driver = Array.isArray(row.driver) ? row.driver[0] : row.driver;
    const profile = Array.isArray(row.profile) ? row.profile[0] : row.profile;
    return {
      id: row.id,
      partner_id: row.partner_id,
      driver_user_id: row.driver_user_id,
      is_default: row.is_default === true,
      created_at: row.created_at,
      driver: {
        id: row.driver_user_id,
        first_name: driver?.first_name ?? null,
        last_name: driver?.last_name ?? null,
        phone: driver?.phone ?? null,
        avatar_url: driver?.avatar_url ?? null,
      },
      profile: {
        is_online: profile?.is_online === true,
        is_available: profile?.is_available === true,
        accepts_b2b_orders: profile?.accepts_b2b_orders === true,
        vehicle_type: profile?.vehicle_type ?? 'moto',
        completed_deliveries: profile?.completed_deliveries ?? 0,
        rating: profile?.rating ?? null,
      },
    };
  });

  res.json({ success: true, data: rows });
};

export const getPartnerDriversForUser = async (req: Request, res: Response): Promise<void> => {
  const userId = (req as any).user?.id;
  const partnerId = req.params.id ?? req.params.partnerId;

  if (!userId) {
    res.status(401).json({ success: false, message: 'Non autorisé' });
    return;
  }

  if (!partnerId) {
    res.status(400).json({ success: false, message: 'partnerId manquant' });
    return;
  }

  const [membershipRes, partnerRes] = await Promise.all([
    db()
      .from('partner_users')
      .select('id, role')
      .eq('partner_id', partnerId)
      .eq('user_id', userId)
      .maybeSingle(),
    db()
      .from('partners')
      .select('status')
      .eq('id', partnerId)
      .maybeSingle(),
  ]);

  if (membershipRes.error) {
    logger.error('[partnerController] getPartnerDriversForUser membership error:', membershipRes.error);
    res.status(500).json({ success: false, message: 'Erreur lors de la vérification partenaire' });
    return;
  }

  if (!membershipRes.data) {
    res.status(403).json({ success: false, message: 'Accès refusé à ce partenaire' });
    return;
  }

  if (partnerRes.data?.status !== 'active') {
    res.status(403).json({ success: false, message: 'Compte partenaire non actif' });
    return;
  }

  (req as any).partnerUser = {
    userId,
    partnerId,
    role: membershipRes.data.role,
  };

  await getPartnerDrivers(req, res);
};

export const getPartnerOrderTracking = async (req: Request, res: Response): Promise<void> => {
  const partnerId = (req as any).partnerUser?.partnerId ?? req.params.partnerId;
  const { orderId } = req.params;

  if (!partnerId || !orderId) {
    res.status(400).json({ success: false, message: 'partnerId et orderId requis' });
    return;
  }

  try {
    const result = await (pool as any).query(
      `SELECT
        o.id,
        o.status,
        o.driver_id,
        o.pickup_address,
        o.dropoff_address,
        o.price_cfa,
        o.delivery_method,
        o.distance_km,
        o.created_at,
        o.updated_at,
        o.recipient,
        o.delivery_qr_scanned_at,
        d.first_name as driver_first_name,
        d.last_name as driver_last_name,
        d.phone as driver_phone,
        d.avatar_url as driver_avatar_url,
        dp.profile_image_url as driver_profile_image_url,
        dp.vehicle_plate as driver_vehicle_plate,
        dp.vehicle_type as driver_vehicle_type,
        dp.current_latitude as driver_lat,
        dp.current_longitude as driver_lng,
        dp.heading_degrees as driver_heading,
        latest_proof.qr_code_type as delivery_proof_method,
        latest_proof.scanned_at as delivery_proof_validated_at
      FROM orders o
      LEFT JOIN users d ON o.driver_id = d.id
      LEFT JOIN driver_profiles dp ON dp.user_id = o.driver_id
      LEFT JOIN LATERAL (
        SELECT qr_code_type, scanned_at
        FROM qr_code_scans
        WHERE order_id = o.id AND is_valid = true
        ORDER BY scanned_at DESC
        LIMIT 1
      ) latest_proof ON true
      WHERE o.id = $1 AND o.partner_id = $2
      LIMIT 1`,
      [orderId, partnerId]
    );

    if (!result.rows?.length) {
      res.status(404).json({ success: false, message: 'Commande introuvable pour ce partenaire' });
      return;
    }

    const row = result.rows[0];
    const pickup = parseLocationField(row.pickup_address);
    const dropoff = parseLocationField(row.dropoff_address);
    const recipient = parseLocationField(row.recipient);
    const status = normalizeProductStatus(row.status) ?? row.status;
    const driverCoordinates =
      row.driver_lat != null && row.driver_lng != null
        ? { latitude: Number(row.driver_lat), longitude: Number(row.driver_lng) }
        : null;
    const safeDriverCoordinates =
      driverCoordinates &&
      Number.isFinite(driverCoordinates.latitude) &&
      Number.isFinite(driverCoordinates.longitude)
        ? driverCoordinates
        : null;
    const etaLabel = etaLabelForPartnerTracking(
      status,
      safeDriverCoordinates,
      pickup,
      dropoff,
      row.delivery_method
    );
    const progress = progressWithEtaCap(status, statusBaseProgress(status), etaLabel);
    const driverName =
      row.driver_first_name || row.driver_last_name
        ? [row.driver_first_name, row.driver_last_name].filter(Boolean).join(' ')
        : null;

    res.json({
      success: true,
      data: {
        id: row.id,
        status,
        phase: orderStatusDefinition(status).phase,
        statusLabel: etaLabel ? clientHeadline(status, etaLabel) : orderStatusDefinition(status).clientLabel,
        etaLabel,
        progress,
        pickup: {
          name: pickup.name || pickup.label || 'Point de collecte',
          address: pickup.address || pickup.formatted_address || pickup.street || '',
          coordinates: toPartnerTrackingCoordinates(pickup),
        },
        dropoff: {
          name: dropoff.name || dropoff.label || recipient.name || 'Destination',
          address: dropoff.address || dropoff.formatted_address || dropoff.street || '',
          coordinates: toPartnerTrackingCoordinates(dropoff),
        },
        recipient: {
          name: recipient.name || recipient.fullName || null,
          phone: recipient.phone || null,
        },
        driver: row.driver_id
          ? {
              id: row.driver_id,
              name: driverName,
              phone: row.driver_phone || null,
              avatarUrl: row.driver_avatar_url || row.driver_profile_image_url || null,
              vehiclePlate: row.driver_vehicle_plate || null,
              vehicleType: row.driver_vehicle_type || null,
              latitude: safeDriverCoordinates?.latitude ?? null,
              longitude: safeDriverCoordinates?.longitude ?? null,
              heading: (() => {
                const heading = row.driver_heading;
                if (heading == null || heading === '') return null;
                const n = Number(heading);
                return Number.isFinite(n) ? n : null;
              })(),
            }
          : null,
        price: row.price_cfa != null ? Number(row.price_cfa) : null,
        deliveryMethod: row.delivery_method,
        distance: row.distance_km != null ? Number(row.distance_km) : null,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        proof: {
          method: row.delivery_proof_method || null,
          validatedAt: row.delivery_proof_validated_at || row.delivery_qr_scanned_at || null,
        },
      },
    });
  } catch (error: any) {
    logger.error('[partnerController] getPartnerOrderTracking error:', error);
    res.status(500).json({ success: false, message: 'Erreur lors du chargement du suivi partenaire' });
  }
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

  // generateLink crée l'utilisateur dans Auth et retourne le lien d'invitation
  // sans déléguer l'envoi email à Supabase (évite les limites de débit et les envois silencieux ratés).
  const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
    type: 'invite',
    email: normalized,
    options: {
      redirectTo,
      data: { partner_id: partnerId, partner_name: partner.name, role: 'owner' },
    },
  });

  if (linkError) {
    if (isInviteEmailAlreadyRegisteredError(linkError)) {
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
          : "Compte déjà existant : accès portail ajouté. Configurez SMTP (EMAIL_USER / EMAIL_PASS) pour envoyer les liens automatiquement.",
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
    logger.error('[partnerController] invitePortalUser generateLink error:', linkError);
    res.status(500).json({ success: false, message: linkError.message ?? "Erreur lors de la création du lien d'invitation" });
    return;
  }

  const userId = linkData.user.id;
  const actionLink: string | undefined = linkData.properties?.action_link;

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
    res.status(500).json({ success: false, message: 'Erreur lors de la liaison au partenaire' });
    return;
  }

  let emailSent = false;
  if (actionLink) {
    const sendResult = await sendPartnerPortalMagicLinkEmail(normalized, actionLink, partner.name);
    emailSent = sendResult.success;
    if (!sendResult.success) {
      logger.warn(`[partnerController] SMTP non configuré — lien d'invitation à transmettre manuellement : ${actionLink}`);
    }
  }

  res.status(201).json({
    success: true,
    message: emailSent
      ? 'Invitation envoyée par email.'
      : "Membre ajouté au portail. Configurez SMTP (EMAIL_USER / EMAIL_PASS) pour envoyer les invitations par email.",
    data: { userId, email: normalized, role: 'owner', emailSent },
  });
};

// ─── GET /api/partners/:id/invoices — admin or partner ────────────────────────
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
