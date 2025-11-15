import express, { Router } from 'express';
import {healthCheck,livenessCheck,readinessCheck,} from '../controllers/healthController.js';
import { advancedHealthCheck } from '../controllers/advancedHealthController.js';

const router: Router = express.Router();

router.get('/', healthCheck);
router.get('/live', livenessCheck);
router.get('/ready', readinessCheck);
router.get('/advanced', advancedHealthCheck);

export default router;
