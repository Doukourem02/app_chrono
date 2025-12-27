import { Router } from 'express';
import { optimizeDeliveryRoute, getZonesWithOrders } from '../controllers/multiDeliveryController.js';
import { verifyJWT } from '../middleware/verifyToken.js';

const router = Router();

router.post('/optimize', verifyJWT, optimizeDeliveryRoute);
router.get('/zones', verifyJWT, getZonesWithOrders);

export default router;

