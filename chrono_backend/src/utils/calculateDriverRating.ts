import pool from '../config/db.js';
import logger from './logger.js';
import { maskUserId } from './maskSensitiveData.js';

export async function calculateDriverRating(
  driverId: string
): Promise<number> {
  if (!driverId) {
    return 5.0;
  }

  try {
    const tableCheck = await (pool as any).query(
      `SELECT EXISTS (
        SELECT 1 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'ratings'
      )`
    );

    if (!tableCheck.rows[0]?.exists) {
      logger.warn(
        `Table ratings n'existe pas pour calculer la note de ${maskUserId(driverId)}`
      );
      return 5.0;
    }

    const result = await (pool as any).query(
      `SELECT 
        COALESCE(AVG(rating)::numeric, 5.0) as average_rating,
        COUNT(*) as total_ratings
      FROM ratings
      WHERE driver_id = $1`,
      [driverId]
    );

    if (result.rows && result.rows.length > 0) {
      const averageRating = parseFloat(result.rows[0].average_rating) || 5.0;
      const totalRatings = parseInt(result.rows[0].total_ratings) || 0;

      const roundedRating = Math.round(averageRating * 10) / 10;

      if (totalRatings > 0) {
        logger.debug(
          `Note moyenne calculée pour ${maskUserId(driverId)}: ${roundedRating} (${totalRatings} évaluation${totalRatings > 1 ? 's' : ''})`
        );
      }

      return roundedRating;
    }

    return 5.0;
  } catch (error: any) {
    logger.warn(
      `Erreur calcul note moyenne pour ${maskUserId(driverId)}:`,
      error.message
    );
    return 5.0;
  }
}
