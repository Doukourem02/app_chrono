import { Request, Response } from 'express';
import pool from '../config/db.js';
import logger from '../utils/logger.js';
import { db, cleanOptionalUuid, cleanOptionalText, PARTNER_DRIVER_REQUEST_TYPES } from './partnerControllerUtils.js';

export const getPartnerDrivers = async (req: Request, res: Response): Promise<void> => {
  const partnerId = (req as any).partnerUser?.partnerId ?? req.params.id ?? req.params.partnerId;

  const { data, error } = await db()
    .from('partner_drivers')
    .select(`
      id,
      partner_id,
      driver_user_id,
      is_default,
      created_at,
      driver:users(id, first_name, last_name, phone, avatar_url),
      profile:driver_profiles(user_id, is_online, is_available, accepts_b2b_orders, vehicle_type, completed_deliveries, rating)
    `)
    .eq('partner_id', partnerId)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: true });

  if (error) {
    logger.error('[partnerController] getPartnerDrivers error:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la récupération des livreurs attitrés' });
    return;
  }

  const rows = (data ?? []).map((row: any) => {
    const driver = Array.isArray(row.driver) ? row.driver[0] : row.driver;
    const profile = Array.isArray(row.profile) ? row.profile[0] : row.profile;
    return {
      id: row.id,
      partner_id: row.partner_id,
      driver_user_id: row.driver_user_id,
      is_default: row.is_default === true,
      created_at: row.created_at,
      driver: {
        id: row.driver_user_id,
        first_name: driver?.first_name ?? null,
        last_name: driver?.last_name ?? null,
        phone: driver?.phone ?? null,
        avatar_url: driver?.avatar_url ?? null,
      },
      profile: {
        is_online: profile?.is_online === true,
        is_available: profile?.is_available === true,
        accepts_b2b_orders: profile?.accepts_b2b_orders === true,
        vehicle_type: profile?.vehicle_type ?? 'moto',
        completed_deliveries: profile?.completed_deliveries ?? 0,
        rating: profile?.rating ?? null,
      },
    };
  });

  res.json({ success: true, data: rows });
};

