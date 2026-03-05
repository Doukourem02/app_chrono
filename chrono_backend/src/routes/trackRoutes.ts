import express, { Router } from 'express';
import { getTrackByToken } from '../controllers/trackController.js';

const router: Router = express.Router();

// Suivi public (sans authentification) - pour le destinataire sans compte Chrono
router.get('/:token', getTrackByToken);

export default router;
