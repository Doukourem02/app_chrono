import Constants from 'expo-constants';
import { logger } from '../utils/logger';
import { normalizeExpoUrl } from '../utils/normalizeExpoUrl';

const rawApi = Constants.expoConfig?.extra?.apiUrl || process.env.EXPO_PUBLIC_API_URL;
const rawSocket = Constants.expoConfig?.extra?.socketUrl || process.env.EXPO_PUBLIC_SOCKET_URL;

export const config = {
  // API Configuration
  mapboxAccessToken: Constants.expoConfig?.extra?.mapboxAccessToken || process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN || process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN,
  apiUrl: normalizeExpoUrl(rawApi as string | undefined, 'http://localhost:4000'),
  socketUrl: normalizeExpoUrl(rawSocket as string | undefined, 'http://localhost:4000'),
  sentryDsn: Constants.expoConfig?.extra?.sentryDsn || process.env.EXPO_PUBLIC_SENTRY_DSN,
  /** Better Stack / Logtail — même type de token que le backend (source dédiée mobile recommandée) */
  betterStackSourceToken:
    Constants.expoConfig?.extra?.betterStackSourceToken ||
    process.env.EXPO_PUBLIC_BETTER_STACK_SOURCE_TOKEN ||
    process.env.EXPO_PUBLIC_LOGTAIL_SOURCE_TOKEN,
  /** Surcharge rare (région EU, etc.) ; défaut in.logs.betterstack.com */
  betterStackIngestUrl:
    Constants.expoConfig?.extra?.betterStackIngestUrl || process.env.EXPO_PUBLIC_BETTER_STACK_INGEST_URL,

  legal: {
    cguUrl:
      Constants.expoConfig?.extra?.legalCguUrl ||
      process.env.EXPO_PUBLIC_LEGAL_CGU_URL ||
      '',
    privacyUrl:
      Constants.expoConfig?.extra?.legalPrivacyUrl ||
      process.env.EXPO_PUBLIC_LEGAL_PRIVACY_URL ||
      '',
  },
  
  // App Configuration
  app: {
    name: 'Krono pro',
    version: Constants.expoConfig?.version || '1.0.0',
    environment: __DEV__ ? 'development' : 'production',
  },
  
  // Map Configuration
  map: {
    defaultLatitudeDelta: 0.01,
    defaultLongitudeDelta: 0.01,
    animationDuration: 1000,
    cameraUpdateInterval: 3000, // Mise à jour caméra toutes les 3 secondes max
    routeRefreshInterval: 30000, // Recalcul route toutes les 30 secondes
  },
  
  // Network Configuration
  network: {
    timeout: 10000,
    retryAttempts: 3,
    retryDelay: 1000,
  },
};

if (__DEV__) {
  // À regarder dans le terminal Metro au lancement : doit être https://api.kro-no-delivery.com en prod réseau.
  console.warn('[Krono dev] API =', config.apiUrl, '| Socket =', config.socketUrl);
}

if (!__DEV__ && (config.apiUrl.includes('localhost') || config.apiUrl.includes('127.0.0.1'))) {
  logger.warn(
    'EXPO_PUBLIC_API_URL pointe vers localhost — l’API ne sera pas joignable depuis un téléphone. Vérifie les variables EAS (production) pour driver_chrono.',
    'config'
  );
}

// Validation des variables critiques
if (!config.mapboxAccessToken) {
  logger.warn(
    'Mapbox access token manquant — carte inactive. Vérifie EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN dans EAS (production).',
    'config'
  );
}

export default config;

