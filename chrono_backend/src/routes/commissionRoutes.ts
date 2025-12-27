import express, { Router } from 'express';
import { getCommissionBalance, getCommissionTransactions, rechargeCommission } from '../controllers/commissionController.js';
import { verifyJWT } from '../middleware/verifyToken.js';

const router: Router = express.Router();


router.get('/:userId/balance', verifyJWT, getCommissionBalance);
router.get('/:userId/transactions', verifyJWT, getCommissionTransactions);
router.post('/:userId/recharge', verifyJWT, rechargeCommission);

export default router;

