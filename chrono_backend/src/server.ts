import 'dotenv/config';
import * as Sentry from '@sentry/node';
import http from 'http';
import { Server } from 'socket.io';
import { validateEnvironment } from './config/envCheck.js';
import app from './app.js';
import deliverySocket from './sockets/deliverySocket.js';
import { setupOrderSocket } from './sockets/orderSocket.js';
import { setupAdminSocket } from './sockets/adminSocket.js';
import logger from './utils/logger.js';

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
    'exp://localhost:808',
  ];

// En développement, accepter toutes les origines localhost
if (process.env.NODE_ENV === 'development') {
  allowedOrigins.push('http://localhost:*');
}

const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (!origin) {
        // Permettre les connexions sans origin (par exemple depuis Postman ou des outils de test)
        return callback(null, true);
      }

      // En développement, accepter toutes les origines localhost
      if (process.env.NODE_ENV === 'development') {
        if (origin.includes('localhost') || origin.includes('127.0.0.1') || origin.includes('192.168.')) {
          return callback(null, true);
        }
      }

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.warn(`Socket.io CORS bloqué pour origin: ${origin}`);
        console.warn(`Origins autorisées:`, allowedOrigins);
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  },
});

io.on('connection', (socket) => {
  console.log('🟢 Client connecté :', socket.id);
  deliverySocket(io, socket);

  socket.on('disconnect', () => {
    console.log('🔴 Client déconnecté :', socket.id);
  });
});

setupOrderSocket(io);
setupAdminSocket(io);

app.set('io', io);

server.listen(PORT, () => {
  logger.info(`🚀 Serveur lancé sur le port ${PORT}`);

  if (process.env.SENTRY_DSN) {
    logger.info('Monitoring Sentry actif');
  }
});
