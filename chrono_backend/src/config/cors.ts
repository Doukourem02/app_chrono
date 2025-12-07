/**
 * Configuration CORS centralisée
 * Gère les origines autorisées selon l'environnement
 */

export function getAllowedOrigins(): string[] {
  // En production, utiliser uniquement les origines configurées
  if (process.env.NODE_ENV === 'production') {
    const origins = process.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()).filter(Boolean);
    
    if (!origins || origins.length === 0) {
      throw new Error(
        'ALLOWED_ORIGINS doit être défini en production. ' +
        'Exemple: ALLOWED_ORIGINS=https://admin.yourdomain.com,https://app.yourdomain.com'
      );
    }
    
    return origins;
  }

  // En développement, accepter localhost et IPs locales
  const defaultDevOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3000',
    'http://localhost:8081',
    'http://localhost:8082',
    'exp://localhost:8081',
    'exp://localhost:8082',
  ];

  // Ajouter les origines personnalisées si définies
  const customOrigins = process.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()).filter(Boolean) || [];
  
  return [...new Set([...defaultDevOrigins, ...customOrigins])];
}

export function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin) {
    // Autoriser les requêtes sans origin (ex: Postman, curl)
    return process.env.NODE_ENV !== 'production';
  }

  const allowedOrigins = getAllowedOrigins();

  // En développement, accepter toutes les origines localhost et 192.168.*
  if (process.env.NODE_ENV !== 'production') {
    if (
      origin.includes('localhost') ||
      origin.includes('127.0.0.1') ||
      origin.match(/^https?:\/\/192\.168\.\d+\.\d+/)
    ) {
      return true;
    }
  }

  return allowedOrigins.includes(origin);
}

