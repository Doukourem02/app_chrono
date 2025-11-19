import { Request, Response } from 'express';
import pool from '../config/db.js';
import logger from '../utils/logger.js';
import { calculateDeliveryPrice, validatePriceParams } from '../services/priceCalculator.js';
import {
  initiateMobileMoneyPayment,
  validateMobileMoneyParams,
  checkPaymentStatus,
} from '../services/mobileMoneyService.js';
import { maskOrderId, maskUserId, maskPhoneNumber } from '../utils/maskSensitiveData.js';

interface RequestWithUser extends Request {
  user?: {
    id: string;
  };
}

interface CreatePaymentMethodBody {
  methodType: 'orange_money' | 'wave' | 'cash' | 'deferred';
  providerAccount?: string;
  providerName?: string;
  isDefault?: boolean;
  metadata?: any;
}

interface InitiatePaymentBody {
  orderId: string;
  paymentMethodId?: string;
  paymentMethodType: 'orange_money' | 'wave' | 'cash' | 'deferred';
  phoneNumber?: string;
  isPartial?: boolean;
  partialAmount?: number;
  payerType?: 'client' | 'recipient';
  recipientUserId?: string;
  recipientPhone?: string;
}

interface UpdateTransactionStatusBody {
  status: 'pending' | 'paid' | 'refused' | 'delayed' | 'refunded' | 'cancelled';
  failureReason?: string;
}

interface CreateDisputeBody {
  transactionId: string;
  disputeType: 'refund_request' | 'payment_issue' | 'service_issue' | 'other';
  reason: string;
  description?: string;
  attachments?: any;
}

