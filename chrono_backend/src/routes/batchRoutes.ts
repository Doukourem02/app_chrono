import express, { Router } from 'express';
import verifyJWT from '../middleware/verifyToken.js';
import {createBatch,getBatch,validateBatchOrder,confirmBatchPickup,} from '../controllers/batchController.js';

const router: Router = express.Router();

router.post('/',                              verifyJWT, createBatch);
router.get('/:id',                            verifyJWT, getBatch);
router.patch('/:id/pickup',                   verifyJWT, confirmBatchPickup);
router.patch('/:id/orders/:orderId',          verifyJWT, validateBatchOrder);

export default router;
