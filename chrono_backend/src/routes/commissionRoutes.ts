import express, { Router } from 'express';
import { getCommissionBalance, getCommissionTransactions, rechargeCommission } from '../controllers/commissionController.js';
import { verifyJWT } from '../middleware/verifyToken.js';
import { requireSelfUser } from '../middleware/requireSelfUser.js';

const router: Router = express.Router();

const requireSelf = requireSelfUser('userId');

router.get('/:userId/balance', verifyJWT, requireSelf, getCommissionBalance);
router.get('/:userId/transactions', verifyJWT, requireSelf, getCommissionTransactions);
router.post('/:userId/recharge', verifyJWT, requireSelf, rechargeCommission);

export default router;

