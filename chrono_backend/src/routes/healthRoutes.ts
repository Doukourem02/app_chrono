import express, { Router } from 'express';
import {healthCheck,livenessCheck,readinessCheck,} from '../controllers/healthController.js';

const router: Router = express.Router();

router.get('/', healthCheck);
router.get('/live', livenessCheck);
router.get('/ready', readinessCheck);

export default router;
