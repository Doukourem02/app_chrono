import pool from '../config/db.js';
import logger from '../utils/logger.js';

/**
 * ⭐ Soumettre une évaluation d'un livreur par un client
 * POST /api/ratings
 */
export const submitRating = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { orderId, rating, comment } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Non autorisé'
      });
    }

    if (!orderId || !rating) {
      return res.status(400).json({
        success: false,
        message: 'orderId et rating sont requis'
      });
    }

    // Valider que la note est entre 1 et 5
    if (rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'La note doit être entre 1 et 5'
      });
    }

    // Vérifier que la commande existe, appartient au client et est complétée
    try {
      // Détecter dynamiquement si driver_id existe dans orders
      const driverColumnCheck = await pool.query(
        `SELECT column_name FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = 'orders'
           AND column_name = 'driver_id'`
      );
      const hasDriverColumn = driverColumnCheck.rows.length > 0;

      // Construire la requête en fonction des colonnes disponibles
      const driverSelect = hasDriverColumn ? 'driver_id' : 'NULL as driver_id';
      const orderResult = await pool.query(
        `SELECT id, user_id, ${driverSelect}, status FROM orders WHERE id = $1`,
        [orderId]
      );

      if (orderResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Commande non trouvée'
        });
      }

      const order = orderResult.rows[0];

      // Vérifier que la commande appartient au client
      if (order.user_id !== userId) {
        return res.status(403).json({
          success: false,
          message: 'Vous n\'êtes pas autorisé à évaluer cette commande'
        });
      }

      // Vérifier que la commande est complétée
      if (order.status !== 'completed') {
        return res.status(400).json({
          success: false,
          message: 'Vous ne pouvez évaluer que les commandes complétées'
        });
      }

      // Récupérer le driver_id (depuis orders ou order_assignments)
      let driverId = hasDriverColumn ? order.driver_id : null;
      
      // Si driver_id n'existe pas dans orders, chercher dans order_assignments
      if (!driverId) {
        try {
          const assignmentCheck = await pool.query(
            `SELECT EXISTS (
              SELECT FROM information_schema.tables
              WHERE table_schema = 'public'
              AND table_name = 'order_assignments'
            )`
          );
          const hasOrderAssignments = assignmentCheck.rows[0]?.exists === true;

          if (hasOrderAssignments) {
            const assignmentResult = await pool.query(
              `SELECT driver_id FROM order_assignments WHERE order_id = $1 LIMIT 1`,
              [orderId]
            );
            if (assignmentResult.rows.length > 0) {
              driverId = assignmentResult.rows[0].driver_id;
            }
          }
        } catch (err) {
          logger.warn('⚠️ Erreur vérification order_assignments pour rating:', err.message);
        }
      }

      // Vérifier que la commande a un livreur assigné
      if (!driverId) {
        return res.status(400).json({
          success: false,
          message: 'Aucun livreur assigné à cette commande'
        });
      }

      // Vérifier que la table ratings existe
      try {
        const tableCheck = await pool.query(
          `SELECT EXISTS (
            SELECT FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name = 'ratings'
          )`
        );
        const tableExists = tableCheck.rows[0]?.exists === true;
        
        if (!tableExists) {
          logger.error('❌ Table ratings n\'existe pas');
          return res.status(500).json({
            success: false,
            message: 'Table ratings n\'existe pas. Veuillez exécuter la migration 010_create_ratings_table.sql'
          });
        }

        // Vérifier que la colonne comment existe
        const columnCheck = await pool.query(
          `SELECT EXISTS (
            SELECT FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = 'ratings'
            AND column_name = 'comment'
          )`
        );
        const columnExists = columnCheck.rows[0]?.exists === true;
        
        if (!columnExists) {
          logger.error('❌ Colonne comment n\'existe pas dans ratings');
          return res.status(500).json({
            success: false,
            message: 'Colonne comment n\'existe pas dans ratings. Veuillez exécuter la migration 010_create_ratings_table.sql'
          });
        }
      } catch (checkError) {
        logger.error('❌ Erreur vérification table ratings:', checkError);
        // Continuer quand même - peut-être que c'est juste un problème de permissions
      }

      // Vérifier si l'utilisateur a déjà évalué cette commande
      const existingRatingResult = await pool.query(
        `SELECT id FROM ratings WHERE order_id = $1 AND user_id = $2`,
        [orderId, userId]
      );

      let ratingId;
      if (existingRatingResult.rows.length > 0) {
        // Mettre à jour l'évaluation existante
        ratingId = existingRatingResult.rows[0].id;
        logger.info(`📝 Mise à jour évaluation existante : ${ratingId} pour commande ${orderId}`, {
          rating,
          hasComment: !!comment,
          commentLength: comment?.length || 0
        });

        try {
          await pool.query(
            `UPDATE ratings 
             SET rating = $1, comment = $2, updated_at = NOW()
             WHERE id = $3`,
            [rating, comment || null, ratingId]
          );
          logger.info(`✅ Évaluation mise à jour : ${ratingId} pour commande ${orderId}`);
        } catch (updateError) {
          logger.error('❌ Erreur UPDATE ratings:', updateError);
          logger.error('❌ Détails UPDATE:', {
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
        // Créer une nouvelle évaluation
        logger.info(`📝 Création nouvelle évaluation pour commande ${orderId}`, {
          userId,
          driverId,
          rating,
          hasComment: !!comment,
          commentLength: comment?.length || 0
        });

        try {
          const insertResult = await pool.query(
            `INSERT INTO ratings (order_id, user_id, driver_id, rating, comment)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id`,
            [orderId, userId, driverId, rating, comment || null]
          );
          ratingId = insertResult.rows[0].id;
          logger.info(`✅ Nouvelle évaluation créée : ${ratingId} pour commande ${orderId}`);
        } catch (insertError) {
          logger.error('❌ Erreur INSERT ratings:', insertError);
          logger.error('❌ Détails INSERT:', {
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

      // La fonction trigger_update_driver_rating() mettra à jour automatiquement la note moyenne du livreur

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
    } catch (queryError) {
      logger.error('❌ Erreur requête submitRating:', queryError);
      return res.status(500).json({
        success: false,
        message: 'Erreur serveur lors de l\'enregistrement de l\'évaluation',
        error: queryError.message
      });
    }
  } catch (error) {
    logger.error('❌ Erreur submitRating:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur serveur',
      error: error.message
    });
  }
};

/**
 * 📊 Récupérer les évaluations d'un livreur
 * GET /api/ratings/driver/:driverId
 */
export const getDriverRatings = async (req, res) => {
  try {
    const { driverId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    if (!driverId) {
      return res.status(400).json({
        success: false,
        message: 'driverId est requis'
      });
    }

    // Vérifier que la connexion DB est configurée
    if (!process.env.DATABASE_URL) {
      logger.warn('⚠️ DATABASE_URL non configuré pour getDriverRatings');
      return res.json({
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

    try {
      // Récupérer les évaluations avec pagination
      const ratingsResult = await pool.query(
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

      // Compter le total
      const countResult = await pool.query(
        `SELECT COUNT(*) as count FROM ratings WHERE driver_id = $1`,
        [driverId]
      );

      const total = parseInt(countResult.rows[0]?.count || 0);

      res.json({
        success: true,
        data: ratingsResult.rows.map(rating => ({
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
    } catch (queryError) {
      logger.error('❌ Erreur requête getDriverRatings:', queryError);
      return res.json({
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
  } catch (error) {
    logger.error('❌ Erreur getDriverRatings:', error);
    return res.json({
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

/**
 * 🔍 Vérifier si une commande a déjà été évaluée
 * GET /api/ratings/order/:orderId
 */
export const getOrderRating = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { orderId } = req.params;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Non autorisé'
      });
    }

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: 'orderId est requis'
      });
    }

    // Vérifier que la connexion DB est configurée
    if (!process.env.DATABASE_URL) {
      return res.json({
        success: true,
        data: null
      });
    }

    try {
      const ratingResult = await pool.query(
        `SELECT id, rating, comment, created_at, updated_at
         FROM ratings
         WHERE order_id = $1 AND user_id = $2`,
        [orderId, userId]
      );

      if (ratingResult.rows.length === 0) {
        return res.json({
          success: true,
          data: null
        });
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
    } catch (queryError) {
      logger.error('❌ Erreur requête getOrderRating:', queryError);
      return res.json({
        success: true,
        data: null
      });
    }
  } catch (error) {
    logger.error('❌ Erreur getOrderRating:', error);
    return res.json({
      success: true,
      data: null
    });
  }
};

