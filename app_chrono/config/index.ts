import Constants from 'expo-constants';
import { logger } from '../utils/logger';
import { normalizeExpoUrl } from '../utils/normalizeExpoUrl';

const rawApi = Constants.expoConfig?.extra?.apiUrl || process.env.EXPO_PUBLIC_API_URL;
const rawSocket = Constants.expoConfig?.extra?.socketUrl || process.env.EXPO_PUBLIC_SOCKET_URL;
const rawTrack = Constants.expoConfig?.extra?.trackBaseUrl || process.env.EXPO_PUBLIC_TRACK_BASE_URL;

export const config = {
  // API Configuration
  mapboxAccessToken: Constants.expoConfig?.extra?.mapboxAccessToken || process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN,
  apiUrl: normalizeExpoUrl(rawApi as string | undefined, 'http://localhost:4000'),
  socketUrl: normalizeExpoUrl(rawSocket as string | undefined, 'http://localhost:4000'),
  trackBaseUrl: normalizeExpoUrl(rawTrack as string | undefined, 'http://localhost:3000'),
  sentryDsn: Constants.expoConfig?.extra?.sentryDsn || process.env.EXPO_PUBLIC_SENTRY_DSN,

  /** URLs des documents légaux (§2.5 ckprod.md) — même contenu que la politique en ligne. */
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
    name: 'Krono',
    version: Constants.expoConfig?.version || '1.0.0',
    environment: __DEV__ ? 'development' : 'production',
  },
  
  // Map Configuration
  map: {
    defaultLatitudeDelta: 0.05,
    defaultLongitudeDelta: 0.05,
    animationDuration: 300,
    maxPolygonPoints: 1000,
  },
  
  // Network Configuration
  network: {
    timeout: 10000,
    retryAttempts: 3,
    retryDelay: 1000,
  },
  
  // Validation
  validation: {
    minSearchLength: 2,
    maxLogEntries: 1000,
  },
};

if (__DEV__) {
  console.warn(
    '[Krono dev] API =',
    config.apiUrl,
    '| Socket =',
    config.socketUrl,
    '| Track =',
    config.trackBaseUrl
  );
}

if (
  !__DEV__ &&
  (config.trackBaseUrl.includes('localhost') || config.trackBaseUrl.includes('127.0.0.1'))
) {
  logger.error(
    '[Krono prod] EXPO_PUBLIC_TRACK_BASE_URL pointe vers localhost — le lien « Partager au destinataire » sera invalide sur un autre téléphone. Mets l’URL HTTPS de l’admin (ex. https://admin.tondomaine.com) dans EAS.',
    'config'
  );
}

if (!__DEV__ && (config.apiUrl.includes('localhost') || config.apiUrl.includes('127.0.0.1'))) {
  logger.error(
    '[Krono prod] EXPO_PUBLIC_API_URL pointe vers localhost — impossible de joindre l’API depuis un vrai téléphone. Vérifie les variables EAS (production) pour app_chrono.',
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