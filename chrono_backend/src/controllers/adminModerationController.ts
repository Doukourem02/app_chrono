import { Request, Response } from 'express';
import pool from '../config/db.js';
import logger from '../utils/logger.js';

export const getAdminRatings = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;
    const driverId = req.query.driverId as string | undefined;
    const clientId = req.query.clientId as string | undefined;
    const minRating = req.query.minRating ? parseInt(req.query.minRating as string) : undefined;
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;

    logger.info('🚀 [getAdminRatings] DÉBUT', { page, limit, driverId, clientId });

    if (!process.env.DATABASE_URL) {
      res.json({ success: true, data: [], pagination: { page, limit, total: 0, totalPages: 0 } });
      return;
    }

    const ratingsTableCheck = await (pool as any).query(
      `SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'ratings'
      )`
    );

    if (!ratingsTableCheck.rows[0]?.exists) {
      res.json({ success: true, data: [], pagination: { page, limit, total: 0, totalPages: 0 } });
      return;
    }

    let query = `
      SELECT
        r.*,
        u.email as user_email, u.phone as user_phone,
        u.first_name as user_first_name, u.last_name as user_last_name,
        d.email as driver_email, d.phone as driver_phone,
        d.first_name as driver_first_name, d.last_name as driver_last_name,
        o.id as order_id_full
      FROM ratings r
      LEFT JOIN users u ON r.user_id = u.id
      LEFT JOIN users d ON r.driver_id = d.id
      LEFT JOIN orders o ON r.order_id = o.id
      WHERE 1=1
    `;

    const params: any[] = [];
    let paramIndex = 1;

    if (driverId) { query += ` AND r.driver_id = $${paramIndex}`; params.push(driverId); paramIndex++; }
    if (clientId) { query += ` AND r.user_id = $${paramIndex}`; params.push(clientId); paramIndex++; }
    if (minRating) { query += ` AND r.rating = $${paramIndex}`; params.push(minRating); paramIndex++; }
    if (startDate) { query += ` AND r.created_at >= $${paramIndex}`; params.push(startDate); paramIndex++; }
    if (endDate) { query += ` AND r.created_at <= $${paramIndex}`; params.push(endDate); paramIndex++; }

    const countQuery = query.replace(/SELECT[\s\S]*?FROM/, 'SELECT COUNT(*) as count FROM');
    query += ` ORDER BY r.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await (pool as any).query(query, params);
    const countResult = await (pool as any).query(countQuery, params.slice(0, -2));
    const total = parseInt(countResult.rows[0]?.count || '0');

    res.json({
      success: true,
      data: result.rows || [],
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error: any) {
    logger.error('Erreur getAdminRatings:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur', error: error.message });
  }
};

export const deleteAdminRating = async (req: Request, res: Response): Promise<void> => {
  try {
    const { ratingId } = req.params;
    logger.info('🚀 [deleteAdminRating] DÉBUT', { ratingId });

    if (!process.env.DATABASE_URL) {
      res.status(400).json({ success: false, message: 'Database non disponible' });
      return;
    }

    const ratingsTableCheck = await (pool as any).query(
      `SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'ratings'
      )`
    );

    if (!ratingsTableCheck.rows[0]?.exists) {
      res.status(404).json({ success: false, message: 'Évaluation non trouvée' });
      return;
    }

    const deleteResult = await (pool as any).query(`DELETE FROM ratings WHERE id = $1 RETURNING *`, [ratingId]);

    if (deleteResult.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Évaluation non trouvée' });
      return;
    }

    res.json({ success: true, message: 'Évaluation supprimée avec succès' });
  } catch (error: any) {
    logger.error('Erreur deleteAdminRating:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur', error: error.message });
  }
};

export const getAdminPromoCodes = async (req: Request, res: Response): Promise<void> => {
  try {
    logger.info('🚀 [getAdminPromoCodes] DÉBUT');

    if (!process.env.DATABASE_URL) {
      res.json({ success: true, data: [] });
      return;
    }

    const tableCheck = await (pool as any).query(
      `SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'promo_codes'
      )`
    );

    if (!tableCheck.rows[0]?.exists) {
      res.json({ success: true, data: [] });
      return;
    }

    const result = await (pool as any).query(`SELECT * FROM promo_codes ORDER BY created_at DESC`);
    res.json({ success: true, data: result.rows || [] });
  } catch (error: any) {
    logger.error('Erreur getAdminPromoCodes:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur', error: error.message });
  }
};

export const createAdminPromoCode = async (req: Request, res: Response): Promise<void> => {
  try {
    const { code, discountType, discountValue, maxUses, validFrom, validUntil, isActive } = req.body;
    logger.info('🚀 [createAdminPromoCode] DÉBUT', { code });

    if (!process.env.DATABASE_URL) {
      res.status(400).json({ success: false, message: 'Database non disponible' });
      return;
    }

    const tableCheck = await (pool as any).query(
      `SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'promo_codes'
      )`
    );

    if (!tableCheck.rows[0]?.exists) {
      await (pool as any).query(`
        CREATE TABLE IF NOT EXISTS promo_codes (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          code VARCHAR(50) UNIQUE NOT NULL,
          discount_type VARCHAR(20) NOT NULL,
          discount_value NUMERIC NOT NULL,
          max_uses INTEGER,
          current_uses INTEGER DEFAULT 0,
          valid_from TIMESTAMP,
          valid_until TIMESTAMP,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `);
    }

    const result = await (pool as any).query(
      `INSERT INTO promo_codes (code, discount_type, discount_value, max_uses, valid_from, valid_until, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [code, discountType, discountValue, maxUses || null, validFrom || null, validUntil || null, isActive !== false]
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    logger.error('Erreur createAdminPromoCode:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur', error: error.message });
  }
};

