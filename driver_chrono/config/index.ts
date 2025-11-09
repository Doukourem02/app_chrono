import Constants from 'expo-constants';

export const config = {
  // API Configuration
  googleApiKey: Constants.expoConfig?.extra?.googleApiKey || 
                process.env.EXPO_PUBLIC_GOOGLE_API_KEY || 
                (typeof __DEV__ !== 'undefined' && __DEV__ ? undefined : ''),
  apiUrl: Constants.expoConfig?.extra?.apiUrl || process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000',
  socketUrl: Constants.expoConfig?.extra?.socketUrl || process.env.EXPO_PUBLIC_SOCKET_URL || 'http://localhost:4000',
  sentryDsn: Constants.expoConfig?.extra?.sentryDsn || process.env.EXPO_PUBLIC_SENTRY_DSN,
  
  // App Configuration
  app: {
    name: 'Chrono Driver',
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

// Validation des variables critiques
if (!config.googleApiKey) {
  console.warn('⚠️ Google API Key not configured. Route features may not work properly.');
}

export default config;

