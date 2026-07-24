import express, { Router } from 'express';
import {getUserDeliveries,updateDeliveryStatus,uploadDeliveryProof,cancelOrder,getUserStatistics,} from '../controllers/deliveryController.js';
import { verifyJWT } from '../middleware/verifyToken.js';
import {validateDeliveryStatus,} from '../middleware/validators.js';

const router: Router = express.Router();

router.get('/:userId', verifyJWT, getUserDeliveries);
router.get('/:userId/statistics', verifyJWT, getUserStatistics);
router.post('/:orderId/cancel', verifyJWT, cancelOrder);
router.post('/:orderId/status', verifyJWT, validateDeliveryStatus, updateDeliveryStatus);
router.post('/:orderId/proof', verifyJWT, uploadDeliveryProof);

export default router;
