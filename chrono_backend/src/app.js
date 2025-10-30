import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import userRoutes from './routes/userRoutes.js';
import deliveryRoutes from './routes/deliveryRoutes.js';
import authRoutes from './routes/authRoutes.js'; 
import driverRoutes from './routes/driverRoutes.js'; // 🚗 NOUVEAU
import syncRoutes from './routes/syncRoutes.js'; 

dotenv.config();
const app = express();

app.use(cors());
app.use(express.json());
app.get('/', (req, res) => res.send('Chrono Livraison API 🚚'));
app.use('/api/users', userRoutes);
app.use('/api/deliveries', deliveryRoutes);
app.use('/api/auth-simple', authRoutes); 
app.use('/api/drivers', driverRoutes); // 🚗 NOUVEAU
app.use('/api/sync', syncRoutes); 

export default app;
