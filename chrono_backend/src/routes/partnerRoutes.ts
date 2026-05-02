import express, { Router } from 'express';
import { verifyAdminSupabase } from '../middleware/verifyAdminSupabase.js';
import { verifyPartnerUser } from '../middleware/verifyPartnerUser.js';
import {
  createPartner,
  listPartners,
  getPartner,
  createSubscription,
  activateSubscription,
  getPartnerUsage,
  getPartnerInvoices,
  invitePartnerUser,
} from '../controllers/partnerController.js';

const router: Router = express.Router();

// ── Routes admin (verifyAdminSupabase) ──────────────────────────────────────
router.post('/',                                          verifyAdminSupabase, createPartner);
router.get('/',                                           verifyAdminSupabase, listPartners);
router.get('/:id',                                        verifyAdminSupabase, getPartner);
router.post('/:id/subscriptions',                         verifyAdminSupabase, createSubscription);
router.patch('/:id/subscriptions/:subId/activate',        verifyAdminSupabase, activateSubscription);
router.get('/:id/usage',                                  verifyAdminSupabase, getPartnerUsage);
router.get('/:id/invoices',                               verifyAdminSupabase, getPartnerInvoices);
router.post('/:id/invite',                                verifyAdminSupabase, invitePartnerUser);

// ── Routes portail partenaire (verifyPartnerUser) ────────────────────────────
// Même données mais accessibles par les owners/managers du partenaire
// Montées sous /api/partner/:partnerId/...
export const partnerPortalRouter: Router = express.Router({ mergeParams: true });

partnerPortalRouter.get('/details',  verifyPartnerUser, getPartner);
partnerPortalRouter.get('/usage',    verifyPartnerUser, getPartnerUsage);
partnerPortalRouter.get('/invoices', verifyPartnerUser, getPartnerInvoices);

export default router;
