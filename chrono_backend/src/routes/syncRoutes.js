import express from 'express';
import { syncUsersFromAuth, checkSyncStatus } from '../controllers/syncController.js';

const router = express.Router();

router.post('/sync-users', syncUsersFromAuth);
router.get('/sync-status', checkSyncStatus);

export default router;