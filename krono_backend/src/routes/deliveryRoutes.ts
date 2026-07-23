import express, { Router } from 'express';
import {createDelivery,getUserDeliveries,updateDeliveryStatus,uploadDeliveryProof,cancelOrder,getUserStatistics,} from '../controllers/deliveryController.js';
import { verifyJWT } from '../middleware/verifyToken.js';
import {validateDeliveryStatus,validateCreateOrder,} from '../middleware/validators.js';
import { orderLimiter } from '../middleware/rateLimiter.js';

const router: Router = express.Router();

router.post('/', verifyJWT, orderLimiter, validateCreateOrder, createDelivery);
router.get('/:userId', verifyJWT, getUserDeliveries);
router.get('/:userId/statistics', verifyJWT, getUserStatistics);
router.post('/:orderId/cancel', verifyJWT, cancelOrder);
router.post('/:orderId/status', verifyJWT, validateDeliveryStatus, updateDeliveryStatus);
router.post('/:orderId/proof', verifyJWT, uploadDeliveryProof);

export default router;
