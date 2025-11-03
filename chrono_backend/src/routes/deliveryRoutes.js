// src/routes/deliveryRoutes.js
import express from 'express';
import {
	createDelivery,
	getUserDeliveries,
	updateDeliveryStatus,
	uploadDeliveryProof,
	cancelOrder
} from '../controllers/deliveryController.js';
import { verifyJWT } from '../middleware/verifyToken.js';
import { validateDeliveryStatus, validateCreateOrder } from '../middleware/validators.js';
import { orderLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// Create delivery (public / user) - Rate limited + Validation
router.post('/', orderLimiter, validateCreateOrder, createDelivery);

// Get deliveries for a user
router.get('/:userId', getUserDeliveries);

// Cancel order (user) - requires JWT
router.post('/:orderId/cancel', verifyJWT, cancelOrder);

// Update delivery status (driver) - requires JWT + Validation
router.post('/:orderId/status', verifyJWT, validateDeliveryStatus, updateDeliveryStatus);

// Upload proof (driver) - requires JWT
router.post('/:orderId/proof', verifyJWT, uploadDeliveryProof);

export default router;
