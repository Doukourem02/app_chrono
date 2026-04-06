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

function isValidExpoPushToken(token: string): boolean {
  const t = token.trim();
  if (t.length < 24 || t.length > 512) return false;
  return t.startsWith('ExponentPushToken[') || t.startsWith('ExpoPushToken[');
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
      logger.error('registerPushToken: INSERT sans ligne RETURNING');
      res.status(500).json({ success: false, message: 'Erreur serveur' });
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
    const err = error as {
      code?: string;
      message?: string;
      detail?: string;
      constraint?: string;
    };
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
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};
