import express, { Router } from 'express';
import { registerPushToken, unregisterPushToken } from '../controllers/pushTokenController.js';
import {
  endLiveActivityToken,
  registerLiveActivityToken,
} from '../controllers/liveActivityTokenController.js';
import { verifyJWT } from '../middleware/verifyToken.js';

const router: Router = express.Router();

router.post('/register', verifyJWT, registerPushToken);
router.delete('/register', verifyJWT, unregisterPushToken);
router.post('/live-activity/register', verifyJWT, registerLiveActivityToken);
router.post('/live-activity/end', verifyJWT, endLiveActivityToken);

export default router;
