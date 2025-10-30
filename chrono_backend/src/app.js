// src/app.js
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import userRoutes from './routes/userRoutes.js';
import deliveryRoutes from './routes/deliveryRoutes.js';
import authRoutes from './routes/authRoutes.js';
import authRoutesDB from './routes/authRoutesDB.js';
import authRoutesSimple from './routes/authRoutesSimple.js'; // 🎯 SOLUTION SIMPLE

dotenv.config();
const app = express();

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => res.send('Chrono Livraison API 🚚'));

// Routes principales
app.use('/api/users', userRoutes);
app.use('/api/deliveries', deliveryRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/auth-db', authRoutesDB);
app.use('/api/auth-simple', authRoutesSimple); // 🎯 SOLUTION SIMPLE !

export default app;
