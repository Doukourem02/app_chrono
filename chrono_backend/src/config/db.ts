import pkg from 'pg';
import { Pool, PoolClient } from 'pg';
import logger from '../utils/logger.js';

const { Pool: PoolClass } = pkg;
let pool: Pool | null = null;

if (process.env.DATABASE_URL) {
  try {
    // Configuration du pool PostgreSQL pour la production
    // Ces valeurs sont optimisées pour Supabase et peuvent être ajustées selon votre plan
    const poolConfig = {
      connectionString: process.env.DATABASE_URL,
      
      // Nombre maximum de connexions dans le pool
      // Supabase Free: ~4 connexions max, Pro: ~60, Team: ~200
      // Ajuster selon votre plan Supabase
      max: parseInt(process.env.DB_POOL_MAX || '20', 10),
      
      // Nombre minimum de connexions maintenues
      min: parseInt(process.env.DB_POOL_MIN || '2', 10),
      
      // Temps d'inactivité avant fermeture d'une connexion (30 secondes)
      idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_TIMEOUT || '30000', 10),
      
      // Timeout pour obtenir une connexion du pool (2 secondes)
      connectionTimeoutMillis: parseInt(process.env.DB_POOL_CONNECTION_TIMEOUT || '2000', 10),
      
      // Temps maximum d'exécution d'une requête (30 secondes)
      query_timeout: parseInt(process.env.DB_QUERY_TIMEOUT || '30000', 10),
      
      // Délai entre les tentatives de reconnexion (1 seconde)
      // Note: pg ne supporte pas directement cette option, mais on peut la gérer manuellement
    };

    pool = new PoolClass(poolConfig) as Pool;

    // Événements du pool
    pool.on('connect', (client) => {
      logger.debug('✅ Nouvelle connexion PostgreSQL établie');
    });

    pool.on('error', (err: Error, client: PoolClient) => {
      logger.error('❌ Erreur PostgreSQL dans le pool:', err.message);
      // Ne pas logger la stack complète en production pour éviter le spam
      if (process.env.NODE_ENV === 'development') {
        logger.error('Stack:', err.stack);
      }
    });

    pool.on('acquire', (client) => {
      logger.debug('🔌 Connexion acquise du pool');
    });

    pool.on('remove', (client) => {
      logger.debug('🔌 Connexion retirée du pool');
    });

    // Test de connexion initial
    pool.query('SELECT 1', (err) => {
      if (err) {
        logger.warn('⚠️  Test de connexion PostgreSQL échoué:', err.message);
      } else {
        logger.info(`✅ Pool PostgreSQL initialisé (max: ${poolConfig.max}, min: ${poolConfig.min})`);
      }
    });

    // Monitoring du pool (optionnel, seulement en développement)
    if (process.env.NODE_ENV === 'development' && process.env.DEBUG_DB_POOL === 'true') {
      setInterval(() => {
        if (pool) {
          const poolStats = {
            totalCount: pool.totalCount,
            idleCount: pool.idleCount,
            waitingCount: pool.waitingCount,
          };
          logger.debug('📊 Pool PostgreSQL stats:', poolStats);
        }
      }, 30000); // Toutes les 30 secondes
    }

  } catch (error: any) {
    logger.warn('⚠️  Erreur lors de la création du pool PostgreSQL:', error.message);
    pool = null;
  }
} else {
  logger.warn('⚠️  DATABASE_URL non configuré. Les fonctionnalités de base de données PostgreSQL seront désactivées.');
}

const mockPool = {
  query: async (_text: string, _params?: any[]) => {
    return { rows: [], rowCount: 0 };
  },
  connect: async (): Promise<PoolClient> => {
    return {
      query: async () => ({ rows: [], rowCount: 0 }),
      release: () => {}
    } as unknown as PoolClient;
  },
} as unknown as Pool;

export default (pool || mockPool) as Pool;

