import pool from '../config/db.js';
import logger from '../utils/logger.js';
import { maskUserId } from './maskSensitiveData.js';

/**
 * Constantes pour les limites de paiement différé
 */
const DEFERRED_PAYMENT_LIMITS = {
  ANNUAL_LIMIT: 20000, 
  MONTHLY_LIMIT: 5000, 
  MAX_USAGES_PER_MONTH: 2, 
  COOLDOWN_DAYS: 7, 
  MIN_AMOUNT: 2000, 
} as const;

/**
 * Restrictions en cas de retards de paiement
 */
const LATE_PAYMENT_RESTRICTIONS = {
  ONE_LATE_30_DAYS: {
    creditReduction: 2000, // Réduire à 3 000 FCFA (5 000 - 2 000)
    description: '1 retard dans les 30 derniers jours',
  },
  TWO_LATE_90_DAYS: {
    creditReduction: 3000, // Réduire à 2 000 FCFA (5 000 - 3 000)
    description: '2 retards dans les 90 derniers jours',
  },
  THREE_LATE: {
    blocked: true,
    blockMonths: 3,
    description: '3 retards ou plus - Blocage de 3 mois',
  },
} as const;

/**
 * Interface pour les informations de crédit différé
 */
export interface DeferredPaymentInfo {
  // Limites annuelles
  annualLimit: number;
  annualUsed: number;
  annualRemaining: number;
  
  // Limites mensuelles
  monthlyLimit: number;
  monthlyUsed: number;
  monthlyRemaining: number;
  
  // Utilisations mensuelles
  monthlyUsages: number;
  maxUsagesPerMonth: number;
  usagesRemaining: number;
  
  // Restrictions
  canUse: boolean;
  reason?: string;
  cooldownDaysRemaining?: number;
  nextAvailableDate?: Date;
  
  // Informations sur les retards
  latePaymentsCount: number;
  creditReduced: boolean;
  blocked: boolean;
  blockEndDate?: Date;
}

/**
 * Calcule le crédit annuel utilisé pour un utilisateur
 * Compte TOUTES les transactions différées créées dans l'année, peu importe leur statut actuel
 * (même si elles ont été remboursées, elles comptent dans la limite annuelle)
 */
export async function calculateAnnualCreditUsed(
  userId: string,
  currentYear: number
): Promise<number> {
  try {
    const startOfYear = new Date(currentYear, 0, 1);
    const endOfYear = new Date(currentYear, 11, 31, 23, 59, 59);

    const result = await (pool as any).query(
      `SELECT COALESCE(SUM(amount), 0) as total
       FROM transactions
       WHERE user_id = $1
         AND payment_method_type = 'deferred'
         AND payer_type = 'client'
         AND created_at >= $2
         AND created_at <= $3`,
      [userId, startOfYear, endOfYear]
    );

    const total = parseFloat(result.rows[0]?.total || '0');
    return total;
  } catch (error: any) {
    logger.error(
      `Erreur calcul crédit annuel utilisé pour ${maskUserId(userId)}:`,
      error
    );
    return 0;
  }
}

/**
 * Calcule le crédit mensuel utilisé pour un utilisateur dans le mois en cours
 * Compte TOUTES les transactions différées créées dans le mois, peu importe leur statut actuel
 * (même si elles ont été remboursées, elles comptent dans la limite mensuelle)
 * Cela garantit qu'un client ne peut utiliser que 5,000 FCFA par mois maximum, même s'il rembourse
 */
export async function calculateMonthlyCreditUsed(
  userId: string,
  currentDate: Date = new Date()
): Promise<number> {
  try {
    const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const endOfMonth = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth() + 1,
      0,
      23,
      59,
      59
    );

    const result = await (pool as any).query(
      `SELECT COALESCE(SUM(amount), 0) as total
       FROM transactions
       WHERE user_id = $1
         AND payment_method_type = 'deferred'
         AND payer_type = 'client'
         AND created_at >= $2
         AND created_at <= $3`,
      [userId, startOfMonth, endOfMonth]
    );

    const total = parseFloat(result.rows[0]?.total || '0');
    return total;
  } catch (error: any) {
    logger.error(
      `Erreur calcul crédit mensuel utilisé pour ${maskUserId(userId)}:`,
      error
    );
    return 0;
  }
}

