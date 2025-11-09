/**
 * Configuration globale pour les tests
 */

// Configuration de l'environnement de test
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://test:test@localhost:5432/chrono_test';

// Mock des dépendances externes si nécessaire
// Par exemple : Supabase, services email, etc.

console.log('🧪 Configuration des tests chargée');

