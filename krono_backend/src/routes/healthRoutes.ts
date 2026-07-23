import express, { Router, Request, Response, NextFunction } from 'express';
import {healthCheck,livenessCheck,readinessCheck,} from '../controllers/healthController.js';
import { advancedHealthCheck } from '../controllers/advancedHealthController.js';

const router: Router = express.Router();

function requireHealthSecret(req: Request, res: Response, next: NextFunction): void {
  const secret = process.env.HEALTH_SECRET;
  if (secret && req.headers['x-health-secret'] !== secret) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  next();
}

router.get('/', healthCheck);
router.get('/live', livenessCheck);
router.get('/ready', readinessCheck);
router.get('/advanced', requireHealthSecret, advancedHealthCheck);

export default router;
