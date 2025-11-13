import { Request, Response } from 'express';
import pool from '../config/db.js';
import logger from '../utils/logger.js';
import { maskOrderId, maskUserId } from '../utils/maskSensitiveData.js';

interface SubmitRatingBody {
  orderId: string;
  rating: number;
  comment?: string;
}

interface RequestWithUser extends Request {
  user?: {
    id: string;
  };
}

export const submitRating = async (req: RequestWithUser, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { orderId, rating, comment } = req.body as SubmitRatingBody;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'Non autorisé'
      });
      return;
    }

    if (!orderId || !rating) {
      res.status(400).json({
        success: false,
        message: 'orderId et rating sont requis'
      });
      return;
    }

    if (rating < 1 || rating > 5) {
      res.status(400).json({
        success: false,
        message: 'La note doit être entre 1 et 5'
      });
      return;
    }

    try {
      const driverColumnCheck = await (pool as any).query(
        `SELECT column_name FROM information_schema.columns 
         WHERE table_schema = 'public' 
         AND table_name = 'orders' 
         AND column_name = 'driver_id'`
      );
      const hasDriverColumn = driverColumnCheck.rows.length > 0;

      const driverSelect = hasDriverColumn ? 'driver_id' : 'NULL as driver_id';
      const orderResult = await (pool as any).query(
        `SELECT id, user_id, ${driverSelect}, status 
         FROM orders 
         WHERE id = $1`,
        [orderId]
      );

      if (!orderResult.rows || orderResult.rows.length === 0) {
        res.status(404).json({
          success: false,
          message: 'Commande non trouvée'
        });
        return;
      }

      const order = orderResult.rows[0];

      if (order.user_id !== userId) {
        res.status(403).json({
          success: false,
          message: 'Vous n\'êtes pas autorisé à évaluer cette commande'
        });
        return;
      }

      if (order.status !== 'completed') {
        res.status(400).json({
          success: false,
          message: 'Vous ne pouvez évaluer que les commandes complétées'
        });
        return;
      }

      let driverId: string | null = hasDriverColumn ? order.driver_id : null;
      
      if (!driverId) {
        try {
          const assignmentCheck = await (pool as any).query(
            `SELECT EXISTS (
               SELECT FROM information_schema.tables
               WHERE table_schema = 'public' AND table_name = 'order_assignments'
             )`
          );
          const hasOrderAssignments = assignmentCheck.rows[0]?.exists === true;

          if (hasOrderAssignments) {
            const assignmentResult = await (pool as any).query(
              `SELECT driver_id FROM order_assignments 
               WHERE order_id = $1 
               LIMIT 1`,
              [orderId]
            );
            if (assignmentResult.rows && assignmentResult.rows.length > 0) {
              driverId = assignmentResult.rows[0].driver_id;
            }
          }
        } catch (err: any) {
          logger.warn('Erreur vérification order_assignments pour rating:', err.message);
        }
      }

      if (!driverId) {
        res.status(400).json({
          success: false,
          message: 'Aucun livreur assigné à cette commande'
        });
        return;
      }

      try {
        const tableCheck = await (pool as any).query(
          `SELECT EXISTS (
             SELECT FROM information_schema.tables
             WHERE table_schema = 'public' AND table_name = 'ratings'
           )`
        );
        const tableExists = tableCheck.rows[0]?.exists === true;

        if (!tableExists) {
          logger.error('Table ratings n\'existe pas');
          res.status(500).json({
            success: false,
            message: 'Table ratings n\'existe pas. Veuillez exécuter la migration 010_create_ratings_table.sql'
          });
          return;
        }

        const columnCheck = await (pool as any).query(
          `SELECT EXISTS (
             SELECT FROM information_schema.columns
             WHERE table_schema = 'public' 
             AND table_name = 'ratings' 
             AND column_name = 'comment'
           )`
        );
        const columnExists = columnCheck.rows[0]?.exists === true;

        if (!columnExists) {
          logger.error('Colonne comment n\'existe pas dans ratings');
          res.status(500).json({
            success: false,
            message: 'Colonne comment n\'existe pas dans ratings. Veuillez exécuter la migration 010_create_ratings_table.sql'
          });
          return;
        }
      } catch (checkError: any) {
        logger.error('Erreur vérification table ratings:', checkError);
      }

      const existingRatingResult = await (pool as any).query(
        `SELECT id FROM ratings 
         WHERE order_id = $1 AND user_id = $2`,
        [orderId, userId]
      );

      let ratingId: string;

      if (existingRatingResult.rows && existingRatingResult.rows.length > 0) {
        ratingId = existingRatingResult.rows[0].id;
        logger.info(`Mise à jour évaluation existante : ${maskOrderId(ratingId)} pour commande ${maskOrderId(orderId)}`, {
          rating,
          hasComment: !!comment,
          commentLength: comment?.length || 0
        });

        try {
          await (pool as any).query(
            `UPDATE ratings 
             SET rating = $1, comment = $2, updated_at = NOW()
             WHERE id = $3`,
            [rating, comment || null, ratingId]
          );
          logger.info(`Évaluation mise à jour : ${maskOrderId(ratingId)} pour commande ${maskOrderId(orderId)}`);
        } catch (updateError: any) {
          logger.error('Erreur UPDATE ratings:', updateError);
          logger.error('Détails UPDATE:', {
            ratingId,
            rating,
            comment: comment ? comment.substring(0, 50) : null,
            errorCode: updateError.code,
            errorDetail: updateError.detail,
            errorMessage: updateError.message
          });
          throw updateError;
        }
      } else {
        logger.info(`Création nouvelle évaluation pour commande ${maskOrderId(orderId)}`, {
          userId: maskUserId(userId),
          driverId: maskUserId(driverId),
          rating,
          hasComment: !!comment,
          commentLength: comment?.length || 0
        });

        try {
          const insertResult = await (pool as any).query(
            `INSERT INTO ratings (order_id, user_id, driver_id, rating, comment)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id`,
            [orderId, userId, driverId, rating, comment || null]
          );
          ratingId = insertResult.rows[0].id;
          logger.info(`Nouvelle évaluation créée : ${maskOrderId(ratingId)} pour commande ${maskOrderId(orderId)}`);
        } catch (insertError: any) {
          logger.error('Erreur INSERT ratings:', insertError);
          logger.error('Détails INSERT:', {
            orderId,
            userId,
            driverId,
            rating,
            comment: comment ? comment.substring(0, 50) : null,
            errorCode: insertError.code,
            errorDetail: insertError.detail,
            errorMessage: insertError.message
          });
          throw insertError;
        }
      }

      res.json({
        success: true,
        message: 'Évaluation enregistrée avec succès',
        data: {
          ratingId,
          orderId,
          driverId: driverId,
          rating,
          comment: comment || null
        }
      });
    } catch (queryError: any) {
      logger.error('Erreur requête submitRating:', queryError);
      res.status(500).json({
        success: false,
        message: 'Erreur serveur lors de l\'enregistrement de l\'évaluation',
        error: queryError.message
      });
    }
  } catch (error: any) {
    logger.error('Erreur submitRating:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur',
      error: error.message
    });
  }
};

