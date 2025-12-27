import { Router } from 'express';
import { getRealTimeKPIs, getPerformanceData, exportAnalytics } from '../controllers/analyticsController.js';
import { verifyAdminSupabase } from '../middleware/verifyAdminSupabase.js';

const router = Router();

router.get('/kpis', verifyAdminSupabase, getRealTimeKPIs);
router.get('/performance', verifyAdminSupabase, getPerformanceData);
router.get('/export', verifyAdminSupabase, exportAnalytics);

export default router;

