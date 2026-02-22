/**
 * Validation des variables d'environnement pour l'app chauffeur
 * Appelé au démarrage de l'application
 */

import Constants from 'expo-constants';

const requiredEnvVars = [
  {
    name: 'EXPO_PUBLIC_API_URL',
    required: true,
    description: 'URL de l\'API backend',
  },
  {
    name: 'EXPO_PUBLIC_SOCKET_URL',
    required: true,
    description: 'URL du serveur WebSocket',
  },
  {
    name: 'EXPO_PUBLIC_SUPABASE_URL',
    required: true,
    description: 'URL du projet Supabase',
  },
  {
    name: 'EXPO_PUBLIC_SUPABASE_ANON_KEY',
    required: true,
    description: 'Clé anonyme Supabase',
  },
] as const;

const optionalEnvVars = [
  {
    name: 'EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN',
    required: false,
    description: 'Token Mapbox pour les cartes et itinéraires',
  },
] as const;

export function validateEnvironment(): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Récupérer les variables d'environnement depuis Expo Constants
  const getEnvVar = (name: string): string | undefined => {
    return Constants.expoConfig?.extra?.[name] || process.env[name];
  };

  // Vérifier les variables requises
  for (const envVar of requiredEnvVars) {
    const value = getEnvVar(envVar.name);
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
    let value = getEnvVar(envVar.name);
    // Mapbox: accepter aussi mapboxAccessToken (extra) ou NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN
    if (!value && envVar.name === 'EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN') {
      value =
        Constants.expoConfig?.extra?.mapboxAccessToken ||
        process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
    }
    if (!value) {
      warnings.push(
        `⚠️ ${envVar.name} non défini: ${envVar.description}`
      );
    }
  }

  // Validation spécifique en production
  if (__DEV__ === false) {
    const apiUrl = getEnvVar('EXPO_PUBLIC_API_URL');
    if (apiUrl && !apiUrl.startsWith('https://')) {
      errors.push(
        '❌ EXPO_PUBLIC_API_URL doit utiliser HTTPS en production'
      );
    }

    const socketUrl = getEnvVar('EXPO_PUBLIC_SOCKET_URL');
    if (socketUrl && !socketUrl.startsWith('https://') && !socketUrl.startsWith('wss://')) {
      errors.push(
        '❌ EXPO_PUBLIC_SOCKET_URL doit utiliser WSS (WebSocket Secure) en production'
      );
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

// Log des erreurs (en développement uniquement)
if (__DEV__) {
  const validation = validateEnvironment();
  
  if (!validation.isValid) {
    console.error('🚨 ERREURS DE CONFIGURATION:');
    validation.errors.forEach((error) => console.error(error));
  }
  
  if (validation.warnings.length > 0) {
    console.warn('⚠️ AVERTISSEMENTS:');
    validation.warnings.forEach((warning) => console.warn(warning));
  }
  
  if (validation.isValid && validation.warnings.length === 0) {
    console.log('✅ Configuration validée avec succès');
  }
}

