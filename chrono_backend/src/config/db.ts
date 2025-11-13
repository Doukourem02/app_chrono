import pkg from 'pg';
import { Pool, PoolClient } from 'pg';
import logger from '../utils/logger.js'; const { Pool: PoolClass } = pkg; let pool: Pool | null = null; if (process.env.DATABASE_URL) {
  try {
    pool = new PoolClass({
      connectionString: process.env.DATABASE_URL,
    }) as Pool;

  pool.on('connect', () => { logger.debug('Connected to PostgreSQL'); }); pool.on('error', (err: Error) => { logger.error('Erreur de connexion PostgreSQL:', err.message); }); pool.query('SELECT 1', (err) => { if (err) { logger.warn('Impossible de se connecter à PostgreSQL:', err.message); } }); } catch (error: any) {
  logger.warn('Erreur lors de la création du pool PostgreSQL:', error.message); pool = null; }
} else { logger.warn('DATABASE_URL non configuré. Les fonctionnalités de base de données PostgreSQL seront désactivées.');
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

