import { Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';
import pool from '../config/db.js';
import logger from '../utils/logger.js';
import { verifyAccessToken } from '../utils/jwt.js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function isTransientPgError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  const code = typeof (error as { code?: string }).code === 'string' ? (error as { code: string }).code : '';
  return (
    /timeout/i.test(msg) ||
    /Connection terminated/i.test(msg) ||
    code === 'ETIMEDOUT' ||
    code === 'ECONNRESET' ||
    code === 'ECONNREFUSED' ||
    code === 'ENOTFOUND'
  );
}

async function queryAdminUserFromPool(userId: string, email: string) {
  const maxAttempts = Math.min(
    Math.max(1, parseInt(process.env.ADMIN_PG_ROLE_QUERY_ATTEMPTS || '3', 10)),
    5,
  );
  const baseDelayMs = parseInt(process.env.ADMIN_PG_ROLE_QUERY_RETRY_MS || '250', 10);
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await (pool as any).query('SELECT id, role FROM users WHERE id = $1 OR email = $2', [
        userId,
        email,
      ]);
    } catch (dbError) {
      lastError = dbError;
      if (attempt < maxAttempts && isTransientPgError(dbError)) {
        await new Promise((r) => setTimeout(r, baseDelayMs * attempt));
        continue;
      }
      throw dbError;
    }
  }
  throw lastError;
}

/**
 * Middleware pour vérifier les tokens Supabase et le rôle admin
 * Utilisé pour l'admin dashboard qui utilise Supabase Auth
 */
export const verifyAdminSupabase = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  logger.debug('🔍 [verifyAdminSupabase] Checking auth for:', req.path);
  const auth = req.headers.authorization || req.headers.Authorization;

  if (!auth) {
    logger.warn('⚠️ [verifyAdminSupabase] No authorization header for:', req.path);
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
    // Vérifier le token avec Supabase (mode normal en production)
    if (!supabaseUrl || !supabaseServiceKey) {
      // IMPORTANT: ne jamais "décoder" un JWT sans vérifier sa signature (risque d'usurpation).
      // En prod, l'admin doit fonctionner avec un SUPABASE_SERVICE_ROLE_KEY correctement configuré.
      const allowJwtFallback = process.env.ALLOW_ADMIN_JWT_FALLBACK === 'true';

      if (!allowJwtFallback) {
        logger.error(
          'Supabase credentials not configured (SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY). ' +
            'Admin routes are disabled for security.'
        );
        res.status(500).json({
          success: false,
          message: 'Configuration serveur incomplète (admin auth).',
        });
        return;
      }

      // Fallback DEV (optionnel): accepter uniquement nos JWT signés (JWT_SECRET) + rôle admin.
      const decoded = verifyAccessToken(token);
      const userId = decoded.id;

      const result = await (pool as any).query('SELECT id, role FROM users WHERE id = $1', [userId]);
      if (result.rows.length === 0) {
        res.status(401).json({ success: false, message: 'Utilisateur non trouvé' });
        return;
      }

      const user = result.rows[0];
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        res.status(403).json({ success: false, message: 'Accès refusé - Rôle admin requis' });
        return;
      }

      (req as any).user = { id: user.id, role: user.role };
      next();
      return;
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      res.status(401).json({
        success: false,
        message: 'Token Supabase invalide',
      });
      return;
    }

    // Vérifier le rôle admin dans la base de données
    // Essayer d'abord avec PostgreSQL, puis fallback sur Supabase
    let dbUser: any = null;
    
    try {
      const result = await queryAdminUserFromPool(user.id, user.email ?? '');

      if (result.rows.length > 0) {
        dbUser = result.rows[0];
      }
    } catch (dbError: unknown) {
      const errMsg = dbError instanceof Error ? dbError.message : String(dbError);
      logger.warn('⚠️ [verifyAdminSupabase] Erreur de connexion PostgreSQL, utilisation de Supabase comme fallback:', { error: errMsg });
      
      // Fallback: utiliser Supabase pour vérifier le rôle
      if (supabaseUrl && supabaseServiceKey) {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        const { data: supabaseUser, error: supabaseError } = await supabase
          .from('users')
          .select('id, role')
          .or(`id.eq.${user.id},email.eq.${user.email}`)
          .single();

        if (!supabaseError && supabaseUser) {
          dbUser = supabaseUser;
        }
      }
    }

    if (!dbUser) {
      res.status(401).json({
        success: false,
        message: 'Utilisateur non trouvé dans la base de données',
      });
      return;
    }

    if (dbUser.role !== 'admin' && dbUser.role !== 'super_admin') {
      res.status(403).json({
        success: false,
        message: 'Accès refusé - Rôle admin requis',
      });
      return;
    }

    (req as any).user = { id: dbUser.id, role: dbUser.role };
    next();
  } catch (err: any) {
    logger.error('Error verifying admin Supabase token:', err);
    res.status(401).json({
      success: false,
      message: err.message || 'Token invalide',
    });
  }
};

export default verifyAdminSupabase;

