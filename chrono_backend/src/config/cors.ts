/**
 * Configuration CORS centralisée
 * Gère les origines autorisées selon l'environnement
 */

/**
 * URL publique du backend (sans chemin), ex. https://api.kro-no-delivery.com
 * Certaines stacks (iOS / RN) envoient Origin = cette URL sur les requêtes Socket.IO polling.
 */
export function getBackendPublicOrigin(): string | null {
  const raw = [
    process.env.API_PUBLIC_URL,
    process.env.BACKEND_PUBLIC_URL,
    process.env.PUBLIC_API_URL,
    process.env.RENDER_EXTERNAL_URL,
  ].find((s) => typeof s === 'string' && s.trim().length > 0);

  if (!raw) {
    return null;
  }

  try {
    const normalized = /^https?:\/\//i.test(raw.trim()) ? raw.trim() : `https://${raw.trim()}`;
    const u = new URL(normalized);
    return `${u.protocol}//${u.host}`;
  } catch {
    return null;
  }
}

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
    // Sans Origin : outils type curl/Postman, et sondes qui ne sont pas des navigateurs.
    // Les routes /health sont montées avant CORS ; le reste reste protégé par auth.
    return true;
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

  const selfOrigin = getBackendPublicOrigin();
  if (selfOrigin && origin === selfOrigin) {
    return true;
  }

  return allowedOrigins.includes(origin);
}