/**
 * Récupère le nombre d'utilisations de paiement différé dans le mois en cours
 * Compte TOUTES les transactions différées créées dans le mois, peu importe leur statut actuel
 * (même si elles ont été remboursées, elles comptent dans la limite de 2 utilisations par mois)
 */
export async function getDeferredPaymentUsageCount(
  userId: string,
  currentDate: Date = new Date()
): Promise<number> {
  try {
    const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const endOfMonth = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth() + 1,
      0,
      23,
      59,
      59
    );

    const result = await (pool as any).query(
      `SELECT COUNT(*) as count
       FROM transactions
       WHERE user_id = $1
         AND payment_method_type = 'deferred'
         AND payer_type = 'client'
         AND created_at >= $2
         AND created_at <= $3`,
      [userId, startOfMonth, endOfMonth]
    );

    return parseInt(result.rows[0]?.count || '0', 10);
  } catch (error: any) {
    logger.error(
      `Erreur récupération nombre d'utilisations pour ${maskUserId(userId)}:`,
      error
    );
    return 0;
  }
}

/**
 * Récupère la date du dernier paiement différé pour vérifier la période de refroidissement
 * Compte TOUTES les transactions différées, peu importe leur statut actuel
 * (même si elles ont été remboursées, la période de refroidissement s'applique)
 */
export async function getLastDeferredPaymentDate(
  userId: string
): Promise<Date | null> {
  try {
    const result = await (pool as any).query(
      `SELECT MAX(created_at) as last_date
       FROM transactions
       WHERE user_id = $1
         AND payment_method_type = 'deferred'
         AND payer_type = 'client'`,
      [userId]
    );

    const lastDate = result.rows[0]?.last_date;
    return lastDate ? new Date(lastDate) : null;
  } catch (error: any) {
    logger.error(
      `Erreur récupération dernière date paiement différé pour ${maskUserId(userId)}:`,
      error
    );
    return null;
  }
}

/**
 * Vérifie les retards de paiement et retourne le nombre de retards
 */
export async function checkLatePayments(
  userId: string,
  currentDate: Date = new Date()
): Promise<{
  count30Days: number;
  count90Days: number;
  totalCount: number;
  isBlocked: boolean;
  blockEndDate?: Date;
}> {
  try {
    const thirtyDaysAgo = new Date(currentDate);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const ninetyDaysAgo = new Date(currentDate);
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    // Récupérer toutes les transactions différées avec statut 'delayed' (non payées)
    // On considère qu'une transaction est en retard si elle est en 'delayed' depuis plus de 7 jours
    const sevenDaysAgo = new Date(currentDate);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const result = await (pool as any).query(
      `SELECT 
         COUNT(*) FILTER (WHERE created_at >= $1) as count_30_days,
         COUNT(*) FILTER (WHERE created_at >= $2) as count_90_days,
         COUNT(*) as total_count
       FROM transactions
       WHERE user_id = $3
         AND payment_method_type = 'deferred'
         AND payer_type = 'client'
         AND status = 'delayed'
         AND created_at <= $4`,
      [thirtyDaysAgo, ninetyDaysAgo, userId, sevenDaysAgo]
    );

    const count30Days = parseInt(result.rows[0]?.count_30_days || '0', 10);
    const count90Days = parseInt(result.rows[0]?.count_90_days || '0', 10);
    const totalCount = parseInt(result.rows[0]?.total_count || '0', 10);

    // Vérifier si l'utilisateur est bloqué (3 retards ou plus)
    const isBlocked = totalCount >= 3;

    // Si bloqué, calculer la date de fin de blocage (3 mois après le dernier retard)
    let blockEndDate: Date | undefined;
    if (isBlocked) {
      const lastLatePaymentResult = await (pool as any).query(
        `SELECT MAX(created_at) as last_late_date
         FROM transactions
         WHERE user_id = $1
           AND payment_method_type = 'deferred'
           AND payer_type = 'client'
           AND status = 'delayed'
           AND created_at <= $2`,
        [userId, sevenDaysAgo]
      );

      const lastLateDate = lastLatePaymentResult.rows[0]?.last_late_date;
      if (lastLateDate) {
        blockEndDate = new Date(lastLateDate);
        blockEndDate.setMonth(blockEndDate.getMonth() + 3);
      }
    }

    return {
      count30Days,
      count90Days,
      totalCount,
      isBlocked,
      blockEndDate,
    };
  } catch (error: any) {
    logger.error(
      `Erreur vérification retards pour ${maskUserId(userId)}:`,
      error
    );
    return {
      count30Days: 0,
      count90Days: 0,
      totalCount: 0,
      isBlocked: false,
    };
  }
}

