import { Response } from 'express';
import pool from '../config/db.js';
import logger from '../utils/logger.js';
import { AuthenticatedRequest } from '../types/index.js';

type AppRole = 'client' | 'driver';
type Platform = 'ios' | 'android';

interface RegisterPushBody {
  expoPushToken?: string;
  platform?: string;
  app?: string;
  deviceId?: string | null;
}

interface UnregisterPushBody {
  expoPushToken?: string;
  app?: string;
  deviceId?: string | null;
}

function isValidExpoPushToken(token: string): boolean {
  const t = token.trim();
  if (t.length < 24 || t.length > 512) return false;
  return t.startsWith('ExponentPushToken[') || t.startsWith('ExpoPushToken[');
}

/** Code / détails pg même si l'erreur est enveloppée (cause, AggregateError). */
function pickPgError(error: unknown): {
  code?: string;
  message?: string;
  detail?: string;
  constraint?: string;
} {
  const seen = new Set<unknown>();
  const walk = (e: unknown): { code?: string; message?: string; detail?: string; constraint?: string } => {
    if (!e || typeof e !== 'object' || seen.has(e)) return {};
    seen.add(e);
    const o = e as Record<string, unknown>;
    const code = typeof o.code === 'string' ? o.code : undefined;
    const message = typeof o.message === 'string' ? o.message : undefined;
    const detail = typeof o.detail === 'string' ? o.detail : undefined;
    const constraint = typeof o.constraint === 'string' ? o.constraint : undefined;
    if (code && /^[0-9A-Z]{5}$/.test(code)) {
      return { code, message, detail, constraint };
    }
    if (typeof o.cause !== 'undefined') {
      const inner = walk(o.cause);
      if (inner.code) return { ...inner, message: inner.message || message, detail: inner.detail || detail };
    }
    if (e instanceof AggregateError && Array.isArray(e.errors)) {
      for (const sub of e.errors) {
        const inner = walk(sub);
        if (inner.code) return { ...inner, message: inner.message || message };
      }
    }
    return { message, detail, constraint, code };
  };
  return walk(error);
}

/**
 * POST /api/push/register — enregistre ou met à jour un token Expo Push (JWT requis).
 * Body: { expoPushToken, platform: "ios"|"android", app: "client"|"driver", deviceId? }
 */
export const registerPushToken = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    if (!process.env.DATABASE_URL) {
      res.status(503).json({ success: false, message: 'Base de données non configurée' });
      return;
    }

    const user = req.user;
    if (!user?.id) {
      res.status(401).json({ success: false, message: 'Non authentifié' });
      return;
    }

    const body = req.body as RegisterPushBody;
    const expoPushToken =
      typeof body.expoPushToken === 'string' ? body.expoPushToken.trim() : '';
    const platform = (body.platform || '').toLowerCase() as Platform;
    const app = (body.app || '').toLowerCase() as AppRole;

    if (!expoPushToken || !isValidExpoPushToken(expoPushToken)) {
      res.status(400).json({
        success: false,
        message: 'expoPushToken invalide ou manquant',
      });
      return;
    }

    if (platform !== 'ios' && platform !== 'android') {
      res.status(400).json({
        success: false,
        message: 'platform doit être "ios" ou "android"',
      });
      return;
    }

    if (app !== 'client' && app !== 'driver') {
      res.status(400).json({
        success: false,
        message: 'app doit être "client" ou "driver"',
      });
      return;
    }

    if (app === 'client' && user.role !== 'client') {
      res.status(403).json({
        success: false,
        message: 'Seul un compte client peut enregistrer app: client',
      });
      return;
    }

    if (app === 'driver' && user.role !== 'driver') {
      res.status(403).json({
        success: false,
        message: 'Seul un compte livreur peut enregistrer app: driver',
      });
      return;
    }

    const deviceId =
      typeof body.deviceId === 'string' && body.deviceId.trim().length > 0
        ? body.deviceId.trim().slice(0, 255)
        : null;

    const result = await pool.query(
      `INSERT INTO push_tokens (
        user_id, expo_push_token, platform, app_role, device_id, invalidated_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, NULL, NOW())
      ON CONFLICT (expo_push_token) DO UPDATE SET
        user_id = EXCLUDED.user_id,
        platform = EXCLUDED.platform,
        app_role = EXCLUDED.app_role,
        device_id = COALESCE(EXCLUDED.device_id, push_tokens.device_id),
        invalidated_at = NULL,
        updated_at = NOW()
      RETURNING id, created_at, updated_at`,
      [user.id, expoPushToken, platform, app, deviceId]
    );

    const row = result.rows[0];
    if (!row) {
      logger.error('registerPushToken: INSERT sans ligne RETURNING', {
        userId: user.id,
        rowCount: result.rowCount,
      });
      res.status(503).json({
        success: false,
        message:
          'Insertion push_tokens sans ligne renvoyée. Souvent causé par RLS (Supabase) : autoriser SELECT/INSERT pour le rôle de DATABASE_URL, ou désactiver RLS sur push_tokens pour le backend.',
      });
      return;
    }

    logger.info('push_tokens enregistré', {
      userId: user.id,
      app_role: app,
      platform,
    });

    res.status(200).json({
      success: true,
      data: {
        id: row.id,
        created_at: row.created_at,
        updated_at: row.updated_at,
      },
    });
  } catch (error: unknown) {
    const err = pickPgError(error);
    logger.error('registerPushToken failed', {
      code: err.code,
      message: err.message,
      detail: err.detail,
      constraint: err.constraint,
    });

    if (err.code === '42P01') {
      res.status(503).json({
        success: false,
        message: 'Table push_tokens introuvable. Appliquer la migration 023 sur la même base que DATABASE_URL (Render).',
      });
      return;
    }
    if (err.code === '23503') {
      res.status(400).json({
        success: false,
        message: 'Utilisateur introuvable pour ce token (clé étrangère).',
      });
      return;
    }
    if (err.code === '42501') {
      res.status(503).json({
        success: false,
        message: 'Permission PostgreSQL refusée sur push_tokens (rôle DB / RLS).',
      });
      return;
    }
    if (err.code === '42703') {
      res.status(503).json({
        success: false,
        message: 'Schéma push_tokens incohérent — revérifier la migration 023.',
      });
      return;
    }
    if (err.code === '23514') {
      res.status(400).json({
        success: false,
        message: 'Données incohérentes avec les contraintes push_tokens (CHECK).',
      });
      return;
    }
    if (err.code === '22P02') {
      res.status(400).json({
        success: false,
        message: 'Identifiant utilisateur invalide (UUID).',
      });
      return;
    }

    // Code court (PostgreSQL 23503, etc. ou Node ECONNREFUSED) — pas un secret, aide au debug sans ouvrir les logs
    res.status(500).json({
      success: false,
      message: 'Erreur serveur',
      ...(err.code ? { errCode: err.code } : {}),
    });
  }
};

