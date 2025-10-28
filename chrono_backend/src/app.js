// src/app.js
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import userRoutes from './routes/userRoutes.js';
import deliveryRoutes from './routes/deliveryRoutes.js';

dotenv.config();
const app = express();

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => res.send('Chrono Livraison API 🚚'));

// Routes principales
app.use('/api/users', userRoutes);
app.use('/api/deliveries', deliveryRoutes);

export default app;
