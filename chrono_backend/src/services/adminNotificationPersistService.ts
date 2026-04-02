import pool from '../config/db.js';
import logger from '../utils/logger.js';

const PERSISTED_EVENTS = new Set([
  'order:created',
  'order:assigned',
  'order:cancelled',
  'order:status:update',
]);

function buildRow(
  event: string,
  data: any
): { title: string; body: string; payload: object } | null {
  try {
    const order = data?.order;
    const orderId = order?.id || data?.orderId;
    const shortId = orderId ? String(orderId).slice(0, 8) : '';

    switch (event) {
      case 'order:created':
        return {
          title: 'Nouvelle commande',
          body: orderId ? `Commande #${shortId}` : 'Nouvelle commande',
          payload: { event, orderId: order?.id, price: order?.price },
        };
      case 'order:assigned':
        return {
          title: 'Commande assignée',
          body: orderId ? `#${shortId} → livreur` : 'Assignation livreur',
          payload: {
            event,
            orderId: order?.id,
            driverId: data?.driverId,
          },
        };
      case 'order:cancelled':
        return {
          title: 'Commande annulée',
          body: orderId ? `#${shortId}` : 'Annulation',
          payload: { event, orderId: data?.orderId || order?.id, reason: data?.reason },
        };
      case 'order:status:update': {
        const status = order?.status || data?.status;
        return {
          title: 'Mise à jour commande',
          body: orderId && status ? `#${shortId} → ${status}` : String(status || 'statut'),
          payload: { event, orderId: order?.id, status },
        };
      }
      default:
        return null;
    }
  } catch {
    return null;
  }
}

/**
 * Persiste un événement admin (complément Socket). Table dédiée admin_notification_feed.
 */
export async function persistAdminFeedNotification(
  event: string,
  data: any
): Promise<void> {
  if (!PERSISTED_EVENTS.has(event)) {
    return;
  }

  const row = buildRow(event, data);
  if (!row) {
    return;
  }

  try {
    await (pool as any).query(
      `INSERT INTO public.admin_notification_feed (category, title, body, payload)
       VALUES ($1, $2, $3, $4::jsonb)`,
      ['admin_feed', row.title, row.body, JSON.stringify(row.payload)]
    );
  } catch (e: any) {
    const code = e?.code;
    const msg = e?.message || String(e);
    if (code === '42P01' || /admin_notification_feed/i.test(msg)) {
      logger.debug(
        '[admin_notification_feed] Table absente — exécuter migration 020:',
        msg
      );
      return;
    }
    logger.warn('[admin_notification_feed] Insert échoué:', msg);
  }
}
