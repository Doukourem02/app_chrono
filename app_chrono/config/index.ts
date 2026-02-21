import Constants from 'expo-constants';
import { logger } from '../utils/logger';

export const config = {
  // API Configuration
  mapboxAccessToken: Constants.expoConfig?.extra?.mapboxAccessToken || process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN,
  apiUrl: Constants.expoConfig?.extra?.apiUrl || process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000',
  socketUrl: Constants.expoConfig?.extra?.socketUrl || process.env.EXPO_PUBLIC_SOCKET_URL || 'http://localhost:4000',
  sentryDsn: Constants.expoConfig?.extra?.sentryDsn || process.env.EXPO_PUBLIC_SENTRY_DSN,
  
  // App Configuration
  app: {
    name: 'Chrono Livraison',
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

// Validation des variables critiques
if (!config.mapboxAccessToken) {
  logger.warn('⚠️ Mapbox access token not configured. Mapbox maps may not work in dev build.');
}

export default config;