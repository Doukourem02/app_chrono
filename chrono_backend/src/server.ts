import 'dotenv/config';
import * as Sentry from '@sentry/node';
import http from 'http';
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { validateEnvironment } from './config/envCheck.js';
import app from './app.js';
import deliverySocket from './sockets/deliverySocket.js';
import { setupOrderSocket } from './sockets/orderSocket.js';
import { setupAdminSocket } from './sockets/adminSocket.js';
import { setupMessageSocket } from './sockets/messageSocket.js';
import logger from './utils/logger.js';
import { initializeRedis, closeRedis, pubClient, subClient } from './config/redis.js';
import { createClient } from '@supabase/supabase-js';
import pool from './config/db.js';
import { verifyAccessToken } from './utils/jwt.js';
import { getAllowedOrigins } from './config/cors.js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    beforeSend(event, hint) {
      if (event.request?.headers?.['x-status-code'] === '400') {
        return null;
      }
      return event;
    },
  });

  logger.info('Sentry initialisé pour le monitoring d\'erreurs');
} else {
  logger.warn('SENTRY_DSN non configuré - monitoring d\'erreurs désactivé');
}

try {
  validateEnvironment();
} catch (error: any) {
  logger.error('ERREUR CRITIQUE DE SÉCURITÉ:', error);

  if (process.env.SENTRY_DSN) {
    Sentry.captureException(error);
  }

  process.exit(1);
}

const PORT = parseInt(process.env.PORT || '4000', 10);
const server = http.createServer(app);

// SÉCURITÉ: en prod, ALLOWED_ORIGINS doit être défini (pas de fallback permissif)
const allowedOrigins = getAllowedOrigins();

// En développement, accepter toutes les origines localhost et 192.168.*
const isDevelopment = process.env.NODE_ENV !== 'production';

const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (!origin) {
        // React Native / apps natives n'envoient souvent pas de header Origin sur le handshake
        // WebSocket (contrairement au navigateur). L'API HTTP autorise déjà !origin via isOriginAllowed.
        // La sécurité repose sur io.use (JWT obligatoire en prod), pas sur Origin ici.
        return callback(null, true);
      }

      // En développement (ou si NODE_ENV n'est pas défini), accepter toutes les origines localhost et 192.168.*
      if (isDevelopment) {
        if (origin.includes('localhost') || origin.includes('127.0.0.1') || origin.includes('192.168.')) {
          return callback(null, true);
        }
      }

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        logger.warn(`Socket.io CORS bloqué pour origin: ${origin}`, {
          allowedOrigins,
          nodeEnv: process.env.NODE_ENV,
          isDevelopment,
        });
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  },
});

// Auth Socket.IO (obligatoire en production)
// Supporte: 1) JWT backend (app/driver), 2) JWT Supabase (admin dashboard)
io.use(async (socket, next) => {
  const isDevelopment = process.env.NODE_ENV !== 'production';
  const allowUnauthenticated =
    isDevelopment && process.env.ALLOW_UNAUTHENTICATED_SOCKETS === 'true';

  const authToken =
    (socket.handshake.auth as any)?.token ||
    (typeof socket.handshake.query?.token === 'string' ? socket.handshake.query.token : undefined) ||
    (typeof socket.handshake.headers?.authorization === 'string'
      ? socket.handshake.headers.authorization
      : undefined);

  if (!authToken) {
    if (allowUnauthenticated) return next();
    return next(new Error('Unauthorized'));
  }

  const token = authToken.startsWith('Bearer ') ? authToken.slice('Bearer '.length) : authToken;

  // 1) Essayer le JWT backend (app_chrono, driver_chrono)
  try {
    const decoded = verifyAccessToken(token);
    (socket.data as any).user = decoded;
    (socket as any).userId = decoded.id;
    (socket as any).userRole = decoded.role;
    return next();
  } catch {
    // 2) Fallback: JWT Supabase (admin_chrono)
    if (supabaseUrl && supabaseServiceKey) {
      try {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        const { data: { user }, error } = await supabase.auth.getUser(token);
        if (!error && user) {
          let dbUser: { id: string; role: string } | null = null;

          // Essayer PostgreSQL d'abord
          try {
            const result = await (pool as any).query(
              'SELECT id, role FROM users WHERE id = $1 OR email = $2',
              [user.id, user.email ?? '']
            );
            if (result.rows.length > 0) dbUser = result.rows[0];
          } catch (_dbErr) {
            // Fallback: requête via Supabase si PostgreSQL timeout/inaccessible
            const orFilter = user.email
              ? `id.eq.${user.id},email.eq.${user.email}`
              : `id.eq.${user.id}`;
            const { data: supabaseUser } = await supabase
              .from('users')
              .select('id, role')
              .or(orFilter)
              .single();
            if (supabaseUser) dbUser = supabaseUser;
          }

          if (dbUser && (dbUser.role === 'admin' || dbUser.role === 'super_admin')) {
            (socket.data as any).user = { id: dbUser.id, role: dbUser.role };
            (socket as any).userId = dbUser.id;
            (socket as any).userRole = dbUser.role;
            return next();
          }
        }
      } catch {
        // Ignorer, on échoue à la fin
      }
    }
  }

  if (allowUnauthenticated) return next();
  return next(new Error('Unauthorized'));
});

