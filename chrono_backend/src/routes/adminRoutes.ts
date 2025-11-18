import express, { Router } from 'express';
import { getAdminDashboardStats, getAdminDeliveryAnalytics, getAdminRecentActivities, getAdminOngoingDeliveries, getAdminOrdersByStatus, getAdminUsers, getAdminGlobalSearch, getAdminFinancialStats, getAdminTransactions, getAdminReportDeliveries, getAdminReportRevenues, getAdminReportClients, getAdminReportDrivers, getAdminReportPayments, getAdminDriverDetails, updateAdminDriverStatus, getAdminClientDetails, getAdminClientStatistics, getAdminRatings, deleteAdminRating, getAdminPromoCodes, createAdminPromoCode, getAdminDisputes, updateAdminDispute, getAdminAdminDetails } from '../controllers/adminController.js';
import { verifyAdminSupabase } from '../middleware/verifyAdminSupabase.js';

const router: Router = express.Router();

// Toutes les routes admin nécessitent une authentification Supabase avec rôle admin
router.get('/dashboard-stats', verifyAdminSupabase, getAdminDashboardStats);
router.get('/delivery-analytics', verifyAdminSupabase, getAdminDeliveryAnalytics);
router.get('/recent-activities', verifyAdminSupabase, getAdminRecentActivities);
router.get('/ongoing-deliveries', verifyAdminSupabase, getAdminOngoingDeliveries);
router.get('/orders', verifyAdminSupabase, getAdminOrdersByStatus);
router.get('/users', verifyAdminSupabase, getAdminUsers);
router.get('/search', verifyAdminSupabase, getAdminGlobalSearch);
router.get('/financial-stats', verifyAdminSupabase, getAdminFinancialStats);
router.get('/transactions', verifyAdminSupabase, getAdminTransactions);
router.get('/reports/deliveries', verifyAdminSupabase, getAdminReportDeliveries);
router.get('/reports/revenues', verifyAdminSupabase, getAdminReportRevenues);
router.get('/reports/clients', verifyAdminSupabase, getAdminReportClients);
router.get('/reports/drivers', verifyAdminSupabase, getAdminReportDrivers);
router.get('/reports/payments', verifyAdminSupabase, getAdminReportPayments);
router.get('/drivers/:driverId/details', verifyAdminSupabase, getAdminDriverDetails);
router.put('/drivers/:driverId/status', verifyAdminSupabase, updateAdminDriverStatus);
router.get('/clients/:clientId/details', verifyAdminSupabase, getAdminClientDetails);
router.get('/clients/:clientId/statistics', verifyAdminSupabase, getAdminClientStatistics);
router.get('/admins/:adminId/details', verifyAdminSupabase, getAdminAdminDetails);
router.get('/ratings', verifyAdminSupabase, getAdminRatings);
router.delete('/ratings/:ratingId', verifyAdminSupabase, deleteAdminRating);
router.get('/promo-codes', verifyAdminSupabase, getAdminPromoCodes);
router.post('/promo-codes', verifyAdminSupabase, createAdminPromoCode);
router.get('/disputes', verifyAdminSupabase, getAdminDisputes);
router.put('/disputes/:disputeId', verifyAdminSupabase, updateAdminDispute);

export default router;

