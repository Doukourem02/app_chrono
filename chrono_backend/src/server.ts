import 'dotenv/config';
import * as Sentry from '@sentry/node';
import http from 'http';
import { Server } from 'socket.io';
import { validateEnvironment } from './config/envCheck.js';
import app from './app.js';
import deliverySocket from './sockets/deliverySocket.js';
import { setupOrderSocket } from './sockets/orderSocket.js';
import logger from './utils/logger.js';

// 🔍 SENTRY: Initialiser le monitoring d'erreurs
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0, // 10% en prod, 100% en dev
    // Filtrer les erreurs à ne pas envoyer
    beforeSend(event, hint) {
      // Ne pas envoyer les erreurs de validation (400)
      if (event.request?.headers?.['x-status-code'] === '400') {
        return null;
      }
      return event;
    },
  });
  logger.info('✅ Sentry initialisé pour le monitoring d\'erreurs');
} else {
  logger.warn('⚠️ SENTRY_DSN non configuré - monitoring d\'erreurs désactivé');
}

// 🔒 SÉCURITÉ: Valider les variables d'environnement au démarrage
try {
  validateEnvironment();
} catch (error: any) {
  logger.error('❌ ERREUR CRITIQUE DE SÉCURITÉ:', error);
  if (process.env.SENTRY_DSN) {
    Sentry.captureException(error);
  }
  process.exit(1);
}

const PORT = process.env.PORT || 4000;
const server = http.createServer(app);

const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
  'http://localhost:8081',
  'http://localhost:19006',
  'exp://localhost:8081'
];

const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      // Autoriser les requêtes sans origin
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.warn(`⚠️ Socket.io CORS bloqué pour origin: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true
  }
});

io.on('connection', (socket) => {
  console.log('🟢 Client connecté :', socket.id);

  deliverySocket(io, socket);

  socket.on('disconnect', () => {
    console.log('🔴 Client déconnecté :', socket.id);
  });
});

setupOrderSocket(io);

app.set('io', io);

server.listen(PORT, () => {
  logger.info(`🚀 Serveur lancé sur le port ${PORT}`);
  if (process.env.SENTRY_DSN) {
    logger.info('🔍 Monitoring Sentry actif');
  }
});