/**
 * Calcule le crédit mensuel disponible en tenant compte des restrictions
 */
export async function calculateMonthlyCreditAvailable(
  userId: string,
  currentDate: Date = new Date()
): Promise<{
  baseCredit: number;
  reducedCredit: number;
  finalCredit: number;
  reason?: string;
}> {
  const baseCredit = DEFERRED_PAYMENT_LIMITS.MONTHLY_LIMIT;
  const latePayments = await checkLatePayments(userId, currentDate);

  // Si bloqué, crédit = 0
  if (latePayments.isBlocked) {
    // Vérifier si le blocage est toujours actif
    if (latePayments.blockEndDate && latePayments.blockEndDate > currentDate) {
      return {
        baseCredit,
        reducedCredit: 0,
        finalCredit: 0,
        reason: `Bloqué jusqu'au ${latePayments.blockEndDate.toLocaleDateString('fr-FR')} (3 retards de paiement)`,
      };
    }
    // Le blocage est terminé, réinitialiser
  }

  // Appliquer les restrictions selon le nombre de retards
  let reducedCredit: number = baseCredit;
  let reason: string | undefined;

  if (latePayments.totalCount >= 3) {
    reducedCredit = 0;
    reason = '3 retards ou plus - Blocage de 3 mois';
  } else if (latePayments.count90Days >= 2) {
    reducedCredit = baseCredit - LATE_PAYMENT_RESTRICTIONS.TWO_LATE_90_DAYS.creditReduction;
    reason = LATE_PAYMENT_RESTRICTIONS.TWO_LATE_90_DAYS.description;
  } else if (latePayments.count30Days >= 1) {
    reducedCredit = baseCredit - LATE_PAYMENT_RESTRICTIONS.ONE_LATE_30_DAYS.creditReduction;
    reason = LATE_PAYMENT_RESTRICTIONS.ONE_LATE_30_DAYS.description;
  }

  return {
    baseCredit,
    reducedCredit,
    finalCredit: Math.max(0, reducedCredit),
    reason,
  };
}

/**
 * Vérifie si un utilisateur peut utiliser le paiement différé pour un montant donné
 */