/**
 * DELETE /api/push/register — invalide un token push courant (JWT requis).
 * Body optionnel: { expoPushToken?, app: "client"|"driver" }
 * Si expoPushToken absent: invalide tous les tokens actifs de l'utilisateur pour l'app demandée.
 */
export const unregisterPushToken = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    if (!process.env.DATABASE_URL) {
      res.status(503).json({ success: false, message: 'Base de données non configurée' });
      return;
    }

    const user = req.user;
    if (!user?.id) {
      res.status(401).json({ success: false, message: 'Non authentifié' });
      return;
    }

    const body = (req.body || {}) as UnregisterPushBody;
    const app = (body.app || '').toLowerCase() as AppRole;
    const token = typeof body.expoPushToken === 'string' ? body.expoPushToken.trim() : '';
    const deviceId =
      typeof body.deviceId === 'string' && body.deviceId.trim().length > 0
        ? body.deviceId.trim().slice(0, 255)
        : null;

    if (app !== 'client' && app !== 'driver') {
      res.status(400).json({
        success: false,
        message: 'app doit être "client" ou "driver"',
      });
      return;
    }

    let query = `UPDATE push_tokens
      SET invalidated_at = COALESCE(invalidated_at, NOW()), updated_at = NOW()
      WHERE user_id = $1 AND app_role = $2 AND invalidated_at IS NULL`;
    const values: Array<string | null> = [user.id, app];

    if (token) {
      query += ' AND expo_push_token = $3';
      values.push(token);
    } else if (deviceId) {
      query += ' AND device_id = $3';
      values.push(deviceId);
    }

    const result = await pool.query(query, values);
    logger.info('push_tokens invalidé(s) à la déconnexion', {
      userId: user.id,
      app_role: app,
      count: result.rowCount || 0,
      by: token ? 'token' : deviceId ? 'device_id' : 'app_scope',
    });

    res.status(200).json({
      success: true,
      data: { invalidatedCount: result.rowCount || 0 },
    });
  } catch (error: unknown) {
    const err = pickPgError(error);
    logger.error('unregisterPushToken failed', {
      code: err.code,
      message: err.message,
      detail: err.detail,
      constraint: err.constraint,
    });
    res.status(500).json({
      success: false,
      message: 'Erreur serveur',
      ...(err.code ? { errCode: err.code } : {}),
    });
  }
};
