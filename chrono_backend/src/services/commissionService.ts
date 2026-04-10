import pool from '../config/db.js';
import logger from '../utils/logger.js';
import { maskUserId, maskAmount } from '../utils/maskSensitiveData.js';

/**
 * Service de gestion de la commission prépayée pour les livreurs partenaires.
 *
 * Les lignes dans `commission_transactions` sont créées par les fonctions SQL
 * `recharge_commission_balance` et `deduct_commission` (migration 016) : recharge
 * livreur/admin, ou livraison **completed** pour un livreur **partner**.
 * Les livreurs **internal** ne génèrent pas de transaction (aucune commission prélevée).
 */

export interface CommissionAccount {
  balance: number;
  minimum_balance: number;
  commission_rate: number;
  is_suspended: boolean;
  last_updated: string;
}

export interface CommissionTransaction {
  id: string;
  type: 'recharge' | 'deduction' | 'refund';
  amount: number;
  balance_before: number;
  balance_after: number;
  order_id?: string;
  payment_method?: string;
  status: 'pending' | 'completed' | 'failed';
  created_at: string;
}

/**
 * Vérifier si un livreur partenaire a un solde suffisant pour recevoir des commandes
 */
export async function canReceiveOrders(driverId: string): Promise<{
  canReceive: boolean;
  reason?: string;
  balance?: number;
}> {
  try {
    // Vérifier que c'est un livreur partenaire
    const driverCheck = await (pool as any).query(
      `SELECT driver_type FROM driver_profiles WHERE user_id = $1`,
      [driverId]
    );

    if (!driverCheck.rows || driverCheck.rows.length === 0) {
      return { canReceive: false, reason: 'Profil livreur non trouvé' };
    }

    const driverType = driverCheck.rows[0].driver_type;

    if (driverType == null || driverType === '') {
      return {
        canReceive: false,
        reason:
          'Type de livreur non défini. Ouvrez l’app et choisissez « interne » ou « partenaire » dans votre profil.',
      };
    }

    // Les livreurs internes peuvent toujours recevoir des commandes
    if (driverType === 'internal') {
      return { canReceive: true };
    }

    // Pour les partenaires, vérifier le solde
    if (driverType === 'partner') {
      const balanceResult = await (pool as any).query(
        `SELECT balance, is_suspended 
         FROM commission_balance 
         WHERE driver_id = $1`,
        [driverId]
      );

      if (!balanceResult.rows || balanceResult.rows.length === 0) {
        // Pas de solde = solde à 0 = suspendu
        return {
          canReceive: false,
          reason: 'Solde commission insuffisant. Veuillez recharger votre compte.',
          balance: 0,
        };
      }

      const balance = parseFloat(balanceResult.rows[0].balance);
      const isSuspended = balanceResult.rows[0].is_suspended;

      if (isSuspended || balance <= 0) {
        return {
          canReceive: false,
          reason: 'Compte suspendu. Solde commission épuisé. Veuillez recharger.',
          balance,
        };
      }

      return { canReceive: true, balance };
    }

    return { canReceive: false, reason: 'Type de livreur inconnu' };
  } catch (error: any) {
    logger.error('Erreur canReceiveOrders:', error);
    // En cas d'erreur, on autorise par défaut pour ne pas bloquer le système
    return { canReceive: true };
  }
}

/**
 * Prélever la commission après une livraison complétée
 */
