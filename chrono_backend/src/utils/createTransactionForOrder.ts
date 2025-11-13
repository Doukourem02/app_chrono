import pool from '../config/db.js';
import logger from '../utils/logger.js';
import { maskOrderId, maskUserId } from './maskSensitiveData.js';

interface CreateTransactionParams {
  orderId: string;
  userId: string;
  paymentMethodType: 'orange_money' | 'wave' | 'cash' | 'deferred';
  paymentMethodId?: string | null;
  amount: number;
  isPartial?: boolean;
  partialAmount?: number;
  remainingAmount?: number;
  payerType?: 'client' | 'recipient';
  paymentStatus?: 'pending' | 'paid' | 'refused' | 'delayed' | 'refunded' | 'cancelled';
  recipientUserId?: string;
}

export async function createTransactionForOrder(
  params: CreateTransactionParams
): Promise<string | null> {
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

    const payerUserId =
      payerType === 'recipient' && recipientUserId
        ? recipientUserId
        : userId;

    const finalPaymentMethodId = paymentMethodId || null;

    let initialStatus: 'pending' | 'paid' | 'delayed' = 'pending';
    if (paymentMethodType === 'deferred') {
      initialStatus = 'delayed';
    } else if (paymentMethodType === 'cash') {
      initialStatus = 'pending';
    }

    const status = paymentStatus || initialStatus;

    const transactionResult = await (pool as any).query(
      `INSERT INTO transactions (
        order_id,
        user_id,
        payment_method_id,
        payment_method_type,
        amount,
        currency,
        status,
        is_partial,
        partial_amount,
        remaining_amount,
        payer_type,
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
        isPartial ? partialAmount || amount : null,
        isPartial ? remainingAmount || 0 : null,
        payerType,
        new Date(),
      ]
    );

    const transaction = transactionResult.rows[0];

    logger.info(
      `Transaction créée automatiquement pour commande ${maskOrderId(orderId)}`,
      {
        transactionId: transaction.id,
        userId: maskUserId(payerUserId),
        paymentMethodId: finalPaymentMethodId || 'non renseigné',
        paymentMethodType,
        amount,
        status,
        orderId: maskOrderId(orderId),
      }
    );

    return transaction.id;
  } catch (error: any) {
    logger.error(
      `Erreur création transaction pour commande ${maskOrderId(params.orderId)}:`,
      {
        error: error.message,
        stack: error.stack,
        orderId: maskOrderId(params.orderId),
        userId: maskUserId(params.userId),
      }
    );
    return null;
  }
}

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
    const invoiceResult = await (pool as any).query(
      `INSERT INTO invoices (
        order_id,
        transaction_id,
        user_id,
        driver_id,
        subtotal,
        total,
        distance,
        price_per_km,
        urgency_fee,
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
        'draft',
      ]
    );

    const invoice = invoiceResult.rows[0];

    logger.debug(
      `Facture créée automatiquement pour commande ${maskOrderId(orderId)}`,
      {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoice_number,
        userId: maskUserId(userId),
        amount,
      }
    );

    return invoice.id;
  } catch (error: any) {
    logger.error(
      `Erreur création facture pour commande ${maskOrderId(orderId)}:`,
      error
    );
    return null;
  }
}

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
    logger.error(
      `Erreur création transaction et facture pour commande ${maskOrderId(orderId)}:`,
      error
    );
    return { transactionId: null, invoiceId: null };
  }
}
