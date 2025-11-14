import { Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';
import pool from '../config/db.js';
import logger from '../utils/logger.js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

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
    // Vérifier le token avec Supabase
    if (!supabaseUrl || !supabaseServiceKey) {
      logger.warn('Supabase credentials not configured, skipping Supabase token verification');
      // Fallback: vérifier dans la base de données PostgreSQL directement
      const decoded = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
      const userId = decoded.sub || decoded.user_id;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Token invalide - userId non trouvé',
        });
        return;
      }

      // Vérifier le rôle admin dans la base de données
      const result = await (pool as any).query(
        'SELECT id, role FROM users WHERE id = $1',
        [userId]
      );

      if (result.rows.length === 0) {
        res.status(401).json({
          success: false,
          message: 'Utilisateur non trouvé',
        });
        return;
      }

      const user = result.rows[0];
      logger.debug('🔍 [verifyAdminSupabase] User found:', { id: user.id, role: user.role });
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        logger.warn('⚠️ [verifyAdminSupabase] User is not admin:', user.role);
        res.status(403).json({
          success: false,
          message: 'Accès refusé - Rôle admin requis',
        });
        return;
      }

      (req as any).user = { id: user.id, role: user.role };
      logger.debug('✅ [verifyAdminSupabase] Auth successful, calling next()');
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
    const result = await (pool as any).query(
      'SELECT id, role FROM users WHERE id = $1 OR email = $2',
      [user.id, user.email]
    );

    if (result.rows.length === 0) {
      res.status(401).json({
        success: false,
        message: 'Utilisateur non trouvé dans la base de données',
      });
      return;
    }

    const dbUser = result.rows[0];
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

