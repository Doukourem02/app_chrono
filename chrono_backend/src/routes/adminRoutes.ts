import express, { Router } from 'express';
import { getAdminDashboardStats, getAdminDeliveryAnalytics, getAdminRecentActivities, getAdminOngoingDeliveries, getAdminOrdersByStatus, getAdminUsers } from '../controllers/adminController.js';
import { verifyAdminSupabase } from '../middleware/verifyAdminSupabase.js';

const router: Router = express.Router();

// Toutes les routes admin nécessitent une authentification Supabase avec rôle admin
router.get('/dashboard-stats', verifyAdminSupabase, getAdminDashboardStats);
router.get('/delivery-analytics', verifyAdminSupabase, getAdminDeliveryAnalytics);
router.get('/recent-activities', verifyAdminSupabase, getAdminRecentActivities);
router.get('/ongoing-deliveries', verifyAdminSupabase, getAdminOngoingDeliveries);
router.get('/orders', verifyAdminSupabase, getAdminOrdersByStatus);
router.get('/users', verifyAdminSupabase, getAdminUsers);

export default router;

