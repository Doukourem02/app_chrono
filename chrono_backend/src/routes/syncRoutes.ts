import express, { Router } from 'express';
import { syncUsersFromAuth, checkSyncStatus } from '../controllers/syncController.js';

const router: Router = express.Router();

router.post('/sync-users', syncUsersFromAuth);
router.get('/sync-status', checkSyncStatus);

export default router;

