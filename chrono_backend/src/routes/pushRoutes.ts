import express, { Router } from 'express';
import { registerPushToken, unregisterPushToken } from '../controllers/pushTokenController.js';
import { verifyJWT } from '../middleware/verifyToken.js';

const router: Router = express.Router();

router.post('/register', verifyJWT, registerPushToken);
router.delete('/register', verifyJWT, unregisterPushToken);

export default router;
