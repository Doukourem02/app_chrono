import { Response } from 'express';
import pool from '../config/db.js';
import logger from '../utils/logger.js';
import { AuthenticatedRequest } from '../types/index.js';

interface RegisterLiveActivityBody {
  orderId?: string;
  activityId?: string | null;
  pushToken?: string;
  liveActivityName?: string;
  props?: Record<string, unknown> | null;
}

interface EndLiveActivityBody {
  orderId?: string;
  activityId?: string | null;
  pushToken?: string | null;
}

function isValidApnsToken(token: string): boolean {
  const t = token.trim();
  return t.length >= 32 && t.length <= 512 && /^[0-9a-fA-F]+$/.test(t);
}

function normalizeText(value: unknown, max = 255): string | null {
  if (typeof value !== 'string') return null;
  const t = value.trim();
  return t ? t.slice(0, max) : null;
}

function pgCode(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === 'string' ? code : '';
  }
  return '';
}

async function userOwnsOrder(orderId: string, userId: string): Promise<boolean> {
  const result = await pool.query<{ id: string }>(
    `SELECT id FROM orders WHERE id = $1 AND user_id = $2 LIMIT 1`,
    [orderId, userId]
  );
  return Boolean(result.rows[0]);
}

export const registerLiveActivityToken = async (
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
    if (user.role !== 'client') {
      res.status(403).json({ success: false, message: 'Seul un client peut enregistrer une Live Activity' });
      return;
    }

    const body = (req.body || {}) as RegisterLiveActivityBody;
    const orderId = normalizeText(body.orderId, 64);
    const activityId = normalizeText(body.activityId, 255);
    const pushToken = normalizeText(body.pushToken, 512);
    const liveActivityName = normalizeText(body.liveActivityName, 80) || 'OrderTrackingLive';

    if (!orderId || !pushToken || !isValidApnsToken(pushToken)) {
      res.status(400).json({
        success: false,
        message: 'orderId ou pushToken Live Activity invalide',
      });
      return;
    }

    if (!(await userOwnsOrder(orderId, user.id))) {
      res.status(403).json({ success: false, message: 'Commande inaccessible' });
      return;
    }

    const props =
      body.props && typeof body.props === 'object' && !Array.isArray(body.props)
        ? JSON.stringify(body.props)
        : null;

    const result = await pool.query(
      `INSERT INTO live_activity_tokens (
         order_id, user_id, activity_id, live_activity_name, apns_push_token, last_props,
         invalidated_at, updated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, NULL, NOW())
       ON CONFLICT (apns_push_token) DO UPDATE SET
         order_id = EXCLUDED.order_id,
         user_id = EXCLUDED.user_id,
         activity_id = COALESCE(EXCLUDED.activity_id, live_activity_tokens.activity_id),
         live_activity_name = EXCLUDED.live_activity_name,
         last_props = COALESCE(EXCLUDED.last_props, live_activity_tokens.last_props),
         invalidated_at = NULL,
         updated_at = NOW()
       RETURNING id, created_at, updated_at`,
      [orderId, user.id, activityId, liveActivityName, pushToken, props]
    );

    logger.info('[live-activity-token] enregistré', {
      userIdPrefix: user.id.slice(0, 8),
      orderIdPrefix: orderId.slice(0, 8),
      hasProps: Boolean(props),
    });

    res.status(200).json({
      success: true,
      data: result.rows[0],
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error('[live-activity-token] register failed', msg);
    if (pgCode(error) === '42P01') {
      res.status(503).json({
        success: false,
        message: 'Table live_activity_tokens introuvable. Appliquer la migration 027.',
      });
      return;
    }
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

export const endLiveActivityToken = async (
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

    const body = (req.body || {}) as EndLiveActivityBody;
    const orderId = normalizeText(body.orderId, 64);
    const activityId = normalizeText(body.activityId, 255);
    const pushToken = normalizeText(body.pushToken, 512);

    if (!orderId && !activityId && !pushToken) {
      res.status(400).json({ success: false, message: 'orderId, activityId ou pushToken requis' });
      return;
    }

    const clauses = ['user_id = $1', 'invalidated_at IS NULL'];
    const values: Array<string> = [user.id];
    let index = 2;

    if (orderId) {
      clauses.push(`order_id = $${index}`);
      values.push(orderId);
      index += 1;
    }
    if (activityId) {
      clauses.push(`activity_id = $${index}`);
      values.push(activityId);
      index += 1;
    }
    if (pushToken) {
      clauses.push(`apns_push_token = $${index}`);
      values.push(pushToken);
    }

    const result = await pool.query(
      `UPDATE live_activity_tokens
       SET invalidated_at = COALESCE(invalidated_at, NOW()),
           last_apns_status = COALESCE(last_apns_status, 'ended_locally'),
           updated_at = NOW()
       WHERE ${clauses.join(' AND ')}`,
      values
    );

    res.status(200).json({
      success: true,
      data: { invalidatedCount: result.rowCount || 0 },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error('[live-activity-token] end failed', msg);
    if (pgCode(error) === '42P01') {
      res.status(503).json({
        success: false,
        message: 'Table live_activity_tokens introuvable. Appliquer la migration 027.',
      });
      return;
    }
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};
