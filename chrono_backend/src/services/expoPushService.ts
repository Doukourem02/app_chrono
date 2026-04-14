import pool from '../config/db.js';
import logger from '../utils/logger.js';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

type AppPushRole = 'client' | 'driver';

/** Statuts notifiés au client qui a passé la commande. */
function copyForPayerStatus(status: string): { title: string; body: string } | null {
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
        body: 'Le livreur est en route vers le point de collecte de colis.',
      };
    case 'picked_up':
      return {
        title: 'Colis récupéré',
        body: 'Le livreur a récupéré le colis.',
      };
    case 'delivering':
      return {
        title: 'En livraison',
        body: 'Le livreur est en route vers le destinataire.',
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

/** Statuts notifiés au destinataire inscrit (compte client distinct du payeur). */
function copyForRecipientStatus(status: string): { title: string; body: string } | null {
  const s = (status || '').toLowerCase();
  switch (s) {
    case 'accepted':
      return {
        title: 'Course acceptée',
        body: 'Une livraison est en route vers vous.',
      };
    case 'enroute':
      return {
        title: 'En route',
        body: 'Le livreur est en route vers le point de collecte.',
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
        body: 'Votre colis a été livré.',
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

function truncateBody(text: string, max = 140): string {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

/** Corps de notif avec lien HTTPS de suivi (même base que SMS / partage app). */
function withPublicTrackUrl(body: string, trackUrl: string | null | undefined): string {
  const u = typeof trackUrl === 'string' ? trackUrl.trim() : '';
  if (!u) return body;
  return `${body}\n${u}`;
}

async function fetchTokensForUser(userId: string, appRole: AppPushRole): Promise<string[]> {
  if (!process.env.DATABASE_URL || !userId) return [];
  try {
    const r = await pool.query<{ expo_push_token: string }>(
      `SELECT expo_push_token FROM push_tokens
       WHERE user_id = $1 AND app_role = $2 AND invalidated_at IS NULL`,
      [userId, appRole]
    );
    return [...new Set(r.rows.map((row) => row.expo_push_token).filter(Boolean))];
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.warn('[expo-push] lecture push_tokens:', msg);
    return [];
  }
}

async function postExpoPush(
  messages: Array<{
    to: string;
    sound: 'default';
    title: string;
    body: string;
    data: Record<string, unknown>;
  }>
): Promise<void> {
  if (!messages.length) return;

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

async function sendPushToUser(
  userId: string,
  appRole: AppPushRole,
  title: string,
  body: string,
  data: Record<string, unknown>
): Promise<void> {
  const tokens = await fetchTokensForUser(userId, appRole);
  if (!tokens.length) {
    logger.warn('[expo-push] aucun token push en base pour cet utilisateur — pas d’envoi (vérifie POST /api/push/register depuis l’app, permissions notif, build EAS Android)', {
      appRole,
      userIdPrefix: userId?.slice(0, 8),
    });
    return;
  }
  const messages = tokens.map((to) => ({
    to,
    sound: 'default' as const,
    title,
    body,
    data,
  }));
  await postExpoPush(messages);
}

/**
 * Push statut commande : payeur (toujours app client) + destinataire inscrit si différent.
 */
export async function notifyOrderStatusPushes(params: {
  orderId: string;
  status: string;
  payerUserId: string;
  recipientUserId?: string | null;
  /** Lien public /track/{token} si PUBLIC_TRACK_BASE_URL est défini côté serveur. */
  trackUrl?: string | null;
}): Promise<void> {
  const { orderId, status, payerUserId, recipientUserId, trackUrl } = params;
  if (!orderId || !payerUserId) return;

  const normalized = status.toLowerCase();
  const payerCopy = copyForPayerStatus(normalized);
  const recipientCopy = copyForRecipientStatus(normalized);

  const dataBase = {
    type: 'order_status',
    orderId,
    status: normalized,
    ...(typeof trackUrl === 'string' && trackUrl.trim()
      ? { trackUrl: trackUrl.trim() }
      : {}),
  };

  if (payerCopy) {
    void sendPushToUser(
      payerUserId,
      'client',
      payerCopy.title,
      withPublicTrackUrl(payerCopy.body, trackUrl),
      dataBase
    ).catch((e: unknown) => {
      logger.warn('[expo-push] payer:', e instanceof Error ? e.message : String(e));
    });
  }

  const rid = typeof recipientUserId === 'string' ? recipientUserId.trim() : '';
  if (recipientCopy && rid && rid !== payerUserId) {
    void sendPushToUser(
      rid,
      'client',
      recipientCopy.title,
      withPublicTrackUrl(recipientCopy.body, trackUrl),
      dataBase
    ).catch((e: unknown) => {
      logger.warn('[expo-push] recipient:', e instanceof Error ? e.message : String(e));
    });
  }
}

/**
 * Push lors d’un message dans une conversation liée à une commande (client ↔ livreur).
 */
export async function notifyOrderChatMessagePush(params: {
  conversation: {
    id: string;
    type: string;
    order_id?: string | null;
    participant_1_id: string;
    participant_2_id: string;
  };
  senderId: string;
  content: string;
}): Promise<void> {
  const { conversation, senderId, content } = params;
  if (conversation.type !== 'order' || !conversation.order_id) return;

  const recipientId =
    conversation.participant_1_id === senderId
      ? conversation.participant_2_id
      : conversation.participant_1_id;

  if (!recipientId || recipientId === senderId) return;

  let senderRole = '';
  try {
    const r = await pool.query<{ role: string }>(`SELECT role FROM users WHERE id = $1 LIMIT 1`, [
      senderId,
    ]);
    senderRole = (r.rows[0]?.role || '').toLowerCase();
  } catch (e: unknown) {
    logger.warn('[expo-push] rôle expéditeur:', e instanceof Error ? e.message : String(e));
    return;
  }

  const title = senderRole === 'driver' ? 'Message du livreur' : 'Message du client';
  const body = truncateBody(content);
  const appRole: AppPushRole = senderRole === 'driver' ? 'client' : 'driver';

  await sendPushToUser(recipientId, appRole, title, body, {
    type: 'order_chat_message',
    orderId: conversation.order_id,
    conversationId: conversation.id,
  });
}
