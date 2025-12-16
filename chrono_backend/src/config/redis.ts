/**
 * Configuration Redis pour Socket.IO Adapter
 * Permet le scaling horizontal de Socket.IO
 * 
 * Fallback automatique : Si Redis n'est pas disponible, Socket.IO fonctionne en mode standalone
 */

import { createClient, RedisClientType } from 'redis';
import logger from '../utils/logger.js';

let pubClient: RedisClientType | null = null;
let subClient: RedisClientType | null = null;
let isRedisAvailable = false;

/**
 * Initialise les clients Redis pour Socket.IO Adapter
 * @returns {Promise<{pubClient: RedisClientType | null, subClient: RedisClientType | null, isAvailable: boolean}>}
 */
export async function initializeRedis(): Promise<{
  pubClient: RedisClientType | null;
  subClient: RedisClientType | null;
  isAvailable: boolean;
}> {
  const redisUrl = process.env.REDIS_URL;

  // Si REDIS_URL n'est pas configuré, fonctionner sans Redis (mode standalone)
  if (!redisUrl) {
    logger.warn('⚠️  REDIS_URL non configuré - Socket.IO fonctionnera en mode standalone (non scalable)');
    logger.info('💡 Pour activer le scaling horizontal, configurez REDIS_URL');
    return { pubClient: null, subClient: null, isAvailable: false };
  }

  try {
    // Créer le client principal (publisher)
    pubClient = createClient({
      url: redisUrl,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            logger.error('❌ Redis: Trop de tentatives de reconnexion, abandon');
            return new Error('Trop de tentatives de reconnexion');
          }
          // Retry avec délai exponentiel : 100ms, 200ms, 400ms, etc.
          return Math.min(retries * 100, 3000);
        },
        connectTimeout: 5000,
      },
    }) as RedisClientType;

    // Créer le client subscriber (dupliqué du publisher)
    subClient = pubClient.duplicate() as RedisClientType;

    // Gestion des erreurs
    pubClient.on('error', (err) => {
      logger.error('❌ Redis Publisher Error:', err);
      isRedisAvailable = false;
    });

    subClient.on('error', (err) => {
      logger.error('❌ Redis Subscriber Error:', err);
      isRedisAvailable = false;
    });

    // Connexion réussie
    pubClient.on('connect', () => {
      logger.info('🔌 Redis Publisher connecté');
    });

    subClient.on('connect', () => {
      logger.info('🔌 Redis Subscriber connecté');
    });

    pubClient.on('ready', () => {
      logger.info('✅ Redis Publisher prêt');
      isRedisAvailable = true;
    });

    subClient.on('ready', () => {
      logger.info('✅ Redis Subscriber prêt');
    });

    // Connexion
    await pubClient.connect();
    await subClient.connect();

    // Test de connexion
    await pubClient.ping();
    logger.info('✅ Redis initialisé avec succès - Socket.IO peut maintenant scaler horizontalement');

    return { pubClient, subClient, isAvailable: true };
  } catch (error: any) {
    logger.error('❌ Erreur lors de l\'initialisation Redis:', error.message);
    logger.warn('⚠️  Socket.IO fonctionnera en mode standalone (non scalable)');
    
    // Nettoyer les clients en cas d'erreur
    try {
      if (pubClient?.isOpen) await pubClient.quit();
      if (subClient?.isOpen) await subClient.quit();
    } catch (cleanupError) {
      // Ignorer les erreurs de nettoyage
    }
    
    pubClient = null;
    subClient = null;
    isRedisAvailable = false;

    return { pubClient: null, subClient: null, isAvailable: false };
  }
}

/**
 * Ferme les connexions Redis proprement
 */
export async function closeRedis(): Promise<void> {
  try {
    if (pubClient?.isOpen) {
      await pubClient.quit();
      logger.info('🔌 Redis Publisher fermé');
    }
    if (subClient?.isOpen) {
      await subClient.quit();
      logger.info('🔌 Redis Subscriber fermé');
    }
  } catch (error: any) {
    logger.error('Erreur lors de la fermeture Redis:', error.message);
  }
}

/**
 * Vérifie si Redis est disponible
 */
export function isRedisConnected(): boolean {
  return isRedisAvailable && pubClient?.isOpen === true && subClient?.isOpen === true;
}

export { pubClient, subClient };

