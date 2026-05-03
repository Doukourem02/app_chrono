import { Request, Response, NextFunction } from 'express';
import { supabase, supabaseAdmin } from '../config/supabase.js';
import logger from '../utils/logger.js';

// Vérifie que l'utilisateur authentifié appartient au partenaire ciblé (via partner_users)
// Lit req.params.partnerId ou req.params.id selon la route
export const verifyPartnerUser = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const auth = req.headers.authorization || req.headers.Authorization;

  if (!auth) {
    res.status(401).json({ success: false, message: 'Authorization manquant' });
    return;
  }

  const parts = (auth as string).split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    res.status(401).json({ success: false, message: 'Format Authorization invalide' });
    return;
  }

  const token = parts[1]!;

  try {
    const authClient = supabaseAdmin ?? supabase;
    const { data: { user }, error } = await authClient.auth.getUser(token);

    if (error || !user) {
      res.status(401).json({ success: false, message: 'Token invalide' });
      return;
    }

    const partnerId = req.params.partnerId ?? req.params.id;
    if (!partnerId) {
      res.status(400).json({ success: false, message: 'partnerId manquant dans la route' });
      return;
    }

    const db = supabaseAdmin ?? supabase;

    const [puRes, partnerRes] = await Promise.all([
      db
        .from('partner_users')
        .select('id, role')
        .eq('partner_id', partnerId)
        .eq('user_id', user.id)
        .maybeSingle(),
      db
        .from('partners')
        .select('status')
        .eq('id', partnerId)
        .maybeSingle(),
    ]);

    if (puRes.error) logger.warn('[verifyPartnerUser] DB error:', puRes.error.message);

    if (!puRes.data) {
      res.status(403).json({ success: false, message: 'Accès refusé à ce partenaire' });
      return;
    }

    if (puRes.data.role !== 'owner') {
      res.status(403).json({ success: false, message: 'Accès réservé au propriétaire du compte partenaire' });
      return;
    }

    const partnerStatus = partnerRes.data?.status;
    if (partnerStatus !== 'active') {
      const STATUS_MESSAGES: Record<string, string> = {
        pending:   'Votre compte partenaire est en attente de validation par un administrateur Krono.',
        inactive:  'Votre compte partenaire est inactif. Contactez le support Krono pour le réactiver.',
        suspended: 'Votre compte partenaire est suspendu. Contactez le support Krono.',
      };
      res.status(403).json({
        success: false,
        code: `partner_${partnerStatus ?? 'unavailable'}`,
        message: STATUS_MESSAGES[partnerStatus ?? ''] ?? 'Accès partenaire non disponible.',
      });
      return;
    }

    (req as any).partnerUser = {
      userId: user.id,
      partnerId,
      role: puRes.data.role,
    };

    next();
  } catch (err: any) {
    logger.error('[verifyPartnerUser] Error:', err);
    res.status(401).json({ success: false, message: err.message || 'Token invalide' });
  }
};
