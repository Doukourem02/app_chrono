import Constants from 'expo-constants';

export const config = {
  // API Configuration
  googleApiKey: Constants.expoConfig?.extra?.googleApiKey || process.env.EXPO_PUBLIC_GOOGLE_API_KEY,
  apiUrl: Constants.expoConfig?.extra?.apiUrl || process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000',
  socketUrl: Constants.expoConfig?.extra?.socketUrl || process.env.EXPO_PUBLIC_SOCKET_URL || 'http://localhost:4000',
  
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
if (!config.googleApiKey) {
  console.warn('⚠️ Google API Key not configured. Map features may not work properly.');
}

export default config;