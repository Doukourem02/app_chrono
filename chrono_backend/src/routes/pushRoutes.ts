import express, { Router } from 'express';
import { registerPushToken } from '../controllers/pushTokenController.js';
import { verifyJWT } from '../middleware/verifyToken.js';

const router: Router = express.Router();

router.post('/register', verifyJWT, registerPushToken);

export default router;
