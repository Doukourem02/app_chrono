import express, { Router } from 'express';
import { createPaymentMethod, getPaymentMethods, calculatePrice,initiatePayment,checkPayment,getTransactions,createDispute,getDeferredPaymentLimits,getDeferredDebts,} from '../controllers/paymentController.js';
import { apiLimiter, orderLimiter } from '../middleware/rateLimiter.js';
import { verifyJWT } from '../middleware/verifyToken.js';

const router: Router = express.Router();


router.post('/methods', verifyJWT, apiLimiter, createPaymentMethod);
router.get('/methods', verifyJWT, apiLimiter, getPaymentMethods); 
router.post('/calculate-price', calculatePrice); 
router.post('/initiate', verifyJWT, orderLimiter, initiatePayment);
router.get('/transactions', verifyJWT, apiLimiter, getTransactions);
router.get('/transactions/:transactionId', verifyJWT, apiLimiter, checkPayment); 
router.post('/disputes', verifyJWT, apiLimiter, createDispute);
router.get('/deferred/limits', verifyJWT, apiLimiter, getDeferredPaymentLimits);
router.get('/deferred/debts', verifyJWT, apiLimiter, getDeferredDebts);

export default router;