// Initialiser Redis Adapter pour le scaling horizontal (optionnel)
// Si Redis n'est pas disponible, Socket.IO fonctionnera en mode standalone
(async () => {
  const { pubClient: redisPub, subClient: redisSub, isAvailable } = await initializeRedis();
  
  if (isAvailable && redisPub && redisSub) {
    try {
      io.adapter(createAdapter(redisPub, redisSub));
      logger.info('Socket.IO Redis Adapter activé - Scaling horizontal disponible');
    } catch (error: any) {
      logger.error('Erreur lors de l\'activation du Redis Adapter:', error.message);
      logger.warn(' Socket.IO fonctionnera en mode standalone');
    }
  } else {
    logger.info(' Socket.IO fonctionne en mode standalone (Redis non disponible)');
    logger.info('💡 Pour activer le scaling horizontal, configurez REDIS_URL');
  }
})();

io.on('connection', (socket) => {
  logger.info('🟢 Client connecté', { socketId: socket.id });

  // Rooms utiles pour limiter les broadcasts (évite fuite de données)
  const user = (socket.data as any)?.user as { id?: string; role?: string } | undefined;
  if (user?.id) {
    socket.join(`user:${user.id}`);
    if (user.role === 'driver') socket.join('drivers');
    if (user.role === 'admin' || user.role === 'super_admin') socket.join('admins');
  }

  deliverySocket(io, socket);

  socket.on('disconnect', () => {
    logger.info('🔴 Client déconnecté', { socketId: socket.id });
  });
});

setupOrderSocket(io);
setupAdminSocket(io);
setupMessageSocket(io);

app.set('io', io);

// Écouter sur toutes les interfaces (0.0.0.0) pour permettre les connexions depuis Expo Go
// En production, cela permet aussi les connexions depuis n'importe quelle interface réseau
const HOST = process.env.HOST || '0.0.0.0';

server.listen(PORT, HOST, () => {
  logger.info(`🚀 Serveur lancé sur ${HOST}:${PORT}`);
  if (isDevelopment) {
    logger.info(`📱 Accessible depuis Expo Go via: http://192.168.1.96:${PORT}`);
  }

  if (process.env.SENTRY_DSN) {
    logger.info('Monitoring Sentry actif');
  }
});

// Nettoyage propre à l'arrêt du serveur
process.on('SIGTERM', async () => {
  logger.info('🛑 SIGTERM reçu, fermeture propre du serveur...');
  await closeRedis();
  server.close(() => {
    logger.info('Serveur fermé proprement');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  logger.info('🛑 SIGINT reçu, fermeture propre du serveur...');
  await closeRedis();
  server.close(() => {
    logger.info('Serveur fermé proprement');
    process.exit(0);
  });
});
