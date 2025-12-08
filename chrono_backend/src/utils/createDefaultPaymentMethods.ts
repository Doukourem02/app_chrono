import pool from '../config/db.js';
import logger from '../utils/logger.js';
import { maskUserId } from './maskSensitiveData.js';

/**
 * Créer les méthodes de paiement par défaut pour un utilisateur.
 * 
 * NOTE: Cash et Deferred sont toujours disponibles dans le code et n'ont pas besoin
 * d'être stockés en base de données. Cette fonction ne fait rien actuellement car
 * Orange Money et Wave ne sont pas encore configurés.
 * 
 * Quand Orange Money/Wave seront configurés, cette fonction pourra être utilisée
 * pour créer les méthodes de paiement spécifiques à l'utilisateur (avec numéro de téléphone).
 */
export async function createDefaultPaymentMethods(
  userId: string
): Promise<boolean> {
  try {
    // Vérifier si l'utilisateur a déjà des méthodes de paiement
    const existingMethods = await (pool as any).query(
      'SELECT id FROM payment_methods WHERE user_id = $1',
      [userId]
    );

    if (existingMethods.rows.length > 0) {
      logger.debug(
        `Méthodes de paiement déjà existantes pour utilisateur ${maskUserId(userId)}`
      );
      return true;
    }

    // Cash et Deferred sont toujours disponibles dans le code, pas besoin de les créer en DB
    // Cette fonction est prête pour quand Orange Money/Wave seront configurés
    // Pour l'instant, on ne crée rien car cash et deferred sont gérés côté code
    
    logger.debug(
      `Aucune méthode de paiement à créer pour utilisateur ${maskUserId(userId)} (cash et deferred sont toujours disponibles)`
    );
    return true;
  } catch (error: any) {
    logger.error(
      `Erreur vérification méthodes de paiement pour ${maskUserId(userId)}:`,
      error
    );
    return false;
  }
}

