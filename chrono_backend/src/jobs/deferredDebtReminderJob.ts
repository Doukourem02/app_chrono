import pool from '../config/db.js';
import logger from '../utils/logger.js';
import { sendCampaignPushToUser } from '../services/expoPushService.js';

// Jours exacts où on envoie une notification (8 au total, stop après J+31)
// J+7, J+14           → Phase 1 : 💜 1x/semaine
// J+18, J+21, J+25    → Phase 2 : 🌟 2x/semaine
// J+27, J+29, J+31    → Phase 3 : 💳 3x/semaine puis sanctions
const REMINDER_DAYS = [7, 14, 18, 21, 25, 27, 29, 31];

// Garde le dernier jour de notif envoyé par userId pour éviter les doublons
const lastNotifDaySent = new Map<string, number>();

function getNotification(daysOld: number, totalAmount: number): { title: string; body: string } | null {
  const amount = totalAmount.toLocaleString('fr-FR');

  if (!REMINDER_DAYS.includes(daysOld)) return null;

  if (daysOld <= 14) {
    return {
      title: 'Petit rappel 💜',
      body: `Vous avez un crédit Krono de ${amount} FCFA à rembourser. Prenez votre temps, on est là pour vous !`,
    };
  }

  if (daysOld <= 25) {
    return {
      title: 'On pense à vous 🌟',
      body: `Votre crédit Krono (${amount} FCFA) attend toujours. Réglez facilement depuis l'app quand vous êtes prêt.`,
    };
  }

  return {
    title: 'Votre crédit Krono 💳',
    body: `N'oubliez pas votre crédit de ${amount} FCFA. Un simple tap depuis "Mes dettes" et c'est réglé !`,
  };
}

export async function runDeferredDebtReminderJob(): Promise<void> {
  logger.info('[debt-reminder] Lancement du job');

  try {
    const result = await (pool as any).query(
      `SELECT
         t.user_id,
         SUM(t.amount)::numeric                              AS total_amount,
         FLOOR(EXTRACT(EPOCH FROM NOW() - MIN(t.created_at)) / 86400)::int AS oldest_debt_days
       FROM transactions t
       INNER JOIN orders o ON t.order_id = o.id
       WHERE t.payment_method_type = 'deferred'
         AND t.status IN ('delayed', 'pending')
         AND t.created_at <= NOW() - INTERVAL '7 days'
         AND o.status = 'completed'
       GROUP BY t.user_id
       HAVING FLOOR(EXTRACT(EPOCH FROM NOW() - MIN(t.created_at)) / 86400)::int <= 31`
    );

    if (result.rows.length === 0) {
      logger.info('[debt-reminder] Aucune dette éligible');
      return;
    }

    for (const row of result.rows) {
      const userId: string = row.user_id;
      const totalAmount = parseFloat(row.total_amount ?? '0');
      const daysOld: number = row.oldest_debt_days;

      // Ne pas renvoyer si on a déjà notifié pour ce même jour (tolérance +1 pour décalages serveur)
      const lastDay = lastNotifDaySent.get(userId) ?? -1;
      if (Math.abs(daysOld - lastDay) < 1) continue;

      const notif = getNotification(daysOld, totalAmount);
      if (!notif) continue;

      try {
        await sendCampaignPushToUser({
          userId,
          appRole: 'client',
          title: notif.title,
          body: notif.body,
          data: { type: 'deferred_debt_reminder', screen: '/profile/debts' },
        });
        lastNotifDaySent.set(userId, daysOld);
        logger.info('[debt-reminder] Notif envoyée', {
          userIdPrefix: userId.slice(0, 8),
          daysOld,
          totalAmount,
        });
      } catch (err) {
        logger.warn('[debt-reminder] Erreur envoi', {
          userIdPrefix: userId.slice(0, 8),
          err: err instanceof Error ? err.message : String(err),
        });
      }
    }
  } catch (err) {
    logger.error('[debt-reminder] Erreur job:', err);
  }
}
