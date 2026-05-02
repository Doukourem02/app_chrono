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
    const { data: partnerUser, error: puErr } = await db
      .from('partner_users')
      .select('id, role')
      .eq('partner_id', partnerId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (puErr) logger.warn('[verifyPartnerUser] DB error:', puErr.message);

    if (!partnerUser) {
      res.status(403).json({ success: false, message: 'Accès refusé à ce partenaire' });
      return;
    }

    (req as any).partnerUser = {
      userId: user.id,
      partnerId,
      role: partnerUser.role, // 'owner' | 'manager'
    };

    next();
  } catch (err: any) {
    logger.error('[verifyPartnerUser] Error:', err);
    res.status(401).json({ success: false, message: err.message || 'Token invalide' });
  }
};
