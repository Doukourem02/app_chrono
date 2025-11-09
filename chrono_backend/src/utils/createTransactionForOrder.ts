/**
 * Utilitaire pour créer automatiquement une transaction et une facture lors de la création d'une commande
 */

import pool from '../config/db.js';
import logger from '../utils/logger.js';
import { maskOrderId, maskUserId } from './maskSensitiveData.js';

interface CreateTransactionParams {
  orderId: string;
  userId: string;
  paymentMethodType: 'orange_money' | 'wave' | 'cash' | 'deferred';
  paymentMethodId?: string | null; // ID de la méthode de paiement depuis payment_methods
  amount: number;
  isPartial?: boolean;
  partialAmount?: number;
  remainingAmount?: number;
  payerType?: 'client' | 'recipient';
  paymentStatus?: 'pending' | 'paid' | 'refused' | 'delayed' | 'refunded' | 'cancelled';
  recipientUserId?: string;
}

/**
 * Créer automatiquement une transaction pour une commande
 */
export async function createTransactionForOrder(params: CreateTransactionParams): Promise<string | null> {
  try {
    const {
      orderId,
      userId,
      paymentMethodType,
      paymentMethodId,
      amount,
      isPartial = false,
      partialAmount,
      remainingAmount,
      payerType = 'client',
      paymentStatus = 'pending',
      recipientUserId,
    } = params;

    // Déterminer l'utilisateur qui paie
    const payerUserId = payerType === 'recipient' && recipientUserId ? recipientUserId : userId;

    // Utiliser payment_method_id si fourni, sinon null
    // Note: payment_method_id doit être fourni explicitement lors de la création de la commande
    // ou lors de l'initiation du paiement pour être renseigné dans la transaction
    const finalPaymentMethodId = paymentMethodId || null;

    // Déterminer le statut initial
    let initialStatus: 'pending' | 'paid' | 'delayed' = 'pending';
    if (paymentMethodType === 'deferred') {
      initialStatus = 'delayed';
    } else if (paymentMethodType === 'cash') {
      // Pour le cash, on met 'pending' car le paiement se fait à la livraison
      initialStatus = 'pending';
    }

    // Utiliser le statut fourni ou le statut initial
    const status = paymentStatus || initialStatus;

    // Créer la transaction
    const transactionResult = await (pool as any).query(
      `INSERT INTO transactions (
        order_id, user_id, payment_method_id, payment_method_type,
        amount, currency, status,
        is_partial, partial_amount, remaining_amount, payer_type,
        initiated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *`,
      [
        orderId,
        payerUserId,
        finalPaymentMethodId || null,
        paymentMethodType,
        amount,
        'XOF',
        status,
        isPartial,
        isPartial ? (partialAmount || amount) : null,
        isPartial ? (remainingAmount || 0) : null,
        payerType,
        new Date(),
      ]
    );

    const transaction = transactionResult.rows[0];

    // Toujours logger la création de transaction (pas seulement en debug)
    logger.info(`✅ Transaction créée automatiquement pour commande ${maskOrderId(orderId)}`, {
      transactionId: transaction.id,
      userId: maskUserId(payerUserId),
      paymentMethodId: finalPaymentMethodId || 'non renseigné',
      paymentMethodType,
      amount,
      status,
      orderId: maskOrderId(orderId),
    });

    return transaction.id;
  } catch (error: any) {
    logger.error(`❌ Erreur création transaction pour commande ${maskOrderId(params.orderId)}:`, {
      error: error.message,
      stack: error.stack,
      orderId: maskOrderId(params.orderId),
      userId: maskUserId(params.userId),
    });
    return null;
  }
}

/**
 * Créer automatiquement une facture pour une commande
 */
export async function createInvoiceForOrder(
  orderId: string,
  transactionId: string | null,
  userId: string,
  driverId: string | null,
  amount: number,
  distance: number | null,
  pricePerKm: number | null,
  urgencyFee: number = 0
): Promise<string | null> {
  try {
    // Créer la facture
    const invoiceResult = await (pool as any).query(
      `INSERT INTO invoices (
        order_id, transaction_id, user_id, driver_id,
        subtotal, total, distance, price_per_km, urgency_fee,
        status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        orderId,
        transactionId,
        userId,
        driverId,
        amount,
        amount,
        distance,
        pricePerKm,
        urgencyFee,
        'draft', // Statut initial : brouillon
      ]
    );

    const invoice = invoiceResult.rows[0];

    logger.debug(`✅ Facture créée automatiquement pour commande ${maskOrderId(orderId)}`, {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoice_number,
      userId: maskUserId(userId),
      amount,
    });

    return invoice.id;
  } catch (error: any) {
    logger.error(`❌ Erreur création facture pour commande ${maskOrderId(orderId)}:`, error);
    return null;
  }
}

/**
 * Créer automatiquement une transaction et une facture pour une commande
 */
export async function createTransactionAndInvoiceForOrder(
  orderId: string,
  userId: string,
  paymentMethodType: 'orange_money' | 'wave' | 'cash' | 'deferred',
  amount: number,
  distance: number | null,
  pricePerKm: number | null,
  urgencyFee: number = 0,
  driverId: string | null = null,
  isPartial?: boolean,
  partialAmount?: number,
  remainingAmount?: number,
  payerType?: 'client' | 'recipient',
  recipientUserId?: string,
  paymentMethodId?: string | null
): Promise<{ transactionId: string | null; invoiceId: string | null }> {
  try {
    // Créer la transaction
    const transactionId = await createTransactionForOrder({
      orderId,
      userId,
      paymentMethodType,
      paymentMethodId,
      amount,
      isPartial,
      partialAmount,
      remainingAmount,
      payerType,
      recipientUserId,
    });

    // Créer la facture
    const invoiceId = await createInvoiceForOrder(
      orderId,
      transactionId,
      userId,
      driverId,
      amount,
      distance,
      pricePerKm,
      urgencyFee
    );

    return { transactionId, invoiceId };
  } catch (error: any) {
    logger.error(`❌ Erreur création transaction et facture pour commande ${maskOrderId(orderId)}:`, error);
    return { transactionId: null, invoiceId: null };
  }
}

