import express, { Router } from 'express';
import {
  getTrackByToken,
  getTrackVapidPublicKey,
  postTrackPushSubscribe,
} from '../controllers/trackController.js';

const router: Router = express.Router();

// Routes spécifiques avant /:token
router.get('/:token/vapid-public-key', getTrackVapidPublicKey);
router.post('/:token/push-subscribe', express.json({ limit: '32kb' }), postTrackPushSubscribe);

// Suivi public (sans authentification) - pour le destinataire sans compte Chrono
router.get('/:token', getTrackByToken);

export default router;
