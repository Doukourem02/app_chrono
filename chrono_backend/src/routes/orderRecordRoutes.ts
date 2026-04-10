import express, { Router } from 'express';
import { verifyJWT } from '../middleware/verifyToken.js';
import { orderLimiter } from '../middleware/rateLimiter.js';
import { createOrderRecord } from '../controllers/orderRecordController.js';

const router: Router = express.Router();

router.post('/record', verifyJWT, orderLimiter, createOrderRecord);

export default router;
