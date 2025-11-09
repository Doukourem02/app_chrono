/**
 * Utilitaire pour créer automatiquement les méthodes de paiement par défaut pour un utilisateur
 */

import pool from '../config/db.js';
import logger from '../utils/logger.js';
import { maskUserId } from './maskSensitiveData.js';

/**
 * Créer les méthodes de paiement par défaut (cash et deferred) pour un utilisateur
 */
export async function createDefaultPaymentMethods(userId: string): Promise<boolean> {
  try {
    // Vérifier si l'utilisateur a déjà des méthodes de paiement
    const existingMethods = await (pool as any).query(
      'SELECT id FROM payment_methods WHERE user_id = $1',
      [userId]
    );

    if (existingMethods.rows.length > 0) {
      logger.debug(`✅ Méthodes de paiement déjà existantes pour utilisateur ${maskUserId(userId)}`);
      return true;
    }

    // Créer les méthodes de paiement par défaut : cash et deferred
    const defaultMethods = [
      {
        method_type: 'cash',
        provider_account: null,
        provider_name: null,
        is_default: true, // Cash est la méthode par défaut
      },
      {
        method_type: 'deferred',
        provider_account: null,
        provider_name: null,
        is_default: false,
      },
    ];

    // Insérer les méthodes de paiement
    for (const method of defaultMethods) {
      try {
        await (pool as any).query(
          `INSERT INTO payment_methods (user_id, method_type, provider_account, provider_name, is_default, is_active)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT DO NOTHING`,
          [
            userId,
            method.method_type,
            method.provider_account,
            method.provider_name,
            method.is_default,
            true, // is_active
          ]
        );
      } catch (error: any) {
        // Ne pas bloquer si une méthode existe déjà
        logger.debug(`⚠️ Méthode ${method.method_type} déjà existante ou erreur:`, error.message);
      }
    }

    logger.debug(`✅ Méthodes de paiement par défaut créées pour utilisateur ${maskUserId(userId)}`);
    return true;
  } catch (error: any) {
    logger.error(`❌ Erreur création méthodes de paiement par défaut pour ${maskUserId(userId)}:`, error);
    return false;
  }
}

