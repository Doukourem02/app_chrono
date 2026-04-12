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
    description: 'Secret pour signer les tokens JWT (minimum 32 caractères)',
  },
  {
    name: 'DATABASE_URL',
    required: false,
    description: 'URL de connexion PostgreSQL',
  },
  {
    name: 'SUPABASE_URL',
    required: false,
    description: 'URL du projet Supabase',
  },
  {
    name: 'SUPABASE_SERVICE_ROLE_KEY',
    required: false,
    description: 'Clé service role Supabase (pour les opérations admin)',
  },
];

export function validateEnvironment(): void {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const envVar of requiredVars) {
    const value = process.env[envVar.name];

    if (envVar.required && !value) {
      errors.push(
        `${envVar.name} est REQUIS: ${envVar.description || 'Variable critique'}`
      );
    } else if (value && envVar.minLength && value.length < envVar.minLength) {
      errors.push(
        `${envVar.name} est trop court (${value.length} chars). Minimum requis: ${envVar.minLength} caractères`
      );
    } else if (!envVar.required && !value && envVar.description) {
      warnings.push(`${envVar.name} non défini: ${envVar.description}`);
    }
  }

  if (process.env.NODE_ENV === 'production') {
    const jwtSecret = process.env.JWT_SECRET;
    if (jwtSecret && jwtSecret.length < 32) {
      errors.push('JWT_SECRET doit faire au moins 32 caractères en production');
    }
    if (jwtSecret === 'default-secret-change-me-in-production') {
      errors.push(
        'JWT_SECRET ne doit JAMAIS utiliser la valeur par défaut en production'
      );
    }
    if (!process.env.FORCE_HTTPS && !process.env.PROXY_ENABLED) {
      warnings.push(
        'HTTPS n\'est pas forcé. Considérez FORCE_HTTPS=true en production'
      );
    }

    // SÉCURITÉ: CORS strict requis en production (admin + site(s) autorisés seulement)
    if (!process.env.ALLOWED_ORIGINS) {
      errors.push('ALLOWED_ORIGINS est requis en production (CORS strict).');
    }

    const twilioSmsReady = Boolean(
      process.env.TWILIO_ACCOUNT_SID?.trim() &&
        process.env.TWILIO_AUTH_TOKEN?.trim() &&
        (process.env.TWILIO_SMS_FROM?.trim() ||
          process.env.TWILIO_SMS_MESSAGING_SERVICE_SID?.trim())
    );
    const vonageReady = Boolean(
      process.env.VONAGE_API_KEY?.trim() && process.env.VONAGE_API_SECRET?.trim()
    );
    if (!twilioSmsReady && !vonageReady) {
      warnings.push(
        'OTP par SMS : aucun fournisseur configuré (Twilio SMS : TWILIO_SMS_FROM ou TWILIO_SMS_MESSAGING_SERVICE_SID + SID/token, ou Vonage VONAGE_*). Les envois send-otp (sms) échoueront.'
      );
    }

    if (!process.env.DATABASE_URL?.trim()) {
      warnings.push(
        'DATABASE_URL absent : PostgreSQL désactivé (pool mock). Voir PRODUCTION_CHECKLIST.md — §1 Base de données.'
      );
    }
    if (
      !process.env.SUPABASE_URL?.trim() ||
      !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
    ) {
      warnings.push(
        'Supabase admin incomplet : définir SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY pour le dashboard admin. Voir PRODUCTION_CHECKLIST.md — §4.'
      );
    }
    if (!process.env.SENTRY_DSN?.trim()) {
      warnings.push(
        'SENTRY_DSN absent : monitoring d’erreurs désactivé. Voir PRODUCTION_CHECKLIST.md — §3.'
      );
    }
    if (!process.env.REDIS_URL?.trim()) {
      warnings.push(
        'REDIS_URL absent : Socket.IO mono-instance uniquement (pas de scale horizontal). Voir PRODUCTION_CHECKLIST.md — §2.'
      );
    }
    if (!process.env.SLACK_WEBHOOK_URL?.trim()) {
      warnings.push(
        'SLACK_WEBHOOK_URL absent : notifications Slack désactivées. Voir PRODUCTION_CHECKLIST.md — §3.'
      );
    }
  }

  if (errors.length > 0) {
    logger.error(
      'ERREURS DE SÉCURITÉ - Variables d\'environnement manquantes ou invalides:'
    );
    errors.forEach((error) => logger.error(error));
    throw new Error(
      `Variables d'environnement critiques manquantes ou invalides:\n${errors.join('\n')}`
    );
  }

  if (warnings.length > 0) {
    logger.warn('Avertissements de configuration:');
    warnings.forEach((warning) => logger.warn(warning));
  }

  logger.info('Validation des variables d\'environnement réussie');
}

export function checkProductionReady(): boolean {
  if (process.env.NODE_ENV !== 'production') {
    return true;
  }

  const criticalChecks = [
    {
      name: 'JWT_SECRET',
      check: () =>
        process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 32,
    },
    {
      name: 'NODE_ENV=production',
      check: () => process.env.NODE_ENV === 'production',
    },
  ];

  const failedChecks = criticalChecks.filter((check) => !check.check());

  if (failedChecks.length > 0) {
    logger.error('L\'application n\'est PAS prête pour la production:');
    failedChecks.forEach((check) => logger.error(` - ${check.name} échoué`));
    return false;
  }

  logger.info('Application prête pour la production');
  return true;
}