async function attachPartnerDriver(
  partnerId: string,
  driverUserId: string,
  isDefault: boolean
): Promise<{
  row?: any;
  warning?: string;
  error?: { status: number; message: string };
}> {
  const client = await (pool as any).connect();
  try {
    await client.query('BEGIN');

    const partner = await client.query('SELECT id FROM partners WHERE id = $1 LIMIT 1', [partnerId]);
    if (partner.rowCount === 0) {
      await client.query('ROLLBACK');
      return { error: { status: 404, message: 'Partenaire introuvable' } };
    }

    const driver = await client.query(
      `SELECT
         u.id,
         u.first_name,
         u.last_name,
         u.phone,
         u.avatar_url,
         u.role,
         COALESCE(dp.accepts_b2b_orders, false) AS accepts_b2b_orders,
         COALESCE(dp.is_online, false) AS is_online,
         COALESCE(dp.is_available, false) AS is_available,
         COALESCE(dp.vehicle_type, 'moto') AS vehicle_type,
         COALESCE(dp.completed_deliveries, 0) AS completed_deliveries,
         dp.rating
       FROM users u
       LEFT JOIN driver_profiles dp ON dp.user_id = u.id
       WHERE u.id = $1
       LIMIT 1`,
      [driverUserId]
    );

    if (driver.rowCount === 0) {
      await client.query('ROLLBACK');
      return { error: { status: 404, message: 'Livreur introuvable' } };
    }

    const driverRow = driver.rows[0];
    if (driverRow.role !== 'driver') {
      await client.query('ROLLBACK');
      return { error: { status: 400, message: "Cet utilisateur n'est pas un livreur" } };
    }

    if (isDefault) {
      await client.query('UPDATE partner_drivers SET is_default = false WHERE partner_id = $1', [partnerId]);
    }

    const insert = await client.query(
      `INSERT INTO partner_drivers (partner_id, driver_user_id, is_default)
       VALUES ($1, $2, $3)
       ON CONFLICT (partner_id, driver_user_id)
       DO UPDATE SET is_default = EXCLUDED.is_default
       RETURNING id, partner_id, driver_user_id, is_default, created_at`,
      [partnerId, driverUserId, isDefault]
    );

    await client.query('COMMIT');

    const row = insert.rows[0];
    return {
      row: {
        ...row,
        driver: {
          id: driverUserId,
          first_name: driverRow.first_name ?? null,
          last_name: driverRow.last_name ?? null,
          phone: driverRow.phone ?? null,
          avatar_url: driverRow.avatar_url ?? null,
        },
        profile: {
          is_online: driverRow.is_online === true,
          is_available: driverRow.is_available === true,
          accepts_b2b_orders: driverRow.accepts_b2b_orders === true,
          vehicle_type: driverRow.vehicle_type ?? 'moto',
          completed_deliveries: driverRow.completed_deliveries ?? 0,
          rating: driverRow.rating ?? null,
        },
      },
      warning: driverRow.accepts_b2b_orders === true
        ? undefined
        : "Ce livreur est rattaché mais il n'accepte pas encore les commandes B2B.",
    };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

export const addPartnerDriver = async (req: Request, res: Response): Promise<void> => {
  const partnerId = req.params.id ?? req.params.partnerId;
  const driverUserId = cleanOptionalUuid((req.body as any).driver_user_id);
  const isDefault = (req.body as any).is_default === true;

  if (!partnerId || !driverUserId) {
    res.status(400).json({ success: false, message: 'partnerId et driver_user_id sont requis' });
    return;
  }

  try {
    const result = await attachPartnerDriver(partnerId, driverUserId, isDefault);
    if (result.error) {
      res.status(result.error.status).json({ success: false, message: result.error.message });
      return;
    }
    res.status(201).json({ success: true, data: result.row, warning: result.warning });
  } catch (error) {
    logger.error('[partnerController] addPartnerDriver error:', error);
    res.status(500).json({ success: false, message: 'Erreur lors du rattachement du livreur' });
  }
};

export const removePartnerDriver = async (req: Request, res: Response): Promise<void> => {
  const partnerId = req.params.id ?? req.params.partnerId;
  const driverUserId = req.params.driverUserId;

  const result = await (pool as any).query(
    'DELETE FROM partner_drivers WHERE partner_id = $1 AND driver_user_id = $2 RETURNING id',
    [partnerId, driverUserId]
  );

  if (result.rowCount === 0) {
    res.status(404).json({ success: false, message: 'Livreur dédié introuvable' });
    return;
  }

  res.json({ success: true });
};

export const setDefaultPartnerDriver = async (req: Request, res: Response): Promise<void> => {
  const partnerId = req.params.id ?? req.params.partnerId;
  const driverUserId = req.params.driverUserId;
  const client = await (pool as any).connect();

  try {
    await client.query('BEGIN');
    const exists = await client.query(
      'SELECT id FROM partner_drivers WHERE partner_id = $1 AND driver_user_id = $2 LIMIT 1',
      [partnerId, driverUserId]
    );
    if (exists.rowCount === 0) {
      await client.query('ROLLBACK');
      res.status(404).json({ success: false, message: 'Livreur dédié introuvable' });
      return;
    }
    await client.query('UPDATE partner_drivers SET is_default = false WHERE partner_id = $1', [partnerId]);
    const updated = await client.query(
      `UPDATE partner_drivers
          SET is_default = true
        WHERE partner_id = $1 AND driver_user_id = $2
        RETURNING id, partner_id, driver_user_id, is_default, created_at`,
      [partnerId, driverUserId]
    );
    await client.query('COMMIT');
    res.json({ success: true, data: updated.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    logger.error('[partnerController] setDefaultPartnerDriver error:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la définition du livreur par défaut' });
  } finally {
    client.release();
  }
};

export const createPartnerDriverRequest = async (req: Request, res: Response): Promise<void> => {
  const partnerId = (req as any).partnerUser?.partnerId ?? req.params.partnerId ?? req.params.id;
  const createdByUserId = (req as any).partnerUser?.userId ?? (req as any).user?.id ?? null;
  const {
    request_type,
    driver_name,
    driver_phone,
    source_order_id,
    comment,
  } = req.body as Record<string, unknown>;

  const requestType = typeof request_type === 'string' ? request_type.trim() : '';
  if (!PARTNER_DRIVER_REQUEST_TYPES.has(requestType)) {
    res.status(400).json({ success: false, message: 'Type de demande invalide' });
    return;
  }

  const { data, error } = await db()
    .from('partner_driver_requests')
    .insert({
      partner_id: partnerId,
      request_type: requestType,
      driver_name: cleanOptionalText(driver_name),
      driver_phone: cleanOptionalText(driver_phone),
      source_order_id: cleanOptionalUuid(source_order_id),
      comment: cleanOptionalText(comment),
      created_by_user_id: createdByUserId,
    })
    .select('*')
    .single();

  if (error) {
    logger.error('[partnerController] createPartnerDriverRequest error:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la création de la demande' });
    return;
  }

  res.status(201).json({ success: true, data });
};

export const listPartnerDriverRequests = async (req: Request, res: Response): Promise<void> => {
  const partnerId = req.params.id ?? req.params.partnerId;
  const status = typeof req.query.status === 'string' ? req.query.status : undefined;

  let query = db()
    .from('partner_driver_requests')
    .select('*')
    .eq('partner_id', partnerId)
    .order('created_at', { ascending: false });

  if (status && status !== 'all') query = query.eq('status', status);

  const { data, error } = await query;
  if (error) {
    logger.error('[partnerController] listPartnerDriverRequests error:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la récupération des demandes' });
    return;
  }

  res.json({ success: true, data: data ?? [] });
};

export const reviewPartnerDriverRequest = async (req: Request, res: Response): Promise<void> => {
  const partnerId = req.params.id ?? req.params.partnerId;
  const requestId = req.params.requestId;
  const adminId = (req as any).user?.id ?? null;
  const action = String((req.body as any).action ?? '').trim();
  const reviewNote = cleanOptionalText((req.body as any).review_note);
  const driverUserId = cleanOptionalUuid((req.body as any).driver_user_id);
  const isDefault = (req.body as any).is_default === true;

  if (action !== 'approve' && action !== 'reject') {
    res.status(400).json({ success: false, message: 'Action invalide' });
    return;
  }
  if (action === 'approve' && !driverUserId) {
    res.status(400).json({ success: false, message: 'driver_user_id requis pour valider une demande' });
    return;
  }

  try {
    let warning: string | undefined;
    if (action === 'approve' && driverUserId) {
      const attached = await attachPartnerDriver(partnerId, driverUserId, isDefault);
      if (attached.error) {
        res.status(attached.error.status).json({ success: false, message: attached.error.message });
        return;
      }
      warning = attached.warning;
    }

    const { data, error } = await db()
      .from('partner_driver_requests')
      .update({
        status: action === 'approve' ? 'approved' : 'rejected',
        reviewed_by_admin_id: adminId,
        review_note: reviewNote,
        approved_driver_user_id: action === 'approve' ? driverUserId : null,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', requestId)
      .eq('partner_id', partnerId)
      .select('*')
      .single();

    if (error || !data) {
      logger.error('[partnerController] reviewPartnerDriverRequest error:', error);
      res.status(404).json({ success: false, message: 'Demande introuvable' });
      return;
    }

    res.json({ success: true, data, warning });
  } catch (error) {
    logger.error('[partnerController] reviewPartnerDriverRequest unexpected error:', error);
    res.status(500).json({ success: false, message: 'Erreur lors du traitement de la demande' });
  }
};

export const getPartnerDriversForUser = async (req: Request, res: Response): Promise<void> => {
  const userId = (req as any).user?.id;
  const partnerId = req.params.id ?? req.params.partnerId;

  if (!userId) {
    res.status(401).json({ success: false, message: 'Non autorisé' });
    return;
  }

  if (!partnerId) {
    res.status(400).json({ success: false, message: 'partnerId manquant' });
    return;
  }

  const [membershipRes, partnerRes] = await Promise.all([
    db()
      .from('partner_users')
      .select('id, role')
      .eq('partner_id', partnerId)
      .eq('user_id', userId)
      .maybeSingle(),
    db()
      .from('partners')
      .select('status')
      .eq('id', partnerId)
      .maybeSingle(),
  ]);

  if (membershipRes.error) {
    logger.error('[partnerController] getPartnerDriversForUser membership error:', membershipRes.error);
    res.status(500).json({ success: false, message: 'Erreur lors de la vérification partenaire' });
    return;
  }

  if (!membershipRes.data) {
    res.status(403).json({ success: false, message: 'Accès refusé à ce partenaire' });
    return;
  }

  if (partnerRes.data?.status !== 'active') {
    res.status(403).json({ success: false, message: 'Compte partenaire non actif' });
    return;
  }

  (req as any).partnerUser = {
    userId,
    partnerId,
    role: membershipRes.data.role,
  };

  await getPartnerDrivers(req, res);
};
