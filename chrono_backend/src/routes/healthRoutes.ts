import express, { Router } from 'express';
import { healthCheck, livenessCheck, readinessCheck } from '../controllers/healthController.js';

const router: Router = express.Router();

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Health check général
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Service opérationnel
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 uptime:
 *                   type: number
 *                   example: 3600
 */
router.get('/', healthCheck);

/**
 * @swagger
 * /health/live:
 *   get:
 *     summary: Liveness probe (Kubernetes)
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Service vivant
 *       503:
 *         description: Service non disponible
 */
router.get('/live', livenessCheck);

/**
 * @swagger
 * /health/ready:
 *   get:
 *     summary: Readiness probe (Kubernetes)
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Service prêt
 *       503:
 *         description: Service non prêt
 */
router.get('/ready', readinessCheck);

export default router;
