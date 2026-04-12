import { logger } from '@/utils/logger'
import { PRODUCTION_API_BASE_URL } from './productionApiBase'

export { PRODUCTION_API_BASE_URL }

export const config = {
  // API Configuration
  apiUrl:
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.EXPO_PUBLIC_API_URL ||
    PRODUCTION_API_BASE_URL,
  socketUrl:
    process.env.NEXT_PUBLIC_SOCKET_URL ||
    process.env.EXPO_PUBLIC_SOCKET_URL ||
    PRODUCTION_API_BASE_URL,
  mapboxAccessToken: process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || '',
  
  // App Configuration
  app: {
    name: 'Dashboard Krono',
    description: 'Dashboard et administration Krono Livraison',
    /**
     * Logo pleine image (portrait) — connexion, sidebar (`@/assets/chrono.png`).
     */
    logoUrl: '/assets/chrono.png',
    /**
     * Icône carrée 512×512 — onglet, favicon, PWA, OG (le PNG portrait se recadre mal en 16×16).
     */
    iconUrl: '/assets/chrono-icon.png',
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
if (!config.mapboxAccessToken) {
  logger.warn('Mapbox access token not configured. Map features may not work properly.')
}

export default config