export async function canUseDeferredPayment(
  userId: string,
  amount: number,
  currentDate: Date = new Date()
): Promise<{
  canUse: boolean;
  reason?: string;
  info?: DeferredPaymentInfo;
}> {
  try {
    // Vérifier le montant minimum
    if (amount < DEFERRED_PAYMENT_LIMITS.MIN_AMOUNT) {
      return {
        canUse: false,
        reason: `Montant minimum requis : ${DEFERRED_PAYMENT_LIMITS.MIN_AMOUNT.toLocaleString()} FCFA`,
      };
    }

    // Vérifier les retards et blocages
    const latePayments = await checkLatePayments(userId, currentDate);
    if (latePayments.isBlocked && latePayments.blockEndDate && latePayments.blockEndDate > currentDate) {
      return {
        canUse: false,
        reason: `Paiement différé bloqué jusqu'au ${latePayments.blockEndDate.toLocaleDateString('fr-FR')} (3 retards de paiement)`,
      };
    }

    // Calculer le crédit mensuel disponible
    const creditInfo = await calculateMonthlyCreditAvailable(userId, currentDate);
    const monthlyUsed = await calculateMonthlyCreditUsed(userId, currentDate);
    const monthlyRemaining = creditInfo.finalCredit - monthlyUsed;

    // Vérifier si le montant dépasse le crédit mensuel restant
    if (amount > monthlyRemaining) {
      return {
        canUse: false,
        reason: `Vous avez atteint votre quota de paiement différé.`,
      };
    }

    // Vérifier le nombre d'utilisations mensuelles
    const monthlyUsages = await getDeferredPaymentUsageCount(userId, currentDate);
    if (monthlyUsages >= DEFERRED_PAYMENT_LIMITS.MAX_USAGES_PER_MONTH) {
      return {
        canUse: false,
        reason: `Vous avez atteint votre quota de paiement différé.`,
      };
    }

    // Vérifier la période de refroidissement
    const lastPaymentDate = await getLastDeferredPaymentDate(userId);
    if (lastPaymentDate) {
      const daysSinceLastPayment = Math.floor(
        (currentDate.getTime() - lastPaymentDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysSinceLastPayment < DEFERRED_PAYMENT_LIMITS.COOLDOWN_DAYS) {
        const daysRemaining = DEFERRED_PAYMENT_LIMITS.COOLDOWN_DAYS - daysSinceLastPayment;
        return {
          canUse: false,
          reason: `Période de refroidissement active. Réessayez dans ${daysRemaining} jour(s)`,
        };
      }
    }

    // Vérifier le crédit annuel
    const currentYear = currentDate.getFullYear();
    const annualUsed = await calculateAnnualCreditUsed(userId, currentYear);
    const annualRemaining = DEFERRED_PAYMENT_LIMITS.ANNUAL_LIMIT - annualUsed;

    if (amount > annualRemaining) {
      return {
        canUse: false,
        reason: `Vous avez atteint votre quota annuel de paiement différé. Vous pourrez utiliser cette option à nouveau l'année prochaine.`,
      };
    }

    // Toutes les vérifications sont passées
    return {
      canUse: true,
    };
  } catch (error: any) {
    logger.error(
      `Erreur vérification paiement différé pour ${maskUserId(userId)}:`,
      error
    );
    return {
      canUse: false,
      reason: 'Erreur lors de la vérification des limites',
    };
  }
}

/**
 * Récupère toutes les informations de crédit différé pour un utilisateur
 */
export async function getDeferredPaymentInfo(
  userId: string,
  currentDate: Date = new Date()
): Promise<DeferredPaymentInfo> {
  try {
    const currentYear = currentDate.getFullYear();

    // Calculer les crédits annuels
    const annualUsed = await calculateAnnualCreditUsed(userId, currentYear);
    const annualRemaining = Math.max(0, DEFERRED_PAYMENT_LIMITS.ANNUAL_LIMIT - annualUsed);

    // Calculer les crédits mensuels
    const creditInfo = await calculateMonthlyCreditAvailable(userId, currentDate);
    const monthlyUsed = await calculateMonthlyCreditUsed(userId, currentDate);
    const monthlyRemaining = Math.max(0, creditInfo.finalCredit - monthlyUsed);

    // Récupérer les utilisations mensuelles
    const monthlyUsages = await getDeferredPaymentUsageCount(userId, currentDate);
    const usagesRemaining = Math.max(0, DEFERRED_PAYMENT_LIMITS.MAX_USAGES_PER_MONTH - monthlyUsages);

    // Vérifier les retards
    const latePayments = await checkLatePayments(userId, currentDate);

    // Vérifier la période de refroidissement
    const lastPaymentDate = await getLastDeferredPaymentDate(userId);
    let cooldownDaysRemaining: number | undefined;
    let nextAvailableDate: Date | undefined;

    if (lastPaymentDate) {
      const daysSinceLastPayment = Math.floor(
        (currentDate.getTime() - lastPaymentDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysSinceLastPayment < DEFERRED_PAYMENT_LIMITS.COOLDOWN_DAYS) {
        cooldownDaysRemaining = DEFERRED_PAYMENT_LIMITS.COOLDOWN_DAYS - daysSinceLastPayment;
        nextAvailableDate = new Date(lastPaymentDate);
        nextAvailableDate.setDate(nextAvailableDate.getDate() + DEFERRED_PAYMENT_LIMITS.COOLDOWN_DAYS);
      }
    }

    // Déterminer si l'utilisateur peut utiliser le paiement différé
    let canUse = true;
    let reason: string | undefined;

    if (latePayments.isBlocked && latePayments.blockEndDate && latePayments.blockEndDate > currentDate) {
      canUse = false;
      reason = `Bloqué jusqu'au ${latePayments.blockEndDate.toLocaleDateString('fr-FR')}`;
    } else if (monthlyRemaining <= 0) {
      canUse = false;
      reason = creditInfo.reason || 'Crédit mensuel épuisé';
    } else if (usagesRemaining <= 0) {
      canUse = false;
      reason = 'Limite d\'utilisations mensuelles atteinte';
    } else if (cooldownDaysRemaining && cooldownDaysRemaining > 0) {
      canUse = false;
      reason = `Période de refroidissement active (${cooldownDaysRemaining} jour(s) restant(s))`;
    } else if (annualRemaining <= 0) {
      canUse = false;
      reason = 'Crédit annuel épuisé';
    }

    return {
      annualLimit: DEFERRED_PAYMENT_LIMITS.ANNUAL_LIMIT,
      annualUsed,
      annualRemaining,
      monthlyLimit: creditInfo.finalCredit,
      monthlyUsed,
      monthlyRemaining,
      monthlyUsages,
      maxUsagesPerMonth: DEFERRED_PAYMENT_LIMITS.MAX_USAGES_PER_MONTH,
      usagesRemaining,
      canUse,
      reason,
      cooldownDaysRemaining,
      nextAvailableDate,
      latePaymentsCount: latePayments.totalCount,
      creditReduced: creditInfo.finalCredit < DEFERRED_PAYMENT_LIMITS.MONTHLY_LIMIT,
      blocked: latePayments.isBlocked && latePayments.blockEndDate ? latePayments.blockEndDate > currentDate : false,
      blockEndDate: latePayments.blockEndDate,
    };
  } catch (error: any) {
    logger.error(
      `Erreur récupération infos paiement différé pour ${maskUserId(userId)}:`,
      error
    );
    // Retourner des valeurs par défaut en cas d'erreur
    return {
      annualLimit: DEFERRED_PAYMENT_LIMITS.ANNUAL_LIMIT,
      annualUsed: 0,
      annualRemaining: DEFERRED_PAYMENT_LIMITS.ANNUAL_LIMIT,
      monthlyLimit: DEFERRED_PAYMENT_LIMITS.MONTHLY_LIMIT,
      monthlyUsed: 0,
      monthlyRemaining: DEFERRED_PAYMENT_LIMITS.MONTHLY_LIMIT,
      monthlyUsages: 0,
      maxUsagesPerMonth: DEFERRED_PAYMENT_LIMITS.MAX_USAGES_PER_MONTH,
      usagesRemaining: DEFERRED_PAYMENT_LIMITS.MAX_USAGES_PER_MONTH,
      canUse: false,
      reason: 'Erreur lors de la récupération des informations',
      latePaymentsCount: 0,
      creditReduced: false,
      blocked: false,
    };
  }
}

/**
 * Export des constantes pour utilisation dans d'autres fichiers
 */
export { DEFERRED_PAYMENT_LIMITS, LATE_PAYMENT_RESTRICTIONS };

