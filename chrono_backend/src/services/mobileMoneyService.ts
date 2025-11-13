import logger from '../utils/logger.js';
import { maskPhoneNumber } from '../utils/maskSensitiveData.js';

export type MobileMoneyProvider = 'orange_money' | 'wave';

export type PaymentStatus = 'pending' | 'paid' | 'refused' | 'failed';

export interface MobileMoneyPaymentParams {
  provider: MobileMoneyProvider;
  phoneNumber: string;
  amount: number;
  orderId: string;
  description?: string;
}

export interface MobileMoneyPaymentResponse {
  success: boolean;
  transactionId?: string;
  providerTransactionId?: string;
  status: PaymentStatus;
  message?: string;
  error?: string;
  providerResponse?: any;
}

export interface MobileMoneyConfig {
  orangeMoney?: {
    apiKey: string;
    apiSecret: string;
    merchantId: string;
    apiUrl?: string;
  };
  wave?: {
    apiKey: string;
    apiSecret: string;
    merchantId: string;
    apiUrl?: string;
  };
}

const config: MobileMoneyConfig = {
  orangeMoney: process.env.ORANGE_MONEY_API_KEY
    ? {
        apiKey: process.env.ORANGE_MONEY_API_KEY,
        apiSecret: process.env.ORANGE_MONEY_API_SECRET || '',
        merchantId: process.env.ORANGE_MONEY_MERCHANT_ID || '',
        apiUrl:
          process.env.ORANGE_MONEY_API_URL ||
          'https://api.orange.com/orange-money-webpay',
      }
    : undefined,
  wave: process.env.WAVE_API_KEY
    ? {
        apiKey: process.env.WAVE_API_KEY,
        apiSecret: process.env.WAVE_API_SECRET || '',
        merchantId: process.env.WAVE_MERCHANT_ID || '',
        apiUrl: process.env.WAVE_API_URL || 'https://api.wave.com/v',
      }
    : undefined,
};

async function initiateOrangeMoneyPayment(
  params: MobileMoneyPaymentParams
): Promise<MobileMoneyPaymentResponse> {
  const { phoneNumber, amount, orderId, description } = params;

  if (!config.orangeMoney) {
    return {
      success: false,
      status: 'failed',
      error: 'Orange Money non configuré',
    };
  }

  try {
    logger.info(`Initiation paiement Orange Money pour commande ${orderId}`, {
      phone: maskPhoneNumber(phoneNumber),
      amount,
    });

    const providerTransactionId = `OM-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    return {
      success: true,
      transactionId: providerTransactionId,
      providerTransactionId,
      status: 'pending',
      message: 'Paiement Orange Money initié',
      providerResponse: {
        provider: 'orange_money',
        transactionId: providerTransactionId,
        status: 'pending',
      },
    };
  } catch (error: any) {
    logger.error('Erreur paiement Orange Money:', error);
    return {
      success: false,
      status: 'failed',
      error: error.message || "Erreur lors de l'initiation du paiement Orange Money",
    };
  }
}

async function initiateWavePayment(
  params: MobileMoneyPaymentParams
): Promise<MobileMoneyPaymentResponse> {
  const { phoneNumber, amount, orderId, description } = params;

  if (!config.wave) {
    return {
      success: false,
      status: 'failed',
      error: 'Wave non configuré',
    };
  }

  try {
    logger.info(`Initiation paiement Wave pour commande ${orderId}`, {
      phone: maskPhoneNumber(phoneNumber),
      amount,
    });

    const providerTransactionId = `WV-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    return {
      success: true,
      transactionId: providerTransactionId,
      providerTransactionId,
      status: 'pending',
      message: 'Paiement Wave initié',
      providerResponse: {
        provider: 'wave',
        transactionId: providerTransactionId,
        status: 'pending',
      },
    };
  } catch (error: any) {
    logger.error('Erreur paiement Wave:', error);
    return {
      success: false,
      status: 'failed',
      error: error.message || "Erreur lors de l'initiation du paiement Wave",
    };
  }
}

export async function checkPaymentStatus(
  provider: MobileMoneyProvider,
  providerTransactionId: string
): Promise<MobileMoneyPaymentResponse> {
  try {
    logger.info(`Vérification statut paiement ${provider}`, {
      transactionId: providerTransactionId,
    });

    return {
      success: true,
      transactionId: providerTransactionId,
      providerTransactionId,
      status: 'pending',
      message: 'Statut du paiement vérifié',
    };
  } catch (error: any) {
    logger.error(`Erreur vérification statut ${provider}:`, error);
    return {
      success: false,
      status: 'failed',
      error:
        error.message ||
        `Erreur lors de la vérification du statut ${provider}`,
    };
  }
}

export async function initiateMobileMoneyPayment(
  params: MobileMoneyPaymentParams
): Promise<MobileMoneyPaymentResponse> {
  const { provider } = params;

  switch (provider) {
    case 'orange_money':
      return await initiateOrangeMoneyPayment(params);
    case 'wave':
      return await initiateWavePayment(params);
    default:
      return {
        success: false,
        status: 'failed',
        error: `Fournisseur non supporté: ${provider}`,
      };
  }
}

export function validateMobileMoneyParams(
  params: MobileMoneyPaymentParams
): { valid: boolean; error?: string } {
  if (
    !params.provider ||
    !['orange_money', 'wave'].includes(params.provider)
  ) {
    return { valid: false, error: 'Fournisseur Mobile Money invalide' };
  }

  if (!params.phoneNumber || !/^\+?[0-9]{8,15}$/.test(params.phoneNumber)) {
    return { valid: false, error: 'Numéro de téléphone invalide' };
  }

  if (!params.amount || params.amount <= 0) {
    return { valid: false, error: 'Le montant doit être supérieur à 0' };
  }

  if (!params.orderId) {
    return { valid: false, error: 'ID de commande requis' };
  }

  return { valid: true };
}