export async function deductCommissionAfterDelivery(
  driverId: string,
  orderId: string,
  orderPrice: number
): Promise<{
  success: boolean;
  transactionId?: string;
  commissionAmount?: number;
  newBalance?: number;
  error?: string;
}> {
  try {
    // Vérifier que c'est un livreur partenaire
    const driverCheck = await (pool as any).query(
      `SELECT driver_type FROM driver_profiles WHERE user_id = $1`,
      [driverId]
    );

    if (!driverCheck.rows || driverCheck.rows.length === 0) {
      return { success: false, error: 'Profil livreur non trouvé' };
    }

    const driverType = driverCheck.rows[0].driver_type;

    if (driverType == null || driverType === '') {
      return { success: false, error: 'Type de livreur non défini' };
    }

    // Les livreurs internes ne paient pas de commission
    if (driverType === 'internal') {
      return { success: true };
    }

    // Pour les partenaires, prélever la commission
    if (driverType === 'partner') {
      const deductResult = await (pool as any).query(
        `SELECT deduct_commission($1, $2, $3, NULL) as transaction_id`,
        [driverId, orderId, orderPrice]
      );

      const transactionId = deductResult.rows[0].transaction_id;

      // Récupérer les détails de la transaction
      const transactionDetails = await (pool as any).query(
        `SELECT amount, balance_after 
         FROM commission_transactions 
         WHERE id = $1`,
        [transactionId]
      );

      const commissionAmount = parseFloat(transactionDetails.rows[0].amount);
      const newBalance = parseFloat(transactionDetails.rows[0].balance_after);

      logger.info(
        `Commission prélevée pour ${maskUserId(driverId)}: ${maskAmount(commissionAmount)} FCFA ` +
        `(commande ${orderId}, nouveau solde: ${maskAmount(newBalance)} FCFA)`
      );

      // Vérifier et envoyer des alertes si nécessaire
      await checkAndSendAlerts(driverId, newBalance);

      return {
        success: true,
        transactionId,
        commissionAmount,
        newBalance,
      };
    }

    return { success: false, error: 'Type de livreur inconnu' };
  } catch (error: any) {
    logger.error('Erreur deductCommissionAfterDelivery:', error);
    
    // Si le solde est insuffisant, c'est une erreur métier
    if (error.message && error.message.includes('Solde commission insuffisant')) {
      return {
        success: false,
        error: error.message,
      };
    }

    // Pour les autres erreurs, on log mais on ne bloque pas la livraison
    return { success: false, error: error.message || 'Erreur lors du prélèvement de la commission' };
  }
}

/**
 * Vérifier le solde et envoyer des alertes si nécessaire
 */
export async function checkAndSendAlerts(
  driverId: string,
  currentBalance: number
): Promise<void> {
  try {
    // Récupérer le solde actuel si non fourni
    let balance = currentBalance;
    if (balance === undefined) {
      const balanceResult = await (pool as any).query(
        `SELECT balance, is_suspended 
         FROM commission_balance 
         WHERE driver_id = $1`,
        [driverId]
      );

      if (!balanceResult.rows || balanceResult.rows.length === 0) {
        return;
      }

      balance = parseFloat(balanceResult.rows[0].balance);
    }

    // Alertes selon le niveau de solde
    if (balance <= 0) {
      // Suspension automatique déjà gérée par la fonction SQL
      logger.warn(`⚠️ Compte suspendu pour ${maskUserId(driverId)}: solde = ${maskAmount(balance)} FCFA`);
      // TODO: Envoyer notification push au livreur
    } else if (balance <= 1000) {
      logger.warn(`⚠️ Solde très faible pour ${maskUserId(driverId)}: ${maskAmount(balance)} FCFA`);
      // TODO: Envoyer notification push "Solde très faible, rechargez maintenant"
    } else if (balance <= 3000) {
      logger.info(`💡 Solde faible pour ${maskUserId(driverId)}: ${maskAmount(balance)} FCFA`);
      // TODO: Envoyer notification push "Solde faible, pensez à recharger"
    }
  } catch (error: any) {
    logger.error('Erreur checkAndSendAlerts:', error);
    // Ne pas bloquer si les alertes échouent
  }
}

/**
 * Initialiser le solde commission pour un nouveau livreur partenaire
 */
export async function initializeCommissionAccount(
  driverId: string,
  commissionRate: number = 10.0
): Promise<boolean> {
  try {
    await (pool as any).query(
      `SELECT initialize_commission_balance($1, $2)`,
      [driverId, commissionRate]
    );
    logger.info(`Solde commission initialisé pour ${maskUserId(driverId)} avec taux ${commissionRate}%`);
    return true;
  } catch (error: any) {
    logger.error('Erreur initializeCommissionAccount:', error);
    return false;
  }
}

