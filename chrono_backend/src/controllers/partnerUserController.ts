import { Request, Response } from 'express';
import logger from '../utils/logger.js';
import { supabaseAdmin } from '../config/supabase.js';
import {
  db,
  PARTNER_PORTAL_LOGIN_URL,
  isInviteEmailAlreadyRegisteredError,
  ensurePublicUserProfileForAuthUser,
  attachExistingUserAndSendPortalLink,
} from './partnerControllerUtils.js';
import { sendPartnerPortalMagicLinkEmail } from '../services/emailService.js';

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
  const redirectTo = process.env.PARTNER_PORTAL_URL ?? PARTNER_PORTAL_LOGIN_URL;

  const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
    type: 'invite',
    email: normalized,
    options: {
      redirectTo,
      data: { partner_id: partnerId, partner_name: partner.name, role },
    },
  });

  if (linkError) {
    if (isInviteEmailAlreadyRegisteredError(linkError)) {
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
    logger.error('[partnerController] invitePartnerUser generateLink error:', linkError);
    res.status(500).json({ success: false, message: linkError.message ?? "Erreur lors de la création du lien d'invitation" });
    return;
  }

  const userId = linkData.user.id;
  const actionLink: string | undefined = linkData.properties?.action_link;

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
    data: { userId, email: normalized, role, emailSent },
  });
};

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
  const redirectTo = process.env.PARTNER_PORTAL_URL ?? PARTNER_PORTAL_LOGIN_URL;

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