export const getAdminDisputes = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;
    const status = req.query.status as string | undefined;

    logger.info('🚀 [getAdminDisputes] DÉBUT', { page, limit, status });

    if (!process.env.DATABASE_URL) {
      res.json({ success: true, data: [], pagination: { page, limit, total: 0, totalPages: 0 } });
      return;
    }

    const tableCheck = await (pool as any).query(
      `SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'payment_disputes'
      )`
    );

    if (!tableCheck.rows[0]?.exists) {
      res.json({ success: true, data: [], pagination: { page, limit, total: 0, totalPages: 0 } });
      return;
    }

    let query = `
      SELECT
        d.*,
        u.email as user_email, u.phone as user_phone,
        o.id as order_id_full
      FROM payment_disputes d
      LEFT JOIN users u ON d.user_id = u.id
      LEFT JOIN orders o ON d.order_id = o.id
      WHERE 1=1
    `;

    const params: any[] = [];
    let paramIndex = 1;

    if (status) { query += ` AND d.status = $${paramIndex}`; params.push(status); paramIndex++; }

    const countQuery = query.replace(/SELECT[\s\S]*?FROM/, 'SELECT COUNT(*) as count FROM');
    query += ` ORDER BY d.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await (pool as any).query(query, params);
    const countResult = await (pool as any).query(countQuery, params.slice(0, -2));
    const total = parseInt(countResult.rows[0]?.count || '0');

    res.json({
      success: true,
      data: result.rows || [],
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error: any) {
    logger.error('Erreur getAdminDisputes:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur', error: error.message });
  }
};

export const updateAdminDispute = async (req: Request, res: Response): Promise<void> => {
  try {
    const { disputeId } = req.params;
    const { status, adminNotes } = req.body;

    logger.info('🚀 [updateAdminDispute] DÉBUT', { disputeId, status });

    if (!process.env.DATABASE_URL) {
      res.status(400).json({ success: false, message: 'Database non disponible' });
      return;
    }

    const tableCheck = await (pool as any).query(
      `SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'payment_disputes'
      )`
    );

    if (!tableCheck.rows[0]?.exists) {
      res.status(404).json({ success: false, message: 'Dispute non trouvée' });
      return;
    }

    const updateFields: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (status) { updateFields.push(`status = $${paramIndex}`); params.push(status); paramIndex++; }
    if (adminNotes) { updateFields.push(`admin_notes = $${paramIndex}`); params.push(adminNotes); paramIndex++; }

    if (updateFields.length === 0) {
      res.status(400).json({ success: false, message: 'Aucun champ à mettre à jour' });
      return;
    }

    updateFields.push(`updated_at = NOW()`);
    params.push(disputeId);

    const result = await (pool as any).query(
      `UPDATE payment_disputes SET ${updateFields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      params
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Dispute non trouvée' });
      return;
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    logger.error('Erreur updateAdminDispute:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur', error: error.message });
  }
};
