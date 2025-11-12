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
import { errorHandler } from './middleware/errorHandler.js';
import { setupSwagger } from './config/swagger.js';

const app: Express = express();

// 🔒 SÉCURITÉ: Forcer HTTPS en production
if (process.env.NODE_ENV === 'production' && process.env.FORCE_HTTPS !== 'false') {
  app.use((req, res, next) => {
    // Vérifier si la requête vient derrière un proxy (comme Heroku, AWS, etc.)
    const forwardedProto = req.headers['x-forwarded-proto'];
    const isHttps = req.secure || forwardedProto === 'https';
    
    if (!isHttps) {
      return res.redirect(301, `https://${req.headers.host}${req.url}`);
    }
    next();
  });
}

// 🔒 Sécurité: Headers HTTP sécurisés
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000, // 1 an
    includeSubDomains: true,
    preload: true
  },
  crossOriginEmbedderPolicy: false, // Désactivé pour Socket.IO
  crossOriginResourcePolicy: { policy: "cross-origin" } // Pour les APIs
}));

const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
  'http://localhost:8081',
  'http://localhost:19006',
  'exp://localhost:8081'
];

app.use(cors({
  origin: (origin, callback) => {
    // Autoriser les requêtes sans origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`⚠️ CORS bloqué pour origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

// Cookie parser pour les sessions et tokens
app.use(cookieParser());

// Limiter la taille des requêtes pour éviter les attaques DoS
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.get('/', (_req, res) => res.send('Chrono Livraison API 🚚'));

// 📚 Documentation API Swagger (disponible uniquement en développement ou si SWAGGER_ENABLED=true)
if (process.env.NODE_ENV !== 'production' || process.env.SWAGGER_ENABLED === 'true') {
  setupSwagger(app);
}

// Health check endpoints (avant les autres routes pour monitoring)
app.use('/health', healthRoutes);

app.use('/api/users', userRoutes);
app.use('/api/deliveries', deliveryRoutes);
app.use('/api/auth-simple', authRoutes); 
app.use('/api/drivers', driverRoutes); 
app.use('/api/ratings', ratingRoutes); 
app.use('/api/sync', syncRoutes);
app.use('/api/payments', paymentRoutes); 

// Middleware de gestion d'erreurs (doit être en dernier)
app.use(errorHandler);

export default app;

