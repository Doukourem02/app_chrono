import express from 'express';
import cors from 'cors';
import userRoutes from './routes/userRoutes.js';
import deliveryRoutes from './routes/deliveryRoutes.js';
import authRoutes from './routes/authRoutes.js'; 
import driverRoutes from './routes/driverRoutes.js'; // 🚗 NOUVEAU
import syncRoutes from './routes/syncRoutes.js'; 
import { errorHandler } from './middleware/errorHandler.js';
const app = express();

// 🔒 CORS sécurisé - Origines autorisées uniquement
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

app.use(express.json());
app.get('/', (req, res) => res.send('Chrono Livraison API 🚚'));
app.use('/api/users', userRoutes);
app.use('/api/deliveries', deliveryRoutes);
app.use('/api/auth-simple', authRoutes); 
app.use('/api/drivers', driverRoutes); // 🚗 NOUVEAU
app.use('/api/sync', syncRoutes); 

// Middleware de gestion d'erreurs global (doit être en dernier)
app.use(errorHandler);

export default app;
