/**
 * Validation des variables d'environnement pour le dashboard admin
 * Appelé au démarrage de l'application
 */

const requiredEnvVars = [
  {
    name: 'NEXT_PUBLIC_API_URL',
    required: true,
    description: 'URL de l\'API backend',
  },
  {
    name: 'NEXT_PUBLIC_SOCKET_URL',
    required: true,
    description: 'URL du serveur WebSocket',
  },
  {
    name: 'NEXT_PUBLIC_SUPABASE_URL',
    required: true,
    description: 'URL du projet Supabase',
  },
  {
    name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    required: true,
    description: 'Clé anonyme Supabase',
  },
] as const;

const optionalEnvVars = [
  {
    name: 'NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN',
    required: false,
    description: 'Token Mapbox pour les cartes (https://account.mapbox.com/access-tokens/)',
  },
] as const;

export function validateEnvironment(): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Vérifier les variables requises
  for (const envVar of requiredEnvVars) {
    const value = process.env[envVar.name];
    if (!value) {
      errors.push(
        `❌ ${envVar.name} est REQUIS: ${envVar.description}`
      );
    } else if (value.includes('your-') || value.includes('example')) {
      errors.push(
        `❌ ${envVar.name} contient une valeur d'exemple. Veuillez la remplacer.`
      );
    }
  }

  // Vérifier les variables optionnelles
  for (const envVar of optionalEnvVars) {
    const value = process.env[envVar.name];
    if (!value) {
      warnings.push(
        `⚠️ ${envVar.name} non défini: ${envVar.description}`
      );
    }
  }

  // Validation spécifique en production
  if (process.env.NODE_ENV === 'production') {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (apiUrl && !apiUrl.startsWith('https://')) {
      errors.push(
        '❌ NEXT_PUBLIC_API_URL doit utiliser HTTPS en production'
      );
    }

    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL;
    if (socketUrl && !socketUrl.startsWith('https://') && !socketUrl.startsWith('wss://')) {
      errors.push(
        '❌ NEXT_PUBLIC_SOCKET_URL doit utiliser WSS (WebSocket Secure) en production'
      );
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

// Validation au chargement du module (côté serveur uniquement)
if (typeof window === 'undefined') {
  const validation = validateEnvironment();
  
  if (!validation.isValid) {
    console.error('🚨 ERREURS DE CONFIGURATION:');
    validation.errors.forEach((error) => console.error(error));
    
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        `Variables d'environnement manquantes ou invalides:\n${validation.errors.join('\n')}`
      );
    }
  }
  
  if (validation.warnings.length > 0) {
    console.warn('⚠️ AVERTISSEMENTS:');
    validation.warnings.forEach((warning) => console.warn(warning));
  }
  
  if (validation.isValid && validation.warnings.length === 0) {
    console.log('✅ Configuration validée avec succès');
  }
}