export const getDriverRatings = async (req: Request, res: Response): Promise<void> => {
  try {
    const { driverId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;

    if (!driverId) {
      res.status(400).json({
        success: false,
        message: 'driverId est requis'
      });
      return;
    }

    if (!process.env.DATABASE_URL) {
      logger.warn('DATABASE_URL non configuré pour getDriverRatings');
      res.json({
        success: true,
        data: [],
        pagination: {
          page,
          limit,
          total: 0,
          totalPages: 0
        }
      });
      return;
    }

    try {
      const ratingsResult = await (pool as any).query(
        `SELECT 
          r.id,
          r.order_id,
          r.rating,
          r.comment,
          r.created_at,
          r.updated_at,
          u.email as user_email,
          u.phone as user_phone
        FROM ratings r
        LEFT JOIN users u ON u.id = r.user_id
        WHERE r.driver_id = $1
        ORDER BY r.created_at DESC
        LIMIT $2 OFFSET $3`,
        [driverId, limit, offset]
      );

      const countResult = await (pool as any).query(
        `SELECT COUNT(*) as count FROM ratings WHERE driver_id = $1`,
        [driverId]
      );
      const total = parseInt(countResult.rows[0]?.count || '0');

      res.json({
        success: true,
        data: (ratingsResult.rows || []).map((rating: any) => ({
          id: rating.id,
          orderId: rating.order_id,
          rating: parseInt(rating.rating),
          comment: rating.comment,
          createdAt: rating.created_at,
          updatedAt: rating.updated_at,
          userEmail: rating.user_email,
          userPhone: rating.user_phone
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      });
    } catch (queryError: any) {
      logger.error('Erreur requête getDriverRatings:', queryError);
      res.json({
        success: true,
        data: [],
        pagination: {
          page,
          limit,
          total: 0,
          totalPages: 0
        }
      });
    }
  } catch (error: any) {
    logger.error('Erreur getDriverRatings:', error);
    res.json({
      success: true,
      data: [],
      pagination: {
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0
      }
    });
  }
};

export const getOrderRating = async (req: RequestWithUser, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { orderId } = req.params;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'Non autorisé'
      });
      return;
    }

    if (!orderId) {
      res.status(400).json({
        success: false,
        message: 'orderId est requis'
      });
      return;
    }

    if (!process.env.DATABASE_URL) {
      res.json({
        success: true,
        data: null
      });
      return;
    }

    try {
      const ratingResult = await (pool as any).query(
        `SELECT id, rating, comment, created_at, updated_at
         FROM ratings
         WHERE order_id = $1 AND user_id = $2`,
        [orderId, userId]
      );

      if (!ratingResult.rows || ratingResult.rows.length === 0) {
        res.json({
          success: true,
          data: null
        });
        return;
      }

      const rating = ratingResult.rows[0];
      res.json({
        success: true,
        data: {
          id: rating.id,
          rating: parseInt(rating.rating),
          comment: rating.comment,
          createdAt: rating.created_at,
          updatedAt: rating.updated_at
        }
      });
    } catch (queryError: any) {
      logger.error('Erreur requête getOrderRating:', queryError);
      res.json({
        success: true,
        data: null
      });
    }
  } catch (error: any) {
    logger.error('Erreur getOrderRating:', error);
    res.json({
      success: true,
      data: null
    });
  }
};
