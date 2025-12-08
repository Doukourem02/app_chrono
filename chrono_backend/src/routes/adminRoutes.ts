import express, { Router } from 'express';
import { cancelAdminOrder, createAdminOrder, createAdminPromoCode, deleteAdminRating, getAdminAdminDetails, getAdminClientDetails, getAdminClientStatistics, getAdminDashboardStats, getAdminDeliveryAnalytics, getAdminDisputes, getAdminDriverDetails, getAdminFinancialStats, getAdminGlobalSearch, getAdminOngoingDeliveries, getAdminOrdersByStatus, getAdminPromoCodes, getAdminRatings, getAdminRecentActivities, getAdminReportClients, getAdminReportDeliveries, getAdminReportDrivers, getAdminReportPayments, getAdminReportRevenues, getAdminTransactions, getAdminUsers, updateAdminDispute, updateAdminDriverStatus } from '../controllers/adminController.js';
import { createConversation, getConversationById, getMessages, getUnreadCount, markMessagesAsRead, sendMessage } from '../controllers/messageController.js';
import { verifyAdminSupabase } from '../middleware/verifyAdminSupabase.js';

const router: Router = express.Router();


router.get('/dashboard-stats', verifyAdminSupabase, getAdminDashboardStats);
router.get('/delivery-analytics', verifyAdminSupabase, getAdminDeliveryAnalytics);
router.get('/recent-activities', verifyAdminSupabase, getAdminRecentActivities);
router.get('/ongoing-deliveries', verifyAdminSupabase, getAdminOngoingDeliveries);
router.get('/orders', verifyAdminSupabase, getAdminOrdersByStatus);
router.post('/orders', verifyAdminSupabase, createAdminOrder);
router.post('/orders/:orderId/cancel', verifyAdminSupabase, cancelAdminOrder);
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
router.get('/messages/conversations/:conversationId', verifyAdminSupabase, getConversationById);
router.post('/messages/conversations', verifyAdminSupabase, createConversation);
router.get('/messages/conversations/:conversationId/messages', verifyAdminSupabase, getMessages);
router.post('/messages/conversations/:conversationId/messages', verifyAdminSupabase, sendMessage);
router.put('/messages/conversations/:conversationId/read', verifyAdminSupabase, markMessagesAsRead);
router.get('/messages/unread-count', verifyAdminSupabase, getUnreadCount);

export default router;

