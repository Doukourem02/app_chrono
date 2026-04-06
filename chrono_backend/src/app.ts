import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import userRoutes from './routes/userRoutes.js';
import deliveryRoutes from './routes/deliveryRoutes.js';
import authRoutes from './routes/authRoutes.js';
import driverRoutes from './routes/driverRoutes.js';
import ratingRoutes from './routes/ratingRoutes.js';
import syncRoutes from './routes/syncRoutes.js';
import healthRoutes from './routes/healthRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import messageRoutes from './routes/messageRoutes.js';
import qrCodeRoutes from './routes/qrCodeRoutes.js';
import trackRoutes from './routes/trackRoutes.js';
import commissionRoutes from './routes/commissionRoutes.js';
import weatherRoutes from './routes/weatherRoutes.js';
import gamificationRoutes from './routes/gamificationRoutes.js';
import analyticsRoutes from './routes/analyticsRoutes.js';
import supportRoutes from './routes/supportRoutes.js';
import multiDeliveryRoutes from './routes/multiDeliveryRoutes.js';
import demandForecastRoutes from './routes/demandForecastRoutes.js';
import fleetRoutes from './routes/fleetRoutes.js';
import mapboxRoutes from './routes/mapboxRoutes.js';
import pushRoutes from './routes/pushRoutes.js';
import { errorHandler } from './middleware/errorHandler.js';
import { setupSwagger } from './config/swagger.js';
import { isOriginAllowed } from './config/cors.js';
import logger from './utils/logger.js';

const app: Express = express();

// Reverse proxy (Render, etc.) : X-Forwarded-For — requis pour express-rate-limit et req.ip.
// Render ne met pas toujours NODE_ENV=production ; la variable RENDER=true est définie sur Render.
const behindProxy =
  process.env.NODE_ENV === 'production' || process.env.RENDER === 'true';
if (behindProxy) {
  app.set('trust proxy', 1);
}

if (
  process.env.NODE_ENV === 'production' &&
  process.env.FORCE_HTTPS !== 'false'
) {
  app.use((req, res, next) => {
    // Sondes Render (HTTP interne :10000) — pas de redirect, sinon health check timeout
    if (req.path.startsWith('/health')) {
      return next();
    }

    const forwardedProto = req.headers['x-forwarded-proto'];
    const isHttps = req.secure || forwardedProto === 'https';

    if (!isHttps) {
      return res.redirect(301, `https://${req.headers.host}${req.url}`);
    }

    next();
  });
}

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// Avant CORS : les health checks Render n’envoient pas de header Origin (voir doc dépannage Render)
app.use('/health', healthRoutes);

app.use(
  cors({
    origin: (origin, callback) => {
      if (isOriginAllowed(origin)) {
        callback(null, true);
      } else {
        logger.warn(`CORS bloqué pour origin: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  })
);

app.use(cookieParser());

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.get('/', (_req, res) => res.send('Krono API'));

if (
  process.env.NODE_ENV !== 'production' ||
  process.env.SWAGGER_ENABLED === 'true'
) {
  setupSwagger(app);
}

app.use('/api/users', userRoutes);
app.use('/api/deliveries', deliveryRoutes);
app.use('/api/auth-simple', authRoutes);
app.use('/api/drivers', driverRoutes);
app.use('/api/ratings', ratingRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api', qrCodeRoutes);
app.use('/api/track', trackRoutes);
app.use('/api/commission', commissionRoutes);
app.use('/api/weather', weatherRoutes);
app.use('/api/gamification', gamificationRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/multi-delivery', multiDeliveryRoutes);
app.use('/api/forecast', demandForecastRoutes);
app.use('/api/fleet', fleetRoutes);
app.use('/api/mapbox', mapboxRoutes);
app.use('/api/push', pushRoutes);

app.use(errorHandler);

export default app;
