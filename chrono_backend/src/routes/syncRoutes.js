import express from 'express';
import { syncUsersFromAuth, checkSyncStatus } from '../controllers/syncController.js';

const router = express.Router();

// 🔄 Synchroniser tous les utilisateurs Auth vers PostgreSQL
router.post('/sync-users', syncUsersFromAuth);

// 📊 Vérifier l'état de la synchronisation
router.get('/sync-status', checkSyncStatus);

export default router;