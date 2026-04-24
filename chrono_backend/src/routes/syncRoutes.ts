import express, { Router } from 'express';
import { syncUsersFromAuth, checkSyncStatus } from '../controllers/syncController.js';
import { verifyAdminSupabase } from '../middleware/verifyAdminSupabase.js';

const router: Router = express.Router();

// SÉCURITÉ go-live : ces endpoints exposaient données / actions sans auth (voir docs/krono-reference-unique.md).
router.post('/sync-users', verifyAdminSupabase, syncUsersFromAuth);
router.get('/sync-status', verifyAdminSupabase, checkSyncStatus);

export default router;
