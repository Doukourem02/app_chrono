import express, { Router } from 'express';
import { createPaymentMethod, getPaymentMethods, calculatePrice,initiatePayment,checkPayment,getTransactions,createDispute,getDeferredPaymentLimits,getDeferredDebts,} from '../controllers/paymentController.js';
import { authLimiter } from '../middleware/rateLimiter.js'; const router: Router = express.Router(); // Méthodes de paiement


router.post('/methods', authLimiter, createPaymentMethod);
router.get('/methods', authLimiter, getPaymentMethods); 
router.post('/calculate-price', calculatePrice); 
router.post('/initiate', authLimiter, initiatePayment);
router.get('/transactions', authLimiter, getTransactions);
router.get('/transactions/:transactionId', authLimiter, checkPayment); 
router.post('/disputes', authLimiter, createDispute);
router.get('/deferred/limits', authLimiter, getDeferredPaymentLimits);
router.get('/deferred/debts', authLimiter, getDeferredDebts);

export default router;

