import { Request, Response } from 'express';
import pool from '../config/db.js';
import logger from '../utils/logger.js';
import { maskUserId, maskAmount } from '../utils/maskSensitiveData.js';

interface RequestWithUser extends Request {
  user?: {
    id: string;
  };
}

/**
 * Récupérer le solde commission d'un livreur partenaire
 */
export const getCommissionBalance = async (
  req: RequestWithUser,
  res: Response
): Promise<void> => {
  try {
    const { userId } = req.params;

    if (req.user && req.user.id !== userId) {
      res.status(403).json({
        success: false,
        message: 'Vous ne pouvez consulter que votre propre solde',
      });
      return;
    }

    // Vérifier que c'est un livreur partenaire
    const driverCheck = await (pool as any).query(
      `SELECT driver_type FROM driver_profiles WHERE user_id = $1`,
      [userId]
    );

    if (!driverCheck.rows || driverCheck.rows.length === 0) {
      res.status(404).json({
        success: false,
        message: 'Profil livreur non trouvé',
      });
      return;
    }

    const driverType = driverCheck.rows[0].driver_type;
    if (driverType !== 'partner') {
      res.status(400).json({
        success: false,
        message: 'Cette fonctionnalité est réservée aux livreurs partenaires',
      });
      return;
    }

    // Récupérer ou initialiser le solde
    const balanceResult = await (pool as any).query(
      `SELECT 
        id,
        balance,
        is_suspended,
        suspended_at,
        suspended_reason,
        commission_rate,
        created_at,
        updated_at
      FROM commission_balance
      WHERE driver_id = $1`,
      [userId]
    );

    let balanceData;
    if (!balanceResult.rows || balanceResult.rows.length === 0) {
      // Initialiser le solde si n'existe pas
      const initResult = await (pool as any).query(
        `SELECT initialize_commission_balance($1, 10.00) as balance_id`,
        [userId]
      );

      // Récupérer le solde initialisé
      const newBalanceResult = await (pool as any).query(
        `SELECT 
          id,
          balance,
          is_suspended,
          suspended_at,
          suspended_reason,
          commission_rate,
          created_at,
          updated_at
        FROM commission_balance
        WHERE driver_id = $1`,
        [userId]
      );

      balanceData = newBalanceResult.rows[0];
    } else {
      balanceData = balanceResult.rows[0];
    }

    logger.info(`Solde commission récupéré pour ${maskUserId(userId)}: ${maskAmount(balanceData.balance)} FCFA`);

    res.json({
      success: true,
      data: {
        balance: parseFloat(balanceData.balance),
        minimum_balance: 10000, // 10 000 FCFA
        commission_rate: parseFloat(balanceData.commission_rate),
        is_suspended: balanceData.is_suspended,
        last_updated: balanceData.updated_at,
      },
    });
  } catch (error: any) {
    logger.error('Erreur getCommissionBalance:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du solde',
      error: error.message,
    });
  }
};

/**
 * Récupérer l'historique des transactions commission
 */
export const getCommissionTransactions = async (
  req: RequestWithUser,
  res: Response
): Promise<void> => {
  try {
    const { userId } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;

    if (req.user && req.user.id !== userId) {
      res.status(403).json({
        success: false,
        message: 'Vous ne pouvez consulter que vos propres transactions',
      });
      return;
    }

    const transactionsResult = await (pool as any).query(
      `SELECT 
        id,
        transaction_type,
        amount,
        balance_before,
        balance_after,
        order_id,
        payment_method,
        payment_provider,
        description,
        created_at
      FROM commission_transactions
      WHERE driver_id = $1
      ORDER BY created_at DESC
      LIMIT $2`,
      [userId, limit]
    );

    const transactions = transactionsResult.rows.map((tx: any) => ({
      id: tx.id,
      type: tx.transaction_type,
      amount: parseFloat(tx.amount),
      balance_before: parseFloat(tx.balance_before),
      balance_after: parseFloat(tx.balance_after),
      order_id: tx.order_id,
      payment_method: tx.payment_method,
      payment_provider: tx.payment_provider,
      status: 'completed', // Les transactions enregistrées sont toujours complétées
      created_at: tx.created_at,
    }));

    logger.info(`Historique commission récupéré pour ${maskUserId(userId)}: ${transactions.length} transactions`);

    res.json({
      success: true,
      data: transactions,
    });
  } catch (error: any) {
    logger.error('Erreur getCommissionTransactions:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des transactions',
      error: error.message,
    });
  }
};

/**
 * Recharger le compte commission
 */
export const rechargeCommission = async (
  req: RequestWithUser,
  res: Response
): Promise<void> => {
  try {
    const { userId } = req.params;
    const { amount, method } = req.body;

    if (req.user && req.user.id !== userId) {
      res.status(403).json({
        success: false,
        message: 'Vous ne pouvez recharger que votre propre compte',
      });
      return;
    }

    if (!amount || amount < 10000) {
      res.status(400).json({
        success: false,
        message: 'Le montant minimum de recharge est de 10 000 FCFA',
      });
      return;
    }

    if (!method || !['orange_money', 'wave'].includes(method)) {
      res.status(400).json({
        success: false,
        message: 'Méthode de paiement invalide. Doit être: orange_money ou wave',
      });
      return;
    }

    // Vérifier que c'est un livreur partenaire
    const driverCheck = await (pool as any).query(
      `SELECT driver_type FROM driver_profiles WHERE user_id = $1`,
      [userId]
    );

    if (!driverCheck.rows || driverCheck.rows.length === 0) {
      res.status(404).json({
        success: false,
        message: 'Profil livreur non trouvé',
      });
      return;
    }

    if (driverCheck.rows[0].driver_type !== 'partner') {
      res.status(400).json({
        success: false,
        message: 'Cette fonctionnalité est réservée aux livreurs partenaires',
      });
      return;
    }

    // TODO: Intégrer avec Mobile Money (Orange Money/Wave)
    // Pour l'instant, on simule une recharge réussie
    // Dans le futur, il faudra :
    // 1. Initier le paiement Mobile Money
    // 2. Attendre le callback
    // 3. Créditer le compte seulement après confirmation

    // Pour l'instant, on crédite directement (simulation)
    const rechargeResult = await (pool as any).query(
      `SELECT recharge_commission_balance(
        $1, -- driver_id
        $2, -- amount
        'mobile_money', -- payment_method
        $3, -- payment_provider
        NULL, -- payment_transaction_id (sera rempli après callback)
        'Recharge via ${method}'
      ) as transaction_id`,
      [userId, amount, method]
    );

    const transactionId = rechargeResult.rows[0].transaction_id;

    logger.info(`Recharge commission pour ${maskUserId(userId)}: ${maskAmount(amount)} FCFA via ${method}`);

    res.json({
      success: true,
      message: 'Recharge initiée avec succès',
      data: {
        transactionId,
        // TODO: Retourner paymentUrl quand Mobile Money sera intégré
        // paymentUrl: 'https://...'
      },
    });
  } catch (error: any) {
    logger.error('Erreur rechargeCommission:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la recharge',
      error: error.message,
    });
  }
};

