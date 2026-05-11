import { Server as SocketIOServer } from 'socket.io';

// ── Shared state maps ──────────────────────────────────────────────────────────
export const activeOrders = new Map<string, any>();
export const connectedDrivers = new Map<string, string>(); // driverId -> socketId
export const connectedUsers = new Map<string, string>();   // userId   -> socketId
export const declinedBatchOffers = new Map<string, Set<string>>(); // batchId -> driverIds
export const lastBatchOfferReplayAt = new Map<string, number>();   // driverId -> timestamp
export const driverDisconnectTimers = new Map<string, NodeJS.Timeout>();

// ── io singleton ───────────────────────────────────────────────────────────────
let _ioInstance: SocketIOServer | null = null;

export function setIoInstance(io: SocketIOServer): void {
  _ioInstance = io;
}

export function getIoInstance(): SocketIOServer | null {
  return _ioInstance;
}

// ── Configurable limits / constants ───────────────────────────────────────────
export const MAX_ACTIVE_ORDERS_PER_CLIENT = parseInt(
  process.env.MAX_ACTIVE_ORDERS_PER_CLIENT || '5'
);
export const MAX_ACTIVE_ORDERS_PER_DRIVER = parseInt(
  process.env.MAX_ACTIVE_ORDERS_PER_DRIVER || '3'
);

/** Positions lues en DB : ignorer les lignes plus vieilles que ça (évite match sur GPS obsolète). */
export const DRIVER_DB_POSITION_MAX_AGE_MIN = parseInt(
  process.env.DRIVER_DB_POSITION_MAX_AGE_MIN || '25',
  10
);

/** Après déconnexion du socket livreur, délai avant passage hors ligne (évite faux positifs réseau / switch d'app). */
export const DRIVER_OFFLINE_GRACE_MS = parseInt(
  process.env.DRIVER_SOCKET_OFFLINE_GRACE_MS || '90000',
  10
);

/** Fenêtre pour accepter/décliner une offre (à garder alignée avec `autoDeclineTimer` sur OrderRequestPopup, driver_chrono). */
export const DRIVER_OFFER_RESPONSE_MS = 30_000;

/** Court délai si le socket livreur n'est pas encore mappé (course client ↔ reconnect driver). */
export const DRIVER_OFFER_SOCKET_RETRY_MS = 500;
