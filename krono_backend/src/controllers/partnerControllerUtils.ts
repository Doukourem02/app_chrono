import { supabase, supabaseAdmin } from '../config/supabase.js';
import logger from '../utils/logger.js';
import { sendPartnerPortalMagicLinkEmail } from '../services/emailService.js';
import {
  normalizeProductStatus,
  orderStatusDefinition,
  progressWithEtaCap,
  statusBaseProgress,
} from '../utils/orderProductRules.js';
import { realisticEtaMinutesFromAirDistance } from '../utils/ivoryCoastEta.js';

export const db = () => supabaseAdmin ?? supabase;

export function getPlanTier(plan: string | null | undefined): { b2b_tier: 'small' | 'large' | null; portal_eligible: boolean } {
  if (plan === 'pro' || plan === 'business') return { b2b_tier: 'large', portal_eligible: true };
  if (plan === 'starter') return { b2b_tier: 'small', portal_eligible: false };
  return { b2b_tier: null, portal_eligible: false };
}

export const PLAN_DEFAULTS: Record<string, { monthly_price: number; included_orders: number | null; excess_commission_rate: number }> = {
  starter:  { monthly_price: 8000,  included_orders: 35,  excess_commission_rate: 0.06 },
  pro:      { monthly_price: 16000, included_orders: 70,  excess_commission_rate: 0.05 },
  business: { monthly_price: 29000, included_orders: 110, excess_commission_rate: 0.03 },
};

export const PARTNER_PAYMENT_METHODS = new Set([
  'wave',
  'orange_money',
  'mtn_money',
  'cash',
  'bank_transfer',
  'other',
]);

export const PARTNER_DRIVER_REQUEST_TYPES = new Set([
  'known_driver',
  'previous_krono_driver',
  'general_request',
]);

export function cleanOptionalUuid(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function cleanOptionalText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function readPartnerPaymentInput(
  body: Record<string, unknown>,
  options: { defaultAmount?: number; requireMethod?: boolean } = {}
): {
  error?: string;
  data?: {
    payment_method_type: string | null;
    payment_provider_account: string | null;
    payment_reference: string | null;
    payment_amount?: number | null;
    paid_at: string;
    payment_notes: string | null;
  };
} {
  const method = cleanOptionalText(body.payment_method_type ?? body.paymentMethodType)?.toLowerCase() ?? null;
  if (options.requireMethod && !method) {
    return { error: 'Moyen de paiement requis' };
  }
  if (method && !PARTNER_PAYMENT_METHODS.has(method)) {
    return { error: 'Moyen de paiement invalide' };
  }

  const amountInput = body.payment_amount ?? body.amount ?? options.defaultAmount;
  const amount =
    amountInput == null || amountInput === ''
      ? null
      : Number(amountInput);
  if (amount != null && (!Number.isFinite(amount) || amount < 0)) {
    return { error: 'Montant payé invalide' };
  }

  const paidAtInput = cleanOptionalText(body.paid_at ?? body.paidAt);
  const paidAt = paidAtInput ? new Date(paidAtInput) : new Date();
  if (Number.isNaN(paidAt.getTime())) {
    return { error: 'Date de paiement invalide' };
  }

  return {
    data: {
      payment_method_type: method,
      payment_provider_account: cleanOptionalText(body.payment_provider_account ?? body.providerAccount),
      payment_reference: cleanOptionalText(body.payment_reference ?? body.reference),
      payment_amount: amount,
      paid_at: paidAt.toISOString(),
      payment_notes: cleanOptionalText(body.payment_notes ?? body.notes),
    },
  };
}

export const PARTNER_PORTAL_LOGIN_URL = 'https://partner.kro-no-delivery.com/partner/login';

export const PAY_PER_DELIVERY_COMMISSION_RATE = 0.07;

export type PartnerTrackingCoordinates = { latitude: number; longitude: number };

export function parseLocationField(value: unknown): Record<string, any> {
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

export function partnerRecipientFromOrder(row: Record<string, any>): { name: string; phone: string } {
  const recipient = parseLocationField(row.recipient);
  const dropoff = parseLocationField(row.dropoff_address ?? row.dropoff);
  const details = parseLocationField(dropoff.details);
  const phone =
    String(recipient.phone ?? recipient.recipientPhone ?? details.phone ?? details.recipientPhone ?? '').trim();
  const name =
    String(
      recipient.name ??
        recipient.fullName ??
        details.recipient_name ??
        details.recipientName ??
        details.name ??
        dropoff.name ??
        dropoff.label ??
        ''
    ).trim() || (phone ? `Destinataire (${phone})` : 'Destinataire');
  return { name, phone };
}

export function partnerCreatorName(row: Record<string, any>): string {
  return (
    [row.creator_first_name, row.creator_last_name].filter(Boolean).join(' ').trim() ||
    row.creator_email ||
    'Client B2B'
  );
}

export function toPartnerTrackingCoordinates(value: unknown): PartnerTrackingCoordinates | null {
  const record = value as Record<string, unknown> | null | undefined;
  const coords = (record?.coordinates || record) as Record<string, unknown> | null | undefined;
  if (!coords) return null;
  const latitude = typeof coords.latitude === 'number' ? coords.latitude : Number(coords.latitude ?? coords.lat);
  const longitude = typeof coords.longitude === 'number' ? coords.longitude : Number(coords.longitude ?? coords.lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude };
}

export function calculateDistanceMeters(a: PartnerTrackingCoordinates, b: PartnerTrackingCoordinates): number {
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

export function etaLabelForPartnerTracking(
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

export function statusFromPartnerJoin(partners: unknown): string | undefined {
  if (partners == null) return undefined;
  if (Array.isArray(partners)) return (partners[0] as { status?: string } | undefined)?.status;
  if (typeof partners === 'object' && 'status' in (partners as object)) {
    return (partners as { status: string }).status;
  }
  return undefined;
}

export function isInviteEmailAlreadyRegisteredError(err: { message?: string } | null | undefined): boolean {
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

export async function ensurePublicUserProfileForAuthUser(
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

export async function resolveUserIdByEmail(normalizedEmail: string): Promise<string | null> {
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

export async function attachExistingUserAndSendPortalLink(params: {
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
