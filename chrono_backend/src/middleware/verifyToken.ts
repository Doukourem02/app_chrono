import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt.js';
import { supabase, supabaseAdmin } from '../config/supabase.js';
import logger from '../utils/logger.js';

export const verifyJWT = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const auth = req.headers.authorization || req.headers.Authorization;

  if (!auth) {
    res.status(401).json({
      success: false,
      message: 'Non autorisé - En-tête Authorization manquant',
    });
    return;
  }

  const parts = (auth as string).split(' ');

  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    res.status(401).json({
      success: false,
      message: 'Format d\'autorisation invalide. Attendu: Bearer <token>',
    });
    return;
  }

  const token = parts[1];

  try {
    const decoded = verifyAccessToken(token);
    (req as any).user = decoded;
    next();
  } catch (err: any) {
    // Fallback portail web: accepte aussi le JWT Supabase (auth du portail partenaire).
    // Utile pour les routes protégées par verifyJWT mais appelées depuis une session Supabase.
    try {
      const authClient = supabaseAdmin ?? supabase;
      const { data: { user }, error } = await authClient.auth.getUser(token);

      if (!error && user?.id) {
        (req as any).user = {
          id: user.id,
          role: 'client',
          type: 'access',
        };
        next();
        return;
      }
    } catch (supabaseErr) {
      logger.warn('[verifyJWT] Supabase token fallback failed:', supabaseErr);
    }

    if (err.message === 'Token expiré') {
      res.status(401).json({
        success: false,
        message: 'Token expiré. Utilisez /refresh-token pour obtenir un nouveau token',
        code: 'TOKEN_EXPIRED',
      });
      return;
    }

    res.status(401).json({
      success: false,
      message: err.message || 'Token invalide',
      code: 'INVALID_TOKEN',
    });
  }
};

export default verifyJWT;
