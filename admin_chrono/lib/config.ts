export const config = {
  // API Configuration
  googleApiKey: process.env.NEXT_PUBLIC_GOOGLE_API_KEY || '',
  apiUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000',
  socketUrl: process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:4000',
  
  // App Configuration
  app: {
    name: 'Chrono Admin Console',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
  },
  
  // Map Configuration
  map: {
    defaultZoom: 13,
    defaultCenter: { lat: 5.3600, lng: -4.0083 }, // Abidjan, Côte d'Ivoire
  },
}

// Validation des variables critiques
if (!config.googleApiKey) {
  console.warn(' Google API Key not configured. Map features may not work properly.')
}

export default config

