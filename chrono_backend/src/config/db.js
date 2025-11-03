import pkg from 'pg';
import logger from '../utils/logger.js';

const { Pool } = pkg;

// Créer un pool uniquement si DATABASE_URL est configuré
let pool = null;

if (process.env.DATABASE_URL) {
  try {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });

    pool.on('connect', () => {
      logger.info('✅ Connected to PostgreSQL');
    });

    pool.on('error', (err) => {
      logger.error('❌ Erreur de connexion PostgreSQL:', err.message);
      // Ne pas faire crash l'app si la connexion échoue au démarrage
    });

    // Tester la connexion au démarrage
    pool.query('SELECT 1', (err) => {
      if (err) {
        logger.warn('⚠️ Impossible de se connecter à PostgreSQL:', err.message);
      }
    });
  } catch (error) {
    logger.warn('⚠️ Erreur lors de la création du pool PostgreSQL:', error.message);
    pool = null;
  }
} else {
  logger.warn('⚠️ DATABASE_URL non configuré. Les fonctionnalités de base de données PostgreSQL seront désactivées.');
}

// Export d'un pool mock si non configuré pour éviter les erreurs
// Ce mock retourne des résultats vides au lieu de lancer des erreurs
export default pool || {
  query: async (text, params) => {
    // Retourner un résultat vide au lieu de lancer une erreur
    return { rows: [], rowCount: 0 };
  },
  connect: async () => {
    // Retourner un client mock
    return {
      query: async () => ({ rows: [], rowCount: 0 }),
      release: () => {}
    };
  },
};
