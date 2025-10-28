// src/routes/deliveryRoutes.js
import express from 'express';
import { createDelivery, getUserDeliveries } from '../controllers/deliveryController.js';

const router = express.Router();

router.post('/', createDelivery);
router.get('/user/:userId', getUserDeliveries);

export default router;
