/**
 * Configuration globale pour les tests TypeScript
 */

// Configuration de l'environnement de test
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-minimum-32-characters-long-for-testing';
// DATABASE_URL peut venir de TEST_DATABASE_URL (CI/CD) ou directement
process.env.DATABASE_URL = process.env.DATABASE_URL || process.env.TEST_DATABASE_URL || 'postgresql://test:test@localhost:5432/chrono_test';
process.env.SUPABASE_URL = process.env.TEST_SUPABASE_URL || 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.TEST_SUPABASE_KEY || 'test-service-role-key';

// Désactiver les logs pendant les tests
process.env.LOG_LEVEL = 'error';

console.log('🧪 Configuration des tests TypeScript chargée');

