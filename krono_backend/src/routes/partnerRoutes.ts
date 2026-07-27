import express, { Router } from 'express';
import { verifyAdminSupabase } from '../middleware/verifyAdminSupabase.js';
import { requireSuperAdmin } from '../middleware/requireSuperAdmin.js';
import { verifyPartnerUser } from '../middleware/verifyPartnerUser.js';
import {createPartner,listPartners,getPartner,activatePartner,updatePartnerStatus,deletePartner,registerAsPartner,deregisterAsPartner,setBusinessMode,updatePartnerPreferences,} from '../controllers/partnerCrudController.js';
import { mergePartners } from '../controllers/partnerMergeController.js';
import {createSubscription,activateSubscription,getPartnerUsage,getPartnerInvoices,markPartnerInvoicePaid,} from '../controllers/partnerSubscriptionController.js';
import {invitePartnerUser,getPartnerUsers,invitePortalUser,removePartnerUser,} from '../controllers/partnerUserController.js';
import {getPartnerDrivers,addPartnerDriver,removePartnerDriver,setDefaultPartnerDriver,createPartnerDriverRequest,listPartnerDriverRequests,reviewPartnerDriverRequest,} from '../controllers/partnerDriverController.js';
import {getPartnerOrderTracking,getPartnerOrderQRCode,} from '../controllers/partnerController.js';
import verifyJWT from '../middleware/verifyToken.js';

const router: Router = express.Router();

// ── Routes utilisateur authentifié ──────────────────────────────────────────
router.post('/register',                                  verifyJWT, registerAsPartner);
router.post('/deregister',                                verifyJWT, deregisterAsPartner);
router.patch('/business-mode',                            verifyJWT, setBusinessMode);

// ── Routes admin (verifyAdminSupabase) ──────────────────────────────────────
router.post('/',                                          verifyAdminSupabase, requireSuperAdmin, createPartner);
router.get('/',                                           verifyAdminSupabase, listPartners);
router.get('/:id',                                        verifyAdminSupabase, getPartner);
router.post('/:id/subscriptions',                         verifyAdminSupabase, requireSuperAdmin, createSubscription);
router.patch('/:id/subscriptions/:subId/activate',        verifyAdminSupabase, requireSuperAdmin, activateSubscription);
router.patch('/:id/activate',                             verifyAdminSupabase, requireSuperAdmin, activatePartner);
router.patch('/:id/status',                               verifyAdminSupabase, requireSuperAdmin, updatePartnerStatus);
router.delete('/:id',                                     verifyAdminSupabase, requireSuperAdmin, deletePartner);
router.post('/:id/merge',                                 verifyAdminSupabase, requireSuperAdmin, mergePartners);
router.get('/:id/drivers',                                verifyAdminSupabase, getPartnerDrivers);
router.post('/:id/drivers',                               verifyAdminSupabase, addPartnerDriver);
router.delete('/:id/drivers/:driverUserId',               verifyAdminSupabase, removePartnerDriver);
router.patch('/:id/drivers/:driverUserId/default',        verifyAdminSupabase, setDefaultPartnerDriver);
router.get('/:id/driver-requests',                        verifyAdminSupabase, listPartnerDriverRequests);
router.patch('/:id/driver-requests/:requestId',           verifyAdminSupabase, reviewPartnerDriverRequest);
router.get('/:id/usage',                                  verifyAdminSupabase, getPartnerUsage);
router.get('/:id/invoices',                               verifyAdminSupabase, getPartnerInvoices);
router.patch('/:id/invoices/:invoiceId/pay',              verifyAdminSupabase, requireSuperAdmin, markPartnerInvoicePaid);
router.post('/:id/invite',                                verifyAdminSupabase, invitePartnerUser);

// ── Routes portail partenaire (verifyPartnerUser) ────────────────────────────
// Même données mais accessibles par les owners/managers du partenaire
// Montées sous /api/partner/:partnerId/...
export const partnerPortalRouter: Router = express.Router({ mergeParams: true });

partnerPortalRouter.get('/details',      verifyPartnerUser, getPartner);
partnerPortalRouter.get('/usage',        verifyPartnerUser, getPartnerUsage);
partnerPortalRouter.get('/invoices',     verifyPartnerUser, getPartnerInvoices);
partnerPortalRouter.get('/users',                    verifyPartnerUser, getPartnerUsers);
partnerPortalRouter.post('/users/invite',             verifyPartnerUser, invitePortalUser);
partnerPortalRouter.delete('/users/:memberId',        verifyPartnerUser, removePartnerUser);
partnerPortalRouter.get('/drivers',                   verifyPartnerUser, getPartnerDrivers);
partnerPortalRouter.post('/driver-requests',          verifyPartnerUser, createPartnerDriverRequest);
partnerPortalRouter.get('/orders/:orderId/tracking',  verifyPartnerUser, getPartnerOrderTracking);
partnerPortalRouter.get('/orders/:orderId/qr-code',   verifyPartnerUser, getPartnerOrderQRCode);
partnerPortalRouter.patch('/preferences',             verifyPartnerUser, updatePartnerPreferences);

export default router;
