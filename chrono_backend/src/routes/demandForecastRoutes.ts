import { Router } from 'express';
import { getDemandForecast, getPeakHours, getZoneRecommendations } from '../controllers/demandForecastController.js';
import { verifyJWT } from '../middleware/verifyToken.js';

const router = Router();

router.get('/demand', verifyJWT, getDemandForecast);
router.get('/peaks', verifyJWT, getPeakHours);
router.get('/recommendations', verifyJWT, getZoneRecommendations);

export default router;

