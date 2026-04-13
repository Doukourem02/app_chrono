/**
 * Configuration CORS centralisée
 * Gère les origines autorisées selon l'environnement
 */

/**
 * URL publique du backend (sans chemin), ex. https://api.kro-no-delivery.com
 * Certaines stacks (iOS / RN) envoient Origin = cette URL sur les requêtes Socket.IO polling.
 */
function normalizeOriginUrl(raw: string): string | null {
  try {
    const normalized = /^https?:\/\//i.test(raw.trim()) ? raw.trim() : `https://${raw.trim()}`;
    const u = new URL(normalized);
    return canonicalizeOrigin(`${u.protocol}//${u.host}`);
  } catch {
    return null;
  }
}

/**
 * Forme unique pour comparer les Origin (navigateurs / clients Socket.IO envoient parfois :443 ou :80 explicites).
 */
export function canonicalizeOrigin(origin: string): string {
  try {
    const u = new URL(origin.trim());
    const port = u.port;
    const defaultHttps = u.protocol === 'https:' && (port === '' || port === '443');
    const defaultHttp = u.protocol === 'http:' && (port === '' || port === '80');
    if (defaultHttps || defaultHttp) {
      return `${u.protocol}//${u.hostname}`;
    }
    return `${u.protocol}//${u.host}`;
  } catch {
    return origin.trim();
  }
}

/** Première URL publique du backend (comportement historique). */
export function getBackendPublicOrigin(): string | null {
  const raw = [
    process.env.API_PUBLIC_URL,
    process.env.BACKEND_PUBLIC_URL,
    process.env.PUBLIC_API_URL,
    process.env.RENDER_EXTERNAL_URL,
  ].find((s) => typeof s === 'string' && s.trim().length > 0);

  if (!raw) return null;
  return normalizeOriginUrl(raw);
}

/**
 * Toutes les origines candidates pour l’API (Socket.IO / CORS).
 * Les apps ou proxies envoient parfois Origin = URL du backend ; sans ça, handshake refusé.
 */
export function getBackendPublicOriginCandidates(): string[] {
  const keys = [
    process.env.API_PUBLIC_URL,
    process.env.BACKEND_PUBLIC_URL,
    process.env.PUBLIC_API_URL,
    process.env.RENDER_EXTERNAL_URL,
    process.env.ALLOWED_ORIGINS,
  ];
  const out = new Set<string>();
  for (const k of keys) {
    if (!k || typeof k !== 'string') continue;
    for (const part of k.split(',')) {
      const t = part.trim();
      if (!t) continue;
      const o = normalizeOriginUrl(t);
      if (o) out.add(o);
    }
  }
  return [...out];
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
  const incoming = canonicalizeOrigin(origin);

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

  for (const candidate of getBackendPublicOriginCandidates()) {
    if (incoming === canonicalizeOrigin(candidate)) {
      return true;
    }
  }

  return allowedOrigins.some((a) => incoming === canonicalizeOrigin(a));
}