export const createPaymentMethod = async (req: RequestWithUser, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Non authentifié' });
      return;
    }

    const { methodType, providerAccount, providerName, isDefault = false, metadata } =
      req.body as CreatePaymentMethodBody;

    if (!['orange_money', 'wave', 'cash', 'deferred'].includes(methodType)) {
      res.status(400).json({
        success: false,
        message: 'Type de méthode de paiement invalide'
      });
      return;
    }

    if ((methodType === 'orange_money' || methodType === 'wave') && !providerAccount) {
      res.status(400).json({
        success: false,
        message: 'Numéro de téléphone requis pour Mobile Money',
      });
      return;
    }

    if (isDefault) {
      await (pool as any).query(
        'UPDATE payment_methods SET is_default = false WHERE user_id = $1',
        [userId]
      );
    }

    const result = await (pool as any).query(
      `INSERT INTO payment_methods (user_id, method_type, provider_account, provider_name, is_default, metadata) 
      VALUES ($1, $2, $3, $4, $5, $6) 
       RETURNING *`,
      [userId, methodType, providerAccount || null, providerName || null, isDefault, metadata || null]
    );

    logger.info(`Méthode de paiement créée pour utilisateur ${maskUserId(userId)}`, {
      methodType,
      isDefault,
    });

    res.status(201).json({
      success: true,
      data: result.rows[0],
    });
  } catch (error: any) {
    logger.error('Erreur création méthode de paiement:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

export const getPaymentMethods = async (req: RequestWithUser, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Non authentifié' });
      return;
    }

    const result = await (pool as any).query(
      'SELECT * FROM payment_methods WHERE user_id = $1 AND is_active = true ORDER BY is_default DESC, created_at DESC',
      [userId]
    );

    res.json({
      success: true,
      data: result.rows || [],
    });
  } catch (error: any) {
    logger.error('Erreur récupération méthodes de paiement:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

export const calculatePrice = async (req: Request, res: Response): Promise<void> => {
  try {
    const { distance, deliveryMethod, isUrgent, customPricePerKm } = req.body;

    const params = {
      distance: parseFloat(distance),
      deliveryMethod,
      isUrgent: isUrgent === true || isUrgent === 'true',
      customPricePerKm: customPricePerKm ? parseFloat(customPricePerKm) : undefined,
    };

    const validation = validatePriceParams(params);
    if (!validation.valid) {
      res.status(400).json({ success: false, message: validation.error });
      return;
    }

    const calculation = calculateDeliveryPrice(params);

    res.json({
      success: true,
      data: calculation,
    });
  } catch (error: any) {
    logger.error('Erreur calcul prix:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

export const initiatePayment = async (req: RequestWithUser, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Non authentifié' });
      return;
    }

    const {
      orderId,
      paymentMethodId,
      paymentMethodType,
      phoneNumber,
      isPartial = false,
      partialAmount,
      payerType = 'client',
      recipientUserId,
      recipientPhone,
    } = req.body as InitiatePaymentBody;

    const orderResult = await (pool as any).query(
      'SELECT * FROM orders WHERE id = $1',
      [orderId]
    );

    if (orderResult.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Commande non trouvée' });
      return;
    }

    const order = orderResult.rows[0];
    const totalPrice = parseFloat(order.price || order.calculated_price || 0);

    if (payerType === 'client' && order.user_id !== userId) {
      res.status(403).json({ success: false, message: 'Accès refusé' });
      return;
    }

    if (payerType === 'recipient') {
      if (recipientUserId && order.recipient_user_id !== recipientUserId) {
        res.status(403).json({ success: false, message: 'Destinataire non autorisé' });
        return;
      }
    }

    let paymentMethod: any = null;
    if (paymentMethodId) {
      const methodResult = await (pool as any).query(
        'SELECT * FROM payment_methods WHERE id = $1 AND user_id = $2',
        [paymentMethodId, userId]
      );
      if (methodResult.rows.length > 0) {
        paymentMethod = methodResult.rows[0];
      }
    }

    let phone = phoneNumber;
    if (!phone && paymentMethod && paymentMethod.provider_account) {
      phone = paymentMethod.provider_account;
    }

    let transactionId: string | null = null;
    let providerTransactionId: string | null = null;
    let providerResponse: any = null;
    let status: string = 'pending';

    let amountToPay = totalPrice;
    let remainingAmount = 0;

    if (isPartial && partialAmount) {
      amountToPay = Number(partialAmount);
      remainingAmount = totalPrice - amountToPay;
      if (amountToPay > totalPrice) {
        res.status(400).json({
          success: false,
          message: 'Le montant partiel ne peut pas dépasser le prix total',
        });
        return;
      }
    }

    if (paymentMethodType === 'orange_money' || paymentMethodType === 'wave') {
      if (!phone) {
        res.status(400).json({
          success: false,
          message: 'Numéro de téléphone requis pour Mobile Money',
        });
        return;
      }

      const mobileMoneyParams = {
        provider: paymentMethodType as 'orange_money' | 'wave',
        phoneNumber: phone,
        amount: amountToPay,
        orderId,
        description: `Paiement commande ${orderId}${isPartial ? ' (partiel)' : ''}`,
      };

      const validation = validateMobileMoneyParams(mobileMoneyParams);
      if (!validation.valid) {
        res.status(400).json({ success: false, message: validation.error });
        return;
      }

      const paymentResult = await initiateMobileMoneyPayment(mobileMoneyParams);
      if (!paymentResult.success) {
        res.status(400).json({
          success: false,
          message: paymentResult.error || 'Erreur lors de l\'initiation du paiement',
        });
        return;
      }

      transactionId = paymentResult.transactionId || null;
      providerTransactionId = paymentResult.providerTransactionId || null;
      providerResponse = paymentResult.providerResponse || null;
      status = paymentResult.status === 'paid' ? 'paid' : 'pending';
    } else if (paymentMethodType === 'cash') {
      status = 'pending';
    } else if (paymentMethodType === 'deferred') {
      status = 'delayed';
    }

    const payerUserId = payerType === 'client' ? userId : recipientUserId || userId;

    const transactionResult = await (pool as any).query(
      `INSERT INTO transactions (
        order_id, user_id, payment_method_id, payment_method_type,
        amount, status, provider_transaction_id, provider_response,
        is_partial, partial_amount, remaining_amount, payer_type
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *`,
      [
        orderId,
        payerUserId,
        paymentMethodId || null,
        paymentMethodType,
        amountToPay,
        status,
        providerTransactionId,
        providerResponse ? JSON.stringify(providerResponse) : null,
        isPartial,
        isPartial ? amountToPay : null,
        isPartial ? remainingAmount : null,
        payerType,
      ]
    );

    const transaction = transactionResult.rows[0];

    if (payerType === 'client') {
      if (isPartial && partialAmount) {
        await (pool as any).query(
          `UPDATE orders 
           SET payment_method_type = $1, payment_status = $2,
              client_paid_amount = $3, payment_payer = 'client' 
           WHERE id = $4`,
          [paymentMethodType, 'pending', amountToPay, orderId]
        );
      } else {
        await (pool as any).query(
          `UPDATE orders 
           SET payment_method_type = $1, payment_status = $2,
              payment_payer = 'client' 
           WHERE id = $3`,
          [paymentMethodType, status, orderId]
        );
      }
    } else if (payerType === 'recipient') {
      let recipientIsRegistered = false;
      if (recipientUserId) {
        const recipientCheck = await (pool as any).query(
          'SELECT id FROM auth.users WHERE id = $1',
          [recipientUserId]
        );
        recipientIsRegistered = recipientCheck.rows.length > 0;
      }

      if (recipientIsRegistered && paymentMethodType === 'deferred') {
        const deadline = new Date();
        deadline.setDate(deadline.getDate() + 7);
        await (pool as any).query(
          `UPDATE orders 
           SET recipient_user_id = $1, recipient_is_registered = true,
              recipient_payment_method_type = $2, recipient_payment_status = 'delayed', 
              recipient_payment_deadline = $3, payment_payer = 'recipient' 
           WHERE id = $4`,
          [recipientUserId, paymentMethodType, deadline, orderId]
        );
      } else {
        await (pool as any).query(
          `UPDATE orders 
           SET recipient_payment_method_type = $1, recipient_payment_status = $2,
              recipient_paid_amount = $3, payment_payer = 'recipient', 
              recipient_is_registered = $4 
           WHERE id = $5`,
          [
            paymentMethodType,
            status,
            amountToPay,
            recipientIsRegistered,
            orderId,
          ]
        );
      }
    }

    const invoiceResult = await (pool as any).query(
      `INSERT INTO invoices (
        order_id, transaction_id, user_id, driver_id,
        subtotal, total, distance, price_per_km, urgency_fee
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        orderId,
        transaction.id,
        userId,
        order.driver_id || null,
        order.price || order.calculated_price || 0,
        order.price || order.calculated_price || 0,
        order.distance || 0,
        order.price_per_km || null,
        order.urgency_fee || 0,
      ]
    );

    logger.info(`Paiement initié pour commande ${maskOrderId(orderId)}`, {
      userId: maskUserId(userId),
      paymentMethodType,
      status,
    });

    res.status(201).json({
      success: true,
      data: {
        transaction: transaction,
        invoice: invoiceResult.rows[0],
      },
    });
  } catch (error: any) {
    logger.error('Erreur initiation paiement:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

export const checkPayment = async (req: RequestWithUser, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Non authentifié' });
      return;
    }

    const { transactionId } = req.params;

    const transactionResult = await (pool as any).query(
      'SELECT * FROM transactions WHERE id = $1 AND user_id = $2',
      [transactionId, userId]
    );

    if (transactionResult.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Transaction non trouvée' });
      return;
    }

    const transaction = transactionResult.rows[0];

    if (
      transaction.payment_method_type === 'orange_money' ||
      transaction.payment_method_type === 'wave'
    ) {
      if (transaction.provider_transaction_id) {
        const statusCheck = await checkPaymentStatus(
          transaction.payment_method_type as 'orange_money' | 'wave',
          transaction.provider_transaction_id
        );

        if (statusCheck.status !== transaction.status) {
          await (pool as any).query(
            'UPDATE transactions SET status = $1, updated_at = NOW() WHERE id = $2',
            [statusCheck.status, transactionId]
          );

          await (pool as any).query(
            'UPDATE orders SET payment_status = $1 WHERE id = $2',
            [statusCheck.status, transaction.order_id]
          );

          transaction.status = statusCheck.status;
        }
      }
    }

    res.json({
      success: true,
      data: transaction,
    });
  } catch (error: any) {
    logger.error('Erreur vérification paiement:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

export const getTransactions = async (req: RequestWithUser, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Non authentifié' });
      return;
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;
    const status = req.query.status as string | undefined;

    let query = `
      SELECT 
        t.*,
        pm.method_type as payment_method_type_from_pm,
        pm.provider_account,
        pm.provider_name,
        pm.is_default as payment_method_is_default
      FROM transactions t
      LEFT JOIN payment_methods pm ON t.payment_method_id = pm.id
      WHERE t.user_id = $1
    `;

    const params: any[] = [userId];

    if (status) {
      query += ' AND t.status = $2';
      params.push(status);
    }

    query += ` ORDER BY t.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await (pool as any).query(query, params);

    let countQuery = 'SELECT COUNT(*) FROM transactions WHERE user_id = $1';
    const countParams: any[] = [userId];

    if (status) {
      countQuery += ' AND status = $2';
      countParams.push(status);
    }

    const countResult = await (pool as any).query(countQuery, countParams);
    const total = parseInt(countResult.rows[0]?.count || '0');

    res.json({
      success: true,
      data: result.rows || [],
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    logger.error('Erreur récupération transactions:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

export const createDispute = async (req: RequestWithUser, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Non authentifié' });
      return;
    }

    const { transactionId, disputeType, reason, description, attachments } = req.body as CreateDisputeBody;

    const transactionResult = await (pool as any).query(
      'SELECT * FROM transactions WHERE id = $1 AND user_id = $2',
      [transactionId, userId]
    );

    if (transactionResult.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Transaction non trouvée' });
      return;
    }

    const transaction = transactionResult.rows[0];

    const disputeResult = await (pool as any).query(
      `INSERT INTO payment_disputes (
        transaction_id, order_id, user_id, dispute_type, reason, description, attachments
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [
        transactionId,
        transaction.order_id,
        userId,
        disputeType,
        reason,
        description || null,
        attachments ? JSON.stringify(attachments) : null,
      ]
    );

    logger.info(`Litige créé pour transaction ${transactionId}`, {
      userId: maskUserId(userId),
      disputeType,
    });

    res.status(201).json({
      success: true,
      data: disputeResult.rows[0],
    });
  } catch (error: any) {
    logger.error('Erreur création litige:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};
