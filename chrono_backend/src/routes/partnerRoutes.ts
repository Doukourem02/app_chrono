import express, { Router } from 'express';
import { verifyAdminSupabase } from '../middleware/verifyAdminSupabase.js';
import { verifyPartnerUser } from '../middleware/verifyPartnerUser.js';
import {createPartner,listPartners,getPartner,createSubscription,activateSubscription,getPartnerUsage,getPartnerInvoices,invitePartnerUser,registerAsPartner,activatePartner,deregisterAsPartner,updatePartnerStatus,getPartnerUsers,invitePortalUser,deletePartner,setBusinessMode,removePartnerUser,getPartnerDrivers,getPartnerDriversForUser,updatePartnerPreferences,} from '../controllers/partnerController.js';
import verifyJWT from '../middleware/verifyToken.js';

const router: Router = express.Router();

// ── Routes utilisateur authentifié ──────────────────────────────────────────
router.post('/register',                                  verifyJWT, registerAsPartner);
router.post('/deregister',                                verifyJWT, deregisterAsPartner);
router.patch('/business-mode',                            verifyJWT, setBusinessMode);

// ── Routes admin (verifyAdminSupabase) ──────────────────────────────────────
router.post('/',                                          verifyAdminSupabase, createPartner);
router.get('/',                                           verifyAdminSupabase, listPartners);
router.get('/:id',                                        verifyAdminSupabase, getPartner);
router.post('/:id/subscriptions',                         verifyAdminSupabase, createSubscription);
router.patch('/:id/subscriptions/:subId/activate',        verifyAdminSupabase, activateSubscription);
router.patch('/:id/activate',                             verifyAdminSupabase, activatePartner);
router.patch('/:id/status',                               verifyAdminSupabase, updatePartnerStatus);
router.delete('/:id',                                     verifyAdminSupabase, deletePartner);
router.get('/:id/drivers',                                verifyJWT, getPartnerDriversForUser);
router.get('/:id/usage',                                  verifyAdminSupabase, getPartnerUsage);
router.get('/:id/invoices',                               verifyAdminSupabase, getPartnerInvoices);
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
partnerPortalRouter.patch('/preferences',             verifyPartnerUser, updatePartnerPreferences);

export default router;
