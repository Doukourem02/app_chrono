import { Server as SocketIOServer } from 'socket.io';
import { maskUserId } from '../utils/maskSensitiveData.js';
import logger from '../utils/logger.js';
import { realDriverStatuses } from '../controllers/driverController.js';
import { broadcastDriverStatusToAdmins } from './adminSocket.js';
import {
  connectedDrivers,
  driverDisconnectTimers,
  DRIVER_OFFLINE_GRACE_MS,
} from './orderSocketState.js';

export function clearDriverSocketOfflineTimer(driverId: string): void {
  const t = driverDisconnectTimers.get(driverId);
  if (t) {
    clearTimeout(t);
    driverDisconnectTimers.delete(driverId);
  }
}

export async function markDriverOfflineAfterSocketGrace(
  io: SocketIOServer,
  driverId: string
): Promise<void> {
  driverDisconnectTimers.delete(driverId);
  if (connectedDrivers.has(driverId)) {
    return;
  }
  const existing = realDriverStatuses.get(driverId);
  if (!existing || existing.is_online !== true) {
    return;
  }

  const updated_at = new Date().toISOString();
  const updated = {
    ...existing,
    user_id: driverId,
    is_online: false as const,
    is_available: false,
    updated_at,
  };
  realDriverStatuses.set(driverId, updated);

  // Ne pas écrire is_online=false en PostgreSQL ici : une coupure socket (app mobile en arrière-plan,
  // bascule entre deux apps sur le même téléphone) n'est pas équivalente à une mise hors ligne explicite.
  // Sinon la fusion DB de findNearbyDrivers exclut le livreur alors que l'app livreur affiche encore « en ligne »
  // jusqu'au prochain updateDriverStatus / rafraîchissement — d'où « aucun chauffeur » à la commande suivante.

  broadcastDriverStatusToAdmins(io, 'driver:offline', {
    userId: driverId,
    is_online: false,
  });

  logger.info(
    `[socket-disconnect] Livreur retiré du cache mémoire (socket absent après ${DRIVER_OFFLINE_GRACE_MS}ms), DB inchangée: ${maskUserId(driverId)}`
  );

  setTimeout(() => {
    const d = realDriverStatuses.get(driverId);
    if (d && d.is_online === false) {
      realDriverStatuses.delete(driverId);
    }
  }, 5000);
}

export function scheduleDriverOfflineOnSocketDisconnect(
  io: SocketIOServer,
  driverId: string
): void {
  clearDriverSocketOfflineTimer(driverId);
  const t = setTimeout(() => {
    void markDriverOfflineAfterSocketGrace(io, driverId);
  }, DRIVER_OFFLINE_GRACE_MS);
  driverDisconnectTimers.set(driverId, t);
}
