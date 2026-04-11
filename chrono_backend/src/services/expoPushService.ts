import pool from '../config/db.js';
import logger from '../utils/logger.js';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

function copyForStatus(status: string): { title: string; body: string } | null {
  const s = (status || '').toLowerCase();
  switch (s) {
    case 'accepted':
      return {
        title: 'Course acceptée',
        body: 'Un livreur a accepté votre commande.',
      };
    case 'enroute':
      return {
        title: 'En route',
        body: 'Le livreur est en route vers le point de retrait.',
      };
    case 'picked_up':
      return {
        title: 'Colis récupéré',
        body: 'Votre colis a été récupéré.',
      };
    case 'delivering':
      return {
        title: 'En livraison',
        body: 'Le livreur est en route vers vous.',
      };
    case 'completed':
      return {
        title: 'Livraison terminée',
        body: 'Votre commande est livrée.',
      };
    case 'cancelled':
      return {
        title: 'Commande annulée',
        body: 'Votre commande a été annulée.',
      };
    default:
      return null;
  }
}

/**
 * Envoie une notification push Expo aux appareils client enregistrés pour cet utilisateur.
 * Ne bloque pas le flux métier : erreurs loguées seulement.
 */
export async function notifyClientOrderStatusPush(
  clientUserId: string,
  orderId: string,
  status: string
): Promise<void> {
  const copy = copyForStatus(status);
  if (!copy || !clientUserId || !orderId) return;

  if (!process.env.DATABASE_URL) return;

  let tokens: string[];
  try {
    const r = await pool.query<{ expo_push_token: string }>(
      `SELECT expo_push_token FROM push_tokens
       WHERE user_id = $1 AND app_role = 'client' AND invalidated_at IS NULL`,
      [clientUserId]
    );
    tokens = [...new Set(r.rows.map((row) => row.expo_push_token).filter(Boolean))];
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.warn('[expo-push] lecture push_tokens:', msg);
    return;
  }

  if (!tokens.length) return;

  const normalized = status.toLowerCase();
  const messages = tokens.map((to) => ({
    to,
    sound: 'default' as const,
    title: copy.title,
    body: copy.body,
    data: {
      type: 'order_status',
      orderId,
      status: normalized,
    },
  }));

  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Accept-Encoding': 'gzip, deflate',
    'Content-Type': 'application/json',
  };
  const access = process.env.EXPO_ACCESS_TOKEN?.trim();
  if (access) {
    headers.Authorization = `Bearer ${access}`;
  }

  try {
    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(messages),
    });
    const json = (await res.json()) as {
      data?: Array<{ status?: string; message?: string }>;
      errors?: unknown;
    };
    if (!res.ok) {
      logger.warn('[expo-push] HTTP', res.status, JSON.stringify(json).slice(0, 800));
      return;
    }
    const data = json.data;
    if (Array.isArray(data)) {
      for (const item of data) {
        if (item?.status === 'error') {
          logger.warn('[expo-push] ticket:', item.message);
        }
      }
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.warn('[expo-push] fetch:', msg);
  }
}
