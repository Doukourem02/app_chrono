import logger from '../utils/logger.js';

interface EnvVar {
  name: string;
  required: boolean;
  minLength?: number;
  description?: string;
}

const requiredVars: EnvVar[] = [
  {
    name: 'JWT_SECRET',
    required: true,
    minLength: 32,
    description: 'Secret pour signer les tokens JWT (minimum 32 caractères)'
  },
  {
    name: 'DATABASE_URL',
    required: false,
    description: 'URL de connexion PostgreSQL'
  },
  {
    name: 'SUPABASE_URL',
    required: false, 
    description: 'URL du projet Supabase'
  },
  {
    name: 'SUPABASE_SERVICE_ROLE_KEY',
    required: false,
    description: 'Clé service role Supabase (pour les opérations admin)'
  }
];

export function validateEnvironment(): void {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const envVar of requiredVars) {
    const value = process.env[envVar.name];

    if (envVar.required && !value) {
      errors.push(`❌ ${envVar.name} est REQUIS: ${envVar.description || 'Variable critique'}`);
    } else if (value && envVar.minLength && value.length < envVar.minLength) {
      errors.push(
        `❌ ${envVar.name} est trop court (${value.length} chars). Minimum requis: ${envVar.minLength} caractères`
      );
    } else if (!envVar.required && !value && envVar.description) {
      warnings.push(`⚠️ ${envVar.name} non défini: ${envVar.description}`);
    }
  }

  if (process.env.NODE_ENV === 'production') {
    const jwtSecret = process.env.JWT_SECRET;
    if (jwtSecret && jwtSecret.length < 32) {
      errors.push('❌ JWT_SECRET doit faire au moins 32 caractères en production');
    }

    if (jwtSecret === 'default-secret-change-me-in-production') {
      errors.push('❌ JWT_SECRET ne doit JAMAIS utiliser la valeur par défaut en production');
    }

    if (!process.env.FORCE_HTTPS && !process.env.PROXY_ENABLED) {
      warnings.push('⚠️ HTTPS n\'est pas forcé. Considérez FORCE_HTTPS=true en production');
    }
  }

  if (errors.length > 0) {
    logger.error('🔒 ERREURS DE SÉCURITÉ - Variables d\'environnement manquantes ou invalides:');
    errors.forEach(error => logger.error(error));
    throw new Error(
      `Variables d'environnement critiques manquantes ou invalides:\n${errors.join('\n')}`
    );
  }

  if (warnings.length > 0) {
    logger.warn('⚠️ Avertissements de configuration:');
    warnings.forEach(warning => logger.warn(warning));
  }

  logger.info('✅ Validation des variables d\'environnement réussie');
}

export function checkProductionReady(): boolean {
  if (process.env.NODE_ENV !== 'production') {
    return true; 
  }

  const criticalChecks = [
    { name: 'JWT_SECRET', check: () => process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 32 },
    { name: 'NODE_ENV=production', check: () => process.env.NODE_ENV === 'production' },
  ];

  const failedChecks = criticalChecks.filter(check => !check.check());

  if (failedChecks.length > 0) {
    logger.error('❌ L\'application n\'est PAS prête pour la production:');
    failedChecks.forEach(check => logger.error(`  - ${check.name} échoué`));
    return false;
  }

  logger.info('✅ Application prête pour la production');
  return true;
}

