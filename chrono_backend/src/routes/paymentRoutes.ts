import express, { Router } from 'express';
import { createPaymentMethod, getPaymentMethods, setDefaultPaymentMethod, deletePaymentMethod, calculatePrice,initiatePayment,checkPayment,getTransactions,createDispute,getDeferredPaymentLimits,getDeferredDebts,repayDeferred,} from '../controllers/paymentController.js';
import { apiLimiter, orderLimiter } from '../middleware/rateLimiter.js';
import { verifyJWT } from '../middleware/verifyToken.js';

const router: Router = express.Router();


router.post('/methods', verifyJWT, apiLimiter, createPaymentMethod);
router.get('/methods', verifyJWT, apiLimiter, getPaymentMethods);
router.patch('/methods/:methodId/default', verifyJWT, apiLimiter, setDefaultPaymentMethod);
router.delete('/methods/:methodId', verifyJWT, apiLimiter, deletePaymentMethod);
router.post('/calculate-price', calculatePrice); 
router.post('/initiate', verifyJWT, orderLimiter, initiatePayment);
router.get('/transactions', verifyJWT, apiLimiter, getTransactions);
router.get('/transactions/:transactionId', verifyJWT, apiLimiter, checkPayment); 
router.post('/disputes', verifyJWT, apiLimiter, createDispute);
router.get('/deferred/limits', verifyJWT, apiLimiter, getDeferredPaymentLimits);
router.get('/deferred/debts', verifyJWT, apiLimiter, getDeferredDebts);
router.post('/deferred/repay', verifyJWT, apiLimiter, repayDeferred);

export default router;

