import { Server as SocketIOServer, Socket } from 'socket.io';
import { realDriverStatuses } from '../controllers/driverController.js';
import { maskUserId } from '../utils/maskSensitiveData.js';
import logger from '../utils/logger.js';

const connectedAdmins = new Map<string, string>();

const adminSockets = new Map<string, string>();

interface ExtendedSocket extends Socket {
  adminId?: string;
}

export const setupAdminSocket = (io: SocketIOServer): void => {
  const DEBUG = process.env.DEBUG_SOCKETS === 'true';

  io.on('connection', (socket: ExtendedSocket) => {
    socket.on('admin-connect', (adminId: string) => {
      try {
        const authAdminId = (socket as any).userId as string | undefined;
        const role = (socket as any).userRole as string | undefined;

        if (!authAdminId) {
          logger.warn('[adminSocket] admin-connect appelé sans authentification');
          return;
        }

        if (role !== 'admin' && role !== 'super_admin') {
          logger.warn('[adminSocket] admin-connect bloqué (rôle non admin)', { socketId: socket.id, role });
          return;
        }

        // Ne jamais faire confiance à l'adminId fourni par le client
        if (adminId && adminId !== authAdminId) {
          logger.warn('[adminSocket] adminId mismatch (ignored)', {
            socketId: socket.id,
            provided: maskUserId(adminId),
            authenticated: maskUserId(authAdminId),
          });
        }

        connectedAdmins.set(authAdminId, socket.id);
        adminSockets.set(socket.id, authAdminId);
        socket.adminId = authAdminId;

        if (DEBUG) {
          logger.info(`[adminSocket] Admin connecté: ${maskUserId(authAdminId)} (socket: ${socket.id})`);
          logger.info(`[adminSocket] Total admins connectés: ${connectedAdmins.size}`);
        }
        
        const now = new Date();
        const onlineDrivers = Array.from(realDriverStatuses.entries())
          .filter(([_, status]) => {
            if (status.is_online !== true) return false;
            
            // Vérifier qu'ils sont actifs (mis à jour dans les 5 dernières minutes)
            if (status.updated_at) {
              const updatedAt = new Date(status.updated_at);
              const diffInMinutes = (now.getTime() - updatedAt.getTime()) / (1000 * 60);
              return diffInMinutes <= 5;
            }
            
            // Si pas de updated_at, considérer comme inactif
            return false;
          })
          .map(([userId, status]) => ({
            userId,
            is_online: status.is_online,
            is_available: status.is_available,
            current_latitude: status.current_latitude,
            current_longitude: status.current_longitude,
            updated_at: status.updated_at,
          }));

        if (DEBUG) {
          logger.info(`[adminSocket] Envoi de ${onlineDrivers.length} drivers en ligne et actifs à l'admin`);
        }

        socket.emit('admin:initial-drivers', { drivers: onlineDrivers });

        // Confirmer la connexion
        socket.emit('admin:connected', {
          success: true,
          message: 'Admin connecté avec succès',
          adminId: maskUserId(authAdminId),
        });
      } catch (error: any) {
        logger.error('[adminSocket] Erreur lors de admin-connect:', error);
        socket.emit('admin:error', { message: 'Erreur lors de la connexion' });
      }
    });

    // Gérer la déconnexion
    socket.on('disconnect', () => {
      const adminId = socket.adminId;
      if (adminId) {
        connectedAdmins.delete(adminId);
        adminSockets.delete(socket.id);
        if (DEBUG) {
          logger.info(`[adminSocket] Admin déconnecté: ${maskUserId(adminId)} (socket: ${socket.id})`);
          logger.info(`[adminSocket] Total admins connectés: ${connectedAdmins.size}`);
        }
      }
    });
  });

  // Fonction pour diffuser un événement à tous les admins connectés
  const broadcastToAdmins = (event: string, data: any) => {
    if (connectedAdmins.size === 0) {
      if (DEBUG) {
        logger.debug(`[adminSocket] Aucun admin connecté pour l'événement: ${event}`);
      }
      return;
    }

    io.to(Array.from(connectedAdmins.values())).emit(event, data);
    if (DEBUG) {
      logger.debug(`[adminSocket] Événement ${event} diffusé à ${connectedAdmins.size} admin(s)`);
    }
  };

  // Surveiller les changements dans realDriverStatuses
  // On va utiliser un interval pour vérifier les changements (toutes les 2 secondes)
  let lastDriverStatuses = new Map<string, any>();

  setInterval(() => {
    const currentStatuses = new Map<string, any>();
    const now = new Date();
    // 30 min : chauffeur en attente peut rester immobile ; en arrière-plan, iOS/Android suspendent les mises à jour
    const INACTIVITY_MINUTES = 30;

    // Nettoyer les drivers inactifs de realDriverStatuses
    const inactiveDrivers: string[] = [];
    for (const [userId, status] of realDriverStatuses.entries()) {
      if (status.is_online === true && status.updated_at) {
        const updatedAt = new Date(status.updated_at);
        const diffInMinutes = (now.getTime() - updatedAt.getTime()) / (1000 * 60);
        if (diffInMinutes > INACTIVITY_MINUTES) {
          inactiveDrivers.push(userId);
          if (DEBUG) {
            logger.debug(`[adminSocket] Driver inactif détecté (>${INACTIVITY_MINUTES} min): ${maskUserId(userId)}`);
          }
        }
      } else if (status.is_online === true && !status.updated_at) {
        inactiveDrivers.push(userId);
        if (DEBUG) {
          logger.debug(`[adminSocket] Driver sans updated_at mais marqué online: ${maskUserId(userId)} - considéré comme inactif`);
        }
      }
    }
    
    // Retirer les drivers inactifs
    inactiveDrivers.forEach(userId => {
      realDriverStatuses.delete(userId);
      // Diffuser l'événement offline pour ce driver
      broadcastToAdmins('driver:offline', {
        userId,
        is_online: false,
      });
    });
    
    for (const [userId, status] of realDriverStatuses.entries()) {
      // Vérifier que le driver est actif avant de le traiter (même seuil que le nettoyage)
      let isActive = true;
      if (status.updated_at) {
        const updatedAt = new Date(status.updated_at);
        const diffInMinutes = (now.getTime() - updatedAt.getTime()) / (1000 * 60);
        isActive = diffInMinutes <= INACTIVITY_MINUTES;
      } else if (status.is_online === true) {
        isActive = false;
      }
      
      // Ne traiter que les drivers actifs
      if (!isActive && status.is_online === true) {
        continue; // Skip les drivers inactifs
      }
      
      currentStatuses.set(userId, {
        is_online: status.is_online,
        is_available: status.is_available,
        current_latitude: status.current_latitude,
        current_longitude: status.current_longitude,
        updated_at: status.updated_at,
      });

      const lastStatus = lastDriverStatuses.get(userId);

      // Détecter si un driver vient de se connecter (nouveau ou qui repasse en ligne)
      // ET qu'il est actif
      if (!lastStatus && status.is_online === true && isActive) {
        broadcastToAdmins('driver:online', {
          userId,
          is_online: true,
          is_available: status.is_available,
          current_latitude: status.current_latitude,
          current_longitude: status.current_longitude,
          updated_at: status.updated_at,
        });
      }

      // Détecter si un driver repasse en ligne (était offline, maintenant online)
      // ET qu'il est actif
      if (lastStatus && lastStatus.is_online === false && status.is_online === true && isActive) {
        broadcastToAdmins('driver:online', {
          userId,
          is_online: true,
          is_available: status.is_available,
          current_latitude: status.current_latitude,
          current_longitude: status.current_longitude,
          updated_at: status.updated_at,
        });
      }

      // Détecter si un driver vient de se déconnecter
      if (lastStatus && lastStatus.is_online === true && status.is_online === false) {
        broadcastToAdmins('driver:offline', {
          userId,
          is_online: false,
        });
      }

      // Détecter si la position a changé (pour les drivers en ligne)
      if (
        status.is_online === true &&
        lastStatus &&
        lastStatus.is_online === true &&
        (lastStatus.current_latitude !== status.current_latitude ||
          lastStatus.current_longitude !== status.current_longitude)
      ) {
        broadcastToAdmins('driver:position:update', {
          userId,
          current_latitude: status.current_latitude,
          current_longitude: status.current_longitude,
          updated_at: status.updated_at,
        });
      }
    }

    // Détecter les drivers qui ont été supprimés de la Map (offline depuis plus de 5s)
    for (const [userId, lastStatus] of lastDriverStatuses.entries()) {
      if (!currentStatuses.has(userId) && lastStatus.is_online === true) {
        broadcastToAdmins('driver:offline', {
          userId,
          is_online: false,
        });
      }
    }

    lastDriverStatuses = currentStatuses;
  }, 2000); // Vérifier toutes les 2 secondes

  logger.info('[adminSocket] Admin socket handler initialisé');
};

/**
 * Diffuser un événement de mise à jour de commande aux admins
 */
export const broadcastOrderUpdateToAdmins = (
  io: SocketIOServer,
  event: string,
  data: any
): void => {
  if (connectedAdmins.size === 0) return;

  io.to(Array.from(connectedAdmins.values())).emit(event, data);
  
  if (process.env.DEBUG_SOCKETS === 'true') {
    logger.debug(`[adminSocket] Événement ${event} diffusé à ${connectedAdmins.size} admin(s)`);
  }
};

/**
 * Diffuser un événement de statut de driver aux admins
 */
export const broadcastDriverStatusToAdmins = (
  io: SocketIOServer,
  event: string,
  data: any
): void => {
  if (connectedAdmins.size === 0) {
    if (process.env.DEBUG_SOCKETS === 'true') {
      logger.debug(`[adminSocket] Aucun admin connecté pour l'événement: ${event}`);
    }
    return;
  }

  io.to(Array.from(connectedAdmins.values())).emit(event, data);
  
  if (process.env.DEBUG_SOCKETS === 'true') {
    logger.debug(`[adminSocket] Événement ${event} diffusé à ${connectedAdmins.size} admin(s)`);
  }
};

