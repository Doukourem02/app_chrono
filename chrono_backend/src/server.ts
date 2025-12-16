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

const PORT = process.env.PORT || 4000;
const server = http.createServer(app);

const allowedOrigins =
  process.env.ALLOWED_ORIGINS?.split(',') || [
    'http://localhost:808',
    'http://localhost:9006',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://192.168.1.85:3000',
    'http://192.168.1.91:3000', // Ajout explicite de cette IP
    'exp://localhost:808',
  ];

// En développement, accepter toutes les origines localhost et 192.168.*
const isDevelopment = process.env.NODE_ENV !== 'production';

const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (!origin) {
        // Permettre les connexions sans origin (par exemple depuis Postman ou des outils de test)
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
        console.warn(`Socket.io CORS bloqué pour origin: ${origin}`);
        console.warn(`Origins autorisées:`, allowedOrigins);
        console.warn(`NODE_ENV: ${process.env.NODE_ENV}, isDevelopment: ${isDevelopment}`);
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  },
});

// Initialiser Redis Adapter pour le scaling horizontal (optionnel)
// Si Redis n'est pas disponible, Socket.IO fonctionnera en mode standalone
(async () => {
  const { pubClient: redisPub, subClient: redisSub, isAvailable } = await initializeRedis();
  
  if (isAvailable && redisPub && redisSub) {
    try {
      io.adapter(createAdapter(redisPub, redisSub));
      logger.info('✅ Socket.IO Redis Adapter activé - Scaling horizontal disponible');
    } catch (error: any) {
      logger.error('❌ Erreur lors de l\'activation du Redis Adapter:', error.message);
      logger.warn('⚠️  Socket.IO fonctionnera en mode standalone');
    }
  } else {
    logger.info('ℹ️  Socket.IO fonctionne en mode standalone (Redis non disponible)');
    logger.info('💡 Pour activer le scaling horizontal, configurez REDIS_URL');
  }
})();

io.on('connection', (socket) => {
  console.log('🟢 Client connecté :', socket.id);
  deliverySocket(io, socket);

  socket.on('disconnect', () => {
    console.log('🔴 Client déconnecté :', socket.id);
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
    logger.info('✅ Serveur fermé proprement');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  logger.info('🛑 SIGINT reçu, fermeture propre du serveur...');
  await closeRedis();
  server.close(() => {
    logger.info('✅ Serveur fermé proprement');
    process.exit(0);
  });
});
